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

export type IndicatorScoreItem = {
  indicatorName: string;
  averageScore: number;
  totalEvaluated: number;
};

type Props = {
  data: IndicatorScoreItem[];
  title?: string;
  subtitle?: string;
};

const INDICATOR_COLORS = [
  "#3b82f6", // Blue
  "#6366f1", // Indigo
  "#0d9488", // Teal
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#f59e0b", // Amber
];

function CustomIndicatorLabel(props: {
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
        fill="#1e293b"
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
      >
        {Number(value).toFixed(2)}
      </text>
    );
  }
  return null;
}

export function IndicatorBreakdownChart({
  data,
  title = "Analisis Nilai per Indikator Utama",
  subtitle = "Rata-rata capaian aspek penilaian pada unit",
}: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500 shadow-2xs">
        Belum ada data indikator yang terskor.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-5 shadow-2xs">
      <div className="mb-3">
        <h3 className="text-sm sm:text-base font-bold text-slate-900">{title}</h3>
        <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div
          className="h-64 sm:h-72"
          style={{ minWidth: Math.max(280, data.length * 60) }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 12, left: -15, bottom: 25 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="indicatorName"
                tick={{ fill: "#475569", fontSize: 10.5 }}
                interval={0}
                angle={-15}
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
                  Number(item.payload?.averageScore ?? 0).toFixed(2),
                  "Rata-rata Skor",
                ]}
                labelFormatter={(name) => `Indikator: ${name}`}
              />
              <Bar dataKey="averageScore" radius={[6, 6, 0, 0]} maxBarSize={40}>
                <LabelList content={<CustomIndicatorLabel />} />
                {data.map((_, idx) => (
                  <Cell
                    key={idx}
                    fill={INDICATOR_COLORS[idx % INDICATOR_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
