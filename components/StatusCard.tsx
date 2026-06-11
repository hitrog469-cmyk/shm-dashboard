"use client";

import type { SensorChannel } from "@/lib/sensors";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/status";
import type { ChannelStat } from "./Dashboard";

interface Props {
  channel: SensorChannel;
  stat: ChannelStat;
  selected: boolean;
  onSelect: () => void;
}

export default function StatusCard({ channel, stat, selected, onSelect }: Props) {
  const color = STATUS_COLOR[stat.status];
  const fmt = (v: number) =>
    Number.isFinite(v) ? v.toFixed(channel.decimals) : "—";

  return (
    <button
      onClick={onSelect}
      className={`rounded-lg border bg-surface p-3 text-left transition-colors hover:border-gray-600 ${
        selected ? "border-accent/70" : "border-edge"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-gray-300">{channel.id}</span>
        <span className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
          />
          <span className="font-mono text-[10px]" style={{ color }}>
            {STATUS_LABEL[stat.status]}
          </span>
        </span>
      </div>
      <p className="mt-0.5 truncate font-mono text-[10px] text-gray-600">
        {channel.location}
      </p>
      <p className="mt-2 font-mono text-xl tabular-nums text-gray-100">
        {stat.latest === null ? "—" : stat.latest.toFixed(channel.decimals)}
        <span className="ml-1 text-xs text-gray-500">{channel.unit}</span>
      </p>
      <p className="mt-1.5 font-mono text-[10px] tabular-nums text-gray-600">
        min {fmt(stat.min)} · max {fmt(stat.max)}
      </p>
    </button>
  );
}
