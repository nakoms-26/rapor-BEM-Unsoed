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
import type { MenkoRecapItem } from "@/types/app";

type Props = {
  data: MenkoRecapItem[];
};

// Render a value label above each bar; shows "Belum ada data" for zero scores.
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
        y={y - 6}
        fill="#334155"
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
      >
        {Number(value).toFixed(2)}
      </text>
    );
  }
  return (
    <text
      x={x + width / 2}
      y={y - 6}
      fill="#94a3b8"
      textAnchor="middle"
      fontSize={10}
    >
      Belum ada data
    </text>
  );
}

export function MenkoRecapChart({ data }: Props) {
  // Ensure units with 0 score still render a minimal visible bar (value 0 in recharts renders nothing)
  const chartData = data.map((item) => ({
    ...item,
    // Use a tiny sentinel so the bar is rendered; tooltip still shows 0
    _displayScore: item.average_score > 0 ? item.average_score : 0,
  }));

  return (
    <div className="h-96 rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 32, right: 16, left: 0, bottom: 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="unit_name"
            tick={{ fill: "#334155", fontSize: 12 }}
            interval={0}
            angle={-10}
            dy={10}
          />
          <YAxis domain={[0, 5]} tick={{ fill: "#334155", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
            formatter={(_value: any, _name: any, props: any) => [
              Number(props.payload?.average_score ?? 0).toFixed(2),
              "Rata-rata",
            ]}
          />
          <Bar
            dataKey="average_score"
            radius={[8, 8, 0, 0]}
            minPointSize={4}
          >
            <LabelList content={<CustomBarLabel />} />
            {chartData.map((item, idx) => (
              <Cell
                key={`${item.unit_name}-${idx}`}
                fill={
                  item.average_score === 0
                    ? "#cbd5e1"
                    : idx % 2 === 0
                    ? "#0f766e"
                    : "#0369a1"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
