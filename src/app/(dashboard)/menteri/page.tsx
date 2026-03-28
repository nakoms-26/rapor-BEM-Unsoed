import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenteriPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "menteri") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: ownedUnit }, { data: periods }, { data: selfScores }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("rapor_scores")
      .select("id, periode_id, total_avg, catatan, created_at")
      .eq("user_nim", profile.nim)
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Diri Menteri/Kepala Biro</h2>
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
            rows.map((row) => (
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
            <p className="text-sm text-slate-600">Belum ada data rapor pribadi.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
