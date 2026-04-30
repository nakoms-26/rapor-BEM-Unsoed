import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

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

export default async function MenkoMenteriDetailPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  // Only allow Menko and Admin to view menko->menteri detail pages. PJ roles should not see menteri rapor.
  if (!(profile.role === "menko" || profile.role === "admin")) {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // PJ Kemenkoan should only access /pj-kemenkoan to manage sub-indicators
  if (profile.is_pj_kemenkoan) {
    redirect("/pj-kemenkoan");
  }

  // Get all kementerian/biro under this kemenko
  const { data: coordinatedUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit")
    .eq("parent_id", profile.unit_id)
    .order("nama_unit");

  const unitIds = (coordinatedUnits ?? []).map((u) => u.id);
  const unitById = new Map((coordinatedUnits ?? []).map((u) => [u.id, u.nama_unit]));

  // Get all menteri in these units
  const { data: menteriProfiles } = unitIds.length
    ? await supabase
        .from("profiles")
        .select("nim, nama_lengkap, unit_id")
        .in("unit_id", unitIds)
        .eq("role", "menteri")
        .order("nama_lengkap")
    : { data: [] };

  const menteriNims = (menteriProfiles ?? []).map((m) => m.nim);

  // Get all rapor periods
  const { data: periods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  // Get all rapor scores for menteri
  const { data: scores } = menteriNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan")
        .in("user_nim", menteriNims)
        .eq("report_type", "menteri_kepala_biro")
    : { data: [] };

  // Get all rapor details
  const scoreIds = (scores ?? []).map((s) => s.id);
  const { data: details } = scoreIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", scoreIds)
    : { data: [] };

  // Build maps
  const menteriByNim = new Map((menteriProfiles ?? []).map((m) => [m.nim, m]));
  const periodById = new Map((periods ?? []).map((p) => [p.id, p]));

  const detailsByRaporId = new Map<string, any[]>();
  for (const detail of details ?? []) {
    if (!detailsByRaporId.has(detail.rapor_id)) {
      detailsByRaporId.set(detail.rapor_id, []);
    }
    detailsByRaporId.get(detail.rapor_id)!.push(detail);
  }

  // Group scores by menteri and period
  const scoresByMenteriAndPeriod = new Map<string, Map<string, any[]>>();
  for (const score of scores ?? []) {
    if (!scoresByMenteriAndPeriod.has(score.user_nim)) {
      scoresByMenteriAndPeriod.set(score.user_nim, new Map());
    }
    const menteriPeriods = scoresByMenteriAndPeriod.get(score.user_nim)!;
    if (!menteriPeriods.has(score.periode_id)) {
      menteriPeriods.set(score.periode_id, []);
    }
    menteriPeriods.get(score.periode_id)!.push(score);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rincian Rapor Menteri/Kepala Biro</h2>
        <p className="text-sm text-slate-600">
          Detail penilaian untuk seluruh menteri/kepala biro di bawah koordinasi Anda.
        </p>
      </div>

      {menteriProfiles && menteriProfiles.length > 0 ? (
        <div className="space-y-6">
          {menteriProfiles.map((menteri) => {
            const unitName = unitById.get(menteri.unit_id);
            const menteriScores = scoresByMenteriAndPeriod.get(menteri.nim);
            const hasScores = menteriScores && menteriScores.size > 0;

            return (
              <Card key={menteri.nim}>
                <CardHeader>
                  <CardTitle>{menteri.nama_lengkap}</CardTitle>
                  <CardDescription>
                    Unit: {unitName ?? "-"} | NIM: {menteri.nim}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {hasScores ? (
                    <div className="space-y-4">
                      {Array.from(menteriScores!.entries()).map(([periodId, scoresInPeriod]) => {
                        const period = periodById.get(periodId);
                        return (
                          <div key={periodId} className="border rounded-lg p-4 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <p className="font-semibold text-slate-900">
                                  {formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)}
                                </p>
                                <p className="text-sm text-slate-600">Status: {period?.status}</p>
                              </div>
                              {scoresInPeriod.length > 0 && (
                                <div className="text-right">
                                  <p className="text-sm text-slate-600">Nilai Total</p>
                                  <p className="text-lg font-bold text-slate-900">
                                    {Number(scoresInPeriod[0].total_avg).toFixed(2)}
                                  </p>
                                </div>
                              )}
                            </div>

                            {scoresInPeriod[0]?.catatan && (
                              <div className="bg-slate-50 rounded p-2 text-sm">
                                <p className="text-slate-700">Catatan: {scoresInPeriod[0].catatan}</p>
                              </div>
                            )}

                            {/* Rincian per indikator */}
                            <div className="space-y-2">
                              <p className="font-medium text-slate-900 text-sm">Rincian per Indikator:</p>
                              {scoresInPeriod.length > 0 && (
                                <div className="space-y-2">
                                  {(() => {
                                    const raporDetails =
                                      detailsByRaporId.get(scoresInPeriod[0].id) ?? [];
                                    const groupedByMain = new Map<string, any[]>();
                                    for (const detail of raporDetails) {
                                      if (!groupedByMain.has(detail.main_indicator_name)) {
                                        groupedByMain.set(detail.main_indicator_name, []);
                                      }
                                      groupedByMain.get(detail.main_indicator_name)!.push(detail);
                                    }

                                    return Array.from(groupedByMain.entries()).map(
                                      ([mainIndicator, subIndicators]) => (
                                        <div key={mainIndicator} className="ml-2">
                                          <p className="font-medium text-slate-700 text-sm mb-1">
                                            {mainIndicator}
                                          </p>
                                          <div className="ml-4 space-y-1">
                                            {subIndicators.map((sub, idx) => (
                                              <div key={idx} className="flex justify-between text-xs">
                                                <span className="text-slate-600">{sub.sub_indicator_name}</span>
                                                <span className="font-semibold text-slate-900">
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
                    <p className="text-sm text-slate-600">Belum ada data rapor untuk menteri ini.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Tidak ada menteri/kepala biro di bawah koordinasi Anda.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
