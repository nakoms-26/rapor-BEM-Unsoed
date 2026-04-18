import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function reportTypeLabel(type: "staf_unit" | "menteri_kepala_biro") {
  return type === "menteri_kepala_biro" ? "Menteri/Kepala Biro" : "Staf Unit";
}

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 70) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

export default async function PresidenWakilPresidenPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "pres_wapres") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const [{ data: units }, { data: periods }, { data: profiles }, { data: scores }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status"),
    supabase.from("profiles").select("nim, nama_lengkap, unit_id, role"),
    supabase
      .from("rapor_scores")
      .select("id, user_nim, penilai_nim, periode_id, report_type, total_avg, catatan, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  const unitById = new Map((units ?? []).map((item) => [item.id, item]));
  const profileByNim = new Map((profiles ?? []).map((item) => [item.nim, item]));
  const periodById = new Map((periods ?? []).map((item) => [item.id, item]));

  const rows = (scores ?? []).map((score) => {
    const target = profileByNim.get(score.user_nim);
    const evaluator = profileByNim.get(score.penilai_nim);
    const period = periodById.get(score.periode_id);
    const targetUnit = unitById.get(target?.unit_id ?? "");
    const parentKemenko = targetUnit?.kategori === "kemenko"
      ? targetUnit
      : unitById.get(targetUnit?.parent_id ?? "");

    return {
      id: score.id,
      targetName: target?.nama_lengkap ?? score.user_nim,
      targetRole: target?.role ?? "-",
      unitName: targetUnit?.nama_unit ?? "-",
      kemenkoName: parentKemenko?.nama_unit ?? "Tanpa Kemenko",
      evaluatorName: evaluator?.nama_lengkap ?? score.penilai_nim,
      totalAvg: Number(score.total_avg),
      reportType: score.report_type,
      catatan: score.catatan,
      periodeLabel: period ? `${period.bulan}/${period.tahun} (${period.status})` : "Periode tidak ditemukan",
    };
  });

  const groupedReports = new Map<string, Map<string, typeof rows>>();
  for (const row of rows) {
    if (!groupedReports.has(row.kemenkoName)) {
      groupedReports.set(row.kemenkoName, new Map());
    }
    const unitGroup = groupedReports.get(row.kemenkoName)!;
    if (!unitGroup.has(row.unitName)) {
      unitGroup.set(row.unitName, []);
    }
    unitGroup.get(row.unitName)!.push(row);
  }

  const totalReports = rows.length;
  const totalUnitsWithReports = new Set(rows.map((row) => row.unitName)).size;
  const totalKemenko = groupedReports.size;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Presiden & Wakil Presiden</h2>
        <p className="text-sm text-slate-600">Akses baca seluruh rapor lintas unit tanpa fitur input.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seluruh Rapor (Struktur Folder)</CardTitle>
          <CardDescription>Pengelompokan: Kemenko &gt; Kementerian/Biro &gt; daftar rapor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{totalReports}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Total Kemenko</p>
              <p className="text-sm font-semibold text-slate-800">{totalKemenko}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Unit Dengan Rapor</p>
              <p className="text-sm font-semibold text-slate-800">{totalUnitsWithReports}</p>
            </div>
          </div>

          {rows.length ? (
            [...groupedReports.entries()].map(([kemenkoName, unitGroup]) => {
              const kemenkoCount = [...unitGroup.values()].reduce((sum, groupRows) => sum + groupRows.length, 0);
              return (
              <details key={kemenkoName} open className="rounded-lg border border-slate-200 bg-slate-50/50">
                <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-semibold text-slate-800">
                  <span>{kemenkoName}</span>
                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs text-slate-600">
                    {kemenkoCount} rapor
                  </span>
                </summary>
                <div className="space-y-2 px-3 pb-3">
                  {[...unitGroup.entries()].map(([unitName, unitRows]) => (
                    <details key={`${kemenkoName}-${unitName}`} open className="rounded-md border border-slate-200 bg-white">
                      <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-slate-700">
                        <span>{kemenkoName} &gt; {unitName}</span>
                        <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                          {unitRows.length} rapor
                        </span>
                      </summary>
                      <div className="space-y-2 px-3 pb-3">
                        {unitRows.map((row) => (
                          <div key={row.id} className="rounded-md border border-slate-200 px-3 py-2 text-sm">
                            <div className="flex items-start justify-between gap-3">
                              <div className="space-y-1">
                                <p className="font-medium text-slate-800">{row.targetName}</p>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                                    {reportTypeLabel(row.reportType)}
                                  </span>
                                  <span>{row.periodeLabel}</span>
                                </div>
                                <p className="text-xs text-slate-500">{row.unitName} - role: {row.targetRole}</p>
                                <p className="text-xs text-slate-500">Penilai: {row.evaluatorName}</p>
                                {row.catatan ? <p className="text-xs text-slate-500">Catatan: {row.catatan}</p> : null}
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreTone(row.totalAvg)}`}>
                                {row.totalAvg.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            );})
          ) : (
            <p className="text-sm text-slate-600">Belum ada data rapor.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}