import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MenkoRecapChart } from "@/components/dashboard/menko-recap-chart";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { MenkoRecapItem } from "@/types/app";

export const dynamic = "force-dynamic";

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();

  if (menkoProfile?.role !== "menko") {
    redirect(ROLE_HOME[menkoProfile.role] ?? "/dashboard");
  }

  const { data: activePeriod } = await supabase
    .from("rapor_periods")
    .select("id")
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

  const { data: staffs } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap, unit_id")
    .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
    .in("role", ["staff", "user"]);

  const staffByNim = new Map((staffs ?? []).map((staff) => [staff.nim, staff]));

  const { data: scores } = activePeriod
    ? await supabase
        .from("rapor_scores")
        .select("user_nim, total_avg")
        .eq("periode_id", activePeriod.id)
        .in("user_nim", [...staffByNim.keys()])
    : { data: [] as { user_nim: string; total_avg: number }[] };

  const unitGroups = new Map<string, { name: string; values: { staff: string; score: number }[] }>();

  for (const unit of coordinatedUnits ?? []) {
    unitGroups.set(unit.id, { name: unit.nama_unit, values: [] });
  }

  for (const score of scores ?? []) {
    const staff = staffByNim.get(score.user_nim);
    if (!staff) continue;
    const group = unitGroups.get(staff.unit_id);
    if (!group) continue;
    group.values.push({ staff: staff.nama_lengkap, score: Number(score.total_avg) });
  }

  const recapData: MenkoRecapItem[] = [...unitGroups.values()].map((group) => {
    const sorted = [...group.values].sort((a, b) => b.score - a.score);
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    const average = sorted.length ? sorted.reduce((sum, item) => sum + item.score, 0) / sorted.length : 0;

    return {
      unit_name: group.name,
      average_score: Number(average.toFixed(2)),
      highest_staff: highest?.staff ?? "-",
      highest_score: highest?.score ?? 0,
      lowest_staff: lowest?.staff ?? "-",
      lowest_score: lowest?.score ?? 0,
    };
  });

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Menko</h2>
        <p className="text-sm text-slate-600">Rekap nilai unit koordinasi: skor tertinggi, terendah, dan rata-rata.</p>
      </div>

      <MenkoRecapChart data={recapData} />

      <div className="grid gap-4 md:grid-cols-2">
        {recapData.map((item) => (
          <Card key={item.unit_name}>
            <CardHeader>
              <CardTitle>{item.unit_name}</CardTitle>
              <CardDescription>Rata-rata: {item.average_score.toFixed(2)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p>Highest: {item.highest_staff} ({item.highest_score.toFixed(2)})</p>
              <p>Lowest: {item.lowest_staff} ({item.lowest_score.toFixed(2)})</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
