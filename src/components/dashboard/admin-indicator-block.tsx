"use client";

import { useEffect, useMemo } from "react";
import { useFieldArray, useWatch, type Control, type UseFormRegister, type UseFormSetValue } from "react-hook-form";
import { CirclePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminInputForm } from "@/types/app";
import {
  PRESTASI_QUALITATIVE_OPTIONS,
  PRESTASI_RESPONSIBILITY_OPTIONS,
  PRESTASI_SCALE_OPTIONS,
} from "@/lib/constants";

type Props = {
  indicatorName: string;
  index: number;
  control: Control<AdminInputForm>;
  register: UseFormRegister<AdminInputForm>;
  setValue: UseFormSetValue<AdminInputForm>;
  readOnlyNames?: boolean;
};

function formatDecimal(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPrestasiResponsibilityScore(value?: string) {
  return PRESTASI_RESPONSIBILITY_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}

function getPrestasiScaleScore(value?: string) {
  return PRESTASI_SCALE_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}

export function AdminIndicatorBlock({ indicatorName, index, control, register, setValue, readOnlyNames }: Props) {
  const isParticipationIndicator =
    indicatorName === "Partisipasi Internal" ||
    indicatorName === "Partisipasi External" ||
    indicatorName === "Partisipasi Eksternal";
  const isPrestasiIndicator = indicatorName === "Nilai Prestasi";
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

  const watchedItems = useWatch({
    control,
    name: `indicators.${index}.items`,
  });

  useEffect(() => {
    if (!isPrestasiIndicator) {
      return;
    }

    (watchedItems ?? []).forEach((item, itemIndex) => {
      const responsibilityScore = getPrestasiResponsibilityScore(item?.bentuk_tanggung_jawab);
      const scaleScore = getPrestasiScaleScore(item?.skala);
      const qualitativeScore = Number(item?.nilai_kualitatif ?? 0);
      const finalScore = Number((responsibilityScore + scaleScore + qualitativeScore).toFixed(2));

      if (Number(item?.nilai_kuantitatif_tanggung_jawab ?? 0) !== responsibilityScore) {
        setValue(`indicators.${index}.items.${itemIndex}.nilai_kuantitatif_tanggung_jawab`, responsibilityScore, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (Number(item?.nilai_kuantitatif_skala ?? 0) !== scaleScore) {
        setValue(`indicators.${index}.items.${itemIndex}.nilai_kuantitatif_skala`, scaleScore, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (Number(item?.nilai_akhir ?? 0) !== finalScore) {
        setValue(`indicators.${index}.items.${itemIndex}.nilai_akhir`, finalScore, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      if (Number(item?.score ?? 0) !== finalScore) {
        setValue(`indicators.${index}.items.${itemIndex}.score`, finalScore, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    });
  }, [index, isPrestasiIndicator, setValue, watchedItems]);

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
          <CirclePlus className="mr-2 h-4 w-4" /> {isPrestasiIndicator ? "Tambah Prestasi" : "Tambah Sub"}
        </Button>
      </div>

      <input type="hidden" {...register(`indicators.${index}.main_indicator_name`)} value={indicatorName} />

      <div className="space-y-3">
        {fieldArray.fields.length === 0 ? (
          <p className="text-xs text-slate-500">{isPrestasiIndicator ? "Belum ada data prestasi." : "Belum ada sub-indikator."}</p>
        ) : null}
        {fieldArray.fields.map((field, itemIndex) =>
          isPrestasiIndicator ? (
            <div key={field.id} className="grid gap-3 md:grid-cols-[1.2fr_1fr_120px_1fr_120px_80px_120px_120px_56px]">
              <Input
                placeholder={readOnlyNames ? "Nama agenda (tetap)" : "Nama agenda"}
                disabled={readOnlyNames}
                {...register(`indicators.${index}.items.${itemIndex}.sub_indicator_name`)}
              />
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                disabled={readOnlyNames}
                {...register(`indicators.${index}.items.${itemIndex}.bentuk_tanggung_jawab`)}
              >
                <option value="">Pilih</option>
                {PRESTASI_RESPONSIBILITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                readOnly
                className="bg-slate-100"
                value={formatDecimal(getPrestasiResponsibilityScore(watchedItems?.[itemIndex]?.bentuk_tanggung_jawab))}
              />
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                disabled={readOnlyNames}
                {...register(`indicators.${index}.items.${itemIndex}.skala`)}
              >
                <option value="">Pilih</option>
                {PRESTASI_SCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <Input
                readOnly
                className="bg-slate-100"
                value={formatDecimal(getPrestasiScaleScore(watchedItems?.[itemIndex]?.skala))}
              />
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                disabled={readOnlyNames}
                {...register(`indicators.${index}.items.${itemIndex}.nilai_kualitatif`, {
                  setValueAs: (value) => Number(value),
                })}
              >
                <option value="">Pilih</option>
                {PRESTASI_QUALITATIVE_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <Input
                readOnly
                className="bg-slate-100"
                value={formatDecimal(Number(watchedItems?.[itemIndex]?.score ?? 0))}
              />
              <Button
                type="button"
                variant="ghost"
                disabled={readOnlyNames}
                onClick={() => fieldArray.remove(itemIndex)}
                aria-label="Hapus prestasi"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : (
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
          ),
        )}
      </div>
    </div>
  );
}
