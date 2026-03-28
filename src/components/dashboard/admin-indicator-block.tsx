"use client";

import { useFieldArray, type Control, type UseFormRegister } from "react-hook-form";
import { CirclePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminInputForm } from "@/types/app";

type Props = {
  indicatorName: string;
  index: number;
  control: Control<AdminInputForm>;
  register: UseFormRegister<AdminInputForm>;
};

export function AdminIndicatorBlock({ indicatorName, index, control, register }: Props) {
  const fieldArray = useFieldArray({
    control,
    name: `indicators.${index}.items`,
  });

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{indicatorName}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fieldArray.append({ sub_indicator_name: "", score: 0 })}
        >
          <CirclePlus className="mr-2 h-4 w-4" /> Tambah Sub
        </Button>
      </div>

      <input type="hidden" {...register(`indicators.${index}.main_indicator_name`)} value={indicatorName} />

      <div className="space-y-3">
        {fieldArray.fields.map((field, itemIndex) => (
          <div key={field.id} className="grid gap-3 md:grid-cols-[1fr_130px_56px]">
            <Input
              placeholder="Nama sub-indikator"
              {...register(`indicators.${index}.items.${itemIndex}.sub_indicator_name`)}
            />
            <Input
              type="number"
              min={0}
              max={5}
              step={0.1}
              {...register(`indicators.${index}.items.${itemIndex}.score`, { valueAsNumber: true })}
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() => fieldArray.fields.length > 1 && fieldArray.remove(itemIndex)}
              disabled={fieldArray.fields.length <= 1}
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
