import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";

type ReportDetail = {
  main_indicator_name: string;
  sub_indicator_name: string;
  catatan?: string | null;
  score: number;
};

type SectionItem = {
  label: string;
  catatan?: string | null;
  score: number;
};

type Props = {
  reportId: string;
  title: string;
  periodLabel: string;
  name: string;
  jurusan?: string | null;
  tahunAngkatan?: number | null;
  unitName: string;
  totalScore: number;
  catatan?: string | null;
  details: ReportDetail[];
};

const SECTION_LABELS: Record<string, string> = {
  "Keaktifan": "Keaktifan",
  "Tanggung Jawab": "Tanggung Jawab",
  "Partisipasi Internal": "Partisipasi Internal",
  "Partisipasi External": "Partisipasi Eksternal",
  "Partisipasi Eksternal": "Partisipasi Eksternal",
  "Nilai Prestasi": "Nilai Prestasi",
};

const SECTION_ORDER = [
  "Keaktifan",
  "Tanggung Jawab",
  "Partisipasi Internal",
  "Partisipasi Eksternal",
];

const SECTION_WEIGHTS: Record<string, number> = {
  "Keaktifan": 20,
  "Tanggung Jawab": 20,
  "Partisipasi Internal": 30,
  "Partisipasi Eksternal": 30,
};

const SECTION_MAX_SCORE: Record<string, number> = {
  "Keaktifan": 5,
  "Tanggung Jawab": 5,
  "Partisipasi Internal": 4,
  "Partisipasi Eksternal": 4,
};

function scoreTone(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 70) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 55) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

function categoryFromScore(score: number) {
  if (score >= 85) return "SANGAT BAIK";
  if (score >= 70) return "BAIK";
  if (score >= 55) return "CUKUP";
  return "PERLU PERBAIKAN";
}

function normalizeSectionName(name: string) {
  if (name === "Partisipasi External") return "Partisipasi Eksternal";
  return name;
}

function groupSectionItems(details: ReportDetail[]) {
  const groups = new Map<string, SectionItem[]>();

  for (const detail of details) {
    const section = normalizeSectionName(detail.main_indicator_name);
    if (!groups.has(section)) {
      groups.set(section, []);
    }
    groups.get(section)!.push({
      label: detail.sub_indicator_name,
      catatan: detail.catatan ?? null,
      score: Number(detail.score),
    });
  }

  return groups;
}

function sectionTotal(items: SectionItem[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.score), 0).toFixed(2));
}

function sectionAverage(items: SectionItem[]) {
  if (!items.length) return 0;
  return Number((sectionTotal(items) / items.length).toFixed(2));
}

function weightedSectionScore(items: SectionItem[], weight: number, maxScore: number) {
  if (!items.length) return 0;
  return Number(((sectionAverage(items) / maxScore) * weight).toFixed(2));
}

function normalizeToHundredScale(score: number) {
  if (score <= 5) {
    return Number((score * 20).toFixed(2));
  }
  return Number(score.toFixed(2));
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(value);
}

function attendanceDescription(score: number) {
  if (score >= 4) return "Hadir";
  if (score >= 3) return "Terlambat";
  if (score >= 2) return "Izin";
  return "Tanpa keterangan";
}

function renderSectionTitle(section: string) {
  return SECTION_LABELS[section] ?? section;
}

