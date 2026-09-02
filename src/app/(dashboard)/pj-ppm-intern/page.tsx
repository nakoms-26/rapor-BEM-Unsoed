import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import Link from "next/link";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { isPublishedStatus } from "@/lib/period-status";
import { ShieldCheck, BarChart3, FileText, User, Building2, AlertCircle, ChevronDown, Calendar } from "lucide-react";
import { StaffPerformanceBarChart } from "@/components/dashboard/staff-performance-bar-chart";
import { IndicatorBreakdownChart } from "@/components/dashboard/indicator-breakdown-chart";
import { PerformanceInsightsCard } from "@/components/dashboard/performance-insights-card";

export const dynamic = "force-dynamic";

export default async function PjPpmInternPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "pj_ppm_intern" && profile.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // 1. Get assigned units for this PJ PPM Intern from pj_assignments
  const { data: assignments } = await supabase
    .from("pj_assignments")
    .select("target_unit_id")
    .eq("nim", profile.nim)
    .eq("is_active", true);

  const assignedUnitIds = (assignments ?? []).map((a) => a.target_unit_id);

  // If no assignments exist and not admin, do not show any units
  if (assignedUnitIds.length === 0 && profile.role !== "admin") {
    return (
      <section className="space-y-6">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>PJ PPM Internship Dashboard</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Rapor Internship Unit Diampu</h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Monitoring & evaluasi rapor anak magang (Cakrawala) untuk unit kementerian/biro yang Kamu pegang.
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50/50 shadow-2xs">
          <CardHeader>
            <CardTitle className="text-amber-900 flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              Belum Ada Kementerian / Biro yang Ditetapkan
            </CardTitle>
            <CardDescription className="text-amber-800 text-xs sm:text-sm">
              Admin belum menetapkan kementerian atau biro yang Kamu ampu pada sistem penugasan (<code>pj_assignments</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs sm:text-sm text-slate-700">
              Silakan hubungi Administrator agar unit kementerian/biro yang menjadi tanggung jawab Kamu segera diaktifkan.
            </p>
            <div className="pt-2">
              <Link
                href="/staff"
                className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-teal-700 transition-colors shadow-2xs"
              >
                <User className="h-4 w-4" />
                <span>Buka Rapor Pribadi Saya</span>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    );
  }

  const { data: managedUnits } = assignedUnitIds.length
    ? await supabase
        .from("ref_units")
        .select("id, nama_unit, kategori, parent_id")
        .in("id", assignedUnitIds)
        .order("nama_unit")
    : await supabase
        .from("ref_units")
        .select("id, nama_unit, kategori, parent_id")
        .in("kategori", ["kementerian", "biro"])
        .order("nama_unit");

  const effectiveUnitIds = (managedUnits ?? []).map((u) => u.id);

  // 2. Fetch periods and internship profiles in these units
  const [{ data: periods }, { data: interns }] = await Promise.all([
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    effectiveUnitIds.length
      ? supabase
          .from("profiles")
          .select("nim, nama_lengkap, unit_id")
          .in("unit_id", effectiveUnitIds)
          .in("role", ["internship", "pj_ppm_intern"])
          .order("nama_lengkap")
      : { data: [] },
  ]);

  const internByNim = new Map((interns ?? []).map((intern) => [intern.nim, intern]));
  const unitById = new Map((managedUnits ?? []).map((unit) => [unit.id, unit]));
  const internNims = (interns ?? []).map((i) => i.nim);
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  // 3. Fetch scores
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

  const performanceList: { name: string; score: number; unitName: string }[] = [];
  const indicatorAccumulator = new Map<string, { sum: number; count: number }>();

  for (const intern of interns ?? []) {
    const current = latestByNim.get(intern.nim);
    const unit = unitById.get(intern.unit_id);

    if (typeof current === "number") {
      performanceList.push({
        name: intern.nama_lengkap,
        score: current,
        unitName: unit?.nama_unit ?? "-",
      });

      const scoreId = latestScoreIdByNim.get(intern.nim);
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

  // Summary per unit (for unit-level comparison chart)
  const unitSummaries = (managedUnits ?? []).map((unit) => {
    const unitInterns = (interns ?? []).filter((i) => i.unit_id === unit.id);
    const scoredInterns = unitInterns
      .map((i) => ({ ...i, score: latestByNim.get(i.nim) }))
      .filter((i): i is typeof i & { score: number } => typeof i.score === "number");

    const avgScore = scoredInterns.length
      ? Number((scoredInterns.reduce((sum, item) => sum + item.score, 0) / scoredInterns.length).toFixed(2))
      : 0;

    return {
      unitId: unit.id,
      unitName: unit.nama_unit,
      totalInterns: unitInterns.length,
      scoredCount: scoredInterns.length,
      averageScore: avgScore,
    };
  });

  const unitComparisonData = unitSummaries.map((u) => ({
    name: u.unitName.replace("Kementerian ", "").replace("Biro ", ""),
    score: u.averageScore,
    unitName: u.unitName,
  }));

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
    const intern = internByNim.get(score.user_nim);
    const unit = intern ? unitById.get(intern.unit_id) : undefined;
    return {
      id: score.id,
      internName: intern?.nama_lengkap ?? score.user_nim,
      unitName: unit?.nama_unit ?? "-",
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
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>PJ PPM Internship Dashboard</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Rapor Internship Unit Diampu</h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Monitoring, visualisasi analitik, dan evaluasi rapor anak magang (Cakrawala) untuk unit yang Kamu pegang.
          </p>
        </div>

        <Link
          href="/pj-ppm-intern/staff-detail"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm hover:bg-teal-700 transition-colors self-start sm:self-auto"
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
        title="Insight Evaluasi Magang (Lintas Unit Diampu)"
      />

      {/* Visual Analytics Charts Grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <StaffPerformanceBarChart
          data={unitComparisonData}
          title="Komparasi Rata-rata Nilai per Kementerian/Biro"
          subtitle="Rata-rata skor anak magang pada setiap unit yang Kamu ampu"
          emptyText="Belum ada data nilai kementerian/biro untuk periode ini."
        />

        <IndicatorBreakdownChart
          data={indicatorScores}
          title="Capaian per Indikator Utama (Semua Unit Diampu)"
          subtitle="Evaluasi aspek kinerja magang pada seluruh unit pegangan Kamu"
        />
      </div>

      {/* Ranking Individual Staf Magang */}
      <StaffPerformanceBarChart
        data={performanceList}
        title="Ranking Skor Seluruh Staf Magang"
        subtitle="Daftar peringkat performa seluruh anak magang di unit-unit yang Kamu ampu"
        emptyText="Belum ada data nilai individu anak magang."
      />

      {/* Recap per Unit Cards */}
      <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {unitSummaries.map((summary) => (
          <Card key={summary.unitId} className="border-slate-200/80 bg-white shadow-2xs hover:border-teal-300 transition-colors">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base text-slate-900">
                <Building2 className="h-4 w-4 text-teal-600 flex-shrink-0" />
                <span className="truncate">{summary.unitName}</span>
              </CardTitle>
              <CardDescription className="text-xs">
                {summary.totalInterns} Staf Magang · {summary.scoredCount} Terskor
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="flex items-baseline justify-between pt-1">
                <span className="text-xs font-medium text-slate-500">Rata-rata Nilai:</span>
                <span className="text-lg sm:text-xl font-bold text-teal-700">
                  {summary.averageScore > 0 ? summary.averageScore.toFixed(2) : "-"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Historical Rapor List Grouped & Collapsible by Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <BarChart3 className="h-4.5 w-4.5 text-teal-600" />
            Daftar Seluruh Rapor Internship
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Riwayat penilaian seluruh anak magang pada unit yang Kamu ampu, dikelompokkan per bulan.
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
                  Belum ada data rapor internship pada unit yang Kamu ampu.
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
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
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
                          {group.rows.length} Staf Magang Terskor · Rata-rata Gabungan: <span className="font-semibold text-teal-700">{avgPeriodScore}</span>
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
                            <User className="h-4 w-4 text-teal-600" />
                            <span className="font-semibold text-slate-800">{row.internName}</span>
                            <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              {row.unitName}
                            </span>
                          </div>
                          {row.catatan ? (
                            <p className="text-xs italic text-slate-600 bg-white rounded px-2 py-1 border border-slate-100 mt-1">
                              Catatan: {row.catatan}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-xs text-slate-500">Nilai:</span>
                          <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-sm font-bold text-teal-700">
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
