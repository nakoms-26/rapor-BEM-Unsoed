import { redirect } from "next/navigation";
import Link from "next/link";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { ROLE_HOME, MAIN_INDICATORS, PRESTASI_RESPONSIBILITY_OPTIONS, PRESTASI_SCALE_OPTIONS } from "@/lib/constants";
import { InternInputForm } from "@/components/dashboard/intern-input-form";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type PrestasiResponsibilityValue = (typeof PRESTASI_RESPONSIBILITY_OPTIONS)[number]["value"];
type PrestasiScaleValue = (typeof PRESTASI_SCALE_OPTIONS)[number]["value"];

function isPrestasiResponsibilityValue(value: string | null | undefined): value is PrestasiResponsibilityValue {
  return PRESTASI_RESPONSIBILITY_OPTIONS.some((option) => option.value === value);
}

function isPrestasiScaleValue(value: string | null | undefined): value is PrestasiScaleValue {
  return PRESTASI_SCALE_OPTIONS.some((option) => option.value === value);
}

function normalizeMainIndicatorName(name: string) {
  const normalized = name.trim().toLowerCase();
  if (normalized.includes("partisipasi") && (normalized.includes("ekstern") || normalized.includes("external"))) {
    return "Partisipasi External";
  }
  if (normalized.includes("keaktifan")) return "Keaktifan";
  if (normalized.includes("tanggung") && normalized.includes("jawab")) return "Tanggung Jawab";
  if (normalized.includes("partisipasi") && normalized.includes("internal")) return "Partisipasi Internal";
  if (normalized.includes("nilai") && normalized.includes("prestasi")) return "Nilai Prestasi";
  return name.trim();
}

