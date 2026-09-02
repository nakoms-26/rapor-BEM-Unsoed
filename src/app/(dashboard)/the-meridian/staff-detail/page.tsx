import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

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

export default async function TheMeridianStaffDetailPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "the_meridian") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // Get all internship staff under this meridian unit
  const { data: internProfiles } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap")
    .eq("unit_id", profile.unit_id)
    .eq("role", "internship")
    .order("nama_lengkap");

  const internNims = (internProfiles ?? []).map((s) => s.nim);

  // Get all rapor periods
  const { data: periods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  // Get all rapor scores for internship
  const { data: scores } = internNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan")
        .in("user_nim", internNims)
        .in("report_type", ["internship", "staf_unit"])
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null }[] };

  // Get all rapor details
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
            href="/the-meridian"
            className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Kembali ke Dashboard The Meridian</span>
          </Link>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-slate-900">Rincian Indikator Rapor Cakrawala</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-xs font-semibold text-indigo-700">
              <Sparkles className="h-3 w-3" />
              The Meridian
            </span>
          </div>
          <p className="text-sm text-slate-600">
            Rincian penilaian per indikator untuk seluruh staf magang Cakrawala di kementerian/biro Kamu.
          </p>
        </div>
      </div>

      {internProfiles && internProfiles.length > 0 ? (
        <div className="space-y-6">
          {internProfiles.map((intern) => {
            const internScores = scoresByStaffAndPeriod.get(intern.nim);
            const hasScores = internScores && internScores.size > 0;

            return (
              <Card key={intern.nim} className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                  <CardTitle className="text-lg text-slate-900">{intern.nama_lengkap}</CardTitle>
                  <CardDescription>NIM: {intern.nim}</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  {hasScores ? (
                    <div className="space-y-4">
                      {Array.from(internScores!.entries()).map(([periodId, scoresInPeriod]) => {
                        const period = periodById.get(periodId);
                        return (
                          <div key={periodId} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-xs">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)}
                                </p>
                                <p className="text-xs text-slate-500 capitalize">Status: {period?.status}</p>
                              </div>
                              {scoresInPeriod.length > 0 && (
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">Nilai Rata-rata</p>
                                  <p className="text-lg font-bold text-indigo-700">
                                    {Number(scoresInPeriod[0].total_avg).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {scoresInPeriod[0]?.catatan && (
                              <div className="bg-slate-50 rounded-lg p-2.5 text-xs text-slate-700 border border-slate-100">
                                <span className="font-semibold">Catatan Penilai:</span> {scoresInPeriod[0].catatan}
                              </div>
                            )}

                            {/* Rincian per indikator */}
                            <div className="space-y-3 pt-2">
                              <p className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
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
                      })}
                    </div>
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
            <p className="text-sm text-slate-600 text-center py-6">Tidak ada staf magang (Cakrawala) terdaftar di unit Kamu.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
