import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenkoMenteriPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "menko") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: coordinatedUnits }, { data: periods }] = await Promise.all([
    supabase
      .from("ref_units")
      .select("id, nama_unit")
      .eq("parent_id", profile.unit_id)
      .order("nama_unit"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
  ]);

  const unitById = new Map((coordinatedUnits ?? []).map((unit) => [unit.id, unit.nama_unit]));
  const unitIds = [...unitById.keys()];
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: menteriProfiles } = unitIds.length
    ? await supabase
        .from("profiles")
        .select("nim, nama_lengkap, unit_id")
        .in("unit_id", unitIds)
        .eq("role", "menteri")
    : { data: [] as { nim: string; nama_lengkap: string; unit_id: string }[] };

  const menteriByNim = new Map((menteriProfiles ?? []).map((item) => [item.nim, item]));
  const menteriNims = [...menteriByNim.keys()];

  const { data: scores } = menteriNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, created_at")
        .in("user_nim", menteriNims)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null }[] };

  const rows = (scores ?? []).map((score) => {
    const menteri = menteriByNim.get(score.user_nim);
    const period = periodById.get(score.periode_id);

    return {
      id: score.id,
      nama: menteri?.nama_lengkap ?? score.user_nim,
      unit: unitById.get(menteri?.unit_id ?? "") ?? "-",
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
        <h2 className="text-2xl font-bold text-slate-900">Rapor Para Menteri</h2>
        <p className="text-sm text-slate-600">Rapor menteri/kepala biro di bawah koordinasi Anda.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Rapor Menteri</CardTitle>
          <CardDescription>Urut dari data terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-700">{row.nama}</p>
                    <p className="text-xs text-slate-500">{row.unit}</p>
                  </div>
                  <span className="font-semibold text-slate-900">{row.total_avg.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {row.bulan}/{row.tahun} ({row.status})
                </p>
                {row.catatan ? <p className="mt-1 text-xs text-slate-600">Catatan: {row.catatan}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor menteri pada unit terkoordinasi.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
