import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenteriStaffPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "menteri") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: ownedUnit }, { data: periods }, { data: staffs }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit").eq("id", profile.unit_id).single(),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap")
      .eq("unit_id", profile.unit_id)
      .in("role", ["staff", "user"])
      .order("nama_lengkap"),
  ]);

  const staffByNim = new Map((staffs ?? []).map((staff) => [staff.nim, staff.nama_lengkap]));
  const staffNims = [...staffByNim.keys()];
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: scores } = staffNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, created_at")
        .in("user_nim", staffNims)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null }[] };

  const rows = (scores ?? []).map((score) => {
    const period = periodById.get(score.periode_id);
    return {
      id: score.id,
      staffName: staffByNim.get(score.user_nim) ?? score.user_nim,
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
        <h2 className="text-2xl font-bold text-slate-900">Rapor Staff Unit</h2>
        <p className="text-sm text-slate-600">Seluruh rapor staff untuk unit {ownedUnit?.nama_unit ?? "-"}.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Rapor Staff</CardTitle>
          <CardDescription>Urut dari data terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">{row.staffName}</span>
                  <span className="font-semibold text-slate-900">{row.total_avg.toFixed(2)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {row.bulan}/{row.tahun} ({row.status})
                </p>
                {row.catatan ? <p className="mt-1 text-xs text-slate-600">Catatan: {row.catatan}</p> : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada rapor staff untuk unit ini.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
