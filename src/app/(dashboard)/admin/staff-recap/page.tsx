import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminStaffRecapPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  if (profile.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: units }, { data: staffs }, { data: periods }, { data: scores }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id").order("kategori").order("nama_unit"),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .in("role", ["staff", "pj_kementerian"])
      .order("nama_lengkap"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    supabase
      .from("rapor_scores")
      .select("id, user_nim, periode_id, total_avg, catatan, created_at")
      .eq("report_type", "staf_unit")
      .order("created_at", { ascending: false }),
  ]);

  const unitById = new Map((units ?? []).map((unit) => [unit.id, unit]));
  const staffByUnit = new Map<string, { nim: string; nama_lengkap: string; unit_id: string }[]>();
  for (const staff of staffs ?? []) {
    if (!staffByUnit.has(staff.unit_id)) {
      staffByUnit.set(staff.unit_id, []);
    }
    staffByUnit.get(staff.unit_id)!.push(staff);
  }

  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));
  const scoreByNim = new Map<string, { total_avg: number; periode: string; catatan: string | null }>();
  for (const score of scores ?? []) {
    const period = periodById.get(score.periode_id);
    const current = scoreByNim.get(score.user_nim);
    const scorePeriodKey = `${period?.tahun ?? 0}-${period?.bulan ?? 0}`;
    const currentKey = current?.periode ?? "";
    if (!current || scorePeriodKey > currentKey) {
      scoreByNim.set(score.user_nim, {
        total_avg: Number(score.total_avg),
        periode: scorePeriodKey,
        catatan: score.catatan,
      });
    }
  }

  const groupedUnits = (units ?? []).filter((unit) => unit.kategori === "kementerian" || unit.kategori === "biro");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Recap Seluruh Staff Kabinet</h2>
        <p className="text-sm text-slate-600">Dikelompokkan berdasarkan kementerian/biro.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Staff per Kementerian/Biro</CardTitle>
          <CardDescription>Ringkasan seluruh staff dalam kabinet.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {groupedUnits.map((unit) => {
            const unitStaffs = staffByUnit.get(unit.id) ?? [];
            return (
              <details key={unit.id} open className="rounded-lg border border-slate-200 bg-slate-50/50">
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-800">
                  {unit.nama_unit} ({unitStaffs.length} staff)
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  {unitStaffs.length ? (
                    unitStaffs.map((staff) => {
                      const latestScore = scoreByNim.get(staff.nim);
                      return (
                        <div key={staff.nim} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-slate-800">{staff.nama_lengkap}</p>
                              <p className="text-xs text-slate-500">NIM: {staff.nim}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-500">Rapor Terbaru</p>
                              <p className="font-semibold text-slate-900">{latestScore ? latestScore.total_avg.toFixed(2) : "0.00"}</p>
                            </div>
                          </div>
                          {latestScore?.catatan ? <p className="mt-1 text-xs text-slate-600">Catatan: {latestScore.catatan}</p> : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-slate-600">Belum ada staff di unit ini.</p>
                  )}
                </div>
              </details>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}
