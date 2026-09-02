"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Users, Sparkles, FileText, User, ChevronDown, Calendar } from "lucide-react";
import { StaffPerformanceBarChart, type StaffPerformanceItem } from "@/components/dashboard/staff-performance-bar-chart";
import { IndicatorBreakdownChart, type IndicatorScoreItem } from "@/components/dashboard/indicator-breakdown-chart";
import { PerformanceInsightsCard, type PerformanceInsights } from "@/components/dashboard/performance-insights-card";

export type StaffRaporRow = {
  id: string;
  staffName: string;
  total_avg: number;
  catatan: string | null;
  bulan: number;
  tahun: number;
  status: string;
};

export type StatsGroup = {
  highestScoreName: string;
  highestScoreLabel: string;
  lowestScoreName: string;
  lowestScoreLabel: string;
  highestGrowthName: string;
  highestGrowthLabel: string;
  lowestGrowthName: string;
  lowestGrowthLabel: string;
};

export type TabAnalyticsData = {
  performanceList: StaffPerformanceItem[];
  indicatorScores: IndicatorScoreItem[];
  insights: PerformanceInsights;
};

type Props = {
  unitName: string;
  latestPeriodLabel: string;
  staffRows: StaffRaporRow[];
  staffStats: StatsGroup;
  staffAnalytics: TabAnalyticsData;
  internRows: StaffRaporRow[];
  internStats: StatsGroup;
  internAnalytics: TabAnalyticsData;
};

const BULAN_NAMES: Record<number, string> = {
  1: "Januari",
  2: "Februari",
  3: "Maret",
  4: "April",
  5: "Mei",
  6: "Juni",
  7: "Juli",
  8: "Agustus",
  9: "September",
  10: "Oktober",
  11: "November",
  12: "Desember",
};

