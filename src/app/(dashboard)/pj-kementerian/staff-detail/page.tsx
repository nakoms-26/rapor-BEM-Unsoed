import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { RaporDocument } from "@/components/dashboard/rapor-document";
import { ReportPeriodItem } from "@/components/dashboard/report-period-item";

export const dynamic = "force-dynamic";

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

export default async function PjKementerianStaffDetailPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "pj_kementerian" || profile.is_pj_kemenkoan) {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: ownedUnit }, { data: staffProfiles }, { data: periods }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap")
      .eq("unit_id", profile.unit_id)
      .in("role", ["staff", "pj_kementerian"])
      .order("nama_lengkap"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
  ]);

  const staffNims = (staffProfiles ?? []).map((staff) => staff.nim);
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: scores } = staffNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, created_at")
        .in("user_nim", staffNims)
        .eq("report_type", "staf_unit")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null; created_at: string }[] };

  const scoreIds = (scores ?? []).map((score) => score.id);
  const { data: detailRows } = scoreIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", scoreIds)
    : { data: [] as { rapor_id: string; main_indicator_name: string; sub_indicator_name: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[] };

  const detailsByRapor = new Map<string, { main_indicator_name: string; sub_indicator_name: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[]>();
  for (const item of detailRows ?? []) {
    if (!detailsByRapor.has(item.rapor_id)) {
      detailsByRapor.set(item.rapor_id, []);
    }
    detailsByRapor.get(item.rapor_id)!.push({
      main_indicator_name: item.main_indicator_name,
      sub_indicator_name: item.sub_indicator_name,
      score: item.score,
      bentuk_tanggung_jawab: item.bentuk_tanggung_jawab,
      nilai_kuantitatif_tanggung_jawab: item.nilai_kuantitatif_tanggung_jawab,
      skala: item.skala,
      nilai_kuantitatif_skala: item.nilai_kuantitatif_skala,
      nilai_kualitatif: item.nilai_kualitatif,
      nilai_akhir: item.nilai_akhir,
    });
  }

  const scoresByStaff = new Map<string, typeof scores>();
  for (const score of scores ?? []) {
    if (!scoresByStaff.has(score.user_nim)) {
      scoresByStaff.set(score.user_nim, []);
    }
    scoresByStaff.get(score.user_nim)!.push(score);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Staff Unit</h2>
        <p className="text-sm text-slate-600">
          Detail rapor staff untuk unit {ownedUnit?.nama_unit ?? "-"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Staff dan Rapor</CardTitle>
          <CardDescription>Versi print-friendly untuk melihat detail isi rapor staff.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {staffProfiles && staffProfiles.length > 0 ? (
            staffProfiles.map((staff) => {
              const staffScores = scoresByStaff.get(staff.nim) ?? [];
              return (
                <Card key={staff.nim} className="border-slate-200">
                  <CardHeader>
                    <CardTitle>{staff.nama_lengkap}</CardTitle>
                    <CardDescription>NIM: {staff.nim}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {staffScores.length ? (
                      staffScores.map((score, index) => {
                        const period = periodById.get(score.periode_id);
                        return (
                          <ReportPeriodItem
                            key={score.id}
                            defaultOpen={index === 0}
                            title={`${formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)} (${period?.status ?? "draft"})`}
                            scoreLabel={Number(score.total_avg).toFixed(2)}
                          >
                             <RaporDocument
                               reportId={`pj-staff-rapor-${score.id}`}
                              title="Rapor BEM UNSOED 2026"
                              periodLabel={formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)}
                              name={staff.nama_lengkap}
                              jurusan={null}
                              tahunAngkatan={null}
                              unitName={ownedUnit?.nama_unit ?? "-"}
                              totalScore={Number(score.total_avg)}
                              catatan={score.catatan}
                              details={detailsByRapor.get(score.id) ?? []}
                            />
                          </ReportPeriodItem>
                        );
                      })
                    ) : (
                      <p className="text-sm text-slate-600">Belum ada data rapor untuk staff ini.</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <p className="text-sm text-slate-600">Tidak ada staff di unit Anda.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
