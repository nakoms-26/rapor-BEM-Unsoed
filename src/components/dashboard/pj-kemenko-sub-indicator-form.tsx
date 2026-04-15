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
import { saveKemenkoSubIndicators } from "@/app/(dashboard)/pj-kemenkoan/actions";

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
      const result = await saveKemenkoSubIndicators({
        kemenkoUnitId: kemenkoId,
        indicators: values.indicators,
      });

      setSubmitMessage(result.message);
      setIsSubmitSuccess(Boolean(result.ok));
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
