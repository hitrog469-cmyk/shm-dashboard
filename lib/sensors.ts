/**
 * Simulated sensor feed for a simply supported bridge girder.
 *
 * ALL simulation lives in this module, behind the `SensorFeed` interface.
 * To use a real data source (WebSocket, MQTT, polling), implement
 * `SensorFeed` and swap the factory in `components/Dashboard.tsx` —
 * no other UI change is required.
 */

export type SensorKind =
  | "accelerometer"
  | "strain"
  | "displacement"
  | "temperature";

export interface SensorChannel {
  /** Real-style SHM channel ID, e.g. "ACC-01" */
  id: string;
  /** Mounting location on the girder */
  location: string;
  kind: SensorKind;
  unit: string;
  /** Display precision */
  decimals: number;
  /** Weight in the structure health score */
  weight: number;
  /**
   * Minimum standard deviation assumed by the anomaly detector.
   * Prevents z-score blow-ups on near-constant signals.
   */
  noiseFloor: number;
  /** Position on the girder SVG, in viewBox coordinates */
  svgX: number;
  svgY: number;
}

export interface SensorSample {
  /** Wall-clock timestamp (ms) */
  t: number;
  value: number;
}

export type Unsubscribe = () => void;

export interface SensorFeed {
  readonly channels: SensorChannel[];
  /** Begin emitting samples. Idempotent. */
  start(): void;
  /** Stop emitting samples and release timers/listeners. */
  stop(): void;
  /** Receive every sample for one channel. Returns an unsubscribe fn. */
  subscribe(channelId: string, cb: (sample: SensorSample) => void): Unsubscribe;
  /**
   * Demo hook: force a transient fault on a channel (random if omitted).
   * Returns the affected channel.
   */
  injectAnomaly(channelId?: string): SensorChannel;
}

/** Sample period in ms — one shared clock drives every channel. */
export const SAMPLE_INTERVAL_MS = 500;

export const CHANNELS: SensorChannel[] = [
  {
    id: "ACC-01",
    location: "midspan · web",
    kind: "accelerometer",
    unit: "m/s²",
    decimals: 3,
    weight: 1.0,
    noiseFloor: 0.08,
    svgX: 360,
    svgY: 96,
  },
  {
    id: "ACC-02",
    location: "quarter-span · web",
    kind: "accelerometer",
    unit: "m/s²",
    decimals: 3,
    weight: 1.0,
    noiseFloor: 0.08,
    svgX: 210,
    svgY: 96,
  },
  {
    id: "SG-01",
    location: "midspan · bottom flange",
    kind: "strain",
    unit: "με",
    decimals: 1,
    weight: 1.2,
    noiseFloor: 8,
    svgX: 360,
    svgY: 124,
  },
  {
    id: "SG-02",
    location: "quarter-span · bottom flange",
    kind: "strain",
    unit: "με",
    decimals: 1,
    weight: 1.0,
    noiseFloor: 8,
    svgX: 510,
    svgY: 124,
  },
  {
    id: "DSP-01",
    location: "midspan · vertical",
    kind: "displacement",
    unit: "mm",
    decimals: 2,
    weight: 1.2,
    noiseFloor: 0.15,
    svgX: 360,
    svgY: 166,
  },
  {
    id: "TMP-01",
    location: "north abutment · shade",
    kind: "temperature",
    unit: "°C",
    decimals: 1,
    weight: 0.5,
    noiseFloor: 0.2,
    svgX: 118,
    svgY: 142,
  },
];

