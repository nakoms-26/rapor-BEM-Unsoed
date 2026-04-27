import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { canAccessKemenkoReports } from "@/lib/auth/permissions";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { MenkoMenteriInputForm } from "@/components/dashboard/menko-menteri-input-form";

export const dynamic = "force-dynamic";

export default async function MenkoMenteriPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (!canAccessKemenkoReports(profile)) {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // PJ Kemenkoan should only access /pj-kemenkoan to manage sub-indicators
  if (profile.is_pj_kemenkoan) {
    redirect("/pj-kemenkoan");
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
  const sortedPeriods = [...(periods ?? [])].sort((a, b) => {
    if (a.tahun !== b.tahun) return b.tahun - a.tahun;
    return b.bulan - a.bulan;
  });

  const { data: menteriProfiles } = unitIds.length
    ? await supabase
        .from("profiles")
        .select("nim, nama_lengkap, unit_id")
        .in("unit_id", unitIds)
        .eq("role", "menteri")
    : { data: [] as { nim: string; nama_lengkap: string; unit_id: string }[] };

  const menteriByNim = new Map((menteriProfiles ?? []).map((item) => [item.nim, item]));
  const menteriNims = [...menteriByNim.keys()];
  const menteriOptions = (menteriProfiles ?? []).map((item) => ({
    nim: item.nim,
    nama_lengkap: item.nama_lengkap,
    unit_name: unitById.get(item.unit_id) ?? "-",
  }));

  const { data: scores } = menteriNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, created_at")
        .in("user_nim", menteriNims)
        .eq("report_type", "menteri_kepala_biro")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null }[] };

  const rows = (scores ?? []).map((score) => {
    const menteri = menteriByNim.get(score.user_nim);
    const period = periodById.get(score.periode_id);
    const unitName = unitById.get(menteri?.unit_id ?? "") ?? "-";

    return {
      id: score.id,
      nama: menteri?.nama_lengkap ?? score.user_nim,
      unit: unitName,
      total_avg: Number(score.total_avg),
      catatan: score.catatan,
      bulan: period?.bulan ?? 0,
      tahun: period?.tahun ?? 0,
      status: period?.status ?? "draft",
    };
  });

  const groupedByUnit = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!groupedByUnit.has(row.unit)) {
      groupedByUnit.set(row.unit, []);
    }
    groupedByUnit.get(row.unit)!.push(row);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Rapor Para Menteri</h2>
        <p className="text-sm text-slate-600">Rapor menteri/kepala biro di bawah koordinasi Anda.</p>
      </div>

      <MenkoMenteriInputForm periods={sortedPeriods} menteriOptions={menteriOptions} />

      <Card>
        <CardHeader>
          <CardTitle>Daftar Rapor Menteri (Struktur Folder)</CardTitle>
          <CardDescription>Pengelompokan: Kemenko Anda &gt; Kementerian/Biro.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length ? (
            [...groupedByUnit.entries()].map(([unitName, unitRows]) => (
              <details key={unitName} open className="rounded-md border border-slate-200 bg-slate-50/50">
                <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-slate-700">
                  {profile.nama_lengkap} (Menko) &gt; {unitName}
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  {unitRows.map((row) => (
                    <div key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
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
                  ))}
                </div>
              </details>
            ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor menteri pada unit terkoordinasi.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
