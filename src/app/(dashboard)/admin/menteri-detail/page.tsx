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

export default async function AdminMenteriDetailPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: units }, { data: periods }, { data: menteriProfiles }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, parent_id").order("nama_unit"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .eq("role", "menteri")
      .order("nama_lengkap"),
  ]);

  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const menteriNims = (menteriProfiles ?? []).map((item) => item.nim);
  const { data: scores } = menteriNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, created_at")
        .in("user_nim", menteriNims)
        .eq("report_type", "menteri_kepala_biro")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null; created_at: string }[] };

  const raporIds = (scores ?? []).map((score) => score.id);
  const { data: detailRows } = raporIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", raporIds)
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

  const staffByUnit = new Map<string, typeof menteriProfiles>();
  for (const menteri of menteriProfiles ?? []) {
    if (!staffByUnit.has(menteri.unit_id)) {
      staffByUnit.set(menteri.unit_id, []);
    }
    staffByUnit.get(menteri.unit_id)!.push(menteri);
  }

  const groupedByKemenko = new Map<string, { unit: string; menteri: typeof menteriProfiles; scoreRows: typeof scores }[]>();
  for (const menteri of menteriProfiles ?? []) {
    const unit = unitById.get(menteri.unit_id);
    const parentKemenko = unit?.parent_id ? unitById.get(unit.parent_id) : undefined;
    const groupKey = parentKemenko?.nama_unit ?? "Tanpa Kemenko";
    if (!groupedByKemenko.has(groupKey)) {
      groupedByKemenko.set(groupKey, []);
    }
    groupedByKemenko.get(groupKey)!.push({
      unit: unit?.nama_unit ?? "-",
      menteri: [menteri],
      scoreRows: (scores ?? []).filter((score) => score.user_nim === menteri.nim),
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Menteri</h2>
        <p className="text-sm text-slate-600">Seluruh rapor menteri/kepala biro dalam kabinet.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rapor Menteri per Kementerian/Biro</CardTitle>
          <CardDescription>Format detail dapat dicetak per periode.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedByKemenko.size ? (
            [...groupedByKemenko.entries()].map(([kemenkoName, items]) => (
              <details key={kemenkoName} open className="rounded-lg border border-slate-200 bg-slate-50/50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">
                  {kemenkoName}
                </summary>
                <div className="space-y-3 px-3 pb-3">
                  {items.map((item) => {
                    const menteri = item.menteri?.[0];
                    const rows = item.scoreRows ?? [];
                    return (
                      <Card key={menteri?.nim ?? item.unit} className="border-slate-200">
                        <CardHeader>
                          <CardTitle>{menteri?.nama_lengkap ?? "-"}</CardTitle>
                          <CardDescription>{item.unit}</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {rows.length ? (
                            rows.map((row, index) => {
                              const period = periodById.get(row.periode_id);
                              return (
                                <ReportPeriodItem
                                  key={row.id}
                                  defaultOpen={index === 0}
                                  title={`${formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)} (${period?.status ?? "draft"})`}
                                  scoreLabel={Number(row.total_avg).toFixed(2)}
                                >
                                  <RaporDocument
                                    reportId={`admin-menteri-${row.id}`}
                                    title="Rapor BEM UNSOED 2025"
                                    periodLabel={formatPeriode(period?.bulan ?? 0, period?.tahun ?? 0)}
                                    name={menteri?.nama_lengkap ?? "-"}
                                    jurusan={null}
                                    tahunAngkatan={null}
                                    unitName={item.unit}
                                    totalScore={Number(row.total_avg)}
                                    catatan={row.catatan}
                                    details={detailsByRapor.get(row.id) ?? []}
                                  />
                                </ReportPeriodItem>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-600">Belum ada rapor untuk menteri ini.</p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </details>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor menteri.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
