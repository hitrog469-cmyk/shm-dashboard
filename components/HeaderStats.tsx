"use client";

interface Props {
  healthScore: number;
  uptimeMs: number;
  activeAlerts: number;
  live: boolean;
}

function formatUptime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(h)}:${p(m)}:${p(s)}`;
}

export default function HeaderStats({ healthScore, uptimeMs, activeAlerts, live }: Props) {
  const healthColor =
    healthScore >= 90 ? "#10B981" : healthScore >= 70 ? "#F59E0B" : "#EF4444";
  const alertColor = activeAlerts > 0 ? "#EF4444" : "#10B981";

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-lg border border-edge bg-surface px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Structure health
        </p>
        <p className="mt-1 font-mono text-2xl tabular-nums" style={{ color: healthColor }}>
          {healthScore}
          <span className="text-sm text-gray-500"> %</span>
        </p>
      </div>
      <div className="rounded-lg border border-edge bg-surface px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Session uptime
        </p>
        <p className="mt-1 flex items-center gap-2 font-mono text-2xl tabular-nums text-gray-100">
          {formatUptime(uptimeMs)}
          {live && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-ok">
              <span className="dot-pulse h-1.5 w-1.5 rounded-full bg-ok" />
              live
            </span>
          )}
        </p>
      </div>
      <div className="rounded-lg border border-edge bg-surface px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
          Active alerts
        </p>
        <p className="mt-1 font-mono text-2xl tabular-nums" style={{ color: alertColor }}>
          {activeAlerts}
          <span className="text-sm text-gray-500"> / 6 channels</span>
        </p>
      </div>
    </div>
  );
}
