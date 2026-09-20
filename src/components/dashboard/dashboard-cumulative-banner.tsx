import Link from "next/link";
import { Award, Users, BarChart3, Building2, TrendingUp, ChevronRight } from "lucide-react";

export type StaffItemCumulative = {
  nim: string;
  nama_lengkap: string;
  cumulativeAvg: number;
  periodCount: number;
  role?: string;
};

export type MinistryItemCumulative = {
  id: string;
  nama_unit: string;
  cumulativeAvg: number;
  staffCount: number;
};

export type DashboardBannerProps =
  | {
      variant: "staff";
      cumulativeAvg: number;
      periodCount: number;
      latestScore: number;
      latestPeriodLabel: string;
      roleTitle?: string;
    }
  | {
      variant: "unit_leader";
      unitName: string;
      unitCumulativeAvg: number;
      totalEvaluatedStaff: number;
      staffList: StaffItemCumulative[];
      detailHref: string;
      isMenteri?: boolean;
    }
  | {
      variant: "menko";
      kemenkoCumulativeAvg: number;
      totalStaff: number;
      ministries: MinistryItemCumulative[];
    };

function getScoreBadgeColor(score: number) {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 70) return "text-blue-700 bg-blue-50 border-blue-200";
  if (score >= 50) return "text-amber-700 bg-amber-50 border-amber-200";
  if (score > 0) return "text-rose-700 bg-rose-50 border-rose-200";
  return "text-slate-500 bg-slate-50 border-slate-200";
}

function getPredikatLabel(score: number) {
  if (score >= 80) return "Sangat Baik";
  if (score >= 70) return "Baik";
  if (score >= 50) return "Cukup";
  if (score > 0) return "Perlu Bimbingan";
  return "Belum Dinilai";
}

export function DashboardCumulativeBanner(props: DashboardBannerProps) {
  if (props.variant === "staff") {
    const { cumulativeAvg, periodCount, latestScore, latestPeriodLabel, roleTitle } = props;
    const predikat = getPredikatLabel(cumulativeAvg);
    const badgeColor = getScoreBadgeColor(cumulativeAvg);

    return (
      <div className="rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/30 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-100/70 px-2.5 py-0.5 text-[11px] font-semibold text-blue-800">
                <Award className="h-3 w-3" />
                <span>{roleTitle ?? "Rapor Personal"}</span>
              </span>
              {periodCount > 0 ? (
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${badgeColor}`}>
                  {predikat}
                </span>
              ) : null}
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Nilai Rata-rata Kumulatif (Semua Bulan)
            </h3>
            <p className="text-xs text-slate-500">
              {periodCount > 0
                ? `Skala 0 - 100 · Rata-rata dari ${periodCount} periode rapor yang dipublikasikan`
                : "Belum ada periode rapor yang dipublikasikan"}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <div className="text-left sm:text-right">
              <div className="text-3xl sm:text-4xl font-extrabold text-blue-600 tracking-tight">
                {periodCount > 0 ? cumulativeAvg.toFixed(2) : "0.00"}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {periodCount > 0 && latestPeriodLabel
                  ? `Terbaru: ${latestPeriodLabel} (${latestScore.toFixed(2)})`
                  : "Menunggu penilaian"}
              </p>
            </div>

            <Link
              href="/staff"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-blue-700 active:scale-[0.98]"
            >
              <span>Buka Rapor Lengkap</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (props.variant === "unit_leader") {
    const { unitName, unitCumulativeAvg, totalEvaluatedStaff, staffList, detailHref, isMenteri } = props;

    // Sort descending by cumulative average
    const sortedStaff = [...staffList].sort((a, b) => b.cumulativeAvg - a.cumulativeAvg);
    const topPerformer = sortedStaff[0];

    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-100">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                <Users className="h-3.5 w-3.5" />
                <span>{isMenteri ? "Rapor Staf & Intern Unit" : "Rapor Staf Kementerian"}</span>
              </span>
              <span className="text-xs font-medium text-slate-500">
                Unit {unitName} · {totalEvaluatedStaff} Staf Dinilai
              </span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xs text-slate-600">Rata-rata Kumulatif Seluruh Staf:</span>
              <span className="text-xl sm:text-2xl font-black text-indigo-600">
                {unitCumulativeAvg.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500">(semua bulan)</span>
            </div>
          </div>

          <Link
            href={detailHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:bg-indigo-700 transition-colors self-start sm:self-auto"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Lihat Rekap Lengkap Staf</span>
          </Link>
        </div>

        {/* Top performer highlight & Mini list */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Nilai Rata-rata Kumulatif per Staf (Semua Bulan)
            </p>
            {topPerformer && topPerformer.cumulativeAvg > 0 ? (
              <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Top: {topPerformer.nama_lengkap} ({topPerformer.cumulativeAvg.toFixed(2)})
              </span>
            ) : null}
          </div>

          {sortedStaff.length > 0 ? (
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-h-56 overflow-y-auto pr-1">
              {sortedStaff.map((staf) => {
                const scoreColor =
                  staf.cumulativeAvg >= 80
                    ? "text-emerald-600"
                    : staf.cumulativeAvg >= 70
                    ? "text-blue-600"
                    : staf.cumulativeAvg >= 50
                    ? "text-amber-600"
                    : staf.cumulativeAvg > 0
                    ? "text-rose-600"
                    : "text-slate-400";

                return (
                  <div
                    key={staf.nim}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2 text-xs transition-colors hover:bg-slate-100/80"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-semibold text-slate-900 truncate">{staf.nama_lengkap}</p>
                      <p className="text-[10.5px] text-slate-500">
                        {staf.periodCount > 0 ? `${staf.periodCount} periode dinilai` : "Belum ada nilai"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={`text-sm font-black ${scoreColor}`}>
                        {staf.cumulativeAvg.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-3 text-center border border-dashed border-slate-200 rounded-lg">
              Belum ada staf yang dinilai pada unit ini.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (props.variant === "menko") {
    const { kemenkoCumulativeAvg, totalStaff, ministries } = props;

    return (
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-100">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <Building2 className="h-3.5 w-3.5" />
              <span>Koordinasi Kemenko</span>
            </span>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-xs text-slate-600">Rata-rata Kumulatif Staf Kemenko:</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600">
                {kemenkoCumulativeAvg.toFixed(2)}
              </span>
              <span className="text-[11px] text-slate-500">({totalStaff} total staf dinilai)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Nilai kumulatif rata-rata dari seluruh bulan untuk kementerian & biro di bawah koordinasi Kamu
            </p>
          </div>

          <Link
            href="/menko"
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors self-start sm:self-auto"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Lihat Rekap Kementerian</span>
          </Link>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Rata-rata Kumulatif Semua Bulan per Kementerian/Biro:
          </p>
          <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {ministries.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 transition-colors hover:bg-slate-100/70"
              >
                <p className="font-semibold text-xs text-slate-900 truncate">{m.nama_unit}</p>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-[11px] text-slate-500">{m.staffCount} staf</span>
                  <div className="text-right">
                    <span className="text-sm font-bold text-slate-900">{m.cumulativeAvg.toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-400">kumulatif</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
