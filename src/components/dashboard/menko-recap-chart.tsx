"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MenkoRecapItem } from "@/types/app";

type Props = {
  data: MenkoRecapItem[];
};

export function MenkoRecapChart({ data }: Props) {
  return (
    <div className="h-96 rounded-xl border border-slate-200 bg-white p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="unit_name" tick={{ fill: "#334155", fontSize: 12 }} interval={0} angle={-10} dy={10} />
          <YAxis domain={[0, 5]} tick={{ fill: "#334155", fontSize: 12 }} />
          <Tooltip
            contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0" }}
            formatter={(value) => [Number(value ?? 0).toFixed(2), "Rata-rata"]}
          />
          <Bar dataKey="average_score" radius={[8, 8, 0, 0]}>
            {data.map((item, idx) => (
              <Cell key={`${item.unit_name}-${idx}`} fill={idx % 2 === 0 ? "#0f766e" : "#0369a1"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