export function RaporDocument({
  reportId,
  title,
  periodLabel,
  name,
  jurusan,
  tahunAngkatan,
  unitName,
  totalScore,
  catatan,
  details,
}: Props) {
  const sectionGroups = groupSectionItems(details);
  const orderedSections = SECTION_ORDER.filter((section) => sectionGroups.has(normalizeSectionName(section)));
  const prestasiSection = sectionGroups.get("Nilai Prestasi") ?? [];
  const internalSection = sectionGroups.get("Partisipasi Internal") ?? [];
  const externalSection = sectionGroups.get("Partisipasi Eksternal") ?? sectionGroups.get("Partisipasi External") ?? [];
  const keaktifanSection = sectionGroups.get("Keaktifan") ?? [];
  const tanggungJawabSection = sectionGroups.get("Tanggung Jawab") ?? [];
  const normalizedTotalScore = normalizeToHundredScale(totalScore);
  const prestasiScore = sectionTotal(prestasiSection);

  const weightedBySection: Record<string, number> = {
    "Keaktifan": weightedSectionScore(keaktifanSection, SECTION_WEIGHTS["Keaktifan"], SECTION_MAX_SCORE["Keaktifan"]),
    "Tanggung Jawab": weightedSectionScore(tanggungJawabSection, SECTION_WEIGHTS["Tanggung Jawab"], SECTION_MAX_SCORE["Tanggung Jawab"]),
    "Partisipasi Internal": weightedSectionScore(internalSection, SECTION_WEIGHTS["Partisipasi Internal"], SECTION_MAX_SCORE["Partisipasi Internal"]),
    "Partisipasi Eksternal": weightedSectionScore(externalSection, SECTION_WEIGHTS["Partisipasi Eksternal"], SECTION_MAX_SCORE["Partisipasi Eksternal"]),
  };

  const weightedTotalFromDetails = Number(
    (
      weightedBySection["Keaktifan"] +
      weightedBySection["Tanggung Jawab"] +
      weightedBySection["Partisipasi Internal"] +
      weightedBySection["Partisipasi Eksternal"]
    ).toFixed(2),
  );

  const displayTotalScore =
    keaktifanSection.length || tanggungJawabSection.length || internalSection.length || externalSection.length
      ? weightedTotalFromDetails
      : normalizedTotalScore;
  const cumulativeCategory = categoryFromScore(displayTotalScore);
  const participationItems = [...internalSection, ...externalSection];
  const terlambatCount = participationItems.filter((item) => item.score === 3).length;
  const izinCount = participationItems.filter((item) => item.score === 2).length;
  const tanpaKetCount = participationItems.filter((item) => item.score === 1).length;

  return (
    <Card id={reportId} className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4 border-b border-slate-100 pb-4">
        <div className="flex items-center justify-end">
          <DownloadPdfButton reportId={reportId} />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Rapor BEM UNSOED 2025</p>
          <CardTitle className="text-2xl text-slate-900">{title}</CardTitle>
          <CardDescription className="text-sm text-slate-600">
            Laporan kinerja pengurus BEM yang disusun setiap bulan.
          </CardDescription>
        </div>

        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div className="grid grid-cols-[150px_12px_1fr] gap-y-1">
              <p className="font-medium text-slate-500">Nama</p>
              <p>:</p>
              <p>{name}</p>

              <p className="font-medium text-slate-500">Jurusan/Tahun</p>
              <p>:</p>
              <p>{jurusan ?? "-"}{tahunAngkatan ? `/${tahunAngkatan}` : ""}</p>

              <p className="font-medium text-slate-500">Kementerian</p>
              <p>:</p>
              <p>{unitName}</p>

              <p className="font-medium text-slate-500">Bulan</p>
              <p>:</p>
              <p>{periodLabel}</p>
            </div>
          </div>
          <div className={`rounded-lg border p-3 text-sm ${scoreTone(displayTotalScore)}`}>
            <div className="grid grid-cols-[130px_12px_1fr] gap-y-1">
              <p className="font-semibold">KATEGORI</p>
              <p>:</p>
              <p className="font-semibold">{cumulativeCategory}</p>

              <p className="font-semibold">NILAI KUMULATIF</p>
              <p>:</p>
              <p className="font-semibold">{formatNumber(displayTotalScore, 2)}</p>

              <p className="font-semibold">NILAI PRESTASI</p>
              <p>:</p>
              <p className="font-semibold">{formatNumber(prestasiScore, 1)}</p>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">Bobot Nilai</h3>
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="w-14 px-3 py-2 text-left">No</th>
                    <th className="px-3 py-2 text-left">Indikator</th>
                    <th className="w-20 px-3 py-2 text-left">Bobot</th>
                    <th className="w-20 px-3 py-2 text-left">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSections.map((sectionKey, index) => {
                    const normalizedSectionKey = normalizeSectionName(sectionKey);
                    const weight = SECTION_WEIGHTS[normalizedSectionKey] ?? 0;
                    const weightedScore = weightedBySection[normalizedSectionKey] ?? 0;

                    return (
                      <tr key={sectionKey} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                        <td className="px-3 py-2 font-medium text-slate-800">{renderSectionTitle(sectionKey)}</td>
                        <td className="px-3 py-2 text-slate-600">{weight}</td>
                        <td className="px-3 py-2 text-slate-600">{formatNumber(weightedScore, 2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Ketidakhadiran Agenda
              </div>
              <table className="w-full border-collapse text-sm">
                <tbody>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">Terlambat</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{terlambatCount}</td>
                  </tr>
                  <tr className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-700">Izin</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{izinCount}</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-slate-700">Tanpa Ket</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800">{tanpaKetCount}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {keaktifanSection.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">Keaktifan</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="w-14 px-3 py-2 text-left">No</th>
                    <th className="px-3 py-2 text-left">Sub Indikator</th>
                    <th className="w-20 px-3 py-2 text-left">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {keaktifanSection.map((item, idx) => (
                    <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700">{item.label}</td>
                      <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Total Keaktifan</td>
                    <td className="px-3 py-2">{sectionTotal(keaktifanSection).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tanggungJawabSection.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">Tanggung Jawab</h3>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <th className="w-14 px-3 py-2 text-left">No</th>
                    <th className="px-3 py-2 text-left">Sub Indikator</th>
                    <th className="w-24 px-3 py-2 text-left">Keterangan</th>
                    <th className="w-20 px-3 py-2 text-left">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {tanggungJawabSection.map((item, idx) => (
                    <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700">{item.label}</td>
                      <td className="px-3 py-2 text-slate-500">-</td>
                      <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">Total Tanggung Jawab</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">{sectionTotal(tanggungJawabSection).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {internalSection.length || externalSection.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">C. Partisipasi Kegiatan</h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="font-semibold text-slate-800">Keterangan Penilaian Partisipasi</p>
              <p>Hadir = 4, Terlambat = 3, Izin = 2, Tanpa keterangan = 1 (maksimal skor: 4)</p>
            </div>
            {internalSection.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Partisipasi Internal</div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="w-14 px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Nama Agenda</th>
                      <th className="w-40 px-3 py-2 text-left">Keterangan</th>
                      <th className="w-20 px-3 py-2 text-left">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalSection.map((item, idx) => (
                      <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700">{item.label}</td>
                        <td className="px-3 py-2 text-slate-600">
                          <div className="space-y-1">
                            <p>{attendanceDescription(item.score)}</p>
                            {item.catatan ? <p className="text-xs text-slate-500">{item.catatan}</p> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">Total Agenda</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">{sectionTotal(internalSection).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {externalSection.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">Partisipasi Eksternal</div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="w-14 px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Nama Agenda</th>
                      <th className="w-40 px-3 py-2 text-left">Keterangan</th>
                      <th className="w-20 px-3 py-2 text-left">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalSection.map((item, idx) => (
                      <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700">{item.label}</td>
                        <td className="px-3 py-2 text-slate-600">
                          <div className="space-y-1">
                            <p>{attendanceDescription(item.score)}</p>
                            {item.catatan ? <p className="text-xs text-slate-500">{item.catatan}</p> : null}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">Total Agenda</td>
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">{sectionTotal(externalSection).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">D. Nilai Prestasi</h3>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="w-14 px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">Nama Agenda</th>
                  <th className="w-32 px-3 py-2 text-left">Bentuk Tanggung Jawab</th>
                  <th className="w-32 px-3 py-2 text-left">Nilai Kuantitatif</th>
                  <th className="w-32 px-3 py-2 text-left">Skala</th>
                </tr>
              </thead>
              <tbody>
                {prestasiSection.length ? (
                  prestasiSection.map((item, idx) => (
                    <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 text-slate-700">{item.label}</td>
                      <td className="px-3 py-2 text-slate-500">-</td>
                      <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-500">-</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-sm text-slate-500">Belum ada data nilai prestasi.</td>
                  </tr>
                )}
                <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">Jumlah Prestasi</td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2">{sectionTotal(prestasiSection).toFixed(2)}</td>
                  <td className="px-3 py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p className="font-semibold text-slate-800">Catatan</p>
          <p className="mt-2 whitespace-pre-line leading-6">{catatan ?? "-"}</p>
        </div>
      </CardContent>
    </Card>
  );
}
