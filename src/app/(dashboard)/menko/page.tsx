import { redirect } from "next/navigation";
import Link from "next/link";
import { MenkoDashboardTabs, type UnitRecapRow } from "@/components/dashboard/menko-dashboard-tabs";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME, formatRoleName } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isInternPublishedStatus, isPublishedStatus } from "@/lib/period-status";
import type { PerformanceInsights } from "@/components/dashboard/performance-insights-card";
import type { IndicatorScoreItem } from "@/components/dashboard/indicator-breakdown-chart";
import type { MemberCumulativeRow, MemberPeriodScore } from "@/components/dashboard/member-cumulative-table";

export const dynamic = "force-dynamic";

const STAFF_CUMULATIVE_DIVISOR = 8;
const INTERN_CUMULATIVE_DIVISOR = 3;

const BULAN_SHORT: Record<number, string> = {
  1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "Mei", 6: "Jun",
  7: "Jul", 8: "Agu", 9: "Sep", 10: "Okt", 11: "Nov", 12: "Des",
};

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();
  const isPjKemenkoan = menkoProfile.role === "pj_kementerian" && menkoProfile.is_pj_kemenkoan === true;
  const canViewInternTab = menkoProfile.role === "menko" || menkoProfile.role === "admin";

  // Allow Menko, Admin, and PJ Kemenkoan to access recap page.
  if (!(menkoProfile.role === "menko" || menkoProfile.role === "admin" || isPjKemenkoan)) {
    redirect(ROLE_HOME[menkoProfile.role] ?? "/dashboard");
  }

  const { data: allPeriods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status, intern_status")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  const periodById = new Map((allPeriods ?? []).map((p) => [p.id, p]));
  const staffPublishedPeriods = (allPeriods ?? []).filter((p) => isPublishedStatus(p.status));
  const internPublishedPeriods = (allPeriods ?? []).filter((p) => isInternPublishedStatus(p.intern_status));

  const latestPublished = staffPublishedPeriods[0];

  const { data: coordinatedUnits } = isPjKemenkoan
    ? await supabase
        .from("ref_units")
        .select("id, nama_unit")
        .in(
          "parent_id",
          (
            await supabase
              .from("pj_assignments")
              .select("target_unit_id")
              .eq("nim", menkoProfile.nim)
              .eq("scope", "kemenko")
              .eq("is_active", true)
          ).data?.map((item) => item.target_unit_id) ?? ["00000000-0000-0000-0000-000000000000"],
        )
    : menkoProfile.role === "admin"
      ? await supabase
          .from("ref_units")
          .select("id, nama_unit")
          .in("kategori", ["kementerian", "biro"])
      : await supabase
          .from("ref_units")
          .select("id, nama_unit")
          .eq("parent_id", menkoProfile.unit_id);

  const unitIds = (coordinatedUnits ?? []).map((unit) => unit.id);
  const unitNameById = new Map((coordinatedUnits ?? []).map((unit) => [unit.id, unit.nama_unit]));

  // Fetch both regular staff and internship profiles
  const [{ data: staffProfiles }, { data: internProfiles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id, role")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
      .in("role", ["staff", "user", "pj_kementerian", "the_meridian"])
      .order("nama_lengkap"),
    canViewInternTab
      ? supabase
          .from("profiles")
          .select("nim, nama_lengkap, unit_id, role")
          .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
          .in("role", ["internship", "pj_ppm_intern"])
          .order("nama_lengkap")
      : Promise.resolve({ data: [] as { nim: string; nama_lengkap: string; unit_id: string; role: string }[] }),
  ]);

  const staffNims = (staffProfiles ?? []).map((item) => item.nim);
  const internNims = (internProfiles ?? []).map((item) => item.nim);
  const allPeriodIds = (allPeriods ?? []).map((p) => p.id);

  type ScoreRecord = { id: string; user_nim: string; periode_id: string; total_avg: number };

  const [{ data: staffScores }, { data: internScores }] = await Promise.all([
    allPeriodIds.length && staffNims.length
      ? supabase
          .from("rapor_scores")
          .select("id, user_nim, periode_id, total_avg")
          .eq("report_type", "staf_unit")
          .in("periode_id", allPeriodIds)
          .in("user_nim", staffNims)
      : Promise.resolve({ data: [] as ScoreRecord[] }),
    canViewInternTab && allPeriodIds.length && internNims.length
      ? supabase
          .from("intern_rapor_scores")
          .select("id, user_nim, periode_id, total_avg")
          .in("periode_id", allPeriodIds)
          .in("user_nim", internNims)
      : Promise.resolve({ data: [] as ScoreRecord[] }),
  ]);

  const staffScoreIds = (staffScores ?? []).map((s) => s.id);
  const internScoreIds = (internScores ?? []).map((s) => s.id);

  type DetailRecord = { rapor_id: string; main_indicator_name: string; score: number };

  const [{ data: staffDetails }, { data: internDetails }] = await Promise.all([
    staffScoreIds.length
      ? supabase.from("rapor_details").select("rapor_id, main_indicator_name, score").in("rapor_id", staffScoreIds)
      : Promise.resolve({ data: [] as DetailRecord[] }),
    internScoreIds.length
      ? supabase.from("intern_rapor_details").select("rapor_id, main_indicator_name, score").in("rapor_id", internScoreIds)
      : Promise.resolve({ data: [] as DetailRecord[] }),
  ]);

  function groupDetailsByRaporId(items: DetailRecord[] | null | undefined) {
    const map = new Map<string, { main_indicator_name: string; score: number }[]>();
    for (const item of items ?? []) {
      if (!map.has(item.rapor_id)) {
        map.set(item.rapor_id, []);
      }
      map.get(item.rapor_id)!.push(item);
    }
    return map;
  }

  const staffDetailsByRaporId = groupDetailsByRaporId(staffDetails);
  const internDetailsByRaporId = groupDetailsByRaporId(internDetails);

  // Helper to build unit rows, indicators, insights, and per-person cumulative rows
  function buildRecap(
    profiles: { nim: string; nama_lengkap: string; unit_id: string; role: string }[],
    scores: ScoreRecord[],
    detailsMap: Map<string, { main_indicator_name: string; score: number }[]>,
    periodList: NonNullable<typeof allPeriods>,
    divisor: number,
    isInternScheme = false,
  ): {
    rows: UnitRecapRow[];
    indicators: IndicatorScoreItem[];
    insights: PerformanceInsights;
    members: MemberCumulativeRow[];
  } {
    const profileNims = new Set(profiles.map((p) => p.nim));
    const nameByNim = new Map(profiles.map((p) => [p.nim, p.nama_lengkap]));
    const latestPeriod = periodList[0];
    const previousPeriod = periodList[1];

    const filteredScores = scores.filter((s) => profileNims.has(s.user_nim));

    const latestByNim = new Map<string, number>();
    const previousByNim = new Map<string, number>();
    const latestScoreIdByNim = new Map<string, string>();
    const scoredPeriodsByNim = new Map<string, MemberPeriodScore[]>();

    for (const score of filteredScores) {
      const period = periodById.get(score.periode_id);
      if (period) {
        if (!scoredPeriodsByNim.has(score.user_nim)) {
          scoredPeriodsByNim.set(score.user_nim, []);
        }
        const statusValue = isInternScheme
          ? (isInternPublishedStatus(period.intern_status) ? "published" : (period.intern_status ?? "draft"))
          : (isPublishedStatus(period.status) ? "published" : (period.status ?? "draft"));
        scoredPeriodsByNim.get(score.user_nim)!.push({
          periode_id: score.periode_id,
          bulan: period.bulan,
          tahun: period.tahun,
          label: `${BULAN_SHORT[period.bulan] ?? `B${period.bulan}`} ${period.tahun}`,
          score: Number(score.total_avg),
          status: statusValue,
        });
      }
      if (latestPeriod && score.periode_id === latestPeriod.id) {
        latestByNim.set(score.user_nim, Number(score.total_avg));
        latestScoreIdByNim.set(score.user_nim, score.id);
      }
      if (previousPeriod && score.periode_id === previousPeriod.id) {
        previousByNim.set(score.user_nim, Number(score.total_avg));
      }
    }

    const cumulativeByNim = new Map<string, number>();
    for (const [nim, psList] of scoredPeriodsByNim.entries()) {
      psList.sort((a, b) => (a.tahun !== b.tahun ? b.tahun - a.tahun : b.bulan - a.bulan));
      const sum = psList.reduce((acc, item) => acc + item.score, 0);
      cumulativeByNim.set(nim, Number((sum / divisor).toFixed(2)));
    }

    const members: MemberCumulativeRow[] = profiles.map((p) => {
      const psList = scoredPeriodsByNim.get(p.nim) ?? [];
      const latestItem = psList[0] ?? null;
      return {
        nim: p.nim,
        nama_lengkap: p.nama_lengkap,
        unit_name: unitNameById.get(p.unit_id) ?? "-",
        role_label: p.role !== "staff" && p.role !== "internship" ? formatRoleName(p.role) : undefined,
        cumulative_avg: cumulativeByNim.get(p.nim) ?? 0,
        published_count: psList.length,
        latest_score: latestItem ? latestItem.score : null,
        latest_period_label: latestItem ? latestItem.label : null,
        period_scores: psList,
      };
    });

    const indicatorAccumulator = new Map<string, { sum: number; count: number }>();
    const allLatestScores: number[] = [];

    const rows = (coordinatedUnits ?? []).map((unit) => {
      const unitMembers = profiles.filter((p) => p.unit_id === unit.id);
      const memberCumulativeScores = unitMembers
        .map((m) => ({ nim: m.nim, score: cumulativeByNim.get(m.nim) ?? latestByNim.get(m.nim) }))
        .filter((item): item is { nim: string; score: number } => typeof item.score === "number");

      const average = memberCumulativeScores.length
        ? Number((memberCumulativeScores.reduce((sum, item) => sum + item.score, 0) / memberCumulativeScores.length).toFixed(2))
        : 0;

      let highestStaff = "-";
      let highestScore = Number.NEGATIVE_INFINITY;
      let lowestStaff = "-";
      let lowestScore = Number.POSITIVE_INFINITY;
      let highestGrowthStaff = "-";
      let highestGrowthScore = Number.NEGATIVE_INFINITY;
      let lowestGrowthStaff = "-";
      let lowestGrowthScore = Number.POSITIVE_INFINITY;

      for (const m of unitMembers) {
        const cumulativeScore = cumulativeByNim.get(m.nim) ?? latestByNim.get(m.nim);
        const current = latestByNim.get(m.nim);

        if (typeof cumulativeScore === "number") {
          allLatestScores.push(cumulativeScore);
          const name = nameByNim.get(m.nim) ?? m.nim;

          if (cumulativeScore > highestScore) {
            highestScore = cumulativeScore;
            highestStaff = name;
          }
          if (cumulativeScore < lowestScore) {
            lowestScore = cumulativeScore;
            lowestStaff = name;
          }
        }

        if (typeof current === "number") {
          const name = nameByNim.get(m.nim) ?? m.nim;
          const prev = previousByNim.get(m.nim) ?? current;
          const growth = Number((current - prev).toFixed(2));
          if (growth > highestGrowthScore) {
            highestGrowthScore = growth;
            highestGrowthStaff = name;
          }
          if (growth < lowestGrowthScore) {
            lowestGrowthScore = growth;
            lowestGrowthStaff = name;
          }
        }

        // Accumulate indicator details
        const scoreId = latestScoreIdByNim.get(m.nim);
        if (scoreId) {
          const detailItems = detailsMap.get(scoreId) ?? [];
          for (const det of detailItems) {
            if (!indicatorAccumulator.has(det.main_indicator_name)) {
              indicatorAccumulator.set(det.main_indicator_name, { sum: 0, count: 0 });
            }
            const acc = indicatorAccumulator.get(det.main_indicator_name)!;
            acc.sum += Number(det.score);
            acc.count += 1;
          }
        }
      }

      return {
        unit_name: unit.nama_unit,
        average_score: average,
        staff_count: memberCumulativeScores.length,
        highest_staff: highestStaff,
        highest_score: Number.isFinite(highestScore) ? Number(highestScore.toFixed(2)) : 0,
        lowest_staff: lowestStaff,
        lowest_score: Number.isFinite(lowestScore) ? Number(lowestScore.toFixed(2)) : 0,
        highest_growth_staff: highestGrowthStaff,
        highest_growth_score: Number.isFinite(highestGrowthScore) ? Number(highestGrowthScore.toFixed(2)) : 0,
        lowest_growth_staff: lowestGrowthStaff,
        lowest_growth_score: Number.isFinite(lowestGrowthScore) ? Number(lowestGrowthScore.toFixed(2)) : 0,
      };
    });

    const indicators = Array.from(indicatorAccumulator.entries()).map(([indicatorName, acc]) => ({
      indicatorName,
      averageScore: Number((acc.sum / (acc.count || 1)).toFixed(2)),
      totalEvaluated: acc.count,
    }));

    const sortedIndicators = [...indicators].sort((a, b) => b.averageScore - a.averageScore);
    const topStrengthIndicator = sortedIndicators[0]
      ? { name: sortedIndicators[0].indicatorName, score: sortedIndicators[0].averageScore }
      : undefined;
    const improvementIndicator = sortedIndicators[sortedIndicators.length - 1]
      ? { name: sortedIndicators[sortedIndicators.length - 1].indicatorName, score: sortedIndicators[sortedIndicators.length - 1].averageScore }
      : undefined;

    const highPerformersCount = allLatestScores.filter((score) => score >= 3.5).length;
    const highPerformersRatio = allLatestScores.length
      ? Math.round((highPerformersCount / allLatestScores.length) * 100)
      : 0;

    const overallAverage = allLatestScores.length
      ? Number((allLatestScores.reduce((a, b) => a + b, 0) / allLatestScores.length).toFixed(2))
      : 0;

    const insights: PerformanceInsights = {
      topStrengthIndicator,
      improvementIndicator,
      highPerformersRatio,
      totalMembers: profiles.length,
      overallAverage,
    };

    return { rows, indicators, insights, members };
  }

  const staffResult = buildRecap(
    staffProfiles ?? [],
    staffScores ?? [],
    staffDetailsByRaporId,
    allPeriods ?? [],
    STAFF_CUMULATIVE_DIVISOR,
    false,
  );
  const internResult = buildRecap(
    internProfiles ?? [],
    internScores ?? [],
    internDetailsByRaporId,
    allPeriods ?? [],
    INTERN_CUMULATIVE_DIVISOR,
    true,
  );

  const activePeriodLabel = latestPublished
    ? `Periode ${latestPublished.bulan}/${latestPublished.tahun} (Published)`
    : "Belum ada periode published";

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Dashboard Menko</h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Rekap performa, analisis indikator, dan perbandingan antar kementerian/biro di bawah koordinasi Kamu.
          </p>
        </div>
        
        {!isPjKemenkoan ? (
          <div className="flex gap-2">
            <Link
              href="/menko/menteri-detail"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors self-start sm:self-auto"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-9 14a5 5 0 0 1 10 0M20 8a3 3 0 1 1-2.65 4.4M18 21a4 4 0 0 0-3-3.87" />
              </svg>
              <span>Lihat Rincian Rapor Menteri</span>
            </Link>
          </div>
        ) : null}
      </div>

      <MenkoDashboardTabs
        staffRows={staffResult.rows}
        staffIndicators={staffResult.indicators}
        staffInsights={staffResult.insights}
        staffMembers={staffResult.members}
        internRows={internResult.rows}
        internIndicators={internResult.indicators}
        internInsights={internResult.insights}
        internMembers={internResult.members}
        showInternTab={canViewInternTab}
        totalUnitsCount={(coordinatedUnits ?? []).length}
        activePeriodLabel={activePeriodLabel}
      />
    </section>
  );
}