export function MenteriStaffTabs({
  unitName,
  latestPeriodLabel,
  staffRows,
  staffStats,
  staffAnalytics,
  internRows,
  internStats,
  internAnalytics,
}: Props) {
  const [activeTab, setActiveTab] = useState<"staff" | "internship">("staff");

  const currentRows = activeTab === "staff" ? staffRows : internRows;
  const currentStats = activeTab === "staff" ? staffStats : internStats;
  const currentAnalytics = activeTab === "staff" ? staffAnalytics : internAnalytics;

  // Group rows by period (Tahun-Bulan) and sort descending
  const periodGroups = new Map<string, { bulan: number; tahun: number; status: string; rows: StaffRaporRow[] }>();
  for (const row of currentRows) {
    const key = `${row.tahun}-${String(row.bulan).padStart(2, "0")}`;
    if (!periodGroups.has(key)) {
      periodGroups.set(key, {
        bulan: row.bulan,
        tahun: row.tahun,
        status: row.status,
        rows: [],
      });
    }
    periodGroups.get(key)!.rows.push(row);
  }

  const sortedPeriodKeys = Array.from(periodGroups.keys()).sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header action and Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl bg-slate-200/80 p-1 max-w-md shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab("staff")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-4 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "staff"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4 text-blue-600" />
            <span>Staf ({staffRows.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("internship")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-4 text-xs sm:text-sm font-semibold transition-all ${
              activeTab === "internship"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span>Cakrawala ({internRows.length})</span>
          </button>
        </div>

        <Link
          href="/menteri/staff-detail"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white hover:bg-blue-700 shadow-sm transition-colors self-start sm:self-auto"
        >
          <FileText className="h-4 w-4" />
          <span>Lihat Rincian Rapor Indikator</span>
        </Link>
      </div>

      {/* Analytical Insights Card */}
      <PerformanceInsightsCard
        insights={currentAnalytics.insights}
        title={`Insight Evaluasi ${activeTab === "staff" ? "Staf" : "Cakrawala"}`}
      />

      {/* Visual Analytics Charts Grid */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <StaffPerformanceBarChart
          data={currentAnalytics.performanceList}
          title={`Ranking Performa ${activeTab === "staff" ? "Staf" : "Cakrawala"}`}
          subtitle={`Unit ${unitName} · ${latestPeriodLabel}`}
          emptyText={`Belum ada data nilai ${activeTab === "staff" ? "staf" : "staf magang"} untuk periode ini.`}
        />

        <IndicatorBreakdownChart
          data={currentAnalytics.indicatorScores}
          title={`Capaian per Indikator Utama (${activeTab === "staff" ? "Staf" : "Cakrawala"})`}
          subtitle={`Evaluasi aspek kinerja pada unit ${unitName}`}
        />
      </div>

      {/* Recap Stats Cards */}
      <Card className={activeTab === "internship" ? "border-indigo-100 bg-indigo-50/20" : ""}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Recap 1 Bulan Terbaru ({activeTab === "staff" ? "Staf" : "Cakrawala"})
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {latestPeriodLabel} · Unit {unitName}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Nilai Tertinggi</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentStats.highestScoreName}</p>
            <p className="text-xs font-semibold text-emerald-600">{currentStats.highestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Nilai Terendah</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentStats.lowestScoreName}</p>
            <p className="text-xs font-semibold text-slate-600">{currentStats.lowestScoreLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Growth Tertinggi</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentStats.highestGrowthName}</p>
            <p className="text-xs font-semibold text-emerald-600">{currentStats.highestGrowthLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Growth Terendah</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{currentStats.lowestGrowthName}</p>
            <p className="text-xs font-semibold text-slate-600">{currentStats.lowestGrowthLabel}</p>
          </div>
        </CardContent>
      </Card>

      {/* Full Historical Rapor List Grouped & Collapsible by Month */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Daftar Seluruh Rapor ({activeTab === "staff" ? "Staf" : "Cakrawala"})
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Riwayat nilai rapor bulanan seluruh anggota unit {unitName}, dikelompokkan per bulan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sortedPeriodKeys.length ? (
            sortedPeriodKeys.map((key, index) => {
              const group = periodGroups.get(key)!;
              const periodName = `Periode ${BULAN_NAMES[group.bulan] ?? `Bulan ${group.bulan}`} ${group.tahun}`;
              const avgPeriodScore = group.rows.length
                ? (group.rows.reduce((sum, r) => sum + r.total_avg, 0) / group.rows.length).toFixed(2)
                : "0.00";

              return (
                <details
                  key={key}
                  open={index === 0}
                  className="group rounded-xl border border-slate-200 bg-slate-50/60 overflow-hidden shadow-2xs transition-all"
                >
                  <summary className="flex items-center justify-between p-3.5 sm:p-4 cursor-pointer hover:bg-slate-100/80 transition-colors select-none list-none">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm sm:text-base text-slate-900">
                            {periodName}
                          </span>
                          <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-[10.5px] font-semibold text-slate-700 capitalize">
                            {group.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {group.rows.length} Anggota Terskor · Rata-rata Unit: <span className="font-semibold text-blue-700">{avgPeriodScore}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
                    </div>
                  </summary>

                  <div className="p-3 sm:p-4 pt-1 space-y-2.5 bg-white border-t border-slate-200/80">
                    {group.rows.map((row) => (
                      <div
                        key={row.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/40 p-3 text-sm transition-colors hover:border-slate-200 hover:bg-white shadow-2xs"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-semibold text-slate-800">{row.staffName}</span>
                          </div>
                          {row.catatan ? (
                            <p className="text-xs italic text-slate-600 bg-white rounded px-2 py-1 border border-slate-100 mt-1">
                              Catatan: {row.catatan}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <span className="text-xs text-slate-500">Nilai:</span>
                          <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-sm font-bold text-blue-700">
                            {row.total_avg.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">
              Belum ada data rapor untuk {activeTab === "staff" ? "staf" : "staf magang"}.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
