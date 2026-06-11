import type { SensorStatus } from "./anomaly";

export const STATUS_COLOR: Record<SensorStatus, string> = {
  ok: "#10B981",
  warn: "#F59E0B",
  alert: "#EF4444",
};

export const STATUS_LABEL: Record<SensorStatus, string> = {
  ok: "OK",
  warn: "WARN",
  alert: "ALERT",
};
