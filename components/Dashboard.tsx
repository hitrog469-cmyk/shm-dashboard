"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSimulatedFeed,
  type SensorChannel,
  type SensorFeed,
  type SensorSample,
} from "@/lib/sensors";
import { RollingZScore, type SensorStatus } from "@/lib/anomaly";
import GirderDiagram from "./GirderDiagram";
import SensorChart from "./SensorChart";
import StatusCard from "./StatusCard";
import EventLog, { type LogEvent } from "./EventLog";
import HeaderStats from "./HeaderStats";

export interface ChannelStat {
  latest: number | null;
  min: number;
  max: number;
  z: number;
  status: SensorStatus;
  /** Alarm hold-down: timestamp until which a warn/alert state is latched. */
  holdUntil: number;
}

/** 60 s rolling window at 2 Hz, plus the incoming point. */
const MAX_POINTS = 121;
const Z_WINDOW = 50;
const MAX_EVENTS = 50;
/**
 * Minimum time a warn/alert state stays raised. A z-score spike clears
 * within a sample or two once the outlier inflates the window's std, so
 * without a hold the operator (or demo visitor) would barely see it.
 */
const ALARM_HOLD_MS = 4500;

const SEVERITY: Record<SensorStatus, number> = { ok: 0, warn: 1, alert: 2 };

interface Engine {
  feed: SensorFeed;
  buffers: Map<string, SensorSample[]>;
  detectors: Map<string, RollingZScore>;
  stats: Map<string, ChannelStat>;
  events: LogEvent[];
  eventSeq: number;
}

function pushEvent(
  engine: Engine,
  severity: LogEvent["severity"],
  message: string,
) {
  engine.events.unshift({
    id: engine.eventSeq++,
    t: Date.now(),
    severity,
    message,
  });
  if (engine.events.length > MAX_EVENTS) engine.events.pop();
}

function handleSample(engine: Engine, ch: SensorChannel, sample: SensorSample) {
  const { z, status: rawStatus } = engine.detectors.get(ch.id)!.push(sample.value);
  const stat = engine.stats.get(ch.id)!;
  const prevStatus = stat.status;

  // Latch warn/alert for ALARM_HOLD_MS: escalations apply immediately,
  // de-escalations wait for the hold to expire.
  let status = rawStatus;
  if (SEVERITY[rawStatus] >= SEVERITY[prevStatus]) {
    if (SEVERITY[rawStatus] > 0) stat.holdUntil = sample.t + ALARM_HOLD_MS;
  } else if (sample.t < stat.holdUntil) {
    status = prevStatus;
  }

  stat.latest = sample.value;
  stat.min = Math.min(stat.min, sample.value);
  stat.max = Math.max(stat.max, sample.value);
  stat.z = z;
  stat.status = status;

  const buffer = engine.buffers.get(ch.id)!;
  buffer.push(sample);
  if (buffer.length > MAX_POINTS) buffer.shift();

  if (status !== prevStatus) {
    const absZ = Math.abs(z).toFixed(1);
    if (status === "alert") {
      pushEvent(engine, "alert", `${ch.id} |z| = ${absZ} — alert threshold exceeded (|z| > 4)`);
    } else if (status === "warn") {
      pushEvent(
        engine,
        "warn",
        prevStatus === "alert"
          ? `${ch.id} easing — back below alert threshold (|z| = ${absZ})`
          : `${ch.id} |z| = ${absZ} — deviation detected (|z| > 3)`,
      );
    } else {
      pushEvent(engine, "info", `${ch.id} returned to normal`);
    }
  }
}

