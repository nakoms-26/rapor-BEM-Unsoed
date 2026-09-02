import { redirect } from "next/navigation";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isPublishedStatus } from "@/lib/period-status";
import {
  MenteriStaffTabs,
  type StaffRaporRow,
  type TabAnalyticsData,
} from "@/components/dashboard/menteri-staff-tabs";

export const dynamic = "force-dynamic";

export default async function MenteriStaffPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "menteri") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: ownedUnit }, { data: periods }, { data: allMembers }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, role")
      .eq("unit_id", profile.unit_id)
      .in("role", ["staff", "pj_kementerian", "internship", "pj_ppm_intern"])
      .order("nama_lengkap"),
  ]);

  const regularStaffs = (allMembers ?? []).filter((m) => m.role === "staff" || m.role === "pj_kementerian");
  const internStaffs = (allMembers ?? []).filter((m) => m.role === "internship" || m.role === "pj_ppm_intern");

  const regularNims = regularStaffs.map((s) => s.nim);
  const internNims = internStaffs.map((s) => s.nim);
  const allNims = [...regularNims, ...internNims];

  const memberNameByNim = new Map((allMembers ?? []).map((m) => [m.nim, m.nama_lengkap]));
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: scores } = allNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, report_type, created_at")
        .in("user_nim", allNims)
        .in("report_type", ["staf_unit", "internship"])
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null; report_type: string; created_at: string }[] };

  // Fetch indicator details for deep analysis
  const scoreIds = (scores ?? []).map((s) => s.id);
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

  const publishedPeriods = (periods ?? [])
    .filter((period) => isPublishedStatus(period.status))
    .sort((a, b) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun;
      return b.bulan - a.bulan;
    });

  const latestPublished = publishedPeriods[0];
  const previousPublished = publishedPeriods[1];

  function computeStatsAndRows(nims: string[]) {
    const nimSet = new Set(nims);
    const subsetScores = (scores ?? []).filter((s) => nimSet.has(s.user_nim));

    const latestByNim = new Map<string, number>();
    const previousByNim = new Map<string, number>();
    const latestScoreIdByNim = new Map<string, string>();

    for (const item of subsetScores) {
      if (latestPublished && item.periode_id === latestPublished.id) {
        latestByNim.set(item.user_nim, Number(item.total_avg));
        latestScoreIdByNim.set(item.user_nim, item.id);
      }
      if (previousPublished && item.periode_id === previousPublished.id) {
        previousByNim.set(item.user_nim, Number(item.total_avg));
      }
    }

    let highestScoreName = "-";
    let highestScoreValue = Number.NEGATIVE_INFINITY;
    let lowestScoreName = "-";
    let lowestScoreValue = Number.POSITIVE_INFINITY;
    let highestGrowthName = "-";
    let highestGrowthValue = Number.NEGATIVE_INFINITY;
    let lowestGrowthName = "-";
    let lowestGrowthValue = Number.POSITIVE_INFINITY;

    const performanceList: { name: string; score: number }[] = [];
    const indicatorAccumulator = new Map<string, { sum: number; count: number }>();

    for (const nim of nims) {
      const current = latestByNim.get(nim);
      const name = memberNameByNim.get(nim) ?? nim;

      if (typeof current === "number") {
        performanceList.push({ name, score: current });

        if (current > highestScoreValue) {
          highestScoreValue = current;
          highestScoreName = name;
        }
        if (current < lowestScoreValue) {
          lowestScoreValue = current;
          lowestScoreName = name;
        }

        const prev = previousByNim.get(nim) ?? current;
        const growth = Number((current - prev).toFixed(2));
        if (growth > highestGrowthValue) {
          highestGrowthValue = growth;
          highestGrowthName = name;
        }
        if (growth < lowestGrowthValue) {
          lowestGrowthValue = growth;
          lowestGrowthName = name;
        }

        // Accumulate indicator details
        const scoreId = latestScoreIdByNim.get(nim);
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
    }

    const rows: StaffRaporRow[] = subsetScores.map((score) => {
      const period = periodById.get(score.periode_id);
      return {
        id: score.id,
        staffName: memberNameByNim.get(score.user_nim) ?? score.user_nim,
        total_avg: Number(score.total_avg),
        catatan: score.catatan,
        bulan: period?.bulan ?? 0,
        tahun: period?.tahun ?? 0,
        status: period?.status ?? "draft",
      };
    });

    const stats = {
      highestScoreName,
      highestScoreLabel: Number.isFinite(highestScoreValue) ? highestScoreValue.toFixed(2) : "0.00",
      lowestScoreName,
      lowestScoreLabel: Number.isFinite(lowestScoreValue) ? lowestScoreValue.toFixed(2) : "0.00",
      highestGrowthName,
      highestGrowthLabel: Number.isFinite(highestGrowthValue) ? highestGrowthValue.toFixed(2) : "0.00",
      lowestGrowthName,
      lowestGrowthLabel: Number.isFinite(lowestGrowthValue) ? lowestGrowthValue.toFixed(2) : "0.00",
    };

    // Calculate indicator averages
    const indicatorScores = Array.from(indicatorAccumulator.entries()).map(([indicatorName, acc]) => ({
      indicatorName,
      averageScore: Number((acc.sum / (acc.count || 1)).toFixed(2)),
      totalEvaluated: acc.count,
    }));

    const sortedIndicators = [...indicatorScores].sort((a, b) => b.averageScore - a.averageScore);
    const topStrengthIndicator = sortedIndicators[0]
      ? { name: sortedIndicators[0].indicatorName, score: sortedIndicators[0].averageScore }
      : undefined;
    const improvementIndicator = sortedIndicators[sortedIndicators.length - 1]
      ? { name: sortedIndicators[sortedIndicators.length - 1].indicatorName, score: sortedIndicators[sortedIndicators.length - 1].averageScore }
      : undefined;

    const highPerformersCount = performanceList.filter((item) => item.score >= 3.5).length;
    const highPerformersRatio = performanceList.length
      ? Math.round((highPerformersCount / performanceList.length) * 100)
      : 0;

    const overallAverage = performanceList.length
      ? Number((performanceList.reduce((acc, curr) => acc + curr.score, 0) / performanceList.length).toFixed(2))
      : 0;

    const analytics: TabAnalyticsData = {
      performanceList,
      indicatorScores,
      insights: {
        topStrengthIndicator,
        improvementIndicator,
        highPerformersRatio,
        totalMembers: nims.length,
        overallAverage,
      },
    };

    return { rows, stats, analytics };
  }

  const staffResult = computeStatsAndRows(regularNims);
  const internResult = computeStatsAndRows(internNims);

  const latestPeriodLabel = latestPublished
    ? `Periode ${latestPublished.bulan}/${latestPublished.tahun} (Published)`
    : "Belum ada periode published";

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Rapor Staff & Internship Unit</h2>
        <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
          Visualisasi performa, analisis indikator, dan rekap nilai untuk unit {ownedUnit?.nama_unit ?? "-"}.
        </p>
      </div>

      <MenteriStaffTabs
        unitName={ownedUnit?.nama_unit ?? "-"}
        latestPeriodLabel={latestPeriodLabel}
        staffRows={staffResult.rows}
        staffStats={staffResult.stats}
        staffAnalytics={staffResult.analytics}
        internRows={internResult.rows}
        internStats={internResult.stats}
        internAnalytics={internResult.analytics}
      />
    </section>
  );
}
