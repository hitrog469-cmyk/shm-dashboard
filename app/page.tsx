import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <main>
      <Dashboard />

      <div className="mx-auto max-w-7xl px-4 pb-8 sm:px-6">
        <section className="rounded-lg border border-edge bg-surface p-4">
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-gray-500">
            About this demo
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-gray-400">
            All sensor data on this page is <strong className="text-gray-300">simulated client-side</strong> —
            physically plausible signals (thermal drift, traffic excitation,
            temperature-correlated strain) with rolling z-score anomaly
            detection on every channel. The simulation sits behind a small
            subscribe/unsubscribe interface, so a real WebSocket sensor feed
            can replace it with zero UI changes. It&apos;s a step toward a
            personal mission: Nepal&apos;s roughly 3,000 bridges operate with
            essentially no structural health monitoring.
          </p>
        </section>

        <footer className="mt-6 border-t border-edge pt-4 text-center font-mono text-xs text-gray-600">
          Built by{" "}
          <a
            href="https://rohit-website-sigma.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent transition-colors hover:text-amber-400"
          >
            Rohit Acharya · rohit-website-sigma.vercel.app
          </a>
        </footer>
      </div>
    </main>
  );
}
