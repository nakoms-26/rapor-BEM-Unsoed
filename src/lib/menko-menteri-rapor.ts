export const MENKO_MENTERI_RESPONSIBILITY_ITEMS = [
  "Komunikatif terkait keperluan kementerian/biro",
  "Adaptif terhadap internal kementerian/biro",
  "Kooperatif",
  "Loyalitas",
  "Emotional manajemen",
  "IWP (Iuran Wajib Panitia)",
  "Selaras",
] as const;

export const MENKO_MENTERI_RESPONSIBILITY_OPTIONS = [
  { value: "sangat_baik", label: "Sangat Baik", score: 4 },
  { value: "baik", label: "Baik", score: 3 },
  { value: "cukup_baik", label: "Cukup Baik", score: 2 },
  { value: "kurang_baik", label: "Kurang Baik", score: 1 },
] as const;

export const MENKO_MENTERI_PARTICIPATION_ITEMS = [
  "Rapim (Rapat Pimpinan)",
  "Ramenko (Rapat Kemenko)",
  "Safarizzmed",
  "Serasa",
] as const;

export const MENKO_MENTERI_PARTICIPATION_OPTIONS = [
  { value: "hadir", label: "Hadir", score: 4 },
  { value: "terlambat", label: "Terlambat", score: 3 },
  { value: "izin", label: "Izin", score: 2 },
  { value: "tanpa_keterangan", label: "Tanpa Keterangan", score: 1 },
] as const;

export type MenkoMenteriResponsibilityValue = (typeof MENKO_MENTERI_RESPONSIBILITY_OPTIONS)[number]["value"];
export type MenkoMenteriParticipationValue = (typeof MENKO_MENTERI_PARTICIPATION_OPTIONS)[number]["value"];

export function getResponsibilityScore(value: MenkoMenteriResponsibilityValue) {
  return MENKO_MENTERI_RESPONSIBILITY_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}

export function getParticipationScore(value: MenkoMenteriParticipationValue) {
  return MENKO_MENTERI_PARTICIPATION_OPTIONS.find((option) => option.value === value)?.score ?? 0;
}
