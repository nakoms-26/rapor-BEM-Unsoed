/**
 * Intern Rapor — Constants and shared logic for the internship rapor system.
 *
 * Indicators and weights are identical to the staff rapor system,
 * including Nilai Prestasi. The key difference is that intern rapor
 * uses separate database tables (intern_rapor_scores, intern_rapor_details).
 */

export const INTERN_MAIN_INDICATORS = [
  "Keaktifan",
  "Tanggung Jawab",
  "Partisipasi Internal",
  "Partisipasi External",
  "Nilai Prestasi",
] as const;

export type InternMainIndicatorName = (typeof INTERN_MAIN_INDICATORS)[number];

/**
 * Section weights for intern rapor calculation (same as staff).
 * Nilai Prestasi is calculated separately and not part of the weighted total.
 */
export const INTERN_SECTION_WEIGHTS: Record<string, number> = {
  "Keaktifan": 20,
  "Tanggung Jawab": 20,
  "Partisipasi Internal": 30,
  "Partisipasi Eksternal": 30,
};

export const INTERN_SECTION_MAX: Record<string, number> = {
  "Keaktifan": 5,
  "Tanggung Jawab": 5,
  "Partisipasi Internal": 4,
  "Partisipasi Eksternal": 4,
};
