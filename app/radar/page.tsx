"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ──────────────────────────────────────────────────────────────────

interface RadarAppearance {
  thesisId: number;
  title: string;
  tier: number;
  bottleneck: boolean;
}

interface RadarCompany {
  ticker: string;
  name: string;
  appearances: RadarAppearance[];
  anyBottleneck: boolean;
}

// ── Ticker validation ──────────────────────────────────────────────────────
// Only show real investable tickers: alphanumeric + dots/hyphens, 1–10 chars,
// not the literal string "Private".
const VALID_TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/i;
function isInvestable(ticker: string): boolean {
  return ticker.toLowerCase() !== "private" && VALID_TICKER.test(ticker);
}

// ── Tier helpers ───────────────────────────────────────────────────────────

const TIER_LABEL = ["T0", "T1", "T2", "T3"] as const;

const TIER_CLASSES: Record<number, string> = {
  0: "text-zinc-400 border-zinc-600",
  1: "text-amber-400 border-amber-700",
  2: "text-emerald-400 border-emerald-700",
  3: "text-purple-400 border-purple-700",
};

// ── Page ──────────────────────────────────────────────────────────────────

const TIER_OPTIONS = [
  { label: "All tiers", value: 0 },
  { label: "Tier 1+", value: 1 },
  { label: "Tier 2+", value: 2 },
] as const;

export default function Radar() {
  const [companies, setCompanies] = useState<RadarCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [bottleneckOnly, setBottleneckOnly] = useState(false);
  const [minTier, setMinTier] = useState(1);

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = companies
    .filter((c) => isInvestable(c.ticker))
    .filter((c) => !bottleneckOnly || c.anyBottleneck)
    .filter((c) => minTier === 0 || c.appearances.some((a) => a.tier >= minTier));

  const bottleneckCount = filtered.filter((c) => c.anyBottleneck).length;

  // ── Loading ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1.5 h-6 rounded-full bg-zinc-700 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="font-mono text-xs text-zinc-600 tracking-widest uppercase">
          Scanning…
        </p>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight font-mono uppercase">
            Radar
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Companies appearing across multiple theses
          </p>
        </div>

        {/* Signal summary bar */}
        {companies.length > 0 && (
          <div className="mb-4 flex items-center gap-6 px-4 py-3 rounded-xl border border-zinc-800 bg-[#0c0c14]">
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xl font-bold text-white tabular-nums">
                {filtered.length}
              </span>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                signals
              </span>
            </div>
            <div className="w-px h-8 bg-zinc-800" />
            <div className="flex flex-col gap-0.5">
              <span className="font-mono text-xl font-bold text-amber-500 tabular-nums">
                {bottleneckCount}
              </span>
              <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">
                bottlenecks
              </span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {companies.length > 0 && (
          <div className="mb-6 flex items-center gap-5 flex-wrap">
            {/* Bottleneck checkbox */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={bottleneckOnly}
                onChange={(e) => setBottleneckOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border border-zinc-700 bg-[#0c0c14] accent-amber-500 cursor-pointer"
              />
              <span className="font-mono text-xs text-zinc-500">
                Bottlenecks only
              </span>
            </label>

            <div className="w-px h-4 bg-zinc-800" />

            {/* Tier minimum */}
            <div className="flex items-center gap-0.5">
              {TIER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMinTier(opt.value)}
                  className={`px-2.5 py-1 rounded-md font-mono text-xs transition-colors ${
                    minTier === opt.value
                      ? "bg-zinc-800 text-zinc-200"
                      : "text-zinc-600 hover:text-zinc-400"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state — no data at all */}
        {!loading && companies.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
            <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center mb-2">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-600"
              >
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="6" />
                <circle cx="12" cy="12" r="2" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm font-semibold">No signals yet</p>
            <p className="text-zinc-600 text-sm max-w-md leading-relaxed">
              Map more theses to discover cross-thesis patterns. Companies that
              appear across multiple investment themes represent the strongest
              convergence signals.
            </p>
            <Link href="/">
              <button className="mt-4 px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                Map a new thesis
              </button>
            </Link>
          </div>
        )}

        {/* Empty state — filters zeroed results */}
        {!loading && companies.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-600 text-sm font-mono text-center py-16">
            No signals match the current filters.
          </p>
        )}

        {/* Company list */}
        {filtered.length > 0 && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            {filtered.map((company, idx) => (
              <div
                key={company.ticker}
                className={`flex items-start gap-0 ${
                  idx !== filtered.length - 1 ? "border-b border-zinc-800/70" : ""
                }`}
              >
                {/* Left border accent */}
                <div
                  className={`w-0.5 self-stretch flex-shrink-0 ${
                    company.anyBottleneck ? "bg-amber-500" : "bg-zinc-800"
                  }`}
                />

                {/* Row content */}
                <div
                  className={`flex-1 px-5 py-4 flex items-start gap-4 ${
                    idx % 2 === 0 ? "bg-[#0c0c14]" : "bg-[#0a0a10]"
                  }`}
                >
                  {/* Ticker + name */}
                  <div className="flex-shrink-0 w-36">
                    <div className="font-mono text-sm font-bold text-emerald-400 tabular-nums">
                      {company.ticker}
                    </div>
                    <div className="text-zinc-400 text-xs mt-0.5 leading-snug">
                      {company.name}
                    </div>
                  </div>

                  {/* Thesis tags */}
                  <div className="flex-1 flex flex-wrap gap-2 items-center min-w-0">
                    {company.appearances.map((a) => (
                      <Link
                        key={`${a.thesisId}-${a.tier}`}
                        href={`/research/${a.thesisId}`}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-opacity hover:opacity-80 ${
                          TIER_CLASSES[a.tier] ?? TIER_CLASSES[0]
                        }`}
                      >
                        <span className="text-zinc-300 max-w-[160px] truncate">
                          {a.title}
                        </span>
                        <span className="font-bold flex-shrink-0">
                          {TIER_LABEL[a.tier] ?? `T${a.tier}`}
                        </span>
                        {a.bottleneck && (
                          <span className="text-amber-400 flex-shrink-0">⚡</span>
                        )}
                      </Link>
                    ))}
                  </div>

                  {/* Right: appearance count + bottleneck badge */}
                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                    <span className="font-mono text-xs text-zinc-500 tabular-nums">
                      {company.appearances.length}×
                    </span>
                    {company.anyBottleneck && (
                      <span className="font-mono text-xs text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        bottleneck
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
