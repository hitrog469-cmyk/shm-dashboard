"use client";

export interface LogEvent {
  id: number;
  t: number;
  severity: "info" | "warn" | "alert";
  message: string;
}

const SEVERITY_COLOR: Record<LogEvent["severity"], string> = {
  info: "#10B981",
  warn: "#F59E0B",
  alert: "#EF4444",
};

function formatTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

interface Props {
  events: LogEvent[];
  mounted: boolean;
}

export default function EventLog({ events, mounted }: Props) {
  return (
    <section className="flex min-h-[280px] flex-col rounded-lg border border-edge bg-surface p-4 lg:min-h-0">
      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-widest text-gray-500">
        Event log
        <span className="ml-2 text-gray-700">newest first · max 50</span>
      </h2>
      <div className="log-scroll max-h-[520px] flex-1 space-y-2 overflow-y-auto pr-1">
        {!mounted || events.length === 0 ? (
          <p className="font-mono text-xs text-gray-600">Awaiting events…</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="flex gap-2 font-mono text-[11px] leading-snug">
              <span className="shrink-0 tabular-nums text-gray-600">
                {formatTime(e.t)}
              </span>
              <span
                className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: SEVERITY_COLOR[e.severity] }}
              />
              <span className="text-gray-400">{e.message}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
