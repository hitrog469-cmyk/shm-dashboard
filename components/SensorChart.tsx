"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { SensorChannel, SensorSample } from "@/lib/sensors";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status";
import type { ChannelStat } from "./Dashboard";

interface Props {
  channel: SensorChannel;
  stat: ChannelStat;
  buffer: SensorSample[];
  /** Render counter — buffer is mutated in place, so memoize on this. */
  tick: number;
}

export default function SensorChart({ channel, stat, buffer, tick }: Props) {
  const color = STATUS_COLOR[stat.status];

  const data = useMemo(() => {
    if (buffer.length === 0) return [];
    const latest = buffer[buffer.length - 1].t;
    return buffer
      .map((s) => ({ x: (s.t - latest) / 1000, v: s.value }))
      .filter((p) => p.x >= -60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer, tick]);

  return (
    <section className="rounded-lg border border-edge bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-mono text-sm text-gray-200">
            {channel.id}
            <span className="text-gray-500"> · {channel.location}</span>
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-600">
            60 s rolling window · 2 Hz
          </p>
        </div>
        <div className="flex items-baseline gap-3 font-mono">
          <span className="text-lg tabular-nums" style={{ color }}>
            {stat.latest === null ? "—" : stat.latest.toFixed(channel.decimals)}
            <span className="ml-1 text-xs text-gray-500">{channel.unit}</span>
          </span>
          <span className="text-[11px] tabular-nums text-gray-500">
            z {stat.z >= 0 ? "+" : ""}
            {stat.z.toFixed(2)}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
            style={{ color, backgroundColor: `${color}1f` }}
          >
            {STATUS_LABEL[stat.status]}
          </span>
        </div>
      </div>

      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#1d1d1d" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={[-60, 0]}
              ticks={[-60, -45, -30, -15, 0]}
              tickFormatter={(v: number) => `${v}s`}
              stroke="#333333"
              tick={{ fill: "#555555", fontSize: 10, fontFamily: "var(--font-jetbrains)" }}
              tickLine={false}
            />
            <YAxis
              domain={["auto", "auto"]}
              width={56}
              stroke="#333333"
              tick={{ fill: "#555555", fontSize: 10, fontFamily: "var(--font-jetbrains)" }}
              tickFormatter={(v: number) => v.toFixed(channel.decimals)}
              tickLine={false}
            />
            <Line
              type="monotone"
              dataKey="v"
              stroke={color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
