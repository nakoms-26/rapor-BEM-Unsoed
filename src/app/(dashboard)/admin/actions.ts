"use server";

import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { adminInputSchema, type AdminInputForm } from "@/types/app";

function canInputAsAdmin(role: string) {
  return role === "admin";
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
  const isEvaluatorStaff = evaluatorProfile.role === "staff";
  const allowedEvaluatorTarget = targetProfile.role === "staff" || targetProfile.role === "user";

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

  if (isAdmin && (targetProfile.role !== "staff" && targetProfile.role !== "user" && targetProfile.role !== "menteri")) {
    return { ok: false, message: "Admin hanya dapat menilai akun staff atau menteri/kepala biro." };
  }

  const reportType = targetProfile.role === "menteri" ? "menteri_kepala_biro" : "staf_unit";

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
    indicator.items.map((item) => ({
      rapor_id: rapor.id,
      main_indicator_name: indicator.main_indicator_name,
      sub_indicator_name: item.sub_indicator_name,
      score: item.score,
    })),
  );

  const { error: detailError } = await supabase.from("rapor_details").insert(detailRows);

  if (detailError) {
    return { ok: false, message: `Gagal menyimpan detail rapor: ${detailError.message}` };
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
