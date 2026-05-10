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
