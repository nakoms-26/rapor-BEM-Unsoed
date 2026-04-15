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

export default async function PjKementerianPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "pj_kementerian") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");

    // Block PJ Kemenkoan from accessing this page
    if (profile.is_pj_kemenkoan) {
      redirect("/dashboard/pj-kemenkoan");
    }
  }

  const [{ data: ownedUnit }, { data: periods }, { data: selfScores }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("rapor_scores")
      .select("id, periode_id, total_avg, catatan, created_at")
      .eq("user_nim", profile.nim)
      .eq("report_type", "staf_unit")
      .order("created_at", { ascending: false }),
  ]);

  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));
  const rows = (selfScores ?? []).map((score) => {
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

  const raporIds = rows.map((row) => row.id);
  const { data: detailRows } = raporIds.length
    ? await supabase
        .from("rapor_details")
        .select("rapor_id, main_indicator_name, sub_indicator_name, score")
        .in("rapor_id", raporIds)
    : { data: [] as { rapor_id: string; main_indicator_name: string; sub_indicator_name: string; score: number }[] };

  const detailsByRapor = new Map<string, { main_indicator_name: string; sub_indicator_name: string; score: number }[]>();
  for (const item of detailRows ?? []) {
    if (!detailsByRapor.has(item.rapor_id)) {
      detailsByRapor.set(item.rapor_id, []);
    }
    detailsByRapor.get(item.rapor_id)!.push({
      main_indicator_name: item.main_indicator_name,
      sub_indicator_name: item.sub_indicator_name,
      score: item.score,
    });
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Diri PJ Kementerian</h2>
        <p className="text-sm text-slate-600">
          Riwayat rapor pribadi untuk unit {ownedUnit?.nama_unit ?? "-"}.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Periode Rapor</CardTitle>
          <CardDescription>Urut dari periode terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            rows.map((row, index) => (
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
                  unitName={ownedUnit?.nama_unit ?? "-"}
                  categoryLabel={row.total_avg >= 4 ? "SANGAT BAIK" : row.total_avg >= 3 ? "BAIK" : "CUKUP"}
                  totalScore={Number(row.total_avg)}
                  catatan={row.catatan}
                  details={detailsByRapor.get(row.id) ?? []}
                />
              </ReportPeriodItem>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor pribadi.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
