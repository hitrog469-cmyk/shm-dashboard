# SHM Dashboard — Bridge Girder Monitor

A minimal Structural Health Monitoring (SHM) dashboard with simulated live
sensor data for a simply supported bridge girder. Six channels (2
accelerometers, 2 strain gauges, 1 displacement transducer, 1 temperature
sensor) stream at 2 Hz with rolling z-score anomaly detection per channel.

Built by [Rohit Acharya](https://rohitacharya.dev) — a step toward a personal
mission: Nepal's ~3,000 bridges operate with essentially no structural health
monitoring.

**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Recharts.
No backend, no database — everything runs client-side. Vercel-deployable as-is.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build (lint + type-check included)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  lib/sensors.ts                 THE ONLY SIMULATION MODULE      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ createSimulatedFeed(): SensorFeed                         │  │
│  │   one shared 500 ms interval drives ALL channels          │  │
│  │   pauses on document.visibilitychange (hidden tab)        │  │
│  │   physics: thermal cycle → strain correlation,            │  │
│  │            traffic events → acc RMS / strain / deflection │  │
│  └───────────────────────────────────────────────────────────┘  │
│                │  SensorFeed interface                          │
│                │  subscribe(channelId, cb) → unsubscribe        │
│                │  start() / stop() / injectAnomaly()            │
└────────────────┼────────────────────────────────────────────────┘
                 ▼
┌─────────────────────────────────────────────────────────────────┐
│  components/Dashboard.tsx       (the only feed consumer)        │
│   per channel: ring buffer (121 pts) + RollingZScore (lib/      │
│   anomaly.ts, window 50; |z|>3 warn, |z|>4 alert)               │
│   per tick: one rAF-batched render for all 6 channels           │
└──────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
       ▼          ▼          ▼          ▼          ▼
  HeaderStats  Girder    SensorChart  Status    EventLog
  (health %,   Diagram   (focused     Cards     (50 entries,
   uptime,     (SVG,      channel,    (value,    newest first)
   alerts)     clickable  60 s roll-  min/max,
               dots)      ing window) status)
```

### Swapping in a real data source

`lib/sensors.ts` is the **only** module that knows the data is fake. The UI
consumes the `SensorFeed` interface:

```ts
interface SensorFeed {
  readonly channels: SensorChannel[];
  start(): void;
  stop(): void;
  subscribe(channelId: string, cb: (sample: SensorSample) => void): Unsubscribe;
  injectAnomaly(channelId?: string): SensorChannel; // demo hook
}
```

To go live, implement the same interface over your transport and swap one
line in `components/Dashboard.tsx`:

```ts
// lib/ws-feed.ts
export function createWebSocketFeed(url: string): SensorFeed {
  let ws: WebSocket | null = null;
  const subs = new Map<string, Set<(s: SensorSample) => void>>();
  return {
    channels: CHANNELS, // or fetch channel metadata on connect
    start() {
      ws = new WebSocket(url);
      ws.onmessage = (e) => {
        const { channelId, t, value } = JSON.parse(e.data);
        subs.get(channelId)?.forEach((cb) => cb({ t, value }));
      };
    },
    stop() { ws?.close(); ws = null; },
    subscribe(id, cb) { /* same Set-based pattern as the simulator */ },
    injectAnomaly() { /* no-op or test-rig trigger */ },
  };
}
```

```diff
- const feed = createSimulatedFeed();
+ const feed = createWebSocketFeed("wss://your-gateway/stream");
```

Anomaly detection (`lib/anomaly.ts`) operates on raw values, so it works
unchanged against real signals.

## Design notes

- **One clock:** a single `setInterval` produces every channel's sample —
  never one timer per chart.
- **Bounded memory:** ring buffers capped at 121 points/channel, event log
  capped at 50 entries. Stable over long sessions.
- **Hidden-tab pause:** the feed stops its timer when the tab is hidden;
  renders are rAF-batched, so a hidden tab does zero work.
- **Realistic signals:** temperature follows a slow compressed diurnal cycle;
  strain = dead load + thermal (≈11.5 με/°C) + traffic live load;
  accelerometers are zero-mean with traffic-modulated RMS; displacement
  combines thermal camber, slow sway, and live-load sag.
- **Detection:** rolling z-score, window 50 samples (~25 s), with a
  per-channel noise floor so near-constant signals don't false-alarm.
  `|z| > 3` → WARN, `|z| > 4` → ALERT. "Inject anomaly" adds a decaying
  spike to a random channel so detection fires within ~1 s.
