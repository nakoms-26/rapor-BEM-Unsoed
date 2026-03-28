import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

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

  const { data: details } = latestScore
    ? await supabase
        .from("rapor_details")
        .select("main_indicator_name, score")
        .eq("rapor_id", latestScore.id)
    : { data: [] as { main_indicator_name: string; score: number }[] };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Personal</h2>
        <p className="text-sm text-slate-600">Semua periode rapor bulanan untuk {profile.nama_lengkap}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Total Average</CardTitle>
          <CardDescription>Skala 0 - 5</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold text-slate-900">{latestScore?.total_avg?.toFixed(2) ?? "0.00"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {latestScore ? `${latestScore.bulan}/${latestScore.tahun} (${latestScore.status})` : "Belum ada data"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat Periode Rapor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {raporByPeriod.length ? (
            raporByPeriod.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {row.bulan}/{row.tahun} ({row.status})
                  </span>
                  <span className="font-semibold text-slate-900">{row.total_avg.toFixed(2)}</span>
                </div>
                {row.catatan ? <p className="mt-1 text-xs text-slate-600">Catatan: {row.catatan}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada rapor yang tersedia.</p>
          )}

          {latestScore && details?.length ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Detail indikator periode terbaru</p>
              <div className="space-y-1 text-sm text-slate-600">
                {details.map((item, idx) => (
                  <p key={`${item.main_indicator_name}-${idx}`}>
                    {item.main_indicator_name}: {Number(item.score).toFixed(2)}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </section>
  );
}
