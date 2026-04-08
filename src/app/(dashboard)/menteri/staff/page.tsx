import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import Link from "next/link";
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
      .eq("role", "staff")
      .order("nama_lengkap"),
  ]);

  const staffByNim = new Map((staffs ?? []).map((staff) => [staff.nim, staff.nama_lengkap]));
  const staffNims = [...staffByNim.keys()];
  const periodById = new Map((periods ?? []).map((period) => [period.id, period]));

  const { data: scores } = staffNims.length
    ? await supabase
        .from("rapor_scores")
        .select("id, user_nim, periode_id, total_avg, catatan, report_type, created_at")
        .in("user_nim", staffNims)
        .eq("report_type", "staf_unit")
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; user_nim: string; periode_id: string; total_avg: number; catatan: string | null; report_type: "staf_unit" | "menteri_kepala_biro" }[] };

  const publishedPeriods = (periods ?? [])
    .filter((period) => period.status === "published")
    .sort((a, b) => {
      if (a.tahun !== b.tahun) return b.tahun - a.tahun;
      return b.bulan - a.bulan;
    });

  const latestPublished = publishedPeriods[0];
  const previousPublished = publishedPeriods[1];

  const latestByNim = new Map<string, number>();
  const previousByNim = new Map<string, number>();

  for (const item of scores ?? []) {
    if (latestPublished && item.periode_id === latestPublished.id) {
      latestByNim.set(item.user_nim, Number(item.total_avg));
    }
    if (previousPublished && item.periode_id === previousPublished.id) {
      previousByNim.set(item.user_nim, Number(item.total_avg));
    }
  }

  let highestScoreName = "-";
  let highestScoreValue = Number.NEGATIVE_INFINITY;
  let lowestScoreName = "-";
  let lowestScoreValue = Number.POSITIVE_INFINITY;
  let highestGrowthName = "-";
  let highestGrowthValue = Number.NEGATIVE_INFINITY;
  let lowestGrowthName = "-";
  let lowestGrowthValue = Number.POSITIVE_INFINITY;

  for (const nim of staffNims) {
    const current = latestByNim.get(nim);
    if (typeof current !== "number") {
      continue;
    }

    const name = staffByNim.get(nim) ?? nim;
    if (current > highestScoreValue) {
      highestScoreValue = current;
      highestScoreName = name;
    }
    if (current < lowestScoreValue) {
      lowestScoreValue = current;
      lowestScoreName = name;
    }

    const prev = previousByNim.get(nim) ?? current;
    const growth = Number((current - prev).toFixed(2));
    if (growth > highestGrowthValue) {
      highestGrowthValue = growth;
      highestGrowthName = name;
    }
    if (growth < lowestGrowthValue) {
      lowestGrowthValue = growth;
      lowestGrowthName = name;
    }
  }

  const highestGrowthLabel = Number.isFinite(highestGrowthValue) ? highestGrowthValue.toFixed(2) : "0.00";
  const lowestGrowthLabel = Number.isFinite(lowestGrowthValue) ? lowestGrowthValue.toFixed(2) : "0.00";
  const highestScoreLabel = Number.isFinite(highestScoreValue) ? highestScoreValue.toFixed(2) : "0.00";
  const lowestScoreLabel = Number.isFinite(lowestScoreValue) ? lowestScoreValue.toFixed(2) : "0.00";

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
          <CardTitle>Recap 1 Bulan Terbaru (Published)</CardTitle>
          <CardDescription>
            {latestPublished
              ? `Periode ${latestPublished.bulan}/${latestPublished.tahun}`
              : "Belum ada periode published"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Nilai Tertinggi</p>
            <p className="text-sm font-semibold text-slate-900">{highestScoreName}</p>
            <p className="text-xs text-slate-600">{highestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Nilai Terendah</p>
            <p className="text-sm font-semibold text-slate-900">{lowestScoreName}</p>
            <p className="text-xs text-slate-600">{lowestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Growth Tertinggi</p>
            <p className="text-sm font-semibold text-slate-900">{highestGrowthName}</p>
            <p className="text-xs text-slate-600">{highestGrowthLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-xs text-slate-500">Growth Terendah</p>
            <p className="text-sm font-semibold text-slate-900">{lowestGrowthName}</p>
            <p className="text-xs text-slate-600">{lowestGrowthLabel}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Rapor Staff</CardTitle>
          <CardDescription>Urut dari data terbaru.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Link
              href="/menteri/staff-detail"
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l5 5v11a2 2 0 0 1-2 2Z" />
              </svg>
              <span>Lihat Rincian Rapor</span>
            </Link>
          </div>
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
