"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const BLUE = "#3b6ef6";
const GREY = "#667085";
const ORANGE = "#d97a4e";
const LIME = "#a9c93a";
const INK = "#12161f";
const GRID = "#e5e7eb";
const PIE = [BLUE, LIME, ORANGE, "#8b5cf6", "#14b8a6", "#cbd5e1", "#f59e0b"];

const axis = { fontSize: 12, fill: GREY };
const tooltipStyle = { borderRadius: 12, border: `1px solid ${GRID}`, fontSize: 13 };
const one = (v: unknown) => (typeof v === "number" ? `${v.toFixed(1)}%` : String(v));

/** Share of journeys that reached each screen, with and without a persona. */
export function FunnelChart({ data, showBaseline }: { data: { label: string; persona: number; baseline: number }[]; showBaseline: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 10, right: 40, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axis} tickLine={false} axisLine={false} unit="%" />
        <Tooltip formatter={one} contentStyle={tooltipStyle} />
        <Legend itemSorter={null} verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ fontSize: 13, paddingBottom: 12 }} />
        <Line name="With persona" dataKey="persona" stroke={BLUE} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
        {showBaseline && (
          <Line name="No persona" dataKey="baseline" stroke={GREY} strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function FactorDonut({ data }: { data: { label: string; share: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={data} dataKey="share" nameKey="label" innerRadius={58} outerRadius={84} paddingAngle={1} isAnimationActive={false}>
          {data.map((d, i) => (
            <Cell key={d.label} fill={PIE[i % PIE.length]} stroke="#fff" />
          ))}
        </Pie>
        <Tooltip formatter={one} contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export const factorColor = (i: number) => PIE[i % PIE.length];

/** Share of all actions taken, persona agents against the baseline. */
export function ActionChart({ data, showBaseline }: { data: { label: string; persona: number; baseline: number }[]; showBaseline: boolean }) {
  const rows = data.slice(0, 9);
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, rows.length * 42)}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 24, left: 0, bottom: 0 }} barGap={2}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={axis} tickLine={false} axisLine={false} unit="%" />
        <YAxis type="category" dataKey="label" width={210} tick={{ ...axis, fill: INK }} tickLine={false} axisLine={false} />
        <Tooltip formatter={one} contentStyle={tooltipStyle} cursor={{ fill: "#f3f4f6" }} />
        <Legend itemSorter={null} verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ fontSize: 13, paddingBottom: 12 }} />
        <Bar name="With persona" dataKey="persona" fill={BLUE} radius={[0, 4, 4, 0]} barSize={11} isAnimationActive={false} />
        {showBaseline && (
          <Bar name="No persona" dataKey="baseline" fill={GREY} radius={[0, 4, 4, 0]} barSize={11} isAnimationActive={false} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Outcome counts for recent runs on the dashboard. */
export function OutcomeChart({ data }: { data: { label: string; completed: number; abandoned: number; timeout: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis allowDecimals={false} tick={axis} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f3f4f6" }} />
        <Legend itemSorter={null} verticalAlign="top" align="left" iconType="circle" wrapperStyle={{ fontSize: 13, paddingBottom: 12 }} />
        <Bar name="Completed" dataKey="completed" stackId="a" fill={BLUE} maxBarSize={56} isAnimationActive={false} />
        <Bar name="Abandoned" dataKey="abandoned" stackId="a" fill={ORANGE} maxBarSize={56} isAnimationActive={false} />
        <Bar name="Step limit" dataKey="timeout" stackId="a" fill={LIME} maxBarSize={56} radius={[4, 4, 0, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
