"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  PRESTASI_RESPONSIBILITY_OPTIONS,
  PRESTASI_SCALE_OPTIONS,
  MAIN_INDICATORS,
} from "@/lib/constants";
import { adminInputSchema, type AdminInputForm } from "@/types/app";

// ─── Permission helpers ──────────────────────────────────────
function canInputInternRapor(role: string) {
  return role === "admin" || role === "pj_ppm_intern" || role === "the_meridian";
}

function getPrestasiResponsibilityScore(value?: string | null) {
  return PRESTASI_RESPONSIBILITY_OPTIONS.find((o) => o.value === value)?.score ?? 0;
}

function getPrestasiScaleScore(value?: string | null) {
  return PRESTASI_SCALE_OPTIONS.find((o) => o.value === value)?.score ?? 0;
}

const INTERN_REVALIDATE_PATHS = [
  "/pj-ppm-intern",
  "/pj-ppm-intern/input",
  "/the-meridian",
  "/staff",
  "/menteri",
  "/menko",
  "/pres_wapres",
  "/admin",
];

function revalidateInternPaths() {
  for (const path of INTERN_REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

// ─── Submit intern rapor ─────────────────────────────────────
export async function submitInternRapor(payload: AdminInputForm) {
  const parsed = adminInputSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = createAdminSupabaseClient();
  const evaluatorProfile = await requireSessionProfile();

  if (!canInputInternRapor(evaluatorProfile.role)) {
    return { ok: false, message: "Kamu tidak memiliki akses untuk input rapor internship." };
  }

  // Validate target is an internship user
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("nim, role, unit_id")
    .eq("nim", parsed.data.user_nim)
    .maybeSingle();

  if (!targetProfile) {
    return { ok: false, message: "Pengguna yang dinilai tidak ditemukan." };
  }

  if (targetProfile.role !== "internship") {
    return { ok: false, message: "Rapor internship hanya untuk akun dengan role internship." };
  }

  // Evaluator assignment check (PJ PPM Intern or The Meridian)
  if (
    evaluatorProfile.role === "pj_ppm_intern" ||
    evaluatorProfile.role === "the_meridian"
  ) {
    const { data: pjAssignments } = await supabase
      .from("pj_assignments")
      .select("target_unit_id")
      .eq("nim", evaluatorProfile.nim)
      .eq("scope", "unit")
      .eq("is_active", true);

    const assignedUnitIds = new Set((pjAssignments ?? []).map((a) => a.target_unit_id));

    // Fallback to evaluator's own unit if the_meridian has no pj_assignments
    if (assignedUnitIds.size === 0 && evaluatorProfile.role === "the_meridian" && evaluatorProfile.unit_id) {
      assignedUnitIds.add(evaluatorProfile.unit_id);
    }

    if (assignedUnitIds.size === 0) {
      return { ok: false, message: "Assignment penilai belum ditetapkan. Hubungi admin." };
    }

    if (!targetProfile.unit_id || !assignedUnitIds.has(targetProfile.unit_id)) {
      return { ok: false, message: "Penilai hanya dapat menginput rapor untuk unit yang ditetapkan assignment." };
    }
  }

  // Validate unit
  const { data: selectedUnit } = await supabase
    .from("ref_units")
    .select("id, kategori, parent_id")
    .eq("id", parsed.data.unit_id)
    .maybeSingle();

  if (!selectedUnit) {
    return { ok: false, message: "Unit yang dipilih tidak ditemukan." };
  }

  const PRESTASI_INDICATOR = "Nilai Prestasi";
  const normalizeIndicatorName = (name: string) =>
    name === "Partisipasi Eksternal" ? "Partisipasi External" : name;

  const parentKemenkoId = selectedUnit.kategori === "kemenko" ? selectedUnit.id : selectedUnit.parent_id;

  // Template validation for PJ PPM Intern
  if (evaluatorProfile.role === "pj_ppm_intern") {
    const { data: templateRows } = await supabase
      .from("intern_sub_indicator_templates")
      .select("main_indicator_name, sub_indicator_name")
      .eq("kemenko_unit_id", parentKemenkoId ?? "00000000-0000-0000-0000-000000000000")
      .eq("periode_id", parsed.data.periode_id);

    const normalize = (value: string) => value.trim().toLowerCase();
    const INTERNAL_INDICATOR = "Partisipasi Internal";
    const TANGGUNG_JAWAB_INDICATOR = "Tanggung Jawab";

    const expectedByIndicator = new Map<string, string[]>();
    for (const row of templateRows ?? []) {
      const indicatorName = normalizeIndicatorName(row.main_indicator_name);
      if (!expectedByIndicator.has(indicatorName)) {
        expectedByIndicator.set(indicatorName, []);
      }
      expectedByIndicator.get(indicatorName)!.push(normalize(row.sub_indicator_name));
    }

    const editableIndicators = new Set([PRESTASI_INDICATOR, INTERNAL_INDICATOR, TANGGUNG_JAWAB_INDICATOR]);

    const mismatch = parsed.data.indicators.some((indicator) => {
      const indicatorName = normalizeIndicatorName(indicator.main_indicator_name);
      if (editableIndicators.has(indicatorName)) {
        return false;
      }

      const submitted = indicator.items
        .map((item) => normalize(item.sub_indicator_name))
        .filter((name) => name.length > 0);
      const expected = expectedByIndicator.get(indicatorName) ?? [];
      const submittedSorted = [...new Set(submitted)].sort();
      const expectedSorted = [...new Set(expected)].sort();
      return submittedSorted.join("||") !== expectedSorted.join("||");
    });

    if (mismatch) {
      return {
        ok: false,
        message: "PJ PPM Intern hanya dapat mengubah sub-indikator pada Tanggung Jawab, Partisipasi Internal, dan Nilai Prestasi.",
      };
    }
  }

  // ── Calculate weighted total ──
  const normalizeMainIndicator = (name: string) => (name === "Partisipasi External" ? "Partisipasi Eksternal" : name);
  const sectionWeights: Record<string, number> = {
    "Keaktifan": 20,
    "Tanggung Jawab": 20,
    "Partisipasi Internal": 30,
    "Partisipasi Eksternal": 30,
  };
  const sectionMaxScore: Record<string, number> = {
    "Keaktifan": 5,
    "Tanggung Jawab": 5,
    "Partisipasi Internal": 4,
    "Partisipasi Eksternal": 4,
  };

  const preparedDetailRows = parsed.data.indicators.flatMap((indicator) =>
    indicator.items
      .filter((item) => item.sub_indicator_name.trim().length > 0)
      .map((item) => {
        const normalizedMainIndicatorName = normalizeMainIndicator(indicator.main_indicator_name);
        const isPrestasi = normalizedMainIndicatorName === PRESTASI_INDICATOR;
        const responsibilityScore = getPrestasiResponsibilityScore(item.bentuk_tanggung_jawab ?? null);
        const scaleScore = getPrestasiScaleScore(item.skala ?? null);
        const qualitativeScore = Number(item.nilai_kualitatif ?? 0);
        const finalScore = isPrestasi
          ? Number((responsibilityScore + scaleScore + qualitativeScore).toFixed(2))
          : Number(item.score);

        return {
          normalizedMainIndicatorName,
          row: {
            main_indicator_name: indicator.main_indicator_name,
            sub_indicator_name: item.sub_indicator_name.trim(),
            catatan: item.catatan?.trim() || null,
            score: finalScore,
            bentuk_tanggung_jawab: isPrestasi ? (item.bentuk_tanggung_jawab ?? null) : null,
            nilai_kuantitatif_tanggung_jawab: isPrestasi ? responsibilityScore : null,
            skala: isPrestasi ? (item.skala ?? null) : null,
            nilai_kuantitatif_skala: isPrestasi ? scaleScore : null,
            nilai_kualitatif: isPrestasi ? qualitativeScore : null,
            nilai_akhir: isPrestasi ? finalScore : null,
          },
        };
      }),
  );

  if (preparedDetailRows.length === 0) {
    return {
      ok: false,
      message: "Gagal menyimpan: detail sub-indikator kosong. Lengkapi sub-indikator dan skor terlebih dahulu.",
    };
  }

  const sectionScoresByIndicator = new Map<string, number[]>();
  for (const detail of preparedDetailRows) {
    if (!sectionScoresByIndicator.has(detail.normalizedMainIndicatorName)) {
      sectionScoresByIndicator.set(detail.normalizedMainIndicatorName, []);
    }
    sectionScoresByIndicator.get(detail.normalizedMainIndicatorName)!.push(Number(detail.row.score));
  }

  const weightedTotal = Object.entries(sectionWeights).reduce((sum, [indicatorName, weight]) => {
    const sectionScores = sectionScoresByIndicator.get(indicatorName) ?? [];
    if (!sectionScores.length) {
      return sum;
    }

    const maxScore = sectionMaxScore[indicatorName] ?? 5;
    const sectionAverage = sectionScores.reduce((acc, score) => acc + score, 0) / sectionScores.length;
    const weightedScore = (sectionAverage / maxScore) * weight;
    return sum + weightedScore;
  }, 0);

  const totalAverage = Number(weightedTotal.toFixed(2));
  const normalizedCatatan = parsed.data.catatan?.trim() || null;

  // ── Upsert to intern_rapor_scores ──
  const { data: existingRapor } = await supabase
    .from("intern_rapor_scores")
    .select("id")
    .eq("user_nim", parsed.data.user_nim)
    .eq("periode_id", parsed.data.periode_id)
    .maybeSingle();

  const { data: rapor, error: raporError } = existingRapor
    ? await supabase
        .from("intern_rapor_scores")
        .update({
          penilai_nim: evaluatorProfile.nim,
          total_avg: totalAverage,
          catatan: normalizedCatatan,
        })
        .eq("id", existingRapor.id)
        .select("id")
        .single()
    : await supabase
        .from("intern_rapor_scores")
        .insert({
          user_nim: parsed.data.user_nim,
          periode_id: parsed.data.periode_id,
          penilai_nim: evaluatorProfile.nim,
          total_avg: totalAverage,
          catatan: normalizedCatatan,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .single();

  const effectiveRapor = existingRapor ? { id: existingRapor.id } : rapor;

  if (raporError || !effectiveRapor) {
    return {
      ok: false,
      message: `Gagal menyimpan rapor internship: ${raporError?.message ?? "unknown error"}`,
    };
  }

  const detailRows = preparedDetailRows.map((detail) => ({
    rapor_id: effectiveRapor.id,
    ...detail.row,
  }));

  if (existingRapor) {
    const { error: deleteDetailError } = await supabase.from("intern_rapor_details").delete().eq("rapor_id", effectiveRapor.id);
    if (deleteDetailError) {
      return { ok: false, message: deleteDetailError.message };
    }
  }

  if (detailRows.length > 0) {
    const { error: detailError } = await supabase.from("intern_rapor_details").insert(detailRows);

    if (detailError) {
      return { ok: false, message: `Gagal menyimpan detail rapor: ${detailError.message}` };
    }
  }

  revalidateInternPaths();

  return {
    ok: true,
    message: existingRapor ? "Rapor internship periode ini berhasil diperbarui." : "Rapor internship berhasil disimpan.",
  };
}

// ─── Delete intern rapor ─────────────────────────────────────
export async function deleteInternRapor(raporId: string) {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (!canInputInternRapor(profile.role)) {
    return { ok: false, message: "Kamu tidak memiliki akses untuk menghapus rapor internship." };
  }

  if (
    profile.role === "pj_ppm_intern" ||
    profile.role === "the_meridian"
  ) {
    const { data: rapor } = await supabase
      .from("intern_rapor_scores")
      .select("id, user_nim")
      .eq("id", raporId)
      .maybeSingle();

    if (!rapor) {
      return { ok: false, message: "Rapor tidak ditemukan." };
    }

    // Validate assignment scope
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("unit_id")
      .eq("nim", rapor.user_nim)
      .maybeSingle();

    if (!targetProfile) {
      return { ok: false, message: "Profil target rapor tidak ditemukan." };
    }

    const { data: pjAssignments } = await supabase
      .from("pj_assignments")
      .select("target_unit_id")
      .eq("nim", profile.nim)
      .eq("scope", "unit")
      .eq("is_active", true);

    const assignedIds = new Set((pjAssignments ?? []).map((a) => a.target_unit_id));
    if (assignedIds.size === 0 && profile.role === "the_meridian" && profile.unit_id) {
      assignedIds.add(profile.unit_id);
    }

    if (!targetProfile.unit_id || !assignedIds.has(targetProfile.unit_id)) {
      return { ok: false, message: "Penilai hanya dapat menghapus rapor dalam unit ampuan." };
    }
  }

  const { error } = await supabase.from("intern_rapor_scores").delete().eq("id", raporId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidateInternPaths();

  return { ok: true, message: "Rapor internship berhasil dihapus." };
}

// ─── Save intern sub-indicator templates ─────────────────────
const internTemplatePayloadSchema = z.object({
  kemenkoUnitId: z.string().uuid("Unit kemenko tidak valid."),
  periodeId: z.string().uuid("Periode tidak valid."),
  indicators: z.array(
    z.object({
      main_indicator_name: z.string(),
      items: z.array(
        z.object({
          sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator minimal 2 karakter."),
        }),
      ),
    }),
  ),
});

export async function saveInternSubIndicators(payload: {
  kemenkoUnitId: string;
  periodeId: string;
  indicators: { main_indicator_name: string; items: { sub_indicator_name: string }[] }[];
}) {
  const parsed = internTemplatePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const profile = await requireSessionProfile();
  if (profile.role !== "pj_ppm_intern" && profile.role !== "admin") {
    return { ok: false, message: "Hanya PJ PPM Intern atau Admin yang dapat mengelola sub-indikator internship." };
  }

  const supabase = createAdminSupabaseClient();

  // Verify assignment if not admin
  if (profile.role !== "admin") {
    const { data: assignments } = await supabase
      .from("pj_assignments")
      .select("id, target_unit_id")
      .eq("nim", profile.nim)
      .eq("is_active", true);

    const assignedIds = new Set((assignments ?? []).map((a) => a.target_unit_id));
    let hasAccess = assignedIds.has(parsed.data.kemenkoUnitId);

    if (!hasAccess) {
      // Check if any assigned unit belongs to this kemenko
      const { data: kemenkoChildren } = await supabase
        .from("ref_units")
        .select("id")
        .eq("parent_id", parsed.data.kemenkoUnitId);
      const childIds = new Set((kemenkoChildren ?? []).map((c) => c.id));
      hasAccess = (assignments ?? []).some((a) => childIds.has(a.target_unit_id));
    }

    if (!hasAccess) {
      return { ok: false, message: "Kamu tidak memiliki assignment aktif untuk kemenko tersebut." };
    }
  }

  const normalizedRows = parsed.data.indicators
    .filter((indicator) => MAIN_INDICATORS.includes(indicator.main_indicator_name as (typeof MAIN_INDICATORS)[number]))
    .flatMap((indicator) =>
      indicator.items
        .map((item) => item.sub_indicator_name.trim())
        .filter((name) => name.length > 0)
        .map((subName) => ({
          kemenko_unit_id: parsed.data.kemenkoUnitId,
          periode_id: parsed.data.periodeId,
          main_indicator_name: indicator.main_indicator_name,
          sub_indicator_name: subName,
          created_by_nim: profile.nim,
        })),
    );

  const uniqueRows = Array.from(
    new Map(
      normalizedRows.map((row) => [
        `${row.kemenko_unit_id}::${row.periode_id}::${row.main_indicator_name}::${row.sub_indicator_name.toLowerCase()}`,
        row,
      ]),
    ).values(),
  );

  const { error: deleteError } = await supabase
    .from("intern_sub_indicator_templates")
    .delete()
    .eq("kemenko_unit_id", parsed.data.kemenkoUnitId)
    .eq("periode_id", parsed.data.periodeId);

  if (deleteError) {
    return { ok: false, message: `Gagal membersihkan template lama: ${deleteError.message}` };
  }

  if (uniqueRows.length) {
    const { error: insertError } = await supabase.from("intern_sub_indicator_templates").insert(uniqueRows);
    if (insertError) {
      return { ok: false, message: `Gagal menyimpan template: ${insertError.message}` };
    }
  }

  revalidatePath("/pj-ppm-intern");
  revalidatePath("/pj-ppm-intern/kelola-indikator");
  revalidatePath("/pj-ppm-intern/input");

  return { ok: true, message: "Sub-indikator internship berhasil disimpan." };
}
