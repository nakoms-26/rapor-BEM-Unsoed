"use server";

import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { adminInputSchema, type AdminInputForm } from "@/types/app";

export async function submitAdminRapor(payload: AdminInputForm) {
  const parsed = adminInputSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = createAdminSupabaseClient();
  const evaluatorProfile = await requireSessionProfile();

  if (evaluatorProfile.role !== "admin" && evaluatorProfile.role !== "pres_wapres") {
    return { ok: false, message: "Anda tidak memiliki akses untuk input rapor." };
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
    return {
      ok: true,
      message:
        "Rapor tersimpan, tetapi catatan belum disimpan. Jalankan migration 20260328005000_add_catatan_to_rapor_scores.sql.",
    };
  }

  return {
    ok: true,
    message: existingRapor ? "Rapor periode ini berhasil diperbarui." : "Rapor berhasil disimpan.",
  };
}
