"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MAIN_INDICATORS, PRESTASI_RESPONSIBILITY_OPTIONS, PRESTASI_SCALE_OPTIONS } from "@/lib/constants";
import { adminInputSchema, type AdminInputForm, type PeriodOption, type StaffOption, type UnitOption } from "@/types/app";
import { submitInternRapor } from "@/app/(dashboard)/pj-ppm-intern/intern-actions";
import { AdminIndicatorBlock } from "@/components/dashboard/admin-indicator-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PrestasiResponsibilityValue = (typeof PRESTASI_RESPONSIBILITY_OPTIONS)[number]["value"];
type PrestasiScaleValue = (typeof PRESTASI_SCALE_OPTIONS)[number]["value"];

type Props = {
  units: UnitOption[];
  periods: PeriodOption[];
  interns: StaffOption[];
  internTemplates?: {
    kemenko_unit_id: string;
    periode_id: string;
    main_indicator_name: string;
    sub_indicator_name: string;
  }[];
  initialEditRapor?: {
    rapor_id: string;
    periode_id: string;
    unit_id: string;
    user_nim: string;
    catatan: string;
    indicators: {
      main_indicator_name: string;
      items: {
        sub_indicator_name: string;
        catatan?: string;
        score: number;
        bentuk_tanggung_jawab?: PrestasiResponsibilityValue;
        nilai_kuantitatif_tanggung_jawab?: number;
        skala?: PrestasiScaleValue;
        nilai_kuantitatif_skala?: number;
        nilai_kualitatif?: number;
        nilai_akhir?: number;
      }[];
    }[];
  };
};

const BULAN_LABEL: Record<number, string> = {
  1: "Januari", 2: "Februari", 3: "Maret", 4: "April", 5: "Mei", 6: "Juni",
  7: "Juli", 8: "Agustus", 9: "September", 10: "Oktober", 11: "November", 12: "Desember",
};

function createBlankPrestasiItem() {
  return {
    sub_indicator_name: "",
    catatan: undefined,
    score: 0,
    bentuk_tanggung_jawab: undefined,
    nilai_kuantitatif_tanggung_jawab: undefined,
    skala: undefined,
    nilai_kuantitatif_skala: undefined,
    nilai_kualitatif: undefined,
    nilai_akhir: undefined,
  };
}

