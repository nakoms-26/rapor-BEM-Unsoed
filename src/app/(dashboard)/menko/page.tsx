import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MenkoRecapChart } from "@/components/dashboard/menko-recap-chart";
import { requireSessionProfile } from "@/lib/auth/session";
import { canAccessKemenkoReports } from "@/lib/auth/permissions";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();

  if (!canAccessKemenkoReports(menkoProfile)) {
    redirect(ROLE_HOME[menkoProfile.role] ?? "/dashboard");
  }

  const { data: activePeriod } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun")
    .eq("status", "published")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false })
    .limit(1)
    .single();

  const { data: coordinatedUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit")
    .eq("parent_id", menkoProfile.unit_id);

  const unitIds = (coordinatedUnits ?? []).map((unit) => unit.id);

  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("nim, unit_id")
    .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
    .in("role", ["staff", "user"]);

  const staffNims = (staffProfiles ?? []).map((item) => item.nim);
  const unitByStaffNim = new Map((staffProfiles ?? []).map((item) => [item.nim, item.unit_id]));

  const { data: scores } = activePeriod
    ? await supabase
        .from("rapor_scores")
        .select("user_nim, total_avg")
        .eq("periode_id", activePeriod.id)
        .eq("report_type", "staf_unit")
        .in("user_nim", staffNims.length ? staffNims : ["-"])
    : { data: [] as { user_nim: string; total_avg: number }[] };

  const scoreBuckets = new Map<string, number[]>();
  for (const score of scores ?? []) {
    const unitId = unitByStaffNim.get(score.user_nim);
    if (!unitId) continue;
    if (!scoreBuckets.has(unitId)) {
      scoreBuckets.set(unitId, []);
    }
    scoreBuckets.get(unitId)!.push(Number(score.total_avg));
  }

  const rows = (coordinatedUnits ?? []).map((unit) => {
    const unitScores = scoreBuckets.get(unit.id) ?? [];
    const average = unitScores.length
      ? Number((unitScores.reduce((sum, value) => sum + value, 0) / unitScores.length).toFixed(2))
      : 0;
    return {
      unit_name: unit.nama_unit,
      average_score: average,
      staff_count: unitScores.length,
    };
  });

  const scoredRows = rows.filter((row) => row.staff_count > 0);
  const highestUnit = [...scoredRows].sort((a, b) => b.average_score - a.average_score)[0];
  const lowestUnit = [...scoredRows].sort((a, b) => a.average_score - b.average_score)[0];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Menko</h2>
        <p className="text-sm text-slate-600">Rekap rata-rata nilai per kementerian/biro di bawah koordinasi Anda.</p>
      </div>
      
      <div className="flex gap-2">
        <Link
          href="/menko/menteri-detail"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm-9 14a5 5 0 0 1 10 0M20 8a3 3 0 1 1-2.65 4.4M18 21a4 4 0 0 0-3-3.87" />
          </svg>
          <span>Lihat Rincian Rapor Menteri</span>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recap Periode Published</CardTitle>
          <CardDescription>
            {activePeriod ? `Periode ${activePeriod.bulan}/${activePeriod.tahun}` : "Belum ada periode published"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Rata-rata Unit Tertinggi</p>
            <p className="text-sm font-semibold text-slate-900">{highestUnit?.unit_name ?? "-"}</p>
            <p className="text-xs text-slate-600">{highestUnit ? highestUnit.average_score.toFixed(2) : "0.00"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Rata-rata Unit Terendah</p>
            <p className="text-sm font-semibold text-slate-900">{lowestUnit?.unit_name ?? "-"}</p>
            <p className="text-xs text-slate-600">{lowestUnit ? lowestUnit.average_score.toFixed(2) : "0.00"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Total Unit Terskor</p>
            <p className="text-sm font-semibold text-slate-900">{scoredRows.length}</p>
            <p className="text-xs text-slate-600">dari {(coordinatedUnits ?? []).length} unit koordinasi</p>
          </div>
        </CardContent>
      </Card>

      <MenkoRecapChart
        data={rows.map((item) => ({
          unit_name: item.unit_name,
          average_score: item.average_score,
          highest_staff: "-",
          highest_score: 0,
          lowest_staff: "-",
          lowest_score: 0,
        }))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((item) => (
          <Card key={item.unit_name}>
            <CardHeader>
              <CardTitle>{item.unit_name}</CardTitle>
              <CardDescription>Rekap nilai staf unit periode aktif</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p>Rata-rata: {item.average_score.toFixed(2)}</p>
              <p>Jumlah staf terskor: {item.staff_count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
