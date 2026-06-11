/**
 * Rolling z-score anomaly detection.
 *
 * Detection is independent of where samples come from — it consumes raw
 * values, so it works unchanged against the simulator or a real feed.
 */

export type SensorStatus = "ok" | "warn" | "alert";

export const WARN_Z = 3;
export const ALERT_Z = 4;

export class RollingZScore {
  private readonly windowSize: number;
  private readonly noiseFloor: number;
  private readonly window: number[] = [];
  private sum = 0;
  private sumSq = 0;

  constructor(windowSize = 50, noiseFloor = 1e-6) {
    this.windowSize = windowSize;
    this.noiseFloor = noiseFloor;
  }

  /**
   * Score `value` against the current window, then add it to the window.
   * Returns z = 0 until enough history exists to be meaningful.
   */
  push(value: number): { z: number; status: SensorStatus } {
    let z = 0;
    const n = this.window.length;
    if (n >= 10) {
      const mean = this.sum / n;
      const variance = Math.max(0, this.sumSq / n - mean * mean);
      const std = Math.max(Math.sqrt(variance), this.noiseFloor);
      z = (value - mean) / std;
    }

    this.window.push(value);
    this.sum += value;
    this.sumSq += value * value;
    if (this.window.length > this.windowSize) {
      const old = this.window.shift()!;
      this.sum -= old;
      this.sumSq -= old * old;
    }

    const abs = Math.abs(z);
    const status: SensorStatus =
      abs > ALERT_Z ? "alert" : abs > WARN_Z ? "warn" : "ok";
    return { z, status };
  }
}
