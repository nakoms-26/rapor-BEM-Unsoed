export const MAIN_INDICATORS = [
  "Keaktifan",
  "Tanggung Jawab",
  "Partisipasi Kegiatan",
  "Partisipasi Internal",
  "Partisipasi External",
  "Nilai Prestasi",
] as const;

export type MainIndicatorName = (typeof MAIN_INDICATORS)[number];

export const APP_ROLES = ["admin", "pres_wapres", "menko", "menteri", "staff"] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_HOME: Record<string, string> = {
  admin: "/dashboard",
  user: "/dashboard",
  pres_wapres: "/dashboard",
  menko: "/dashboard",
  menteri: "/dashboard",
  staff: "/dashboard",
};
