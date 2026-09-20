type ReportVariant = "staff" | "menteri";

type ScoreDetail = {
  main_indicator_name: string;
  score: number;
};

const STAFF_SECTION_WEIGHTS: Record<string, number> = {
  "Keaktifan": 20,
  "Tanggung Jawab": 20,
  "Partisipasi Internal": 30,
  "Partisipasi Eksternal": 30,
};

const STAFF_SECTION_MAX: Record<string, number> = {
  "Keaktifan": 5,
  "Tanggung Jawab": 5,
  "Partisipasi Internal": 4,
  "Partisipasi Eksternal": 4,
};

const MENTERI_SECTION_WEIGHTS: Record<string, number> = {
  "Tanggung Jawab": 50,
  "Partisipasi Internal": 50,
};

const MENTERI_SECTION_MAX: Record<string, number> = {
  "Tanggung Jawab": 4,
  "Partisipasi Internal": 4,
};

function normalizeSectionName(name: string) {
  if (name === "Partisipasi External") return "Partisipasi Eksternal";
  return name;
}

function normalizeToHundredScale(score: number) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) return 0;

  if (numericScore <= 5) {
    return Number((numericScore * 20).toFixed(2));
  }

  return Number(numericScore.toFixed(2));
}

export function computeWeightedTotalFromDetails(details: ScoreDetail[], reportVariant: ReportVariant = "staff") {
  const sectionScores = new Map<string, number[]>();

  for (const detail of details) {
    const sectionName = normalizeSectionName(detail.main_indicator_name);
    if (!sectionScores.has(sectionName)) {
      sectionScores.set(sectionName, []);
    }
    sectionScores.get(sectionName)!.push(Number(detail.score));
  }

  const sectionWeights = reportVariant === "menteri" ? MENTERI_SECTION_WEIGHTS : STAFF_SECTION_WEIGHTS;
  const sectionMax = reportVariant === "menteri" ? MENTERI_SECTION_MAX : STAFF_SECTION_MAX;

  const weightedTotal = Object.entries(sectionWeights).reduce((sum, [sectionName, weight]) => {
    const scores = sectionScores.get(sectionName) ?? [];
    if (!scores.length) return sum;

    const avg = scores.reduce((acc, value) => acc + value, 0) / scores.length;
    const maxScore = sectionMax[sectionName] ?? 5;
    return sum + (avg / maxScore) * weight;
  }, 0);

  return Number(weightedTotal.toFixed(2));
}

export function resolveDisplayTotalScore(
  storedTotalScore: number,
  details: ScoreDetail[] | undefined,
  reportVariant: ReportVariant = "staff",
) {
  const safeDetails = details ?? [];
  const derivedScore = computeWeightedTotalFromDetails(safeDetails, reportVariant);

  if (derivedScore > 0) {
    return derivedScore;
  }

  return normalizeToHundredScale(storedTotalScore);
}

export type StaffPeriodScoreInput = {
  scoreId: string;
  userNim: string;
  totalAvg: number;
  bulan: number;
  tahun: number;
  details?: ScoreDetail[];
};

export type StaffCumulativeResult = {
  userNim: string;
  cumulativeAvg: number;
  periodCount: number;
  latestScore: number;
  latestBulan: number;
  latestTahun: number;
  periodScores: Array<{
    scoreId: string;
    bulan: number;
    tahun: number;
    score: number;
  }>;
};

export function calculateSingleStaffCumulative(
  scores: Array<{
    scoreId?: string;
    totalAvg: number;
    bulan: number;
    tahun: number;
    details?: ScoreDetail[];
  }>,
  reportVariant: ReportVariant = "staff",
) {
  if (!scores.length) {
    return {
      cumulativeAvg: 0,
      periodCount: 0,
      latestScore: 0,
      latestBulan: 0,
      latestTahun: 0,
      periodScores: [],
    };
  }

  const sorted = [...scores].sort((a, b) => {
    if (a.tahun !== b.tahun) return b.tahun - a.tahun;
    return b.bulan - a.bulan;
  });

  const periodScores = sorted.map((s) => ({
    scoreId: s.scoreId ?? "",
    bulan: s.bulan,
    tahun: s.tahun,
    score: resolveDisplayTotalScore(s.totalAvg, s.details, reportVariant),
  }));

  const totalSum = periodScores.reduce((acc, curr) => acc + curr.score, 0);
  const cumulativeAvg = Number((totalSum / periodScores.length).toFixed(2));
  const latest = periodScores[0];

  return {
    cumulativeAvg,
    periodCount: periodScores.length,
    latestScore: latest?.score ?? 0,
    latestBulan: latest?.bulan ?? 0,
    latestTahun: latest?.tahun ?? 0,
    periodScores,
  };
}

export function calculateStaffCumulativeScores(
  inputs: StaffPeriodScoreInput[],
  reportVariant: ReportVariant = "staff",
): Map<string, StaffCumulativeResult> {
  const byNim = new Map<string, StaffPeriodScoreInput[]>();
  for (const item of inputs) {
    if (!byNim.has(item.userNim)) {
      byNim.set(item.userNim, []);
    }
    byNim.get(item.userNim)!.push(item);
  }

  const resultMap = new Map<string, StaffCumulativeResult>();
  for (const [userNim, staffScores] of byNim.entries()) {
    const single = calculateSingleStaffCumulative(
      staffScores.map((s) => ({
        scoreId: s.scoreId,
        totalAvg: s.totalAvg,
        bulan: s.bulan,
        tahun: s.tahun,
        details: s.details,
      })),
      reportVariant,
    );

    resultMap.set(userNim, {
      userNim,
      cumulativeAvg: single.cumulativeAvg,
      periodCount: single.periodCount,
      latestScore: single.latestScore,
      latestBulan: single.latestBulan,
      latestTahun: single.latestTahun,
      periodScores: single.periodScores,
    });
  }

  return resultMap;
}
