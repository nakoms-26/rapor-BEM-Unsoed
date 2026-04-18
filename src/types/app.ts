import { z } from "zod";
import type { AppRole } from "@/lib/constants";

const PRESTASI_RESPONSIBILITY_VALUES = ["PO", "Koor", "Anggota Kepanitiaan", "MC/Moderator", "Lain-lain"] as const;
const PRESTASI_SCALE_VALUES = ["kecil", "sedang", "besar"] as const;

export const subIndicatorSchema = z.object({
  sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator minimal 2 karakter"),
  catatan: z.string().trim().max(200, "Catatan maksimal 200 karakter").optional(),
  score: z
    .number()
    .min(0, "Skor minimal 0")
    .max(100, "Skor maksimal 100"),
  bentuk_tanggung_jawab: z.enum(PRESTASI_RESPONSIBILITY_VALUES).optional(),
  nilai_kuantitatif_tanggung_jawab: z.number().min(0).max(3).optional(),
  skala: z.enum(PRESTASI_SCALE_VALUES).optional(),
  nilai_kuantitatif_skala: z.number().min(0).max(1).optional(),
  nilai_kualitatif: z.number().int().min(1).max(5).optional(),
  nilai_akhir: z.number().min(0).optional(),
});

export const indicatorBlockSchema = z.object({
  main_indicator_name: z.string(),
  items: z.array(subIndicatorSchema),
});

const PARTICIPATION_INDICATORS = new Set(["Partisipasi Internal", "Partisipasi External", "Partisipasi Eksternal"]);

export const adminInputSchema = z.object({
  periode_id: z.string().uuid("Bulan belum dipilih"),
  unit_id: z.string().uuid("Unit belum dipilih"),
  user_nim: z.string().min(3, "Staf belum dipilih"),
  catatan: z.string().max(1000, "Catatan maksimal 1000 karakter"),
  indicators: z.array(indicatorBlockSchema),
}).superRefine((data, ctx) => {
  const PRESTASI_INDICATOR = "Nilai Prestasi";

  data.indicators.forEach((indicator, indicatorIndex) => {
    const isPrestasi = indicator.main_indicator_name === PRESTASI_INDICATOR;

    if (isPrestasi) {
      indicator.items.forEach((item, itemIndex) => {
        if (!item.sub_indicator_name.trim()) {
          return;
        }

        if (!item.bentuk_tanggung_jawab) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Bentuk tanggung jawab wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "bentuk_tanggung_jawab"],
          });
        }

        if (item.nilai_kuantitatif_tanggung_jawab == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nilai kuantitatif tanggung jawab wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "nilai_kuantitatif_tanggung_jawab"],
          });
        }

        if (!item.skala) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Skala wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "skala"],
          });
        }

        if (item.nilai_kuantitatif_skala == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nilai kuantitatif skala wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "nilai_kuantitatif_skala"],
          });
        }

        if (item.nilai_kualitatif == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nilai kualitatif wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "nilai_kualitatif"],
          });
        }

        if (item.nilai_akhir == null) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Nilai akhir wajib diisi.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "nilai_akhir"],
          });
        }
      });
      return;
    }

    if (!PARTICIPATION_INDICATORS.has(indicator.main_indicator_name)) {
      indicator.items.forEach((item, itemIndex) => {
        if (!Number.isInteger(item.score) || item.score < 1 || item.score > 5) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Skor harus bilangan bulat 1 sampai 5.",
            path: ["indicators", indicatorIndex, "items", itemIndex, "score"],
          });
        }
      });
      return;
    }

    indicator.items.forEach((item, itemIndex) => {
      if (!Number.isInteger(item.score) || item.score < 1 || item.score > 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Skor Partisipasi Internal/Eksternal maksimal 4.",
          path: ["indicators", indicatorIndex, "items", itemIndex, "score"],
        });
      }
    });
  });
});

export type AdminInputForm = z.input<typeof adminInputSchema>;

export type UnitOption = {
  id: string;
  nama_unit: string;
  kategori: "kemenko" | "kementerian" | "biro";
  parent_id: string | null;
};

export type PeriodOption = {
  id: string;
  bulan: number;
  tahun: number;
  status: "draft" | "published";
};

export type StaffOption = {
  nim: string;
  nama_lengkap: string;
  unit_id: string;
};

export type MenkoRecapItem = {
  unit_name: string;
  average_score: number;
  highest_staff: string;
  highest_score: number;
  lowest_staff: string;
  lowest_score: number;
};

export type SignUpRoleOption = {
  value: AppRole;
  label: string;
  description: string;
};

export type SignUpUnitOption = {
  id: string;
  nama_unit: string;
  kategori: "kemenko" | "kementerian" | "biro";
};
