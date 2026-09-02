"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MenkoRecapChart } from "@/components/dashboard/menko-recap-chart";
import { Users, Sparkles } from "lucide-react";
import { IndicatorBreakdownChart, type IndicatorScoreItem } from "@/components/dashboard/indicator-breakdown-chart";
import { PerformanceInsightsCard, type PerformanceInsights } from "@/components/dashboard/performance-insights-card";

export type UnitRecapRow = {
  unit_name: string;
  average_score: number;
  staff_count: number;
  highest_staff: string;
  highest_score: number;
  lowest_staff: string;
  lowest_score: number;
  highest_growth_staff: string;
  highest_growth_score: number;
  lowest_growth_staff: string;
  lowest_growth_score: number;
};

type Props = {
  staffRows: UnitRecapRow[];
  staffIndicators?: IndicatorScoreItem[];
  staffInsights?: PerformanceInsights;
  internRows: UnitRecapRow[];
  internIndicators?: IndicatorScoreItem[];
  internInsights?: PerformanceInsights;
  totalUnitsCount: number;
  activePeriodLabel: string;
};

export function MenkoDashboardTabs({
  staffRows,
  staffIndicators = [],
  staffInsights,
  internRows,
  internIndicators = [],
  internInsights,
  totalUnitsCount,
  activePeriodLabel,
}: Props) {
  const [activeTab, setActiveTab] = useState<"staff" | "internship">("staff");

  const currentRows = activeTab === "staff" ? staffRows : internRows;
  const currentIndicators = activeTab === "staff" ? staffIndicators : internIndicators;
  const currentInsights = activeTab === "staff" ? staffInsights : internInsights;

  const scoredRows = currentRows.filter((row) => row.staff_count > 0);
  const highestUnit = [...scoredRows].sort((a, b) => b.average_score - a.average_score)[0];
  const lowestUnit = [...scoredRows].sort((a, b) => a.average_score - b.average_score)[0];

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex rounded-xl bg-slate-200/80 p-1 max-w-md shadow-inner">
        <button
          type="button"
          onClick={() => setActiveTab("staff")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "staff"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Users className="h-4 w-4 text-blue-600" />
          <span>Staf</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("internship")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 px-3 sm:px-4 text-xs sm:text-sm font-semibold transition-all ${
            activeTab === "internship"
              ? "bg-white text-slate-900 shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span>Cakrawala (Internship)</span>
        </button>
      </div>

      {/* Performance Insights */}
      {currentInsights && (
        <PerformanceInsightsCard
          insights={currentInsights}
          title={`Insight Evaluasi ${activeTab === "staff" ? "Staf" : "Cakrawala"} Lintas Kementerian`}
        />
      )}

      {/* Recharts Chart for this Tab */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Grafik Komparasi Nilai Unit ({activeTab === "staff" ? "Staf" : "Cakrawala"})
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-500">
              Rata-rata capaian per kementerian/biro di bawah koordinasi Kamu
            </p>
          </div>
        </div>
        <MenkoRecapChart
          data={currentRows.map((item) => ({
            unit_name: item.unit_name,
            average_score: item.average_score,
            highest_staff: item.highest_staff,
            highest_score: item.highest_score,
            lowest_staff: item.lowest_staff,
            lowest_score: item.lowest_score,
          }))}
        />
      </div>

      {/* Indicator Breakdown Chart across ministries */}
      {currentIndicators.length > 0 && (
        <IndicatorBreakdownChart
          data={currentIndicators}
          title={`Capaian per Indikator Utama (${activeTab === "staff" ? "Staf" : "Cakrawala"})`}
          subtitle="Rata-rata aspek penilaian pada seluruh kementerian/biro di bawah koordinasi Kamu"
        />
      )}

      {/* Recap Stats Cards */}
      <Card className={activeTab === "internship" ? "border-indigo-100 bg-indigo-50/20" : ""}>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Recap Nilai {activeTab === "staff" ? "Staf" : "Internship (Cakrawala)"}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            {activePeriodLabel} · Grafik & Rekap terpisah khusus {activeTab === "staff" ? "Staf Kabinet" : "Staf Magang Cakrawala"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Rata-rata Unit Tertinggi</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{highestUnit?.unit_name ?? "-"}</p>
            <p className="text-xs font-semibold text-emerald-600">
              {highestUnit ? highestUnit.average_score.toFixed(2) : "0.00"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Rata-rata Unit Terendah</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900 truncate">{lowestUnit?.unit_name ?? "-"}</p>
            <p className="text-xs font-semibold text-slate-600">
              {lowestUnit ? lowestUnit.average_score.toFixed(2) : "0.00"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
            <p className="text-[11px] text-slate-500">Total Unit Terskor</p>
            <p className="text-xs sm:text-sm font-semibold text-slate-900">{scoredRows.length}</p>
            <p className="text-[11px] text-slate-500">dari {totalUnitsCount} unit koordinasi</p>
          </div>
        </CardContent>
      </Card>

      {/* Unit Cards Breakdown */}
      <div className="grid gap-3.5 sm:gap-4 grid-cols-1 sm:grid-cols-2">
        {currentRows.map((item) => (
          <Card key={item.unit_name} className="border-slate-200/80 bg-white shadow-2xs hover:border-slate-300 transition-colors">
            <CardHeader className="p-4 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base text-slate-900 truncate">{item.unit_name}</CardTitle>
                <span className="rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 whitespace-nowrap">
                  {item.staff_count} Anggota
                </span>
              </div>
              <CardDescription className="text-xs">
                Rata-rata Skor Unit: <span className="font-bold text-blue-700">{item.average_score.toFixed(2)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 pt-1 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10.5px] text-slate-500">Nilai Tertinggi</p>
                  <p className="font-semibold text-slate-800 truncate">{item.highest_staff}</p>
                  <p className="text-emerald-600 font-bold">{item.highest_score.toFixed(2)}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-2 border border-slate-100">
                  <p className="text-[10.5px] text-slate-500">Nilai Terendah</p>
                  <p className="font-semibold text-slate-800 truncate">{item.lowest_staff}</p>
                  <p className="text-slate-600 font-bold">{item.lowest_score.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
