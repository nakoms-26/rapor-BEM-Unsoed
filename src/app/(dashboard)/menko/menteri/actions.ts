"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSessionProfile } from "@/lib/auth/session";
import { canAccessKemenkoReports } from "@/lib/auth/permissions";
import {
  MENKO_MENTERI_PARTICIPATION_OPTIONS,
  MENKO_MENTERI_RESPONSIBILITY_OPTIONS,
  getParticipationScore,
  getResponsibilityScore,
  type MenkoMenteriParticipationValue,
  type MenkoMenteriResponsibilityValue,
} from "@/lib/menko-menteri-rapor";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const responsibilityEnum = z.enum(
  MENKO_MENTERI_RESPONSIBILITY_OPTIONS.map((option) => option.value) as [
    MenkoMenteriResponsibilityValue,
    ...MenkoMenteriResponsibilityValue[],
  ],
);

const participationEnum = z.enum(
  MENKO_MENTERI_PARTICIPATION_OPTIONS.map((option) => option.value) as [
    MenkoMenteriParticipationValue,
    ...MenkoMenteriParticipationValue[],
  ],
);

const menkoMenteriInputSchema = z.object({
  periode_id: z.string().uuid("Periode belum dipilih."),
  user_nim: z.string().min(3, "Menteri/Kepala Biro belum dipilih."),
  catatan: z.string().max(1000, "Catatan maksimal 1000 karakter."),
  tanggung_jawab: z
    .array(
      z.object({
        sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator tanggung jawab minimal 2 karakter."),
        kategori: responsibilityEnum,
      }),
    )
    .min(1, "Minimal ada 1 sub-indikator tanggung jawab."),
  partisipasi: z
    .array(
      z.object({
        sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator partisipasi minimal 2 karakter."),
        kategori: participationEnum,
      }),
    )
    .min(1, "Minimal ada 1 sub-indikator partisipasi."),
}).superRefine((data, ctx) => {
  const normalize = (value: string) => value.trim().toLowerCase();

  const responsibilityNames = data.tanggung_jawab.map((item) => normalize(item.sub_indicator_name));
  if (new Set(responsibilityNames).size !== responsibilityNames.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sub-indikator tanggung jawab tidak boleh duplikat.",
      path: ["tanggung_jawab"],
    });
  }

  const participationNames = data.partisipasi.map((item) => normalize(item.sub_indicator_name));
  if (new Set(participationNames).size !== participationNames.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Sub-indikator partisipasi tidak boleh duplikat.",
      path: ["partisipasi"],
    });
  }
});

export type MenkoMenteriInputForm = z.infer<typeof menkoMenteriInputSchema>;