export default function Dashboard() {
  const engineRef = useRef<Engine | null>(null);
  if (!engineRef.current) {
    const feed = createSimulatedFeed();
    const engine: Engine = {
      feed,
      buffers: new Map(),
      detectors: new Map(),
      stats: new Map(),
      events: [],
      eventSeq: 0,
    };
    for (const ch of feed.channels) {
      engine.buffers.set(ch.id, []);
      engine.detectors.set(ch.id, new RollingZScore(Z_WINDOW, ch.noiseFloor));
      engine.stats.set(ch.id, {
        latest: null,
        min: Infinity,
        max: -Infinity,
        z: 0,
        status: "ok",
        holdUntil: 0,
      });
    }
    engineRef.current = engine;
  }
  const engine = engineRef.current;

  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState(engine.feed.channels[0].id);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const eng = engineRef.current!;
    const { feed } = eng;

    // Batch the 6 per-tick sample callbacks into one render. rAF does not
    // fire in hidden tabs, so a paused feed also means zero re-renders.
    let raf = 0;
    let pending = false;
    const scheduleRender = () => {
      if (pending) return;
      pending = true;
      raf = requestAnimationFrame(() => {
        pending = false;
        setTick((t) => t + 1);
      });
    };

    const unsubs = feed.channels.map((ch) =>
      feed.subscribe(ch.id, (sample) => {
        handleSample(eng, ch, sample);
        scheduleRender();
      }),
    );

    if (startTimeRef.current === null) startTimeRef.current = Date.now();
    if (eng.events.length === 0) {
      pushEvent(eng, "info", "Monitoring session started — 6 channels online");
    }
    feed.start();

    return () => {
      unsubs.forEach((u) => u());
      feed.stop();
      cancelAnimationFrame(raf);
    };
  }, []);

  const channels = engine.feed.channels;
  const mounted = tick > 0;

  const { healthScore, activeAlerts } = useMemo(() => {
    let weighted = 0;
    let totalWeight = 0;
    let alerts = 0;
    for (const ch of channels) {
      const status = engine.stats.get(ch.id)!.status;
      const factor = status === "ok" ? 1 : status === "warn" ? 0.5 : 0;
      weighted += ch.weight * factor;
      totalWeight += ch.weight;
      if (status !== "ok") alerts++;
    }
    return {
      healthScore: Math.round((weighted / totalWeight) * 100),
      activeAlerts: alerts,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, channels, engine]);

  const uptimeMs =
    mounted && startTimeRef.current !== null
      ? Date.now() - startTimeRef.current
      : 0;

  const selected = channels.find((c) => c.id === selectedId) ?? channels[0];
  const selectedStat = engine.stats.get(selected.id)!;
  const selectedBuffer = engine.buffers.get(selected.id)!;

  const handleInject = () => {
    const ch = engine.feed.injectAnomaly();
    pushEvent(engine, "warn", `Demo anomaly injected on ${ch.id} (${ch.location})`);
    setSelectedId(ch.id);
    setTick((t) => t + 1);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6">
      {/* header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-gray-100">
            <span className="text-accent">SHM</span> · Bridge Girder Monitor
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
            STR-001 · simply supported girder · L = 32.0 m
          </p>
        </div>
        <button
          onClick={handleInject}
          className="rounded border border-accent/60 bg-accent/10 px-3 py-1.5 font-mono text-xs uppercase tracking-wider text-accent transition-colors hover:bg-accent/20"
        >
          ⚡ Inject anomaly
        </button>
      </header>

      <HeaderStats
        healthScore={healthScore}
        uptimeMs={uptimeMs}
        activeAlerts={activeAlerts}
        live={mounted}
      />

      {/* girder + chart | event log */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="rounded-lg border border-edge bg-surface p-4">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
                Side elevation · sensor layout
              </h2>
              <span className="hidden font-mono text-[10px] text-gray-600 sm:block">
                click a sensor to focus its chart
              </span>
            </div>
            <GirderDiagram
              channels={channels}
              stats={engine.stats}
              selectedId={selected.id}
              onSelect={setSelectedId}
            />
          </section>

          <SensorChart
            channel={selected}
            stat={selectedStat}
            buffer={selectedBuffer}
            tick={tick}
          />
        </div>

        <EventLog events={engine.events} mounted={mounted} />
      </div>

      {/* status cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {channels.map((ch) => (
          <StatusCard
            key={ch.id}
            channel={ch}
            stat={engine.stats.get(ch.id)!}
            selected={ch.id === selected.id}
            onSelect={() => setSelectedId(ch.id)}
          />
        ))}
      </div>
    </div>
  );
}
