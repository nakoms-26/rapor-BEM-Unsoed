import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DownloadPdfButton } from "@/components/dashboard/download-pdf-button";

type ReportDetail = {
  main_indicator_name: string;
  sub_indicator_name: string;
  score: number;
};

type SectionItem = {
  label: string;
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
  categoryLabel: string;
  totalScore: number;
  catatan?: string | null;
  details: ReportDetail[];
};

const SECTION_LABELS: Record<string, string> = {
  "Keaktifan": "A. Keaktifan",
  "Tanggung Jawab": "B. Tanggung Jawab",
  "Partisipasi Kegiatan": "C. Partisipasi Kegiatan",
  "Partisipasi Internal": "C.1 Partisipasi Internal",
  "Partisipasi External": "C.2 Partisipasi Eksternal",
  "Partisipasi Eksternal": "C.2 Partisipasi Eksternal",
  "Nilai Prestasi": "D. Nilai Prestasi",
};

const SECTION_ORDER = [
  "Keaktifan",
  "Tanggung Jawab",
  "Partisipasi Internal",
  "Partisipasi Eksternal",
  "Nilai Prestasi",
];

function scoreTone(score: number) {
  if (score >= 4.5) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (score >= 3.5) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 2.5) return "bg-amber-100 text-amber-800 border-amber-200";
  return "bg-rose-100 text-rose-800 border-rose-200";
}

function categoryFromScore(score: number) {
  if (score >= 4.5) return "SANGAT BAIK";
  if (score >= 3.5) return "BAIK";
  if (score >= 2.5) return "CUKUP";
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
      score: Number(detail.score),
    });
  }

  return groups;
}

function sectionTotal(items: SectionItem[]) {
  return Number(items.reduce((sum, item) => sum + Number(item.score), 0).toFixed(2));
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
  categoryLabel,
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <p><span className="font-medium text-slate-500">Nama:</span> {name}</p>
            <p><span className="font-medium text-slate-500">Jurusan/Tahun:</span> {jurusan ?? "-"}{tahunAngkatan ? `/${tahunAngkatan}` : ""}</p>
            <p><span className="font-medium text-slate-500">Kementerian/Biro:</span> {unitName}</p>
          </div>
          <div className={`rounded-lg border p-3 text-sm ${scoreTone(totalScore)}`}>
            <p><span className="font-medium">Bulan:</span> {periodLabel}</p>
            <p><span className="font-medium">Nilai Kumulatif:</span> {totalScore.toFixed(2)}</p>
            <p><span className="font-medium">Kategori:</span> {categoryFromScore(totalScore)}</p>
            <p><span className="font-medium">Bobot Nilai Prestasi:</span> 0</p>
            <p><span className="font-medium">Status:</span> {categoryLabel}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 pt-6">
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
                const items = sectionGroups.get(normalizeSectionName(sectionKey)) ?? [];
                const total = sectionTotal(items);
                const baseWeights: Record<string, number> = {
                  "Keaktifan": 20,
                  "Tanggung Jawab": 20,
                  "Partisipasi Kegiatan": 30,
                  "Partisipasi Internal": 30,
                  "Partisipasi Eksternal": 30,
                  "Partisipasi External": 30,
                  "Nilai Prestasi": 0,
                };
                const weight = baseWeights[sectionKey] ?? 0;

                return (
                  <tr key={sectionKey} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                    <td className="px-3 py-2 font-medium text-slate-800">{renderSectionTitle(sectionKey)}</td>
                    <td className="px-3 py-2 text-slate-600">{weight}</td>
                    <td className="px-3 py-2 text-slate-600">{total.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {keaktifanSection.length ? (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">A. Keaktifan</h3>
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
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-700">B. Tanggung Jawab</h3>
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
            {internalSection.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">C.1 Partisipasi Internal</div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="w-14 px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Nama Agenda</th>
                      <th className="w-20 px-3 py-2 text-left">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {internalSection.map((item, idx) => (
                      <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700">{item.label}</td>
                        <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">Total Agenda</td>
                      <td className="px-3 py-2">{sectionTotal(internalSection).toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            ) : null}

            {externalSection.length ? (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">C.2 Partisipasi Eksternal</div>
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="w-14 px-3 py-2 text-left">No</th>
                      <th className="px-3 py-2 text-left">Nama Agenda</th>
                      <th className="w-20 px-3 py-2 text-left">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {externalSection.map((item, idx) => (
                      <tr key={`${item.label}-${idx}`} className="border-b border-slate-100">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700">{item.label}</td>
                        <td className="px-3 py-2 text-slate-700">{item.score.toFixed(2)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 text-sm font-semibold text-slate-700">
                      <td className="px-3 py-2"></td>
                      <td className="px-3 py-2">Total Agenda</td>
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
