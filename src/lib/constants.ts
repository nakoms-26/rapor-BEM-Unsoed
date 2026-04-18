export const MAIN_INDICATORS = [
  "Keaktifan",
  "Tanggung Jawab",
  "Partisipasi Internal",
  "Partisipasi External",
  "Nilai Prestasi",
] as const;

export const PRESTASI_RESPONSIBILITY_OPTIONS = [
  { label: "PO (3)", value: "PO", score: 3 },
  { label: "Koor (2)", value: "Koor", score: 2 },
  { label: "Anggota Kepanitiaan (1)", value: "Anggota Kepanitiaan", score: 1 },
  { label: "MC/Moderator (1)", value: "MC/Moderator", score: 1 },
  { label: "Lain-lain (1)", value: "Lain-lain", score: 1 },
] as const;

export const PRESTASI_SCALE_OPTIONS = [
  { label: "Kecil (0,5)", value: "kecil", score: 0.5 },
  { label: "Sedang (0,75)", value: "sedang", score: 0.75 },
  { label: "Besar (1)", value: "besar", score: 1 },
] as const;

export const PRESTASI_QUALITATIVE_OPTIONS = [1, 2, 3, 4, 5] as const;

export type MainIndicatorName = (typeof MAIN_INDICATORS)[number];

export const APP_ROLES = ["admin", "pj_kementerian", "pres_wapres", "menko", "menteri", "staff"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard",
  pj_kementerian: "/dashboard",
  user: "/dashboard",
  pres_wapres: "/dashboard",
  menko: "/dashboard",
  menteri: "/dashboard",
  staff: "/dashboard",
};
