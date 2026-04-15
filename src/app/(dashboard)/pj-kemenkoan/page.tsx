import { redirect } from "next/navigation";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PjKemenkoSubIndicatorForm } from "@/components/dashboard/pj-kemenko-sub-indicator-form";

export const dynamic = "force-dynamic";

export default async function PjKemenkoPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

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

  // Fetch all kemenko data for assigned units
  const { data: kemenkoUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit, kategori")
    .in("id", kemenkoIds)
    .order("nama_unit");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Kelola Sub-Indikator Kemenko</h2>
        <p className="text-sm text-slate-600">Tambahkan, sunting, atau hapus rincian kegiatan (sub-indikator) untuk indikator utama.</p>
      </div>

      {(kemenkoUnits ?? []).map((kemenko) => (
        <Card key={kemenko.id}>
          <CardHeader>
            <CardTitle>{kemenko.nama_unit}</CardTitle>
            <CardDescription>Kelola sub-indikator untuk kemenko ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <PjKemenkoSubIndicatorForm kemenkoId={kemenko.id} kemenkoName={kemenko.nama_unit} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
