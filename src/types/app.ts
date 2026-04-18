import { z } from "zod";
import type { AppRole } from "@/lib/constants";

export const subIndicatorSchema = z.object({
  sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator minimal 2 karakter"),
  score: z
    .number()
    .int("Skor harus bilangan bulat")
    .min(1, "Skor minimal 1")
    .max(5, "Skor maksimal 5")
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
  data.indicators.forEach((indicator, indicatorIndex) => {
    if (!PARTICIPATION_INDICATORS.has(indicator.main_indicator_name)) {
      return;
    }

    indicator.items.forEach((item, itemIndex) => {
      if (item.score > 4) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Skor Partisipasi Internal/Eksternal maksimal 4.",
          path: ["indicators", indicatorIndex, "items", itemIndex, "score"],
        });
      }
    });
  });
});

export type AdminInputForm = z.infer<typeof adminInputSchema>;

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
