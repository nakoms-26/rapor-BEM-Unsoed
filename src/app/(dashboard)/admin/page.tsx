import { redirect } from "next/navigation";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { AdminDynamicForm } from "@/components/dashboard/admin-dynamic-form";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  if (profile?.role !== "admin" && profile?.role !== "pres_wapres") {
    redirect(ROLE_HOME[profile.role] ?? "/login");
  }

  const [{ data: units }, { data: periods }, { data: staffs }] = await Promise.all([
    supabase.from("ref_units").select("id, nama_unit, kategori, parent_id").order("nama_unit"),
    supabase.from("rapor_periods").select("id, bulan, tahun, status").order("tahun", { ascending: false }).order("bulan", { ascending: false }),
    supabase.from("profiles").select("nim, nama_lengkap, unit_id").in("role", ["staff", "user", "menteri"]).order("nama_lengkap"),
  ]);

  const noReferenceData = !(units ?? []).length || !(periods ?? []).length;

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Admin</h2>
        <p className="text-sm text-slate-600">Input rapor bulanan staf berdasarkan unit.</p>
      </div>
      {noReferenceData ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Dropdown tidak akan terisi jika data unit atau bulan/periode belum ada di database.
        </p>
      ) : null}
      <AdminDynamicForm
        units={units ?? []}
        periods={periods ?? []}
        staffs={staffs ?? []}
      />
    </section>
  );
}
