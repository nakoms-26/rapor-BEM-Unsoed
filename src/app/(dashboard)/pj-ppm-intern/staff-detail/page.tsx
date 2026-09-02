import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Building2 } from "lucide-react";

const BULAN_LABEL: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

function formatPeriode(bulan: number, tahun: number) {
  return `${BULAN_LABEL[bulan] ?? `Bulan ${bulan}`}/${tahun}`;
}

export const dynamic = "force-dynamic";

export default async function PjPpmInternStaffDetailPage() {
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

  if (assignedUnitIds.length === 0 && profile.role !== "admin") {
    return (
      <section className="space-y-6">
        <div>
          <Link
            href="/pj-ppm-intern"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Dashboard PJ PPM Intern</span>
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Rincian Indikator Rapor Cakrawala</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-teal-700">
              <ShieldCheck className="h-3 w-3" />
              PJ PPM Intern
            </span>
          </div>
        </div>

        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-6">
            <p className="text-sm text-slate-700 text-center py-6">
              Belum ada kementerian/biro yang ditetapkan oleh Admin untuk akun Kamu pada sistem penugasan (<code>pj_assignments</code>).
            </p>
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
  const unitById = new Map((managedUnits ?? []).map((u) => [u.id, u]));

  // 2. Fetch periods and internship profiles in these units
  const [{ data: periods }, { data: internProfiles }] = await Promise.all([
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    effectiveUnitIds.length
      ? supabase
          .from("profiles")
          .select("nim, nama_lengkap, unit_id")
          .in("unit_id", effectiveUnitIds)
          .eq("role", "internship")
          .order("nama_lengkap")
      : { data: [] },
  ]);

  const internNims = (internProfiles ?? []).map((s) => s.nim);

  // 3. Get all rapor scores for internship
  const { data: scores } = internNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan")
        .in("user_nim", internNims)
        .in("report_type", ["internship", "staf_unit"])
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null }[] };

  // 4. Get all rapor details
  const scoreIds = (scores ?? []).map((s) => s.id);
  const { data: details } = scoreIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", scoreIds)
    : {
        data: [] as {
          rapor_id: string;
          main_indicator_name: string;
          sub_indicator_name: string;
          score: number;
          bentuk_tanggung_jawab: string | null;
          nilai_kuantitatif_tanggung_jawab: number | null;
          skala: string | null;
          nilai_kuantitatif_skala: number | null;
          nilai_kualitatif: number | null;
          nilai_akhir: number | null;
        }[],
      };

  const periodById = new Map((periods ?? []).map((p) => [p.id, p]));
  
  type DetailRow = NonNullable<typeof details>[number];
  const detailsByRaporId = new Map<string, DetailRow[]>();
  for (const detail of details ?? []) {
    if (!detailsByRaporId.has(detail.rapor_id)) {
      detailsByRaporId.set(detail.rapor_id, []);
    }
    detailsByRaporId.get(detail.rapor_id)!.push(detail);
  }

  // Group scores by staff and period
  type ScoreRow = NonNullable<typeof scores>[number];
  const scoresByStaffAndPeriod = new Map<string, Map<string, ScoreRow[]>>();
  for (const score of scores ?? []) {
    if (!scoresByStaffAndPeriod.has(score.user_nim)) {
      scoresByStaffAndPeriod.set(score.user_nim, new Map());
    }
    const staffPeriods = scoresByStaffAndPeriod.get(score.user_nim)!;
    if (!staffPeriods.has(score.periode_id)) {
      staffPeriods.set(score.periode_id, []);
    }
    staffPeriods.get(score.periode_id)!.push(score);
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/pj-ppm-intern"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Dashboard PJ PPM Intern</span>
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Rincian Indikator Rapor Cakrawala</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 border border-teal-200 px-2 py-0.5 text-xs font-semibold text-teal-700">
              <ShieldCheck className="h-3 w-3" />
              PJ PPM Intern
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Rincian nilai per indikator untuk seluruh staf magang Cakrawala di kementerian/biro yang Kamu pegang.
          </p>
        </div>
      </div>

      {internProfiles && internProfiles.length > 0 ? (
        <div className="space-y-6">
          {internProfiles.map((intern) => {
            const internScores = scoresByStaffAndPeriod.get(intern.nim);
            const hasScores = internScores && internScores.size > 0;
            const unit = unitById.get(intern.unit_id);

            return (
              <Card key={intern.nim} className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg text-slate-900">{intern.nama_lengkap}</CardTitle>
                      <CardDescription className="text-xs text-slate-500">
                        NIM: {intern.nim} · Unit: {unit?.nama_unit ?? "-"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 space-y-4">
                  {hasScores ? (
                    Array.from(internScores.entries()).map(([periodId, scoresInPeriod]) => {
                      const period = periodById.get(periodId);
                      const latestScore = scoresInPeriod[0];

                      return (
                        <div key={periodId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                            <div>
                              <span className="text-sm font-semibold text-slate-800">
                                Periode {period?.bulan}/{period?.tahun}
                              </span>
                              <span className="ml-2 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 capitalize">
                                {period?.status}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-500 mr-2">Total Nilai:</span>
                              <span className="rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-sm font-bold text-teal-700">
                                {Number(latestScore.total_avg).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {latestScore.catatan && (
                            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-600 border border-slate-100">
                              <span className="font-semibold text-slate-700">Catatan: </span>
                              {latestScore.catatan}
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                              Rincian per Indikator:
                            </p>
                            {scoresInPeriod.length > 0 && (
                              <div className="space-y-3">
                                {(() => {
                                  const raporDetails =
                                    detailsByRaporId.get(scoresInPeriod[0].id) ?? [];
                                  const groupedByMain = new Map<string, DetailRow[]>();
                                  for (const detail of raporDetails) {
                                    if (!groupedByMain.has(detail.main_indicator_name)) {
                                      groupedByMain.set(detail.main_indicator_name, []);
                                    }
                                    groupedByMain.get(detail.main_indicator_name)!.push(detail);
                                  }

                                  return Array.from(groupedByMain.entries()).map(
                                    ([mainIndicator, subIndicators]) => (
                                      <div key={mainIndicator} className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
                                        <p className="font-medium text-slate-900 text-xs mb-2">
                                          {mainIndicator}
                                        </p>
                                        <div className="space-y-1.5">
                                          {subIndicators.map((sub, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-xs py-0.5">
                                              <span className="text-slate-600">{sub.sub_indicator_name}</span>
                                              <span className="font-semibold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                                {Number(sub.score).toFixed(2)}
                                              </span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-500 py-3 text-center">Belum ada data rapor untuk staf magang ini.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600 text-center py-6">Tidak ada staf magang (Cakrawala) terdaftar di unit yang Kamu ampu.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
