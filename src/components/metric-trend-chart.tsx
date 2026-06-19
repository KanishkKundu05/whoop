"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type MetricTrendPoint = {
  label: string;
  recovery?: number | null;
  strain?: number | null;
  sleep?: number | null;
};

type MetricTrendChartProps = {
  data: MetricTrendPoint[];
};

export function MetricTrendChart({ data }: MetricTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center border border-dashed border-zinc-300 bg-white text-sm text-zinc-500">
        No scored records in this range
      </div>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 8, right: 18, top: 10, bottom: 4 }}>
          <CartesianGrid stroke="#e4e4e7" vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            minTickGap={24}
            tick={{ fill: "#52525b", fontSize: 12 }}
          />
          <YAxis
            yAxisId="percent"
            domain={[0, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#52525b", fontSize: 12 }}
          />
          <YAxis
            yAxisId="strain"
            orientation="right"
            domain={[0, 21]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#52525b", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #d4d4d8",
              borderRadius: 8,
              boxShadow: "0 10px 30px rgb(24 24 27 / 0.08)",
              color: "#18181b",
            }}
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="recovery"
            name="Recovery"
            stroke="#e11d48"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="percent"
            type="monotone"
            dataKey="sleep"
            name="Sleep"
            stroke="#0891b2"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
          <Line
            yAxisId="strain"
            type="monotone"
            dataKey="strain"
            name="Strain"
            stroke="#65a30d"
            strokeWidth={2.5}
            dot={false}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