export async function submitMenkoMenteriRapor(payload: MenkoMenteriInputForm) {
  const parsed = menkoMenteriInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const supabase = createAdminSupabaseClient();
  const evaluatorProfile = await requireSessionProfile();

  const isAdmin = evaluatorProfile.role === "admin";
  const isMenko = evaluatorProfile.role === "menko" && canAccessKemenkoReports(evaluatorProfile);

  if (!isAdmin && !isMenko) {
    return { ok: false, message: "Hanya Admin dan Menko yang dapat menginput rapor menteri/kepala biro." };
  }

  if (isMenko && evaluatorProfile.is_pj_kemenkoan) {
    return { ok: false, message: "Akun PJ Kemenkoan tidak dapat menginput rapor menteri/kepala biro." };
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("nim, role, unit_id")
    .eq("nim", parsed.data.user_nim)
    .maybeSingle();

  if (!targetProfile || targetProfile.role !== "menteri") {
    return { ok: false, message: "Target penilaian harus akun menteri/kepala biro yang valid." };
  }

  const { data: targetUnit } = await supabase
    .from("ref_units")
    .select("id, parent_id")
    .eq("id", targetProfile.unit_id)
    .maybeSingle();

  if (!targetUnit) {
    return { ok: false, message: "Unit menteri/kepala biro tidak ditemukan." };
  }

  if (isMenko && targetUnit.parent_id !== evaluatorProfile.unit_id) {
    return { ok: false, message: "Anda hanya dapat menilai menteri/kepala biro pada unit koordinasi Anda." };
  }

  const responsibilityEntries: Array<{ subIndicator: string; value: MenkoMenteriResponsibilityValue }> =
    parsed.data.tanggung_jawab.map((item) => ({
      subIndicator: item.sub_indicator_name.trim(),
      value: item.kategori,
    }));

  const participationEntries: Array<{ subIndicator: string; value: MenkoMenteriParticipationValue }> =
    parsed.data.partisipasi.map((item) => ({
      subIndicator: item.sub_indicator_name.trim(),
      value: item.kategori,
    }));

  const allScores = [
    ...responsibilityEntries.map((entry) => getResponsibilityScore(entry.value)),
    ...participationEntries.map((entry) => getParticipationScore(entry.value)),
  ];
  const totalAverage = Number((allScores.reduce((sum, value) => sum + value, 0) / allScores.length).toFixed(2));

  const normalizedCatatan = parsed.data.catatan?.trim() || null;
  const { error: catatanProbeError } = await supabase.from("rapor_scores").select("catatan").limit(1);
  const canPersistCatatan = !catatanProbeError;

  const { data: existingRapor } = await supabase
    .from("rapor_scores")
    .select("id")
    .eq("user_nim", parsed.data.user_nim)
    .eq("periode_id", parsed.data.periode_id)
    .eq("report_type", "menteri_kepala_biro")
    .maybeSingle();

  const payloadWithMaybeCatatan = canPersistCatatan ? { catatan: normalizedCatatan } : {};

  const { data: rapor, error: raporError } = existingRapor
    ? await supabase
        .from("rapor_scores")
        .update({
          penilai_nim: evaluatorProfile.nim,
          report_type: "menteri_kepala_biro",
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
          report_type: "menteri_kepala_biro",
          total_avg: totalAverage,
          ...payloadWithMaybeCatatan,
        })
        .select("id")
        .single();

  if (raporError || !rapor) {
    return { ok: false, message: `Gagal menyimpan rapor utama: ${raporError?.message ?? "unknown error"}` };
  }

  const detailRows = [
    ...responsibilityEntries.map((entry) => ({
      rapor_id: rapor.id,
      main_indicator_name: "Tanggung Jawab",
      sub_indicator_name: entry.subIndicator,
      score: getResponsibilityScore(entry.value),
      catatan: entry.value,
      bentuk_tanggung_jawab: null,
      nilai_kuantitatif_tanggung_jawab: null,
      skala: null,
      nilai_kuantitatif_skala: null,
      nilai_kualitatif: null,
      nilai_akhir: null,
    })),
    ...participationEntries.map((entry) => ({
      rapor_id: rapor.id,
      main_indicator_name: "Partisipasi Internal",
      sub_indicator_name: entry.subIndicator,
      score: getParticipationScore(entry.value),
      catatan: entry.value,
      bentuk_tanggung_jawab: null,
      nilai_kuantitatif_tanggung_jawab: null,
      skala: null,
      nilai_kuantitatif_skala: null,
      nilai_kualitatif: null,
      nilai_akhir: null,
    })),
  ];

  if (existingRapor) {
    const { error: deleteDetailError } = await supabase.from("rapor_details").delete().eq("rapor_id", rapor.id);
    if (deleteDetailError) {
      return { ok: false, message: `Gagal memperbarui detail rapor: ${deleteDetailError.message}` };
    }
  }

  const { error: detailError } = await supabase.from("rapor_details").insert(detailRows);
  if (detailError) {
    return { ok: false, message: `Gagal menyimpan detail rapor: ${detailError.message}` };
  }

  revalidatePath("/menko");
  revalidatePath("/menko/menteri");
  revalidatePath("/menko/menteri-detail");
  revalidatePath("/menteri");
  revalidatePath("/pres_wapres");

  if (!canPersistCatatan) {
    return {
      ok: true,
      message:
        "Rapor tersimpan, tetapi catatan belum disimpan. Jalankan migration 20260328005000_add_catatan_to_rapor_scores.sql.",
    };
  }

  return {
    ok: true,
    message: existingRapor ? "Rapor menteri/kepala biro berhasil diperbarui." : "Rapor menteri/kepala biro berhasil disimpan.",
  };
}
