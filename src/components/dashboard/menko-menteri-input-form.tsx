"use client";

import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CirclePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  MENKO_MENTERI_PARTICIPATION_ITEMS,
  MENKO_MENTERI_PARTICIPATION_OPTIONS,
  MENKO_MENTERI_RESPONSIBILITY_ITEMS,
  MENKO_MENTERI_RESPONSIBILITY_OPTIONS,
  type MenkoMenteriParticipationValue,
  type MenkoMenteriResponsibilityValue,
} from "@/lib/menko-menteri-rapor";
import { submitMenkoMenteriRapor, type MenkoMenteriInputForm } from "@/app/(dashboard)/menko/menteri/actions";

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

const DEFAULT_RESPONSIBILITY = MENKO_MENTERI_RESPONSIBILITY_OPTIONS[0].value as MenkoMenteriResponsibilityValue;
const DEFAULT_PARTICIPATION = MENKO_MENTERI_PARTICIPATION_OPTIONS[0].value as MenkoMenteriParticipationValue;

const formSchema = z.object({
  periode_id: z.string().uuid("Periode belum dipilih."),
  user_nim: z.string().min(3, "Menteri/Kepala Biro belum dipilih."),
  catatan: z.string().max(1000, "Catatan maksimal 1000 karakter."),
  tanggung_jawab: z
    .array(
      z.object({
        sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator tanggung jawab minimal 2 karakter."),
        kategori: z.enum(
          MENKO_MENTERI_RESPONSIBILITY_OPTIONS.map((option) => option.value) as [
            MenkoMenteriResponsibilityValue,
            ...MenkoMenteriResponsibilityValue[],
          ],
        ),
      }),
    )
    .min(1, "Minimal ada 1 sub-indikator tanggung jawab."),
  partisipasi: z
    .array(
      z.object({
        sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator partisipasi minimal 2 karakter."),
        kategori: z.enum(
          MENKO_MENTERI_PARTICIPATION_OPTIONS.map((option) => option.value) as [
            MenkoMenteriParticipationValue,
            ...MenkoMenteriParticipationValue[],
          ],
        ),
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

type Props = {
  periods: { id: string; bulan: number; tahun: number; status: "draft" | "published" }[];
  menteriOptions: { nim: string; nama_lengkap: string; unit_name: string }[];
};

function buildDefaultValues(periodId: string, userNim: string): MenkoMenteriInputForm {
  return {
    periode_id: periodId,
    user_nim: userNim,
    catatan: "",
    tanggung_jawab: MENKO_MENTERI_RESPONSIBILITY_ITEMS.map((name) => ({
      sub_indicator_name: name,
      kategori: DEFAULT_RESPONSIBILITY,
    })),
    partisipasi: MENKO_MENTERI_PARTICIPATION_ITEMS.map((name) => ({
      sub_indicator_name: name,
      kategori: DEFAULT_PARTICIPATION,
    })),
  };
}

export function MenkoMenteriInputForm({ periods, menteriOptions }: Props) {
  const [submitMessage, setSubmitMessage] = useState("");
  const [isSubmitSuccess, setIsSubmitSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const initialPeriodeId = periods[0]?.id ?? "";
  const initialMenteriNim = menteriOptions[0]?.nim ?? "";

  const form = useForm<MenkoMenteriInputForm, undefined, MenkoMenteriInputForm>({
    resolver: zodResolver(formSchema),
    defaultValues: buildDefaultValues(initialPeriodeId, initialMenteriNim),
  });

  const responsibilityFieldArray = useFieldArray({
    control: form.control,
    name: "tanggung_jawab",
  });

  const participationFieldArray = useFieldArray({
    control: form.control,
    name: "partisipasi",
  });

  const isReadyToSubmit = periods.length > 0 && menteriOptions.length > 0;

  function onInvalidSubmit() {
    setIsSubmitSuccess(false);
    const firstError =
      form.formState.errors.periode_id?.message ||
      form.formState.errors.user_nim?.message ||
      form.formState.errors.catatan?.message ||
      form.formState.errors.tanggung_jawab?.message ||
      form.formState.errors.partisipasi?.message ||
      "Form belum lengkap. Pastikan seluruh kategori penilaian telah dipilih.";
    setSubmitMessage(String(firstError));
  }

  function onSubmit(values: MenkoMenteriInputForm) {
    setSubmitMessage("");
    setIsSubmitSuccess(false);

    startTransition(async () => {
      const result = await submitMenkoMenteriRapor(values);
      setSubmitMessage(result.message);
      setIsSubmitSuccess(Boolean(result.ok));

      if (result.ok) {
        const currentPeriod = form.getValues("periode_id");
        const currentMenteri = form.getValues("user_nim");
        form.reset(buildDefaultValues(currentPeriod, currentMenteri));
      }
    });
  }

  return (
    <Card id="input-rapor-menteri-form">
      <CardHeader>
        <CardTitle>Input Penilaian Menteri/Kepala Biro</CardTitle>
        <CardDescription>
          Penilai: Menko. Komponen nilai terdiri dari Tanggung Jawab dan Partisipasi dengan kategori tetap.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isReadyToSubmit ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Data periode atau data menteri belum tersedia.
          </p>
        ) : null}

        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit, onInvalidSubmit)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Periode</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register("periode_id")}
                disabled={!periods.length}
              >
                {!periods.length ? <option value="">Belum ada periode</option> : null}
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {BULAN_LABEL[period.bulan] ?? `Bulan ${period.bulan}`} {period.tahun} ({period.status})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Menteri/Kepala Biro Dinilai</label>
              <select
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                {...form.register("user_nim")}
                disabled={!menteriOptions.length}
              >
                {!menteriOptions.length ? <option value="">Belum ada data menteri</option> : null}
                {menteriOptions.map((menteri) => (
                  <option key={menteri.nim} value={menteri.nim}>
                    {menteri.nama_lengkap} - {menteri.unit_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Tanggung Jawab</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  responsibilityFieldArray.append({
                    sub_indicator_name: "",
                    kategori: DEFAULT_RESPONSIBILITY,
                  })
                }
              >
                <CirclePlus className="mr-2 h-4 w-4" /> Tambah Sub-Indikator
              </Button>
            </div>
            <div className="space-y-2">
              {responsibilityFieldArray.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                  <Input
                    placeholder="Nama sub-indikator tanggung jawab"
                    {...form.register(`tanggung_jawab.${index}.sub_indicator_name`)}
                  />
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                    {...form.register(`tanggung_jawab.${index}.kategori`)}
                  >
                    {MENKO_MENTERI_RESPONSIBILITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => responsibilityFieldArray.remove(index)}
                    disabled={responsibilityFieldArray.fields.length <= 1}
                    aria-label="Hapus sub-indikator tanggung jawab"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {form.formState.errors.tanggung_jawab ? (
              <p className="mt-2 text-xs text-red-600">{String(form.formState.errors.tanggung_jawab.message ?? "Periksa input tanggung jawab.")}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800">Partisipasi</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  participationFieldArray.append({
                    sub_indicator_name: "",
                    kategori: DEFAULT_PARTICIPATION,
                  })
                }
              >
                <CirclePlus className="mr-2 h-4 w-4" /> Tambah Sub-Indikator
              </Button>
            </div>
            <div className="space-y-2">
              {participationFieldArray.fields.map((field, index) => (
                <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
                  <Input
                    placeholder="Nama sub-indikator partisipasi"
                    {...form.register(`partisipasi.${index}.sub_indicator_name`)}
                  />
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                    {...form.register(`partisipasi.${index}.kategori`)}
                  >
                    {MENKO_MENTERI_PARTICIPATION_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => participationFieldArray.remove(index)}
                    disabled={participationFieldArray.fields.length <= 1}
                    aria-label="Hapus sub-indikator partisipasi"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {form.formState.errors.partisipasi ? (
              <p className="mt-2 text-xs text-red-600">{String(form.formState.errors.partisipasi.message ?? "Periksa input partisipasi.")}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Catatan (opsional)</label>
            <textarea
              className="min-h-24 w-full rounded-md border border-slate-300 bg-white p-3 text-sm"
              placeholder="Catatan tambahan untuk rapor ini"
              maxLength={1000}
              {...form.register("catatan")}
            />
          </div>

          {submitMessage ? (
            <p className={`text-sm ${isSubmitSuccess ? "text-emerald-700" : "text-red-700"}`}>{submitMessage}</p>
          ) : null}

          <Button type="submit" disabled={!isReadyToSubmit || isPending}>
            {isPending ? "Menyimpan..." : "Simpan Penilaian"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
