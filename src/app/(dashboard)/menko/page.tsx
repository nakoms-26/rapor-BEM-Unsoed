import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { MenkoRecapChart } from "@/components/dashboard/menko-recap-chart";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MenkoPage() {
  const supabase = createAdminSupabaseClient();
  const menkoProfile = await requireSessionProfile();
  const isPjKemenkoan = menkoProfile.role === "pj_kementerian" && menkoProfile.is_pj_kemenkoan === true;

  // Only allow Menko and Admin to access the Menko recap pages (exclude PJ roles).
  if (!(menkoProfile.role === "menko" || menkoProfile.role === "admin")) {
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

  const { data: publishedPeriods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .eq("status", "published")
    .order("tahun", { ascending: false })
    .order("bulan", { ascending: false });

  const latestPublished = (publishedPeriods ?? [])[0];
  const previousPublished = (publishedPeriods ?? [])[1];

  const { data: coordinatedUnits } = isPjKemenkoan
    ? await supabase
        .from("ref_units")
        .select("id, nama_unit")
        .in(
          "parent_id",
          (
            await supabase
              .from("pj_assignments")
              .select("target_unit_id")
              .eq("nim", menkoProfile.nim)
              .eq("scope", "kemenko")
              .eq("is_active", true)
          ).data?.map((item) => item.target_unit_id) ?? ["00000000-0000-0000-0000-000000000000"],
        )
    : await supabase
        .from("ref_units")
        .select("id, nama_unit")
        .eq("parent_id", menkoProfile.unit_id);

  const unitIds = (coordinatedUnits ?? []).map((unit) => unit.id);

  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("nim, nama_lengkap, unit_id")
    .in("unit_id", unitIds.length ? unitIds : ["00000000-0000-0000-0000-000000000000"])
    .in("role", ["staff", "user"]);

  const staffNims = (staffProfiles ?? []).map((item) => item.nim);
  const staffNameByNim = new Map((staffProfiles ?? []).map((item) => [item.nim, item.nama_lengkap]));
  const unitByStaffNim = new Map((staffProfiles ?? []).map((item) => [item.nim, item.unit_id]));

  const { data: scores } = (latestPublished || activePeriod)
    ? await supabase
        .from("rapor_scores")
        .select("user_nim, periode_id, total_avg")
        .in("periode_id", [latestPublished?.id ?? activePeriod?.id ?? "", previousPublished?.id ?? ""].filter(Boolean))
        .eq("report_type", "staf_unit")
        .in("user_nim", staffNims.length ? staffNims : ["-"])
    : { data: [] as { user_nim: string; periode_id: string; total_avg: number }[] };

  const latestByNim = new Map<string, number>();
  const previousByNim = new Map<string, number>();
  for (const score of scores ?? []) {
    const unitId = unitByStaffNim.get(score.user_nim);
    if (!unitId) continue;
    if (latestPublished && score.periode_id === latestPublished.id) {
      latestByNim.set(score.user_nim, Number(score.total_avg));
    }
    if (previousPublished && score.periode_id === previousPublished.id) {
      previousByNim.set(score.user_nim, Number(score.total_avg));
    }
  }

  const rows = (coordinatedUnits ?? []).map((unit) => {
    const unitStaff = (staffProfiles ?? []).filter((staff) => staff.unit_id === unit.id);
    const currentScores = unitStaff
      .map((staff) => ({ nim: staff.nim, score: latestByNim.get(staff.nim) }))
      .filter((item): item is { nim: string; score: number } => typeof item.score === "number");

    const average = currentScores.length
      ? Number((currentScores.reduce((sum, item) => sum + item.score, 0) / currentScores.length).toFixed(2))
      : 0;

    let highestStaff = "-";
    let highestScore = Number.NEGATIVE_INFINITY;
    let lowestStaff = "-";
    let lowestScore = Number.POSITIVE_INFINITY;
    let highestGrowthStaff = "-";
    let highestGrowthScore = Number.NEGATIVE_INFINITY;
    let lowestGrowthStaff = "-";
    let lowestGrowthScore = Number.POSITIVE_INFINITY;

    for (const staff of unitStaff) {
      const current = latestByNim.get(staff.nim);
      if (typeof current !== "number") {
        continue;
      }

      const staffName = staffNameByNim.get(staff.nim) ?? staff.nim;

      if (current > highestScore) {
        highestScore = current;
        highestStaff = staffName;
      }
      if (current < lowestScore) {
        lowestScore = current;
        lowestStaff = staffName;
      }

      const prev = previousByNim.get(staff.nim) ?? current;
      const growth = Number((current - prev).toFixed(2));
      if (growth > highestGrowthScore) {
        highestGrowthScore = growth;
        highestGrowthStaff = staffName;
      }
      if (growth < lowestGrowthScore) {
        lowestGrowthScore = growth;
        lowestGrowthStaff = staffName;
      }
    }

    return {
      unit_name: unit.nama_unit,
      average_score: average,
      staff_count: currentScores.length,
      highest_staff: highestStaff,
      highest_score: Number.isFinite(highestScore) ? Number(highestScore.toFixed(2)) : 0,
      lowest_staff: lowestStaff,
      lowest_score: Number.isFinite(lowestScore) ? Number(lowestScore.toFixed(2)) : 0,
      highest_growth_staff: highestGrowthStaff,
      highest_growth_score: Number.isFinite(highestGrowthScore) ? Number(highestGrowthScore.toFixed(2)) : 0,
      lowest_growth_staff: lowestGrowthStaff,
      lowest_growth_score: Number.isFinite(lowestGrowthScore) ? Number(lowestGrowthScore.toFixed(2)) : 0,
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
      
      {!isPjKemenkoan ? (
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
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Recap Periode Published</CardTitle>
          <CardDescription>
            {latestPublished ? `Periode ${latestPublished.bulan}/${latestPublished.tahun}` : activePeriod ? `Periode ${activePeriod.bulan}/${activePeriod.tahun}` : "Belum ada periode published"}
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
          highest_staff: item.highest_staff,
          highest_score: item.highest_score,
          lowest_staff: item.lowest_staff,
          lowest_score: item.lowest_score,
        }))}
      />

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((item) => (
          <Card key={item.unit_name}>
            <CardHeader>
              <CardTitle>{item.unit_name}</CardTitle>
              <CardDescription>Rekap nilai staf unit periode aktif</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700">
              <p>Rata-rata: {item.average_score.toFixed(2)}</p>
              <p>Staf nilai tertinggi: {item.highest_staff} ({item.highest_score.toFixed(2)})</p>
              <p>Staf nilai terendah: {item.lowest_staff} ({item.lowest_score.toFixed(2)})</p>
              <p>Growth tertinggi: {item.highest_growth_staff} ({item.highest_growth_score.toFixed(2)})</p>
              <p>Growth terendah: {item.lowest_growth_staff} ({item.lowest_growth_score.toFixed(2)})</p>
              <p>Jumlah staf terskor: {item.staff_count}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
