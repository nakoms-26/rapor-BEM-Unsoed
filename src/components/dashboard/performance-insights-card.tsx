"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Award, AlertTriangle, TrendingUp, CheckCircle2 } from "lucide-react";

export type PerformanceInsights = {
  topStrengthIndicator?: { name: string; score: number };
  improvementIndicator?: { name: string; score: number };
  highPerformersRatio: number; // e.g., 85 (%)
  totalMembers: number;
  overallAverage: number;
};

type Props = {
  insights: PerformanceInsights;
  title?: string;
};

export function PerformanceInsightsCard({
  insights,
  title = "Insight & Analisis Evaluasi Performa",
}: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Top Strength */}
        <Card className="border-emerald-200/80 bg-emerald-50/40 shadow-2xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 flex-shrink-0">
                <Award className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">
                  Indikator Terkuat
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                  {insights.topStrengthIndicator?.name ?? "-"}
                </p>
                <p className="text-xs font-semibold text-emerald-700">
                  {insights.topStrengthIndicator
                    ? `Skor: ${insights.topStrengthIndicator.score.toFixed(2)} / 5.00`
                    : "Belum ada data"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Improvement Area */}
        <Card className="border-amber-200/80 bg-amber-50/40 shadow-2xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                  Fokus Bimbingan
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                  {insights.improvementIndicator?.name ?? "-"}
                </p>
                <p className="text-xs font-semibold text-amber-700">
                  {insights.improvementIndicator
                    ? `Skor: ${insights.improvementIndicator.score.toFixed(2)} / 5.00`
                    : "Belum ada data"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* High Performers Ratio */}
        <Card className="border-blue-200/80 bg-blue-50/40 shadow-2xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 flex-shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-800">
                  Tingkat Performa Baik
                </p>
                <p className="text-base sm:text-lg font-bold text-blue-900 mt-0.5">
                  {insights.highPerformersRatio}%
                </p>
                <p className="text-[11px] text-slate-500">Skor &gt;= 3.50 ({insights.totalMembers} Anggota)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overall Average */}
        <Card className="border-indigo-200/80 bg-indigo-50/40 shadow-2xs">
          <CardContent className="p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 flex-shrink-0">
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-800">
                  Rata-rata Keseluruhan
                </p>
                <p className="text-base sm:text-lg font-bold text-indigo-900 mt-0.5">
                  {insights.overallAverage > 0 ? insights.overallAverage.toFixed(2) : "0.00"}
                </p>
                <p className="text-[11px] text-slate-500">Skala 0.00 - 5.00</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