export default async function PjPpmInternInputPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = (await searchParams) ?? {};
  const editRaporIdParam = resolvedParams.edit_rapor_id;
  const editRaporId = typeof editRaporIdParam === "string"
    ? editRaporIdParam
    : Array.isArray(editRaporIdParam)
      ? (editRaporIdParam[0] ?? "")
      : "";

  const profile = await requireSessionProfile();
  const supabase = createAdminSupabaseClient();

  if (profile.role !== "pj_ppm_intern" && profile.role !== "admin") {
    redirect(ROLE_HOME[profile.role] ?? "/dashboard");
  }

  // Get assigned units
  const { data: assignments } = await supabase
    .from("pj_assignments")
    .select("target_unit_id")
    .eq("nim", profile.nim)
    .eq("is_active", true);

  const assignedUnitIds = (assignments ?? []).map((a) => a.target_unit_id);

  // Fetch units (kementerian/biro under assigned kemenko, or direct unit assignments)
  const { data: allUnits } = await supabase
    .from("ref_units")
    .select("id, nama_unit, kategori, parent_id")
    .order("nama_unit");

  // Resolve all units within scope (assigned units + their children)
  const unitsByParent = new Map<string, typeof allUnits>();
  for (const unit of allUnits ?? []) {
    if (unit.parent_id) {
      if (!unitsByParent.has(unit.parent_id)) {
        unitsByParent.set(unit.parent_id, []);
      }
      unitsByParent.get(unit.parent_id)!.push(unit);
    }
  }

  const scopeUnitIds = new Set<string>();
  for (const assignedId of assignedUnitIds) {
    scopeUnitIds.add(assignedId);
    const children = unitsByParent.get(assignedId) ?? [];
    for (const child of children) {
      scopeUnitIds.add(child.id);
    }
  }

  const managedUnits = (allUnits ?? [])
    .filter((u) => profile.role === "admin" || scopeUnitIds.has(u.id))
    .filter((u) => u.kategori === "kementerian" || u.kategori === "biro");

  const effectiveUnitIds = managedUnits.map((u) => u.id);

  // Fetch periods
  const { data: periods } = await supabase
    .from("rapor_periods")
    .select("id, bulan, tahun, status")
    .order("tahun", { ascending: false });

  // Fetch internship profiles in scope units
  const { data: internProfiles } = effectiveUnitIds.length
    ? await supabase
        .from("profiles")
        .select("nim, nama_lengkap, unit_id")
        .in("unit_id", effectiveUnitIds)
        .eq("role", "internship")
        .order("nama_lengkap")
    : { data: [] };

  // Fetch intern sub-indicator templates
  const { data: internTemplates } = await supabase
    .from("intern_sub_indicator_templates")
    .select("kemenko_unit_id, periode_id, main_indicator_name, sub_indicator_name");

  // Handle edit mode
  let initialEditRapor: React.ComponentProps<typeof InternInputForm>["initialEditRapor"] = undefined;

  if (editRaporId) {
    const { data: editRapor } = await supabase
      .from("intern_rapor_scores")
      .select("id, user_nim, periode_id, catatan")
      .eq("id", editRaporId)
      .maybeSingle();

    if (editRapor) {
      const { data: editDetails } = await supabase
        .from("intern_rapor_details")
        .select("main_indicator_name, sub_indicator_name, catatan, score, bentuk_tanggung_jawab, nilai_kuantitatif_tanggung_jawab, skala, nilai_kuantitatif_skala, nilai_kualitatif, nilai_akhir")
        .eq("rapor_id", editRapor.id);

      const { data: editProfile } = await supabase
        .from("profiles")
        .select("unit_id")
        .eq("nim", editRapor.user_nim)
        .maybeSingle();

      const indicatorMap = new Map<string, typeof editDetails>();
      for (const detail of editDetails ?? []) {
        const key = normalizeMainIndicatorName(detail.main_indicator_name);
        if (!indicatorMap.has(key)) {
          indicatorMap.set(key, []);
        }
        indicatorMap.get(key)!.push(detail);
      }

      initialEditRapor = {
        rapor_id: editRapor.id,
        periode_id: editRapor.periode_id,
        unit_id: editProfile?.unit_id ?? "",
        user_nim: editRapor.user_nim,
        catatan: editRapor.catatan ?? "",
        indicators: MAIN_INDICATORS.map((indicatorName) => ({
          main_indicator_name: indicatorName,
          items: (indicatorMap.get(indicatorName) ?? []).map((detail) => ({
            sub_indicator_name: detail.sub_indicator_name,
            catatan: detail.catatan ?? undefined,
            score: Number(detail.score),
            bentuk_tanggung_jawab: isPrestasiResponsibilityValue(detail.bentuk_tanggung_jawab) ? detail.bentuk_tanggung_jawab : undefined,
            nilai_kuantitatif_tanggung_jawab: detail.nilai_kuantitatif_tanggung_jawab != null ? Number(detail.nilai_kuantitatif_tanggung_jawab) : undefined,
            skala: isPrestasiScaleValue(detail.skala) ? detail.skala : undefined,
            nilai_kuantitatif_skala: detail.nilai_kuantitatif_skala != null ? Number(detail.nilai_kuantitatif_skala) : undefined,
            nilai_kualitatif: detail.nilai_kualitatif != null ? Number(detail.nilai_kualitatif) : undefined,
            nilai_akhir: detail.nilai_akhir != null ? Number(detail.nilai_akhir) : undefined,
          })),
        })),
      };
    }
  }

  return (
    <section className="space-y-6">
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
          <span>PJ PPM Intern — Input Rapor</span>
        </div>
        <h2 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
          {editRaporId ? "Edit Rapor Internship" : "Input Rapor Internship"}
        </h2>
        <p className="text-xs sm:text-sm text-slate-600">
          Isi rapor bulanan untuk staf magang (Cakrawala) di unit kementerian/biro yang Kamu pegang.
        </p>
      </div>

      <InternInputForm
        units={managedUnits}
        periods={(periods ?? []).map((p) => ({ id: p.id, bulan: p.bulan, tahun: p.tahun, status: p.status as "draft" | "published" }))}
        interns={internProfiles ?? []}
        internTemplates={internTemplates ?? []}
        initialEditRapor={initialEditRapor}
      />
    </section>
  );
}
