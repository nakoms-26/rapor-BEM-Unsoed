"use client";

import { useState, useTransition } from "react";
import { useForm, useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CirclePlus, Trash2 } from "lucide-react";
import { MAIN_INDICATORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const subIndicatorSchema = z.object({
  indicators: z.array(
    z.object({
      main_indicator_name: z.string(),
      items: z.array(
        z.object({
          sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator minimal 2 karakter"),
        }),
      ),
    }),
  ),
});

type SubIndicatorForm = z.infer<typeof subIndicatorSchema>;

type Props = {
  kemenkoId: string;
  kemenkoName: string;
};

function SubIndicatorBlock({
  indicatorName,
  index,
  control,
  register,
}: {
  indicatorName: string;
  index: number;
  control: Control<SubIndicatorForm>;
  register: UseFormRegister<SubIndicatorForm>;
}) {
  const fieldArray = useFieldArray({
    control,
    name: `indicators.${index}.items`,
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="font-medium text-slate-700">{indicatorName}</h4>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fieldArray.append({ sub_indicator_name: "" })}
        >
          <CirclePlus className="mr-2 h-4 w-4" /> Tambah
        </Button>
      </div>

      <input type="hidden" {...register(`indicators.${index}.main_indicator_name`)} value={indicatorName} />

      <div className="space-y-2">
        {fieldArray.fields.length === 0 ? <p className="text-xs text-slate-500">Belum ada sub-indikator.</p> : null}
        {fieldArray.fields.map((field, itemIndex) => (
          <div key={field.id} className="flex gap-2">
            <Input
              placeholder="Nama rincian kegiatan"
              {...register(`indicators.${index}.items.${itemIndex}.sub_indicator_name`)}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => fieldArray.remove(itemIndex)}
              aria-label="Hapus sub-indikator"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PjKemenkoSubIndicatorForm({ kemenkoId, kemenkoName }: Props) {
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const form = useForm<SubIndicatorForm>({
    resolver: zodResolver(subIndicatorSchema),
    defaultValues: {
      indicators: MAIN_INDICATORS.map((name) => ({
        main_indicator_name: name,
        items: [],
      })),
    },
  });

  async function onSubmit(values: SubIndicatorForm) {
    setSubmitMessage("");
    setIsSubmitSuccess(false);

    startTransition(async () => {
      try {
        const supabase = createAdminSupabaseClient();

        // Save sub-indicators as templates linked to this kemenko
        // We'll store this as rapor with report_type='kemenko_sub_template'
        const { data: existingTemplate, error: fetchError } = await supabase
          .from("rapor_scores")
          .select("id")
          .eq("user_nim", kemenkoId)
          .eq("report_type", "kemenko_sub_template")
          .limit(1)
          .maybeSingle();

        if (fetchError && fetchError.code !== "PGRST116") {
          throw new Error(`Gagal mengambil template: ${fetchError.message}`);
        }

        // Prepare detail rows
        const detailRows = values.indicators.flatMap((indicator) =>
          indicator.items.map((item) => ({
            main_indicator_name: indicator.main_indicator_name,
            sub_indicator_name: item.sub_indicator_name.trim(),
            score: 0,
          })),
        );

        if (existingTemplate) {
          // Delete old details
          const { error: deleteError } = await supabase.from("rapor_details").delete().eq("rapor_id", existingTemplate.id);
          if (deleteError) throw new Error(`Gagal menghapus detail lama: ${deleteError.message}`);

          // Insert new details if any
          if (detailRows.length) {
            const { error: insertError } = await supabase.from("rapor_details").insert(
              detailRows.map((row) => ({
                rapor_id: existingTemplate.id,
                ...row,
              })),
            );
            if (insertError) throw new Error(`Gagal menyimpan detail: ${insertError.message}`);
          }
        } else {
          // Create new template
          const { data: newRapor, error: createError } = await supabase
            .from("rapor_scores")
            .insert({
              user_nim: kemenkoId,
              periode_id: "00000000-0000-0000-0000-000000000000", // Placeholder for template
              penilai_nim: kemenkoId,
              report_type: "kemenko_sub_template",
              total_avg: 0,
            })
            .select("id")
            .single();

          if (createError || !newRapor) throw new Error(`Gagal membuat template: ${createError?.message}`);

          if (detailRows.length) {
            const { error: insertError } = await supabase.from("rapor_details").insert(
              detailRows.map((row) => ({
                rapor_id: newRapor.id,
                ...row,
              })),
            );
            if (insertError) throw new Error(`Gagal menyimpan detail: ${insertError.message}`);
          }
        }

        setSubmitMessage("Sub-indikator berhasil disimpan untuk kemenko ini.");
        setIsSubmitSuccess(true);
      } catch (error) {
        setSubmitMessage(error instanceof Error ? error.message : "Gagal menyimpan sub-indikator.");
        setIsSubmitSuccess(false);
      }
    });
  }

  return (
    <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="space-y-3">
        {MAIN_INDICATORS.map((indicatorName, index) => (
          <SubIndicatorBlock
            key={indicatorName}
            indicatorName={indicatorName}
            index={index}
            control={form.control}
            register={form.register}
          />
        ))}
      </div>

      {submitMessage ? (
        <p className={`text-sm ${isSubmitSuccess ? "text-emerald-700" : "text-red-700"}`}>{submitMessage}</p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Menyimpan..." : "Simpan Sub-Indikator"}
      </Button>
    </form>
  );
}
