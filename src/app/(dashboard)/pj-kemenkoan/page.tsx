import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PjKemenkoSubIndicatorForm } from "@/components/dashboard/pj-kemenko-sub-indicator-form";
import { updatePeriodStatusByPjKemenkoan } from "@/app/(dashboard)/admin/actions";

export const dynamic = "force-dynamic";

export default async function PjKemenkoPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  async function updatePeriodStatusAction(formData: FormData) {
    "use server";

    await updatePeriodStatusByPjKemenkoan(formData);
  }

  // Only PJ Kemenkoan can access this page
  if (profile.role !== "pj_kementerian" || !profile.is_pj_kemenkoan) {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // Get all kemenko that this PJ manages
  const { data: assignments } = await supabase
    .from("pj_assignments")
    .select("target_unit_id")
    .eq("nim", profile.nim)
    .eq("scope", "kemenko")
    .eq("is_active", true)
    .order("created_at");

  const kemenkoIds = assignments?.map((a) => a.target_unit_id) ?? [];

  if (!kemenkoIds.length) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Kelola Sub-Indikator Kemenko</h2>
          <p className="text-sm text-slate-600">Pengaturan rincian kegiatan (sub-indikator) untuk kemenko yang Anda pimpin.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Tidak ada kemenko yang di-assign. Hubungi admin untuk menetapkan kemenko pegangan Anda.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  // Fetch all kemenko data for assigned units + periods + saved templates
  const [{ data: kemenkoUnits }, { data: periods }, { data: templateRows }] = await Promise.all([
    supabase
      .from("ref_units")
      .select("id, nama_unit, kategori")
      .in("id", kemenkoIds)
      .order("nama_unit"),
    supabase
      .from("rapor_periods")
      .select("id, bulan, tahun, status")
      .order("tahun", { ascending: false })
      .order("bulan", { ascending: false }),
    supabase
      .from("kemenko_sub_indicator_templates")
      .select("kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name")
      .in("kemenko_unit_id", kemenkoIds),
  ]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Kelola Sub-Indikator Kemenko</h2>
        <p className="text-sm text-slate-600">Tambahkan, sunting, atau hapus rincian kegiatan (sub-indikator) untuk indikator utama.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Input Kementerian Diampu
        </Link>
        <Link
          href="/menko"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Recap Kementerian
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish Periode Rapor</CardTitle>
          <CardDescription>
            Publish periode agar staf dan pejabat dapat melihat rapor mereka. Berlaku untuk seluruh kemenko.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(periods ?? []).length ? (
            [...(periods ?? [])]
              .sort((a, b) => {
                if (a.tahun !== b.tahun) return b.tahun - a.tahun;
                return b.bulan - a.bulan;
              })
              .map((period) => (
                <div
                  key={period.id}
                  className="flex flex-col gap-3 rounded-md border border-slate-200 px-3 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-slate-800">
                      {period.bulan}/{period.tahun}
                    </p>
                    <p className="text-xs text-slate-500">Status saat ini: {period.status}</p>
                  </div>

                  <div className="flex gap-2">
                    <form action={updatePeriodStatusAction}>
                      <input type="hidden" name="period_id" value={period.id} />
                      <input type="hidden" name="status" value="draft" />
                      <button
                        type="submit"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                      >
                        Draft
                      </button>
                    </form>

                    <form action={updatePeriodStatusAction}>
                      <input type="hidden" name="period_id" value={period.id} />
                      <input type="hidden" name="status" value="published" />
                      <button
                        type="submit"
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100"
                      >
                        Publish
                      </button>
                    </form>
                  </div>
                </div>
              ))
          ) : (
            <p className="text-sm text-slate-600">Belum ada periode rapor.</p>
          )}
        </CardContent>
      </Card>

      {(kemenkoUnits ?? []).map((kemenko) => (
        <Card key={kemenko.id}>
          <CardHeader>
            <CardTitle>{kemenko.nama_unit}</CardTitle>
            <CardDescription>Kelola sub-indikator untuk kemenko ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <PjKemenkoSubIndicatorForm
              kemenkoId={kemenko.id}
              kemenkoName={kemenko.nama_unit}
              periods={periods ?? []}
              initialTemplates={(templateRows ?? [])
                .filter((row) => row.kemenko_unit_id === kemenko.id)
                .map((row) => ({
                  periode_id: row.periode_id,
                  main_indicator_name: row.main_indicator_name,
                  sub_indicator_name: row.sub_indicator_name,
                }))}
            />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
