import { redirect } from "next/navigation";
import Link from "next/link";
import { MenkoDashboardTabs, type UnitRecapRow } from "@/components/dashboard/menko-dashboard-tabs";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { PerformanceInsights } from "@/components/dashboard/performance-insights-card";
import type { IndicatorScoreItem } from "@/components/dashboard/indicator-breakdown-chart";

export const dynamic = "force-dynamic";

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();
  const isPjKemenkoan = menkoProfile.role === "pj_kementerian" && menkoProfile.is_pj_kemenkoan === true;

  // Allow Menko, Admin, and PJ Kemenkoan to access recap page.
  if (!(menkoProfile.role === "menko" || menkoProfile.role === "admin" || isPjKemenkoan)) {
    redirect(ROLE_HOME[menkoProfile.role] ?? "/dashboard");
  }

  const { data: activePeriod } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun")
    .eq("status", "published")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false })
    .limit(1)
    .single();

  const { data: publishedPeriods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .eq("status", "published")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  const latestPublished = (publishedPeriods ?? [])[0];
  const previousPublished = (publishedPeriods ?? [])[1];

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
    : await supabase
        .from("ref_units")
        .select("id, nama_unit")
        .eq("parent_id", menkoProfile.unit_id);

  const unitIds = (coordinatedUnits ?? []).map((unit) => unit.id);

  // Fetch both regular staff and internship profiles
  const [{ data: staffProfiles }, { data: internProfiles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
      .in("role", ["staff", "user", "pj_kementerian"]),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
      .eq("role", "internship"),
  ]);

  const staffNims = (staffProfiles ?? []).map((item) => item.nim);
  const internNims = (internProfiles ?? []).map((item) => item.nim);

  const allRelevantNims = [...staffNims, ...internNims];

  const { data: allScores } = (latestPublished || activePeriod) && allRelevantNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, report_type")
        .in("periode_id", [latestPublished?.id ?? activePeriod?.id ?? "", previousPublished?.id ?? ""].filter(Boolean))
        .in("user_nim", allRelevantNims)
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; report_type: string }[] };

  // Fetch indicator details for deep analysis
  const scoreIds = (allScores ?? []).map((s) => s.id);
  const { data: details } = scoreIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, score")
        .in("rapor_id", scoreIds)
    : { data: [] as { rapor_id: string; main_indicator_name: string; score: number }[] };

  const detailsByRaporId = new Map<string, { main_indicator_name: string; score: number }[]>();
  for (const item of details ?? []) {
    if (!detailsByRaporId.has(item.rapor_id)) {
      detailsByRaporId.set(item.rapor_id, []);
    }
    detailsByRaporId.get(item.rapor_id)!.push(item);
  }

  // Helper to build unit rows, indicators, and insights
  function buildRecap(
    profiles: { nim: string; nama_lengkap: string; unit_id: string }[],
    reportTypeFilter?: string
  ): {
    rows: UnitRecapRow[];
    indicators: IndicatorScoreItem[];
    insights: PerformanceInsights;
  } {
    const profileNims = new Set(profiles.map((p) => p.nim));
    const nameByNim = new Map(profiles.map((p) => [p.nim, p.nama_lengkap]));

    const filteredScores = (allScores ?? []).filter(
      (s) => profileNims.has(s.user_nim) && (!reportTypeFilter || s.report_type === reportTypeFilter || s.report_type === "staf_unit")
    );

    const latestByNim = new Map<string, number>();
    const previousByNim = new Map<string, number>();
    const latestScoreIdByNim = new Map<string, string>();

    for (const score of filteredScores) {
      if (latestPublished && score.periode_id === latestPublished.id) {
        latestByNim.set(score.user_nim, Number(score.total_avg));
        latestScoreIdByNim.set(score.user_nim, score.id);
      }
      if (previousPublished && score.periode_id === previousPublished.id) {
        previousByNim.set(score.user_nim, Number(score.total_avg));
      }
    }

    const indicatorAccumulator = new Map<string, { sum: number; count: number }>();
    const allLatestScores: number[] = [];

    const rows = (coordinatedUnits ?? []).map((unit) => {
      const unitMembers = profiles.filter((p) => p.unit_id === unit.id);
      const currentScores = unitMembers
        .map((m) => ({ nim: m.nim, score: latestByNim.get(m.nim) }))
        .filter((item): item is { nim: string; score: number } => typeof item.score === "number");

      const average = currentScores.length
        ? Number((currentScores.reduce((sum, item) => sum + item.score, 0) / currentScores.length).toFixed(2))
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
        const current = latestByNim.get(m.nim);
        if (typeof current !== "number") continue;

        allLatestScores.push(current);

        const name = nameByNim.get(m.nim) ?? m.nim;

        if (current > highestScore) {
          highestScore = current;
          highestStaff = name;
        }
        if (current < lowestScore) {
          lowestScore = current;
          lowestStaff = name;
        }

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

        // Accumulate indicator details
        const scoreId = latestScoreIdByNim.get(m.nim);
        if (scoreId) {
          const detailItems = detailsByRaporId.get(scoreId) ?? [];
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
        staff_count: currentScores.length,
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

    return { rows, indicators, insights };
  }

  const staffResult = buildRecap(staffProfiles ?? []);
  const internResult = buildRecap(internProfiles ?? []);

  const activePeriodLabel = latestPublished
    ? `Periode ${latestPublished.bulan}/${latestPublished.tahun} (Published)`
    : activePeriod
      ? `Periode ${activePeriod.bulan}/${activePeriod.tahun}`
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
        internRows={internResult.rows}
        internIndicators={internResult.indicators}
        internInsights={internResult.insights}
        totalUnitsCount={(coordinatedUnits ?? []).length}
        activePeriodLabel={activePeriodLabel}
      />
    </section>
  );
}
