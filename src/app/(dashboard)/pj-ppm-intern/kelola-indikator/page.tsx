import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionProfile } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/constants";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InternSubIndicatorForm } from "@/components/dashboard/intern-sub-indicator-form";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PjPpmInternKelolaIndikatorPage() {
  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  if (profile.role !== "pj_ppm_intern" && profile.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // Get assigned kemenko units for this PJ PPM Intern
  const { data: assignments } = await supabase
    .from("pj_assignments")
    .select("target_unit_id")
    .eq("nim", profile.nim)
    .eq("is_active", true);

  const assignedIds = (assignments ?? []).map((a) => a.target_unit_id);

  // Resolve which units are kemenko (direct assignments to kemenko units)
  const { data: allUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit, kategori, parent_id")
    .order("nama_unit");

  // Find kemenko units in scope
  const kemenkoUnits = (allUnits ?? []).filter(
    (u) => u.kategori === "kemenko" && (profile.role === "admin" || assignedIds.includes(u.id)),
  );

  // Also check if any assigned unit is a kementerian/biro — resolve parent kemenko
  if (profile.role !== "admin") {
    for (const assignedId of assignedIds) {
      const unit = (allUnits ?? []).find((u) => u.id === assignedId);
      if (unit && unit.kategori !== "kemenko" && unit.parent_id) {
        const parentKemenko = (allUnits ?? []).find((u) => u.id === unit.parent_id && u.kategori === "kemenko");
        if (parentKemenko && !kemenkoUnits.some((k) => k.id === parentKemenko.id)) {
          kemenkoUnits.push(parentKemenko);
        }
      }
    }
  }

  if (kemenkoUnits.length === 0 && profile.role !== "admin") {
    return (
      <section className="space-y-4">
        <div>
          <Link
            href="/pj-ppm-intern"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-3"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Kembali ke Monitoring</span>
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>PJ PPM Intern — Kelola Indikator</span>
          </div>
          <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">Kelola Sub-Indikator Internship</h2>
          <p className="text-xs sm:text-sm text-slate-600">Pengaturan rincian kegiatan (sub-indikator) internship.</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-slate-600">Tidak ada kemenko yang di-assign. Hubungi admin untuk menetapkan assignment.</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  // For admin, show all kemenko
  const effectiveKemenkoUnits = profile.role === "admin" && kemenkoUnits.length === 0
    ? (allUnits ?? []).filter((u) => u.kategori === "kemenko")
    : kemenkoUnits;

  const kemenkoIds = effectiveKemenkoUnits.map((k) => k.id);

  // Fetch periods + saved templates
  const [{ data: periods }, { data: templateRows }] = await Promise.all([
    supabase
      .from("rapor_periods")
      .select("id, bulan, tahun, status")
      .order("tahun", { ascending: false })
      .order("bulan", { ascending: false }),
    kemenkoIds.length
      ? supabase
          .from("intern_sub_indicator_templates")
          .select("kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name")
          .in("kemenko_unit_id", kemenkoIds)
      : { data: [] },
  ]);

  return (
    <section className="space-y-4">
      <div>
        <Link
          href="/pj-ppm-intern"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Kembali ke Monitoring</span>
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>PJ PPM Intern — Kelola Indikator</span>
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900">Kelola Sub-Indikator Internship</h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Tambahkan, sunting, atau hapus rincian kegiatan (sub-indikator) internship untuk setiap kemenko.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/pj-ppm-intern/input"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Input Rapor Internship
        </Link>
        <Link
          href="/pj-ppm-intern"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Monitoring Internship
        </Link>
      </div>

      {effectiveKemenkoUnits.map((kemenko) => (
        <Card key={kemenko.id}>
          <CardHeader>
            <CardTitle>{kemenko.nama_unit}</CardTitle>
            <CardDescription>Kelola sub-indikator internship untuk kemenko ini.</CardDescription>
          </CardHeader>
          <CardContent>
            <InternSubIndicatorForm
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
