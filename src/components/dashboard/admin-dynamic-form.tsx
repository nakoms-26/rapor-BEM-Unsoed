"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MAIN_INDICATORS } from "@/lib/constants";
import { adminInputSchema, type AdminInputForm, type PeriodOption, type StaffOption, type UnitOption } from "@/types/app";
import { submitAdminRapor } from "@/app/(dashboard)/admin/actions";
import { canInputDetailKegiatan, getAdminTypeLabel } from "@/lib/auth/permissions";
import { AdminIndicatorBlock } from "@/components/dashboard/admin-indicator-block";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  units: UnitOption[];
  periods: PeriodOption[];
  staffs: StaffOption[];
  adminType?: "pj_kementerian" | "pj_kemenkoan";
  isAdmin?: boolean;
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

export function AdminDynamicForm({ units, periods, staffs, adminType, isAdmin }: Props) {
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const hasPeriods = periods.length > 0;
  const hasUnits = units.length > 0;
  const isPjKemenkoan = adminType === "pj_kemenkoan";
  const PRESTASI_INDICATOR = "Nilai Prestasi";
  // Admin dan PJ Kemenkoan dapat menambah sub-indikator untuk semua indicator
  // PJ Kementerian hanya untuk Nilai Prestasi
  // Yang lain hanya dapat edit score
  const canAddDetailAll = isAdmin || isPjKemenkoan;

  const form = useForm<AdminInputForm>({
    resolver: zodResolver(adminInputSchema),
    defaultValues: {
      periode_id: periods[0]?.id ?? "",
      unit_id: units[0]?.id ?? "",
      user_nim: "",
      catatan: "",
      indicators: MAIN_INDICATORS.map((name) => ({
        main_indicator_name: name,
        items: name === PRESTASI_INDICATOR ? [] : [],
      })),
    },
  });

  const selectedUnit = useWatch({
    control: form.control,
    name: "unit_id",
  });

  const filteredStaff = useMemo(
    () => staffs.filter((staff) => staff.unit_id === selectedUnit),
    [selectedUnit, staffs],
  );

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
            items: [],
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
      "Form belum lengkap. Pastikan staf dipilih dan nama sub-indikator yang diisi minimal 2 karakter.";

    setSubmitMessage(String(firstError));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Input Rapor Dinamis</CardTitle>
        <CardDescription>
          {canAddDetailAll
            ? "Tambahkan, sunting, atau hapus rincian kegiatan (sub-indikator) per indikator utama."
            : isPjKemenkoan === false && adminType === "pj_kementerian"
            ? "Input skala penilaian per indikator. Hanya dapat menambah/mengurangi rincian kegiatan pada Nilai Prestasi."
            : "Input skala penilaian per indikator yang sudah ada. Penambahan/pengurangan rincian kegiatan tidak diizinkan."
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
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
              readOnlyNames={!canAddDetailAll && indicatorName !== PRESTASI_INDICATOR}
            />
          ))}
          })}

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