/** Box–Muller gaussian, mean 0, std 1. */
function gauss(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface ActiveSpike {
  startSim: number;
  amplitude: number;
  durationS: number;
}

/** Per-kind spike amplitude used by injectAnomaly — sized to push |z| > 4 fast. */
const SPIKE_AMPLITUDE: Record<SensorKind, number> = {
  accelerometer: 1.4,
  strain: 110,
  displacement: 2.6,
  temperature: 5.5,
};

export function createSimulatedFeed(): SensorFeed {
  const subscribers = new Map<string, Set<(s: SensorSample) => void>>();
  const spikes = new Map<string, ActiveSpike>();

  let timer: ReturnType<typeof setInterval> | null = null;
  let running = false;

  /** Simulated seconds elapsed — only advances while the tab is visible. */
  let simT = 0;

  // --- physics state ---------------------------------------------------
  // Slow random-walk component of ambient temperature (weather front).
  let tempDrift = 0;
  // Traffic: vehicle crossings arrive randomly and excite the whole girder.
  let trafficEnvelope = 0; // 0..1 smoothed loading intensity
  let crossingEndsAt = -1; // simT when the current crossing finishes
  let crossingPeak = 0;
  let crossingStartsAt = -1;

  function advanceTraffic() {
    if (simT >= crossingEndsAt && Math.random() < 0.06) {
      // ~ one crossing every 8 s on average (0.06 per 0.5 s tick)
      const duration = 2 + Math.random() * 2.5;
      crossingStartsAt = simT;
      crossingEndsAt = simT + duration;
      crossingPeak = 0.4 + Math.random() * 0.6; // light car .. heavy truck
    }
    let target = 0;
    if (simT < crossingEndsAt) {
      // half-sine envelope as the vehicle moves across the span
      const phase = (simT - crossingStartsAt) / (crossingEndsAt - crossingStartsAt);
      target = crossingPeak * Math.sin(Math.PI * phase);
    }
    // light smoothing so the envelope is not jagged
    trafficEnvelope += (target - trafficEnvelope) * 0.5;
  }

  /** Ambient/structure temperature — slow compressed diurnal cycle. */
  function temperature(): number {
    tempDrift = Math.max(-1.5, Math.min(1.5, tempDrift + gauss() * 0.006));
    return (
      24 +
      6 * Math.sin((2 * Math.PI * simT) / 600) + // "day" cycle ~10 min
      0.7 * Math.sin((2 * Math.PI * simT) / 137) + // shorter cloud cycle
      tempDrift +
      gauss() * 0.04
    );
  }

  function spikeOffset(channelId: string): number {
    const spike = spikes.get(channelId);
    if (!spike) return 0;
    const age = simT - spike.startSim;
    if (age > spike.durationS) {
      spikes.delete(channelId);
      return 0;
    }
    // sharp onset, exponential decay — looks like an impact / sensor fault
    return spike.amplitude * Math.exp(-age / 1.8);
  }

  function computeValues(): Record<string, number> {
    advanceTraffic();
    const T = temperature();
    const dT = T - 24; // departure from neutral temperature

    // Accelerometers: zero-mean broadband jitter; traffic raises RMS.
    // Midspan sees the full first bending mode, quarter-span ~70 %.
    const accRms = 0.02 + 0.06 * trafficEnvelope;
    const acc01 = gauss() * accRms;
    const acc02 = gauss() * accRms * 0.7;

    // Strain: dead-load baseline + thermal strain (tracks temperature)
    // + live-load from traffic + gauge noise.
    const sg01 = 118 + 11.5 * dT + 20 * trafficEnvelope + gauss() * 1.4;
    const sg02 = 74 + 11.5 * dT + 12 * trafficEnvelope + gauss() * 1.4;

    // Midspan deflection: slow thermal camber + live-load sag + noise.
    const dsp01 =
      1.9 +
      0.35 * dT * 0.16 + // thermal camber, small and slow
      0.45 * Math.sin((2 * Math.PI * simT) / 300) + // slow ambient sway
      0.35 * trafficEnvelope +
      gauss() * 0.02;

    return {
      "ACC-01": acc01 + spikeOffset("ACC-01"),
      "ACC-02": acc02 + spikeOffset("ACC-02"),
      "SG-01": sg01 + spikeOffset("SG-01"),
      "SG-02": sg02 + spikeOffset("SG-02"),
      "DSP-01": dsp01 + spikeOffset("DSP-01"),
      "TMP-01": T + spikeOffset("TMP-01"),
    };
  }

  function tick() {
    simT += SAMPLE_INTERVAL_MS / 1000;
    const values = computeValues();
    const now = Date.now();
    for (const ch of CHANNELS) {
      const subs = subscribers.get(ch.id);
      if (!subs || subs.size === 0) continue;
      const sample: SensorSample = { t: now, value: values[ch.id] };
      subs.forEach((cb) => cb(sample));
    }
  }

  function startTimer() {
    if (timer === null) timer = setInterval(tick, SAMPLE_INTERVAL_MS);
  }

  function stopTimer() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  // Pause the simulation while the tab is hidden — no work, no memory churn.
  function onVisibilityChange() {
    if (!running) return;
    if (document.hidden) stopTimer();
    else startTimer();
  }

  return {
    channels: CHANNELS,

    start() {
      if (running) return;
      running = true;
      document.addEventListener("visibilitychange", onVisibilityChange);
      if (!document.hidden) startTimer();
    },

    stop() {
      running = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      stopTimer();
    },

    subscribe(channelId, cb) {
      let subs = subscribers.get(channelId);
      if (!subs) {
        subs = new Set();
        subscribers.set(channelId, subs);
      }
      subs.add(cb);
      return () => {
        subs!.delete(cb);
      };
    },

    injectAnomaly(channelId) {
      const channel = channelId
        ? CHANNELS.find((c) => c.id === channelId) ?? CHANNELS[0]
        : CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
      const sign = channel.kind === "accelerometer" || Math.random() < 0.7 ? 1 : -1;
      spikes.set(channel.id, {
        startSim: simT,
        amplitude: sign * SPIKE_AMPLITUDE[channel.kind],
        durationS: 7,
      });
      return channel;
    },
  };
}
