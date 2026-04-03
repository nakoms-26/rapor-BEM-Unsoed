import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();

  if (menkoProfile?.role !== "menko") {
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

  const { data: previousPeriod } = await supabase
    .from("rapor_periods")
    .select("id")
    .eq("status", "published")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false })
    .range(1, 1)
    .maybeSingle();

  const { data: coordinatedUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit")
    .eq("parent_id", menkoProfile.unit_id);

  const unitIds = (coordinatedUnits ?? []).map((unit) => unit.id);

  const { data: menteriProfiles } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap, unit_id")
    .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("role", "menteri");

  const menteriByNim = new Map((menteriProfiles ?? []).map((menteri) => [menteri.nim, menteri]));

  const { data: scores } = activePeriod
    ? await supabase
        .from("rapor_scores")
        .select("user_nim, total_avg")
        .eq("periode_id", activePeriod.id)
        .eq("report_type", "menteri_kepala_biro")
        .in("user_nim", [...menteriByNim.keys()])
    : { data: [] as { user_nim: string; total_avg: number }[] };

  const { data: previousScores } = activePeriod && previousPeriod
    ? await supabase
        .from("rapor_scores")
        .select("user_nim, total_avg")
        .eq("periode_id", previousPeriod.id)
        .eq("report_type", "menteri_kepala_biro")
        .in("user_nim", [...menteriByNim.keys()])
    : { data: [] as { user_nim: string; total_avg: number }[] };

  const previousByNim = new Map((previousScores ?? []).map((row) => [row.user_nim, Number(row.total_avg)]));

  const rows = (scores ?? []).map((score) => {
    const menteri = menteriByNim.get(score.user_nim);
    const prev = previousByNim.get(score.user_nim) ?? Number(score.total_avg);
    return {
      nim: score.user_nim,
      nama: menteri?.nama_lengkap ?? score.user_nim,
      unit: coordinatedUnits?.find((unit) => unit.id === menteri?.unit_id)?.nama_unit ?? "-",
      score: Number(score.total_avg),
      growth: Number((Number(score.total_avg) - prev).toFixed(2)),
    };
  });

  const topScore = [...rows].sort((a, b) => b.score - a.score)[0];
  const topGrowth = [...rows].sort((a, b) => b.growth - a.growth)[0];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Menko</h2>
        <p className="text-sm text-slate-600">Rekap 1 kemenko berdasarkan rapor menteri/kepala biro yang Anda koordinasikan.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recap Periode Published</CardTitle>
          <CardDescription>
            {activePeriod ? `Periode ${activePeriod.bulan}/${activePeriod.tahun}` : "Belum ada periode published"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Nilai Menteri Tertinggi</p>
            <p className="text-sm font-semibold text-slate-900">{topScore?.nama ?? "-"}</p>
            <p className="text-xs text-slate-600">{topScore ? `${topScore.unit} - ${topScore.score.toFixed(2)}` : "0.00"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Growth Menteri Tertinggi</p>
            <p className="text-sm font-semibold text-slate-900">{topGrowth?.nama ?? "-"}</p>
            <p className="text-xs text-slate-600">{topGrowth ? `${topGrowth.unit} - ${topGrowth.growth.toFixed(2)}` : "0.00"}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((item) => (
          <Card key={item.nim}>
            <CardHeader>
              <CardTitle>{item.nama}</CardTitle>
              <CardDescription>{item.unit}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-slate-700">
              <p>Nilai: {item.score.toFixed(2)}</p>
              <p>Growth: {item.growth.toFixed(2)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
