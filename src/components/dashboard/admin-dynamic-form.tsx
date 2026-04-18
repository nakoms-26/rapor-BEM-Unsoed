"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MAIN_INDICATORS, PRESTASI_RESPONSIBILITY_OPTIONS, PRESTASI_SCALE_OPTIONS } from "@/lib/constants";
import { adminInputSchema, type AdminInputForm, type PeriodOption, type StaffOption, type UnitOption } from "@/types/app";
import { submitAdminRapor } from "@/app/(dashboard)/admin/actions";
import { AdminIndicatorBlock } from "@/components/dashboard/admin-indicator-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PrestasiResponsibilityValue = (typeof PRESTASI_RESPONSIBILITY_OPTIONS)[number]["value"];
type PrestasiScaleValue = (typeof PRESTASI_SCALE_OPTIONS)[number]["value"];

type Props = {
  units: UnitOption[];
  periods: PeriodOption[];
  staffs: StaffOption[];
  adminType?: "pj_kementerian" | "pj_kemenkoan";
  isAdmin?: boolean;
  editableKemenkoUnitIds?: string[];
  kemenkoTemplates?: {
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
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
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

type FormIndicatorItem = NonNullable<AdminInputForm["indicators"][number]["items"][number]>;

function normalizeIndicatorItems(indicatorName: string, items: FormIndicatorItem[]) {
  if (indicatorName !== "Nilai Prestasi") {
    return items;
  }

  return items;
}

export function AdminDynamicForm({
  units,
  periods,
  staffs,
  adminType,
  isAdmin,
  editableKemenkoUnitIds = [],
  kemenkoTemplates = [],
  initialEditRapor,
}: Props) {
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasPeriods = periods.length > 0;
  const hasUnits = units.length > 0;
  const isPjKemenkoan = adminType === "pj_kemenkoan";
  const PRESTASI_INDICATOR = "Nilai Prestasi";
  const INTERNAL_INDICATOR = "Partisipasi Internal";
  const EXTERNAL_INDICATOR = "Partisipasi External";
  const pjKementerianEditableIndicators = useMemo(
    () => new Set([PRESTASI_INDICATOR, INTERNAL_INDICATOR, EXTERNAL_INDICATOR]),
    [PRESTASI_INDICATOR, INTERNAL_INDICATOR, EXTERNAL_INDICATOR],
  );
  const editableKemenkoSet = useMemo(() => new Set(editableKemenkoUnitIds), [editableKemenkoUnitIds]);

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

  const selectedUnit = useWatch({
    control: form.control,
    name: "unit_id",
  });

  const selectedPeriode = useWatch({
    control: form.control,
    name: "periode_id",
  });

  const filteredStaff = useMemo(
    () => staffs.filter((staff) => staff.unit_id === selectedUnit),
    [selectedUnit, staffs],
  );

  const unitById = useMemo(() => new Map(units.map((unit) => [unit.id, unit])), [units]);
  const selectedUnitMeta = unitById.get(selectedUnit);
  const selectedParentKemenkoId =
    selectedUnitMeta?.kategori === "kemenko" ? selectedUnitMeta.id : (selectedUnitMeta?.parent_id ?? "");
  const canEditByOwnedKemenko = isPjKemenkoan && editableKemenkoSet.has(selectedParentKemenkoId);
  // Admin can always edit sub-indicator names.
  // PJ Kemenkoan can edit only when selected unit belongs to kemenko they own.
  const canAddDetailAll = Boolean(isAdmin) || canEditByOwnedKemenko;
  const isEditMode = Boolean(initialEditRapor);

  const templatesByKemenkoPeriode = useMemo(() => {
    const map = new Map<string, Map<string, string[]>>();
    for (const row of kemenkoTemplates) {
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
  }, [kemenkoTemplates]);

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
      {
        keepErrors: true,
        keepTouched: true,
      },
    );
  }, [selectedUnit, selectedPeriode, unitById, templatesByKemenkoPeriode, form, isEditMode]);

  useEffect(() => {
    if (!initialEditRapor) return;

    form.reset(
      {
        periode_id: initialEditRapor.periode_id,
        unit_id: initialEditRapor.unit_id,
        user_nim: initialEditRapor.user_nim,
        catatan: initialEditRapor.catatan,
        indicators: initialEditRapor.indicators.map((indicator) => ({
          ...indicator,
          items: normalizeIndicatorItems(indicator.main_indicator_name, indicator.items),
        })),
      },
      {
        keepErrors: true,
      },
    );
  }, [initialEditRapor, form]);

  const canSubmit = hasPeriods && hasUnits;

  async function onSubmit(values: AdminInputForm) {
    setSubmitMessage("");
    setIsSubmitSuccess(false);
    startTransition(async () => {
      const result = await submitAdminRapor(values);
      setSubmitMessage(result.message);
      setIsSubmitSuccess(Boolean(result.ok));
      if (result.ok) {
        form.reset({
          ...values,
          catatan: "",
          indicators: values.indicators.map((indicator) => ({
            ...indicator,
            items: indicator.main_indicator_name === PRESTASI_INDICATOR
              ? []
              : indicator.items.map((item) => ({
                  ...item,
                  catatan: item.catatan ?? "",
                  score: 1,
                })),
          })),
        });
      }
    });
  }

  function onInvalidSubmit() {
    setIsSubmitSuccess(false);
    const firstError =
      form.formState.errors.periode_id?.message ||
      form.formState.errors.unit_id?.message ||
      form.formState.errors.user_nim?.message ||
      form.formState.errors.indicators?.message ||
      "Form belum lengkap. Pastikan staf dipilih dan skor diisi bilangan bulat 1 sampai 5.";

    setSubmitMessage(String(firstError));
  }

  return (
    <Card id="input-rapor-form">
      <CardHeader>
        <CardTitle>Input Rapor Dinamis</CardTitle>
        <CardDescription>
          {canAddDetailAll
            ? "Tambahkan, sunting, atau hapus rincian kegiatan (sub-indikator) per indikator utama."
            : isPjKemenkoan
            ? "Anda hanya dapat input nilai dari sub-indikator template. Edit sub-indikator hanya untuk unit di bawah kemenko yang Anda ampu."
            : adminType === "pj_kementerian"
            ? "Input skala penilaian per indikator. PJ Kementerian dapat menambah/mengurangi rincian pada Partisipasi Internal, Partisipasi External, dan Nilai Prestasi."
            : "Input skala penilaian per indikator yang sudah ada. Penambahan/pengurangan rincian kegiatan tidak diizinkan."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditMode ? (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <p>
              Mode edit aktif. Anda sedang mengedit rapor terpilih.
            </p>
            <Link href="/admin#input-rapor-form" className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-100">
              Keluar dari mode edit
            </Link>
          </div>
        ) : null}

        {!canSubmit ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {!hasPeriods ? "Data bulan/periode belum tersedia." : "Data unit belum tersedia."} Lengkapi data referensi
            terlebih dahulu agar input rapor bisa dilakukan.
          </p>
        ) : null}

        <form className="space-y-8" onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Periode (Bulan)</label>
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register("periode_id")}
                disabled={!hasPeriods}
              >
                {!hasPeriods ? <option value="">Belum ada data bulan</option> : null}
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {BULAN_LABEL[period.bulan] ?? `Bulan ${period.bulan}`} {period.tahun} ({period.status})
                  </option>
                ))}
              </select>
              {form.formState.errors.periode_id ? (
                <p className="text-xs text-red-600">{form.formState.errors.periode_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Unit</label>
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register("unit_id")}
                disabled={!hasUnits}
              >
                {!hasUnits ? <option value="">Belum ada data unit</option> : null}
                {units.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.nama_unit}
                  </option>
                ))}
              </select>
              {form.formState.errors.unit_id ? (
                <p className="text-xs text-red-600">{form.formState.errors.unit_id.message}</p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Staf Dinilai</label>
              <select
                className="h-10 w-full appearance-auto rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register("user_nim")}
                disabled={!hasUnits}
              >
                <option value="">Pilih staf</option>
                {filteredStaff.map((staff) => (
                  <option key={staff.nim} value={staff.nim}>
                    {staff.nama_lengkap} ({staff.nim})
                  </option>
                ))}
              </select>
              {form.formState.errors.user_nim ? (
                <p className="text-xs text-red-600">{form.formState.errors.user_nim.message}</p>
              ) : null}
            </div>
          </div>

          {MAIN_INDICATORS.map((indicatorName, index) => (
            <AdminIndicatorBlock
              key={indicatorName}
              indicatorName={indicatorName}
              index={index}
              control={form.control}
              register={form.register}
              setValue={form.setValue}
              readOnlyNames={isPjKemenkoan
                ? !canAddDetailAll
                : !canAddDetailAll && !pjKementerianEditableIndicators.has(indicatorName)}
            />
          ))}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Catatan</label>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
              placeholder="Tambahkan catatan penilaian (opsional)"
              maxLength={1000}
              {...form.register("catatan")}
            />
          </div>

          {submitMessage ? (
            <p className={`text-sm ${isSubmitSuccess ? "text-emerald-700" : "text-red-700"}`}>{submitMessage}</p>
          ) : null}

          <Button type="submit" disabled={isPending || !canSubmit}>
            {isPending ? "Menyimpan..." : "Simpan Rapor"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
