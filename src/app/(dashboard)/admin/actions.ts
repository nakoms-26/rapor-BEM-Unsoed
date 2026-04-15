"use server";

import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
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

  if (isPjKementerian) {
    if (!allowedEvaluatorTarget) {
      return { ok: false, message: "PJ Kementerian hanya boleh menilai staf/PJ Kementerian pada unit pegangan." };
    }

    const { data: pjAssignment } = await supabase
      .from("evaluator_unit_assignments")
      .select("target_unit_id, is_active")
      .eq("evaluator_nim", evaluatorProfile.nim)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!pjAssignment) {
      return { ok: false, message: "Assignment PJ Kementerian belum ditetapkan. Hubungi admin untuk menetapkan 1 kementerian pegangan." };
    }

    if (targetProfile.unit_id !== pjAssignment.target_unit_id || parsed.data.unit_id !== pjAssignment.target_unit_id) {
      return { ok: false, message: "PJ Kementerian hanya dapat input rapor pada 1 kementerian yang ditetapkan." };
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

  // PJ Kementerian (non-kemenkoan) only allowed to edit detail on "Nilai Prestasi".
  if (evaluatorProfile.role === "pj_kementerian" && evaluatorProfile.is_pj_kemenkoan !== true) {
    const hasNonPrestasiDetail = parsed.data.indicators.some((indicator) =>
      indicator.main_indicator_name !== PRESTASI_INDICATOR &&
      indicator.items.some((item) => item.sub_indicator_name && item.sub_indicator_name.trim().length > 0),
    );
    if (hasNonPrestasiDetail) {
      return { ok: false, message: "PJ Kementerian hanya dapat mengubah sub-indikator pada Nilai Prestasi." };
    }
  }

  if (evaluatorProfile.role === "pj_kementerian" && evaluatorProfile.is_pj_kemenkoan === true) {
    const parentKemenkoId = selectedUnit.kategori === "kemenko" ? selectedUnit.id : selectedUnit.parent_id;
    const { data: ownedKemenko } = await supabase
      .from("pj_assignments")
      .select("id")
      .eq("nim", evaluatorProfile.nim)
      .eq("scope", "kemenko")
      .eq("target_unit_id", parentKemenkoId ?? "00000000-0000-0000-0000-000000000000")
      .eq("is_active", true)
      .maybeSingle();

    // If selected unit is not under owned kemenko, sub-indicator names must match template exactly.
    if (!ownedKemenko) {
      const { data: templateRows } = await supabase
        .from("kemenko_sub_indicator_templates")
        .select("main_indicator_name, sub_indicator_name")
        .eq("kemenko_unit_id", parentKemenkoId ?? "00000000-0000-0000-0000-000000000000")
        .eq("periode_id", parsed.data.periode_id);

      const normalize = (value: string) => value.trim().toLowerCase();

      const expectedByIndicator = new Map<string, string[]>();
      for (const row of templateRows ?? []) {
        if (!expectedByIndicator.has(row.main_indicator_name)) {
          expectedByIndicator.set(row.main_indicator_name, []);
        }
        expectedByIndicator.get(row.main_indicator_name)!.push(normalize(row.sub_indicator_name));
      }

      const submittedByIndicator = new Map<string, string[]>();
      for (const indicator of parsed.data.indicators) {
        submittedByIndicator.set(
          indicator.main_indicator_name,
          indicator.items
            .map((item) => normalize(item.sub_indicator_name))
            .filter((name) => name.length > 0),
        );
      }

      const mismatch = Array.from(submittedByIndicator.entries()).some(([indicatorName, submitted]) => {
        const expected = expectedByIndicator.get(indicatorName) ?? [];
        const submittedSorted = [...new Set(submitted)].sort();
        const expectedSorted = [...new Set(expected)].sort();
        return submittedSorted.join("||") !== expectedSorted.join("||");
      });

      if (mismatch) {
        return {
          ok: false,
          message:
            "Sub-indikator hanya dapat diubah oleh PJ Kemenko yang mengampu unit tersebut. Anda hanya bisa input nilai dari template sub-indikator yang sudah ada.",
        };
      }
    }
  }

  const scoreList = parsed.data.indicators.flatMap((indicator) =>
    indicator.items.map((item) => Number(item.score)),
  );
  const totalAverage = scoreList.length
    ? Number((scoreList.reduce((sum, n) => sum + n, 0) / scoreList.length).toFixed(2))
    : 0;

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
      .map((item) => ({
        rapor_id: rapor.id,
        main_indicator_name: indicator.main_indicator_name,
        sub_indicator_name: item.sub_indicator_name.trim(),
        score: item.score,
      })),
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
