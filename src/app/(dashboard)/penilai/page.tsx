import { redirect } from "next/navigation";
import { AdminDynamicForm } from "@/components/dashboard/admin-dynamic-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const ALLOWED_EVALUATOR_UNITS = new Set(["Biro PPM", "Biro Pengendali & Penjamin Mutu"]);

export default async function PenilaiPage() {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (
    profile.role !== "staff" &&
    profile.role !== "the_meridian" &&
    profile.role !== "pj_kementerian" &&
    profile.role !== "admin"
  ) {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  const { data: ownUnit } = await supabase
    .from("ref_units")
    .select("id, nama_unit")
    .eq("id", profile.unit_id)
    .single();

  if (!ownUnit || !ALLOWED_EVALUATOR_UNITS.has(ownUnit.nama_unit)) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Input Rapor Unit Pegangan</h2>
          <p className="text-sm text-slate-600">Fitur ini hanya untuk staf Biro PPM/Pengendali Mutu yang ditunjuk sebagai penilai.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Akses Tidak Tersedia</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">Akun Kamu tidak termasuk unit penilai untuk input rapor staf kementerian/biro.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  const [{ data: assignments }, { data: pjAssignments }, { data: periods }] = await Promise.all([
    supabase
      .from("evaluator_unit_assignments")
      .select("target_unit_id, is_active")
      .eq("evaluator_nim", profile.nim)
      .eq("is_active", true)
      .limit(1),
    supabase
      .from("pj_assignments")
      .select("target_unit_id")
      .eq("nim", profile.nim)
      .eq("scope", "unit")
      .eq("is_active", true)
      .limit(1),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
  ]);

  const targetUnitId = assignments?.[0]?.target_unit_id || pjAssignments?.[0]?.target_unit_id;

  if (!targetUnitId) {
    return (
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Input Rapor Unit Pegangan</h2>
          <p className="text-sm text-slate-600">Admin harus menetapkan 1 unit pegangan untuk setiap penilai.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Belum Ada Assignment</CardTitle>
            <CardDescription>Silakan hubungi admin agar unit pegangan Kamu diaktifkan.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  const [{ data: targetUnit }, { data: staffs }] = await Promise.all([
    supabase
      .from("ref_units")
      .select("id, nama_unit, kategori, parent_id")
      .eq("id", targetUnitId)
      .single(),
    supabase
      .from("profiles")
      .select("nim, nama_lengkap, unit_id")
      .eq("unit_id", targetUnitId)
      .in("role", ["staff", "pj_kementerian", "the_meridian", "user"])
      .order("nama_lengkap"),
  ]);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Input Rapor Unit Pegangan</h2>
        <p className="text-sm text-slate-600">
          Kamu hanya dapat input rapor staf untuk 1 unit yang ditetapkan: {targetUnit?.nama_unit ?? "-"}.
        </p>
      </div>

      <AdminDynamicForm
        units={targetUnit ? [targetUnit] : []}
        periods={periods ?? []}
        staffs={staffs ?? []}
      />
    </section>
  );
}
