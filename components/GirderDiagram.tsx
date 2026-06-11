"use client";

import type { SensorChannel } from "@/lib/sensors";
import { STATUS_COLOR } from "@/lib/status";
import type { ChannelStat } from "./Dashboard";

interface Props {
  channels: SensorChannel[];
  stats: Map<string, ChannelStat>;
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Per-sensor label placement in viewBox coordinates. */
const LABELS: Record<string, { x: number; y: number; anchor: "start" | "middle" | "end" }> = {
  "ACC-01": { x: 360, y: 48, anchor: "middle" },
  "ACC-02": { x: 210, y: 48, anchor: "middle" },
  "SG-01": { x: 346, y: 128, anchor: "end" },
  "SG-02": { x: 510, y: 142, anchor: "middle" },
  "DSP-01": { x: 360, y: 184, anchor: "middle" },
  "TMP-01": { x: 118, y: 164, anchor: "middle" },
};

export default function GirderDiagram({ channels, stats, selectedId, onSelect }: Props) {
  return (
    <svg
      viewBox="0 0 720 210"
      className="h-auto w-full"
      role="img"
      aria-label="Side elevation of the monitored bridge girder with sensor positions"
    >
      {/* deck */}
      <rect x="56" y="58" width="608" height="7" fill="#181818" stroke="#262626" strokeWidth="1" />

      {/* girder web + flanges */}
      <rect x="60" y="65" width="600" height="55" fill="#131313" stroke="#2e2e2e" strokeWidth="1" />
      <rect x="60" y="65" width="600" height="4" fill="#202020" />
      <rect x="60" y="116" width="600" height="4" fill="#202020" />
      {/* stiffeners */}
      {[160, 260, 360, 460, 560].map((x) => (
        <line key={x} x1={x} y1="69" x2={x} y2="116" stroke="#1c1c1c" strokeWidth="1" />
      ))}

      {/* pin support (north) */}
      <polygon points="80,122 62,158 98,158" fill="#161616" stroke="#333333" strokeWidth="1" />
      <line x1="52" y1="158" x2="108" y2="158" stroke="#333333" strokeWidth="1" />
      {[58, 70, 82, 94].map((x) => (
        <line key={x} x1={x} y1="158" x2={x - 6} y2="166" stroke="#2a2a2a" strokeWidth="1" />
      ))}

      {/* roller support (south) */}
      <polygon points="640,122 624,148 656,148" fill="#161616" stroke="#333333" strokeWidth="1" />
      <circle cx="632" cy="153" r="4" fill="#161616" stroke="#333333" strokeWidth="1" />
      <circle cx="648" cy="153" r="4" fill="#161616" stroke="#333333" strokeWidth="1" />
      <line x1="614" y1="158" x2="668" y2="158" stroke="#333333" strokeWidth="1" />
      {[620, 632, 644, 656].map((x) => (
        <line key={x} x1={x} y1="158" x2={x - 6} y2="166" stroke="#2a2a2a" strokeWidth="1" />
      ))}

      {/* span dimension */}
      <line x1="80" y1="196" x2="640" y2="196" stroke="#333333" strokeWidth="1" strokeDasharray="4 4" />
      <line x1="80" y1="190" x2="80" y2="202" stroke="#333333" strokeWidth="1" />
      <line x1="640" y1="190" x2="640" y2="202" stroke="#333333" strokeWidth="1" />
      <text x="360" y="193" textAnchor="middle" className="font-mono" fontSize="10" fill="#555555">
        L = 32.0 m
      </text>

      {/* displacement transducer reference line */}
      <line x1="360" y1="126" x2="360" y2="158" stroke="#3a3a3a" strokeWidth="1" strokeDasharray="3 3" />
      {/* temperature sensor stem at abutment */}
      <line x1="118" y1="120" x2="118" y2="138" stroke="#3a3a3a" strokeWidth="1" strokeDasharray="3 3" />

      {/* sensors */}
      {channels.map((ch) => {
        const status = stats.get(ch.id)?.status ?? "ok";
        const color = STATUS_COLOR[status];
        const label = LABELS[ch.id];
        const isSelected = ch.id === selectedId;
        return (
          <g
            key={ch.id}
            onClick={() => onSelect(ch.id)}
            className="cursor-pointer"
            role="button"
            aria-label={`Focus ${ch.id} (${ch.location})`}
          >
            {/* glow halo */}
            <circle
              cx={ch.svgX}
              cy={ch.svgY}
              r="10"
              fill={color}
              opacity="0.22"
              className={status === "alert" ? "dot-pulse" : undefined}
            />
            {isSelected && (
              <circle
                cx={ch.svgX}
                cy={ch.svgY}
                r="7.5"
                fill="none"
                stroke="#e5e5e5"
                strokeWidth="1"
                opacity="0.7"
              />
            )}
            <circle cx={ch.svgX} cy={ch.svgY} r="4.5" fill={color} stroke="#050505" strokeWidth="1.5" />
            {label && (
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.anchor}
                className="font-mono"
                fontSize="9"
                fill={isSelected ? "#a3a3a3" : "#595959"}
              >
                {ch.id}
              </text>
            )}
            {/* generous invisible hit target */}
            <circle cx={ch.svgX} cy={ch.svgY} r="16" fill="transparent" />
          </g>
        );
      })}
    </svg>
  );
}
