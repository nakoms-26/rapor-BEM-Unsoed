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
  readOnlyNames?: boolean;
};

export function AdminIndicatorBlock({ indicatorName, index, control, register, readOnlyNames }: Props) {
  const isParticipationIndicator =
    indicatorName === "Partisipasi Internal" ||
    indicatorName === "Partisipasi External" ||
    indicatorName === "Partisipasi Eksternal";
  const maxScore = isParticipationIndicator ? 4 : 5;
  const attendanceLabelByScore: Record<number, string> = {
    4: "Hadir",
    3: "Terlambat",
    2: "Izin",
    1: "Tanpa keterangan",
  };

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
          disabled={readOnlyNames}
          onClick={() => fieldArray.append({ sub_indicator_name: "", catatan: "", score: 1 })}
        >
          <CirclePlus className="mr-2 h-4 w-4" /> Tambah Sub
        </Button>
      </div>

      <input type="hidden" {...register(`indicators.${index}.main_indicator_name`)} value={indicatorName} />

      <div className="space-y-3">
        {fieldArray.fields.length === 0 ? (
          <p className="text-xs text-slate-500">Belum ada sub-indikator.</p>
        ) : null}
        {fieldArray.fields.map((field, itemIndex) => (
          <div key={field.id} className={isParticipationIndicator ? "grid gap-3 md:grid-cols-[1fr_1fr_130px_56px]" : "grid gap-3 md:grid-cols-[1fr_130px_56px]"}>
            <Input
              placeholder={readOnlyNames ? "Sub-indikator (tetap)" : "Nama sub-indikator"}
              disabled={readOnlyNames}
              {...register(`indicators.${index}.items.${itemIndex}.sub_indicator_name`)}
            />
            {isParticipationIndicator ? (
              <Input
                placeholder="Catatan"
                {...register(`indicators.${index}.items.${itemIndex}.catatan`)}
              />
            ) : null}
            <select
              className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
              {...register(`indicators.${index}.items.${itemIndex}.score`, {
                setValueAs: (value) => Number(value),
              })}
            >
              {Array.from({ length: maxScore }, (_, idx) => idx + 1).map((value) => (
                <option key={value} value={value}>
                  {isParticipationIndicator ? `${value} - ${attendanceLabelByScore[value]}` : value}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="ghost"
              disabled={readOnlyNames}
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
