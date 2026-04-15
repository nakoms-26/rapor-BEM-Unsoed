"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAIN_INDICATORS } from "@/lib/constants";
import { requireSessionProfile } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const payloadSchema = z.object({
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

export async function saveKemenkoSubIndicators(payload: {
  kemenkoUnitId: string;
  periodeId: string;
  indicators: { main_indicator_name: string; items: { sub_indicator_name: string }[] }[];
}) {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const profile = await requireSessionProfile();
  if (profile.role !== "pj_kementerian" || !profile.is_pj_kemenkoan) {
    return { ok: false, message: "Hanya PJ Kemenkoan yang dapat mengelola sub-indikator." };
  }

  const supabase = createAdminSupabaseClient();

  const { data: assignment } = await supabase
    .from("pj_assignments")
    .select("id")
    .eq("nim", profile.nim)
    .eq("scope", "kemenko")
    .eq("target_unit_id", parsed.data.kemenkoUnitId)
    .eq("is_active", true)
    .maybeSingle();

  if (!assignment) {
    return { ok: false, message: "Anda tidak memiliki assignment aktif untuk kemenko tersebut." };
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
    .from("kemenko_sub_indicator_templates")
    .delete()
    .eq("kemenko_unit_id", parsed.data.kemenkoUnitId)
    .eq("periode_id", parsed.data.periodeId);

  if (deleteError) {
    return { ok: false, message: `Gagal membersihkan template lama: ${deleteError.message}` };
  }

  if (uniqueRows.length) {
    const { error: insertError } = await supabase.from("kemenko_sub_indicator_templates").insert(uniqueRows);
    if (insertError) {
      return { ok: false, message: `Gagal menyimpan template: ${insertError.message}` };
    }
  }

  revalidatePath("/pj-kemenkoan");
  revalidatePath("/admin");

  return { ok: true, message: "Sub-indikator berhasil disimpan." };
}
