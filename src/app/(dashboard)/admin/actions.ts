"use server";

import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  PRESTASI_RESPONSIBILITY_OPTIONS,
  PRESTASI_SCALE_OPTIONS,
} from "@/lib/constants";
import { adminInputSchema, type AdminInputForm } from "@/types/app";

function canInputAsAdmin(role: string) {
  return role === "admin" || role === "pj_kementerian";
}

async function canInputAsEvaluator(
  evaluatorNim: string,
  targetUnitId: string,
) {
  const supabase = createAdminSupabaseClient();
  const { data: assignment } = await supabase
    .from("evaluator_unit_assignments")
    .select("id")
    .eq("evaluator_nim", evaluatorNim)
    .eq("target_unit_id", targetUnitId)
    .eq("is_active", true)
    .maybeSingle();

  return Boolean(assignment);
}

function getPrestasiResponsibilityScore(value?: string | null) {
  return PRESTASI_RESPONSIBILITY_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}

function getPrestasiScaleScore(value?: string | null) {
  return PRESTASI_SCALE_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}

export async function submitAdminRapor(payload: AdminInputForm) {
  const parsed = adminInputSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = createAdminSupabaseClient();
  const evaluatorProfile = await requireSessionProfile();
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("nim, role, unit_id")
    .eq("nim", parsed.data.user_nim)
    .maybeSingle();

  if (!targetProfile) {
    return { ok: false, message: "Pengguna yang dinilai tidak ditemukan." };
  }

  const isAdmin = canInputAsAdmin(evaluatorProfile.role);
  const isPjKementerian = evaluatorProfile.role === "pj_kementerian";
  const isEvaluatorStaff = evaluatorProfile.role === "staff";
  const allowedEvaluatorTarget =
    targetProfile.role === "staff" ||
    targetProfile.role === "user" ||
    targetProfile.role === "pj_kementerian";

  if (!isAdmin) {
    if (!isEvaluatorStaff) {
      return { ok: false, message: "Anda tidak memiliki akses untuk input rapor." };
    }

    if (!allowedEvaluatorTarget) {
      return { ok: false, message: "Staf penilai hanya boleh input rapor staf kementerian/biro." };
    }

    const allowedByAssignment = await canInputAsEvaluator(evaluatorProfile.nim, targetProfile.unit_id);
    if (!allowedByAssignment) {
      return { ok: false, message: "Anda hanya boleh input rapor untuk 1 unit pegangan yang ditetapkan admin." };
    }
  }

  if (
    isAdmin &&
    targetProfile.role !== "staff" &&
    targetProfile.role !== "user" &&
    targetProfile.role !== "menteri" &&
    targetProfile.role !== "pj_kementerian"
  ) {
    return { ok: false, message: "Admin hanya dapat menilai akun staff, PJ Kementerian, atau menteri/kepala biro." };
  }

  if (isPjKementerian && evaluatorProfile.is_pj_kemenkoan !== true) {
    if (!allowedEvaluatorTarget) {
      return { ok: false, message: "PJ Kementerian hanya boleh menilai staf/PJ Kementerian pada unit pegangan." };
    }

    // Check both legacy evaluator_unit_assignments and new pj_assignments (scope='unit')
    const { data: legacyAssignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("target_unit_id, is_active")
      .eq("evaluator_nim", evaluatorProfile.nim)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    const { data: pjUnitAssignments } = await supabase
      .from("pj_assignments")
      .select("target_unit_id")
      .eq("nim", evaluatorProfile.nim)
      .eq("scope", "unit")
      .eq("is_active", true);

    const validUnitIds = new Set<string>();
    if (legacyAssignment) {
      validUnitIds.add(legacyAssignment.target_unit_id);
    }
    pjUnitAssignments?.forEach((a) => validUnitIds.add(a.target_unit_id));

    if (validUnitIds.size === 0) {
      return { ok: false, message: "Assignment PJ Kementerian belum ditetapkan. Hubungi admin untuk menetapkan kementerian pegangan." };
    }

    if (!validUnitIds.has(targetProfile.unit_id) || !validUnitIds.has(parsed.data.unit_id)) {
      return { ok: false, message: "PJ Kementerian hanya dapat input rapor pada unit yang ditetapkan assignment." };
    }
  }

  if (isPjKementerian && evaluatorProfile.is_pj_kemenkoan === true) {
    if (!allowedEvaluatorTarget) {
      return { ok: false, message: "PJ Kemenkoan hanya boleh menilai staf/PJ Kementerian pada unit pegangan." };
    }

    // PJ Kemenkoan validates against pj_assignments scope='unit' only
    const { data: pjUnitAssignments } = await supabase
      .from("pj_assignments")
      .select("target_unit_id")
      .eq("nim", evaluatorProfile.nim)
      .eq("scope", "unit")
      .eq("is_active", true);

    const pjUnitIds = new Set((pjUnitAssignments ?? []).map((a) => a.target_unit_id));

    if (pjUnitIds.size === 0) {
      return { ok: false, message: "Assignment unit PJ Kemenkoan belum ditetapkan. Hubungi admin untuk menetapkan unit pegangan." };
    }

    if (!pjUnitIds.has(targetProfile.unit_id) || !pjUnitIds.has(parsed.data.unit_id)) {
      return { ok: false, message: "PJ Kemenkoan hanya dapat input rapor pada unit yang ditetapkan assignment." };
    }
  }

  const { data: selectedUnit } = await supabase
    .from("ref_units")
    .select("id, kategori, parent_id")
    .eq("id", parsed.data.unit_id)
    .maybeSingle();

  if (!selectedUnit) {
    return { ok: false, message: "Unit yang dipilih tidak ditemukan." };
  }

  const reportType = targetProfile.role === "menteri" ? "menteri_kepala_biro" : "staf_unit";
  const PRESTASI_INDICATOR = "Nilai Prestasi";
  const INTERNAL_INDICATOR = "Partisipasi Internal";
  const TANGGUNG_JAWAB_INDICATOR = "Tanggung Jawab";
  const EXTERNAL_INDICATOR = "Partisipasi External";
  const EXTERNAL_INDICATOR_ALT = "Partisipasi Eksternal";
  const normalizeIndicatorName = (name: string) => (name === EXTERNAL_INDICATOR_ALT ? EXTERNAL_INDICATOR : name);

  const parentKemenkoId = selectedUnit.kategori === "kemenko" ? selectedUnit.id : selectedUnit.parent_id;

  // PJ Kementerian (non-kemenkoan): non-Prestasi sub-indikator must follow period template.
  if (evaluatorProfile.role === "pj_kementerian" && evaluatorProfile.is_pj_kemenkoan !== true) {
    const { data: templateRows } = await supabase
      .from("kemenko_sub_indicator_templates")
      .select("main_indicator_name, sub_indicator_name")
      .eq("kemenko_unit_id", parentKemenkoId ?? "00000000-0000-0000-0000-000000000000")
      .eq("periode_id", parsed.data.periode_id);

    const normalize = (value: string) => value.trim().toLowerCase();
    const expectedByIndicator = new Map<string, string[]>();
    for (const row of templateRows ?? []) {
      const indicatorName = normalizeIndicatorName(row.main_indicator_name);
      if (!expectedByIndicator.has(indicatorName)) {
        expectedByIndicator.set(indicatorName, []);
      }
      expectedByIndicator.get(indicatorName)!.push(normalize(row.sub_indicator_name));
    }

    const mismatchRestrictedIndicator = parsed.data.indicators.some((indicator) => {
      const indicatorName = normalizeIndicatorName(indicator.main_indicator_name);
      if (indicatorName === PRESTASI_INDICATOR || indicatorName === INTERNAL_INDICATOR || indicatorName === TANGGUNG_JAWAB_INDICATOR) {
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

    if (mismatchRestrictedIndicator) {
      return {
        ok: false,
        message: "PJ Kementerian hanya dapat mengubah sub-indikator pada Tanggung Jawab, Partisipasi Internal, dan Nilai Prestasi.",
      };
    }
  }

  if (evaluatorProfile.role === "pj_kementerian" && evaluatorProfile.is_pj_kemenkoan === true) {
    const { data: templateRows } = await supabase
      .from("kemenko_sub_indicator_templates")
      .select("main_indicator_name, sub_indicator_name")
      .eq("kemenko_unit_id", parentKemenkoId ?? "00000000-0000-0000-0000-000000000000")
      .eq("periode_id", parsed.data.periode_id);

    const normalize = (value: string) => value.trim().toLowerCase();

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
        message: "PJ Kemenkoan hanya dapat mengubah sub-indikator pada Tanggung Jawab, Partisipasi Internal, dan Nilai Prestasi untuk unit ampuan.",
      };
    }
  }

  const scoreList = parsed.data.indicators.flatMap((indicator) =>
    indicator.items.map((item) => Number(item.score)),
  );
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

  const indicatorsByName = new Map(
    parsed.data.indicators.map((indicator) => [normalizeMainIndicator(indicator.main_indicator_name), indicator.items]),
  );

  const weightedTotal = Object.entries(sectionWeights).reduce((sum, [indicatorName, weight]) => {
    const items = indicatorsByName.get(indicatorName) ?? [];
    if (!items.length) {
      return sum;
    }

    const maxScore = sectionMaxScore[indicatorName] ?? 5;
    const sectionAverage = items.reduce((acc, item) => acc + Number(item.score), 0) / items.length;
    const weightedScore = (sectionAverage / maxScore) * weight;
    return sum + weightedScore;
  }, 0);

  const totalAverage = Number(weightedTotal.toFixed(2));

  const normalizedCatatan = parsed.data.catatan?.trim() || null;

  // Some environments may not have applied the catatan migration yet.
  // We probe once and gracefully continue without catatan when absent.
  const { error: catatanProbeError } = await supabase.from("rapor_scores").select("catatan").limit(1);
  const canPersistCatatan = !catatanProbeError;

  const { data: existingRapor } = await supabase
    .from("rapor_scores")
    .select("id")
    .eq("user_nim", parsed.data.user_nim)
    .eq("periode_id", parsed.data.periode_id)
    .maybeSingle();

  const payloadWithMaybeCatatan = canPersistCatatan ? { catatan: normalizedCatatan } : {};

  const { data: rapor, error: raporError } = existingRapor
    ? await supabase
        .from("rapor_scores")
        .update({
          penilai_nim: evaluatorProfile.nim,
          report_type: reportType,
          total_avg: totalAverage,
          ...payloadWithMaybeCatatan,
        })
        .eq("id", existingRapor.id)
        .select("id")
        .single()
    : await supabase
        .from("rapor_scores")
        .insert({
          user_nim: parsed.data.user_nim,
          periode_id: parsed.data.periode_id,
          penilai_nim: evaluatorProfile.nim,
          report_type: reportType,
          total_avg: totalAverage,
          ...payloadWithMaybeCatatan,
        })
        .select("id")
        .single();

  if (raporError || !rapor) {
    return {
      ok: false,
      message: `Gagal menyimpan rapor utama: ${raporError?.message ?? "unknown error"}`,
    };
  }

  if (existingRapor) {
    const { error: deleteDetailError } = await supabase.from("rapor_details").delete().eq("rapor_id", rapor.id);
    if (deleteDetailError) {
      return { ok: false, message: deleteDetailError.message };
    }
  }

  const detailRows = parsed.data.indicators.flatMap((indicator) =>
    indicator.items
      .filter((item) => item.sub_indicator_name.trim().length > 0)
      .map((item) => {
        const isPrestasi = indicator.main_indicator_name === PRESTASI_INDICATOR;
        const responsibilityScore = getPrestasiResponsibilityScore(item.bentuk_tanggung_jawab ?? null);
        const scaleScore = getPrestasiScaleScore(item.skala ?? null);
        const qualitativeScore = Number(item.nilai_kualitatif ?? 0);
        const finalScore = isPrestasi
          ? Number((responsibilityScore + scaleScore + qualitativeScore).toFixed(2))
          : item.score;

        return {
          rapor_id: rapor.id,
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
        };
      }),
  );

  if (detailRows.length > 0) {
    const { error: detailError } = await supabase.from("rapor_details").insert(detailRows);

    if (detailError) {
      return { ok: false, message: `Gagal menyimpan detail rapor: ${detailError.message}` };
    }
  }

  if (!canPersistCatatan) {
    revalidatePath("/admin");
    revalidatePath("/penilai");
    revalidatePath("/staff");
    revalidatePath("/menteri");
    revalidatePath("/menteri/staff");
    revalidatePath("/menko");
    revalidatePath("/menko/menteri");
    revalidatePath("/pres_wapres");

    return {
      ok: true,
      message:
        "Rapor tersimpan, tetapi catatan belum disimpan. Jalankan migration 20260328005000_add_catatan_to_rapor_scores.sql.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/penilai");
  revalidatePath("/staff");
  revalidatePath("/menteri");
  revalidatePath("/menteri/staff");
  revalidatePath("/menko");
  revalidatePath("/menko/menteri");
  revalidatePath("/pres_wapres");

  return {
    ok: true,
    message: existingRapor ? "Rapor periode ini berhasil diperbarui." : "Rapor berhasil disimpan.",
  };
}

export async function deleteRaporByAdmin(raporId: string) {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "admin") {
    return { ok: false, message: "Hanya admin yang dapat menghapus rapor." };
  }

  const { error } = await supabase.from("rapor_scores").delete().eq("id", raporId);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/staff");
  revalidatePath("/menteri");
  revalidatePath("/menteri/staff");
  revalidatePath("/menko");
  revalidatePath("/menko/menteri");
  revalidatePath("/pres_wapres");

  return { ok: true, message: "Rapor berhasil dihapus." };
}

export async function upsertEvaluatorAssignmentByAdmin(payload: { evaluator_nim: string; target_unit_id: string }) {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "admin") {
    return { ok: false, message: "Hanya admin yang dapat mengatur assignment penilai." };
  }

  const evaluatorNim = payload.evaluator_nim.trim();
  const targetUnitId = payload.target_unit_id.trim();

  if (!evaluatorNim || !targetUnitId) {
    return { ok: false, message: "Evaluator dan unit target wajib dipilih." };
  }

  const { error } = await supabase.from("evaluator_unit_assignments").upsert(
    {
      evaluator_nim: evaluatorNim,
      target_unit_id: targetUnitId,
      is_active: true,
    },
    { onConflict: "evaluator_nim" },
  );

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/penilai");
  return { ok: true, message: "Assignment unit penilai berhasil disimpan." };
}

export async function clearEvaluatorAssignmentByAdmin(evaluatorNim: string) {
  const supabase = createAdminSupabaseClient();
  const profile = await requireSessionProfile();

  if (profile.role !== "admin") {
    return { ok: false, message: "Hanya admin yang dapat menghapus assignment penilai." };
  }

  const { error } = await supabase
    .from("evaluator_unit_assignments")
    .delete()
    .eq("evaluator_nim", evaluatorNim.trim());

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/penilai");
  return { ok: true, message: "Assignment unit penilai berhasil dihapus." };
}
