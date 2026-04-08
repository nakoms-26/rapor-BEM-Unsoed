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

export default async function MenteriStaffDetailPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "menteri") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // Get all staff under this menteri
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap")
    .eq("unit_id", profile.unit_id)
    .eq("role", "staff")
    .order("nama_lengkap");

  const staffNims = (staffProfiles ?? []).map((s) => s.nim);

  // Get all rapor periods
  const { data: periods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  // Get all rapor scores for staff
  const { data: scores } = staffNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan")
        .in("user_nim", staffNims)
        .eq("report_type", "staf_unit")
    : { data: [] };

  // Get all rapor details
  const scoreIds = (scores ?? []).map((s) => s.id);
  const { data: details } = scoreIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score")
        .in("rapor_id", scoreIds)
    : { data: [] };

  // Build maps
  const staffByNim = new Map((staffProfiles ?? []).map((s) => [s.nim, s]));
  const periodById = new Map((periods ?? []).map((p) => [p.id, p]));
  
  const detailsByRaporId = new Map<string, any[]>();
  for (const detail of details ?? []) {
    if (!detailsByRaporId.has(detail.rapor_id)) {
      detailsByRaporId.set(detail.rapor_id, []);
    }
    detailsByRaporId.get(detail.rapor_id)!.push(detail);
  }

  // Group scores by staff and period
  const scoresByStaffAndPeriod = new Map<string, Map<string, any[]>>();
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rincian Rapor Staff</h2>
        <p className="text-sm text-slate-600">
          Detail penilaian untuk seluruh staff di unit Anda.
        </p>
      </div>

      {staffProfiles && staffProfiles.length > 0 ? (
        <div className="space-y-6">
          {staffProfiles.map((staff) => {
            const staffScores = scoresByStaffAndPeriod.get(staff.nim);
            const hasScores = staffScores && staffScores.size > 0;

            return (
              <Card key={staff.nim}>
                <CardHeader>
                  <CardTitle>{staff.nama_lengkap}</CardTitle>
                  <CardDescription>NIM: {staff.nim}</CardDescription>
                </CardHeader>
                <CardContent>
                  {hasScores ? (
                    <div className="space-y-4">
                      {Array.from(staffScores!.entries()).map(([periodId, scoresInPeriod]) => {
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
                    <p className="text-sm text-slate-600">Belum ada data rapor untuk staff ini.</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Tidak ada staff di unit Anda.</p>
          </CardContent>
        </Card>
      )}
    </section>
  );
}
