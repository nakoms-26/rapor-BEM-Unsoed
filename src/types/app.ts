import { z } from "zod";
import type { AppRole } from "@/lib/constants";

export const subIndicatorSchema = z.object({
  sub_indicator_name: z.string().trim().min(2, "Nama sub-indikator minimal 2 karakter"),
  score: z
    .number()
    .min(0, "Skor minimal 0")
    .max(5, "Skor maksimal 5")
    .refine((value) => Number.isInteger(value * 2), "Skor harus kelipatan 0.5"),
});

export const indicatorBlockSchema = z.object({
  main_indicator_name: z.string(),
  items: z.array(subIndicatorSchema),
});

export const adminInputSchema = z.object({
  periode_id: z.string().uuid("Bulan belum dipilih"),
  unit_id: z.string().uuid("Unit belum dipilih"),
  user_nim: z.string().min(3, "Staf belum dipilih"),
  catatan: z.string().max(1000, "Catatan maksimal 1000 karakter"),
  indicators: z.array(indicatorBlockSchema),
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