export function InternInputForm({
  units,
  periods,
  interns,
  internTemplates = [],
  initialEditRapor,
}: Props) {
  const router = useRouter();
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasPeriods = periods.length > 0;
  const hasUnits = units.length > 0;
  const PRESTASI_INDICATOR = "Nilai Prestasi";

  const form = useForm<AdminInputForm, undefined, AdminInputForm>({
    resolver: zodResolver(adminInputSchema),
    defaultValues: {
      periode_id: periods[0]?.id ?? "",
      unit_id: units[0]?.id ?? "",
      user_nim: "",
      catatan: "",
      indicators: MAIN_INDICATORS.map((name) => ({
        main_indicator_name: name,
        items: [],
      })),
    },
  });

  const selectedUnit = useWatch({ control: form.control, name: "unit_id" });
  const selectedPeriode = useWatch({ control: form.control, name: "periode_id" });

  const filteredInterns = useMemo(
    () => interns.filter((intern) => intern.unit_id === selectedUnit),
    [selectedUnit, interns],
  );

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const isEditMode = Boolean(initialEditRapor);

  const templatesByKemenkoPeriode = useMemo(() => {
    const map = new Map<string, Map<string, string[]>>();
    for (const row of internTemplates) {
      const key = `${row.kemenko_unit_id}::${row.periode_id}`;
      if (!map.has(key)) {
        map.set(key, new Map());
      }
      const byIndicator = map.get(key)!;
      if (!byIndicator.has(row.main_indicator_name)) {
        byIndicator.set(row.main_indicator_name, []);
      }
      const list = byIndicator.get(row.main_indicator_name)!;
      if (!list.includes(row.sub_indicator_name)) {
        list.push(row.sub_indicator_name);
      }
    }
    return map;
  }, [internTemplates]);

  useEffect(() => {
    if (isEditMode) return;
    if (!selectedUnit) return;
    if (!selectedPeriode) return;

    const selectedUnitMeta = unitById.get(selectedUnit);
    const kemenkoId = selectedUnitMeta?.kategori === "kemenko" ? selectedUnitMeta.id : selectedUnitMeta?.parent_id;
    if (!kemenkoId) return;

    const indicatorTemplate = templatesByKemenkoPeriode.get(`${kemenkoId}::${selectedPeriode}`);
    const nextIndicators = MAIN_INDICATORS.map((indicatorName) => ({
      main_indicator_name: indicatorName,
      items: indicatorName === PRESTASI_INDICATOR
        ? []
        : (indicatorTemplate?.get(indicatorName) ?? []).map((subName) => ({
            sub_indicator_name: subName,
            catatan: "",
            score: 1,
          })),
    }));

    const current = form.getValues();
    form.reset(
      {
        ...current,
        unit_id: selectedUnit,
        periode_id: selectedPeriode,
        user_nim: "",
        indicators: nextIndicators,
      },
      { keepDirtyValues: false },
    );
  }, [selectedUnit, selectedPeriode, unitById, templatesByKemenkoPeriode, isEditMode, form, PRESTASI_INDICATOR]);

  useEffect(() => {
    if (!initialEditRapor) return;

    form.reset({
      periode_id: initialEditRapor.periode_id,
      unit_id: initialEditRapor.unit_id,
      user_nim: initialEditRapor.user_nim,
      catatan: initialEditRapor.catatan,
      indicators: initialEditRapor.indicators,
    });
  }, [initialEditRapor, form]);

  const onSubmit = (data: AdminInputForm) => {
    setSubmitMessage("");
    setIsSubmitSuccess(false);

    startTransition(async () => {
      const result = await submitInternRapor(data);
      setSubmitMessage(result.message);
      setIsSubmitSuccess(result.ok);
      if (result.ok) {
        router.refresh();
      }
    });
  };

  return (
    <Card className="border-teal-200/80 bg-white shadow-xs">
      <CardHeader className="p-4 sm:p-6 pb-3">
        <CardTitle className="text-base sm:text-lg text-slate-900">
          {isEditMode ? "Edit Rapor Internship" : "Input Rapor Internship"}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {isEditMode
            ? "Perbarui data rapor internship yang sudah ada."
            : "Isi rapor bulanan untuk anak magang (Cakrawala)."}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          {/* Period selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="intern-periode" className="block text-xs font-medium text-slate-700 mb-1.5">
                Periode
              </label>
              <select
                id="intern-periode"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={!hasPeriods || isEditMode}
                {...form.register("periode_id")}
              >
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {BULAN_LABEL[period.bulan] ?? `Bulan ${period.bulan}`} {period.tahun} ({period.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="intern-unit" className="block text-xs font-medium text-slate-700 mb-1.5">
                Unit Kementerian/Biro
              </label>
              <select
                id="intern-unit"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                disabled={!hasUnits || isEditMode}
                {...form.register("unit_id")}
              >
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nama_unit}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Intern selector */}
          <div>
            <label htmlFor="intern-nim" className="block text-xs font-medium text-slate-700 mb-1.5">
              Staf Magang (Cakrawala)
            </label>
            <select
              id="intern-nim"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              disabled={isEditMode}
              {...form.register("user_nim")}
            >
              <option value="">Pilih staf magang…</option>
              {filteredInterns.map((intern) => (
                <option key={intern.nim} value={intern.nim}>
                  {intern.nama_lengkap} ({intern.nim})
                </option>
              ))}
            </select>
            {form.formState.errors.user_nim ? (
              <p className="mt-1 text-xs text-red-600">{form.formState.errors.user_nim.message}</p>
            ) : null}
          </div>

          {/* Catatan */}
          <div>
            <label htmlFor="intern-catatan" className="block text-xs font-medium text-slate-700 mb-1.5">
              Catatan Umum
            </label>
            <textarea
              id="intern-catatan"
              rows={3}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm placeholder:text-slate-400"
              placeholder="Catatan umum untuk rapor ini (opsional)"
              {...form.register("catatan")}
            />
          </div>

          {/* Indicator blocks */}
          {MAIN_INDICATORS.map((indicatorName, indicatorIndex) => (
            <AdminIndicatorBlock
              key={indicatorName}
              indicatorName={indicatorName}
              index={indicatorIndex}
              control={form.control}
              register={form.register}
              setValue={form.setValue}
              allowAddItem={true}
              readOnlyNames={false}
            />
          ))}

          {/* Submit */}
          <div className="flex flex-col gap-3 pt-2">
            {submitMessage ? (
              <div
                className={`rounded-lg border px-4 py-3 text-sm ${
                  isSubmitSuccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {submitMessage}
              </div>
            ) : null}

            <Button type="submit" disabled={isPending} className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto">
              {isPending ? "Menyimpan…" : isEditMode ? "Perbarui Rapor" : "Simpan Rapor Internship"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
