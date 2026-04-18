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

export default async function StaffPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (!profile) {
    redirect("/login");
  }

  if (profile.role !== "staff") {
    redirect(ROLE_HOME[profile.role] ?? "/login");
  }

  const [{ data: periods }, { data: allScores }] = await Promise.all([
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("rapor_scores")
      .select("id, periode_id, total_avg, catatan, created_at")
      .eq("user_nim", profile.nim)
      .eq("report_type", "staf_unit")
      .order("created_at", { ascending: false }),
  ]);

  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const raporByPeriod = (allScores ?? []).map((score) => {
    const period = periodById.get(score.periode_id);
    return {
      id: score.id,
      total_avg: Number(score.total_avg),
      catatan: score.catatan,
      bulan: period?.bulan ?? 0,
      tahun: period?.tahun ?? 0,
      status: period?.status ?? "draft",
    };
  });

  const latestScore = raporByPeriod[0];
  const raporIds = raporByPeriod.map((row) => row.id);

  const detailRows = raporIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .in("rapor_id", raporIds)
    : { data: [] as { rapor_id: string; main_indicator_name: string; sub_indicator_name: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[] };

  const detailsByRapor = new Map<string, { main_indicator_name: string; sub_indicator_name: string; score: number; bentuk_tanggung_jawab: string | null; nilai_kuantitatif_tanggung_jawab: number | null; skala: string | null; nilai_kuantitatif_skala: number | null; nilai_kualitatif: number | null; nilai_akhir: number | null }[]>();
  for (const item of detailRows.data ?? []) {
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

  const latestUnit = await supabase
    .from("ref_units")
    .select("nama_unit")
    .eq("id", profile.unit_id)
    .single();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Personal</h2>
        <p className="text-sm text-slate-600">Semua periode rapor bulanan untuk {profile.nama_lengkap}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nilai Kumulatif</CardTitle>
          <CardDescription>Skala 0 - 100 (tanpa nilai prestasi)</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-slate-900">{latestScore?.total_avg?.toFixed(2) ?? "0.00"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {latestScore ? `${formatPeriode(latestScore.bulan, latestScore.tahun)} (${latestScore.status})` : "Belum ada data"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Periode Rapor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {raporByPeriod.length ? (
            raporByPeriod.map((row, index) => (
              <ReportPeriodItem
                key={row.id}
                defaultOpen={index === 0}
                title={`${formatPeriode(row.bulan, row.tahun)} (${row.status})`}
                scoreLabel={row.total_avg.toFixed(2)}
              >
                <RaporDocument
                  reportId={`rapor-${row.id}`}
                  title="Rapor BEM UNSOED 2025"
                  periodLabel={formatPeriode(row.bulan, row.tahun)}
                  name={profile.nama_lengkap}
                  jurusan={null}
                  tahunAngkatan={null}
                  unitName={latestUnit.data?.nama_unit ?? "-"}
                  totalScore={Number(row.total_avg)}
                  catatan={row.catatan}
                  details={detailsByRapor.get(row.id) ?? []}
                />
              </ReportPeriodItem>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada rapor yang tersedia.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
