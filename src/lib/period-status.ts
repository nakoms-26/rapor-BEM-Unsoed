export function isPublishedStatus(status: string | null | undefined) {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "published" || normalized === "publish";
}

type PeriodLike = {
  id: string;
  bulan: number;
  tahun: number;
  status: string;
};

export function periodMonthYearKey(period: Pick<PeriodLike, "bulan" | "tahun">) {
  return `${period.tahun}-${period.bulan}`;
}

export function resolvePublishedPeriodByScorePeriodId(
  scorePeriodeId: string,
  publishedById: Map<string, PeriodLike>,
  allById: Map<string, PeriodLike>,
  publishedByMonthYear: Map<string, PeriodLike>,
) {
  const directPeriod = publishedById.get(scorePeriodeId);
  if (directPeriod) return directPeriod;

  const sourcePeriod = allById.get(scorePeriodeId);
  if (!sourcePeriod) return undefined;

  return publishedByMonthYear.get(periodMonthYearKey(sourcePeriod));
}
