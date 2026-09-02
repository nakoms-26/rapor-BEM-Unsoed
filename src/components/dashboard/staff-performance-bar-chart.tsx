"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type StaffPerformanceItem = {
  name: string;
  score: number;
  unitName?: string;
  role?: string;
};

type Props = {
  data: StaffPerformanceItem[];
  title?: string;
  subtitle?: string;
  emptyText?: string;
};

function getScoreColor(score: number): string {
  if (score >= 4.0) return "#10b981"; // Emerald / Sangat Baik
  if (score >= 3.5) return "#3b82f6"; // Blue / Baik
  if (score >= 2.5) return "#f59e0b"; // Amber / Cukup
  if (score > 0) return "#ef4444";    // Red / Perlu Bimbingan
  return "#cbd5e1";                   // Slate / Belum dinilai
}

function CustomBarLabel(props: {
  x?: number;
  y?: number;
  width?: number;
  value?: number;
}) {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (value > 0) {
    return (
      <text
        x={x + width / 2}
        y={y - 5}
        fill="#334155"
        textAnchor="middle"
        fontSize={10.5}
        fontWeight={600}
      >
        {Number(value).toFixed(2)}
      </text>
    );
  }
  return null;
}

export function StaffPerformanceBarChart({
  data,
  title = "Grafik Performa Individu",
  subtitle = "Skor rata-rata berdasarkan periode rapor terbaru",
  emptyText = "Belum ada data nilai individu.",
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-2xs">
        {emptyText}
      </div>
    );
  }

  // Sort descending by score for a clean ranking visual
  const sortedData = [...data].sort((a, b) => b.score - a.score);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="mb-3">
        <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[10.5px] text-slate-600">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> &gt;= 4.0 (Sangat Baik)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> 3.5 - 3.99 (Baik)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> 2.5 - 3.49 (Cukup)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> &lt; 2.5 (Perhatian)
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="h-64 sm:h-72"
          style={{ minWidth: Math.max(300, sortedData.length * 48) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              margin={{ top: 20, right: 12, left: -15, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#475569", fontSize: 10.5 }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={45}
              />
              <YAxis domain={[0, 5]} tick={{ fill: "#475569", fontSize: 11 }} width={35} />
              <Tooltip
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                formatter={(_val: any, _name: any, item: any) => [
                  Number(item.payload?.score ?? 0).toFixed(2),
                  "Nilai Rata-rata",
                ]}
                labelFormatter={(name) => `Nama: ${name}`}
              />
              <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={36}>
                <LabelList content={<CustomBarLabel />} />
                {sortedData.map((item, idx) => (
                  <Cell key={`${item.name}-${idx}`} fill={getScoreColor(item.score)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
