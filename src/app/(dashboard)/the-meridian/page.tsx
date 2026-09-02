import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import Link from "next/link";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isPublishedStatus } from "@/lib/period-status";
import { Sparkles, BarChart3, FileText, User, ChevronDown, Calendar } from "lucide-react";
import { StaffPerformanceBarChart } from "@/components/dashboard/staff-performance-bar-chart";
import { IndicatorBreakdownChart } from "@/components/dashboard/indicator-breakdown-chart";
import { PerformanceInsightsCard } from "@/components/dashboard/performance-insights-card";

export const dynamic = "force-dynamic";

export default async function TheMeridianPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "the_meridian") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: ownedUnit }, { data: periods }, { data: interns }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap")
      .eq("unit_id", profile.unit_id)
      .eq("role", "internship")
      .order("nama_lengkap"),
  ]);

  const internByNim = new Map((interns ?? []).map((intern) => [intern.nim, intern.nama_lengkap]));
  const internNims = [...internByNim.keys()];
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: scores } = internNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, report_type, created_at")
        .in("user_nim", internNims)
        .in("report_type", ["internship", "staf_unit"])
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null; report_type: string; created_at: string }[] };

  // Fetch indicator details for analysis
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

  const latestByNim = new Map<string, number>();
  const previousByNim = new Map<string, number>();
  const latestScoreIdByNim = new Map<string, string>();

  for (const item of scores ?? []) {
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

  for (const nim of internNims) {
    const current = latestByNim.get(nim);
    const name = internByNim.get(nim) ?? nim;

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

  const highestGrowthLabel = Number.isFinite(highestGrowthValue) ? highestGrowthValue.toFixed(2) : "0.00";
  const lowestGrowthLabel = Number.isFinite(lowestGrowthValue) ? lowestGrowthValue.toFixed(2) : "0.00";
  const highestScoreLabel = Number.isFinite(highestScoreValue) ? highestScoreValue.toFixed(2) : "0.00";
  const lowestScoreLabel = Number.isFinite(lowestScoreValue) ? lowestScoreValue.toFixed(2) : "0.00";

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

  const rows = (scores ?? []).map((score) => {
    const period = periodById.get(score.periode_id);
    return {
      id: score.id,
      internName: internByNim.get(score.user_nim) ?? score.user_nim,
      total_avg: Number(score.total_avg),
      catatan: score.catatan,
      bulan: period?.bulan ?? 0,
      tahun: period?.tahun ?? 0,
      status: period?.status ?? "draft",
    };
  });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>The Meridian Dashboard</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Rapor Internship (Cakrawala) Unit
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Monitoring, visualisasi analitik, dan evaluasi khusus staf internship pada {ownedUnit?.nama_unit ?? "-"}.
          </p>
        </div>

        <Link
          href="/the-meridian/staff-detail"
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-colors self-start sm:self-auto"
        >
          <FileText className="h-4 w-4" />
          <span>Lihat Rincian Per Indikator</span>
        </Link>
      </div>

      {/* Analytical Insights */}
      <PerformanceInsightsCard
        insights={{
          topStrengthIndicator,
          improvementIndicator,
          highPerformersRatio,
          totalMembers: internNims.length,
          overallAverage,
        }}
        title="Insight Evaluasi Staf Magang (Cakrawala)"
      />

      {/* Visual Analytics Charts */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <StaffPerformanceBarChart
          data={performanceList}
          title="Ranking Performa Staf Magang"
          subtitle={`Unit ${ownedUnit?.nama_unit ?? "-"} · ${latestPublished ? `Periode ${latestPublished.bulan}/${latestPublished.tahun}` : "Periode Terbaru"}`}
          emptyText="Belum ada data nilai staf magang untuk periode ini."
        />

        <IndicatorBreakdownChart
          data={indicatorScores}
          title="Capaian per Indikator Magang"
          subtitle={`Evaluasi aspek kinerja staf magang pada unit ${ownedUnit?.nama_unit ?? "-"}`}
        />
      </div>

      {/* Summary Cards */}
      <Card className="border-indigo-100 bg-indigo-50/20">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Recap 1 Bulan Terbaru</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {latestPublished
              ? `Periode ${latestPublished.bulan}/${latestPublished.tahun} (Published)`
              : "Belum ada periode published"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Nilai Tertinggi</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{highestScoreName}</p>
            <p className="text-xs font-semibold text-emerald-600">{highestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Nilai Terendah</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{lowestScoreName}</p>
            <p className="text-xs font-semibold text-slate-600">{lowestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Growth Tertinggi</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{highestGrowthName}</p>
            <p className="text-xs font-semibold text-emerald-600">{highestGrowthLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Growth Terendah</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{lowestGrowthName}</p>
            <p className="text-xs font-semibold text-slate-600">{lowestGrowthLabel}</p>
          </div>
        </CardContent>
      </Card>

      {/* Rapor List Grouped & Collapsible by Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-indigo-600" />
            Daftar Seluruh Rapor Internship
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Riwayat penilaian rapor bulanan staf magang unit {ownedUnit?.nama_unit ?? "-"}, dikelompokkan per bulan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(() => {
            const BULAN_NAMES: Record<number, string> = {
              1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
              7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember"
            };

            const periodGroups = new Map<string, { bulan: number; tahun: number; status: string; rows: typeof rows }>();
            for (const row of rows) {
              const key = `${row.tahun}-${String(row.bulan).padStart(2, "0")}`;
              if (!periodGroups.has(key)) {
                periodGroups.set(key, {
                  bulan: row.bulan,
                  tahun: row.tahun,
                  status: row.status,
                  rows: [],
                });
              }
              periodGroups.get(key)!.rows.push(row);
            }

            const sortedKeys = Array.from(periodGroups.keys()).sort().reverse();

            if (!sortedKeys.length) {
              return (
                <p className="text-sm text-slate-500 text-center py-6">
                  Belum ada data rapor internship untuk unit ini.
                </p>
              );
            }

            return sortedKeys.map((key, index) => {
              const group = periodGroups.get(key)!;
              const periodName = `Periode ${BULAN_NAMES[group.bulan] ?? `Bulan ${group.bulan}`} ${group.tahun}`;
              const avgPeriodScore = group.rows.length
                ? (group.rows.reduce((sum, r) => sum + r.total_avg, 0) / group.rows.length).toFixed(2)
                : "0.00";

              return (
                <details
                  key={key}
                  open={index === 0}
                  className="group rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden shadow-2xs transition-all"
                >
                  <summary className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none list-none">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-slate-900">
                            {periodName}
                          </span>
                          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 capitalize">
                            {group.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {group.rows.length} Staf Magang Terskor · Rata-rata Unit: <span className="font-semibold text-indigo-700">{avgPeriodScore}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="p-3 sm:p-4 pt-1 space-y-2.5 bg-white border-t border-slate-200/80">
                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/40 p-3 text-sm transition-colors hover:border-slate-200 hover:bg-white shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="h-4 w-4 text-indigo-600" />
                            <span className="font-semibold text-slate-800">{row.internName}</span>
                          </div>
                          {row.catatan ? (
                            <p className="text-xs italic text-slate-600 bg-white rounded px-2 py-1 border border-slate-100 mt-1">
                              Catatan: {row.catatan}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-xs text-slate-500">Nilai:</span>
                          <span className="rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-sm font-bold text-indigo-700">
                            {row.total_avg.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            });
          })()}
        </CardContent>
      </Card>
    </section>
  );
}
