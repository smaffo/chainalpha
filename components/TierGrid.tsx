"use client";

import { useRef, useState } from "react";
import { Company, ThesisResult } from "@/lib/types";
import { Tooltip } from "./Tooltip";
import { DeepDiveModal, CacheEntry, IconSearch } from "./DeepDiveModal";

// ── Types ──────────────────────────────────────────────────────────────────

interface LiveData {
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume: number | null;
  marketCap: number | null;
  pe: number | null;
  yearHigh: number | null;
  yearLow: number | null;
  sector: string | null;
  industry: string | null;
  website: string | null;
  employees: number | null;
}

type LiveEntry =
  | { status: "loading" }
  | { status: "success"; data: LiveData }
  | { status: "error" };

// ── Formatters ─────────────────────────────────────────────────────────────

function fmtPrice(n: number | null): string {
  if (n == null) return "—";
  return n >= 1000
    ? `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${n.toFixed(2)}`;
}

function fmtLiveCap(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtVolume(n: number | null): string {
  if (n == null) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return `${n}`;
}

// ── Constants ──────────────────────────────────────────────────────────────

const TIERS = [
  {
    key: "tier0" as keyof ThesisResult,
    label: "Tier 0",
    sublabel: "The Obvious Plays",
    alphaLabel: "Low Alpha",
    border: "border-zinc-700/60",
    headerText: "text-zinc-400",
    badge: "bg-zinc-800/80 text-zinc-400 border border-zinc-700",
    ticker: "text-zinc-300",
    capCollapsed: "text-zinc-600",
    capExpanded: "text-zinc-400",
  },
  {
    key: "tier1" as keyof ThesisResult,
    label: "Tier 1",
    sublabel: "Smart Money Attention",
    alphaLabel: "Moderate Alpha",
    border: "border-amber-500/30",
    headerText: "text-amber-400",
    badge: "bg-amber-950/60 text-amber-400 border border-amber-500/40",
    ticker: "text-amber-300",
    capCollapsed: "text-amber-700",
    capExpanded: "text-amber-400",
  },
  {
    key: "tier2" as keyof ThesisResult,
    label: "Tier 2",
    sublabel: "The Hidden Enablers",
    alphaLabel: "High Alpha",
    border: "border-emerald-500/30",
    headerText: "text-emerald-400",
    badge: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/40",
    ticker: "text-emerald-300",
    capCollapsed: "text-emerald-800",
    capExpanded: "text-emerald-400",
  },
  {
    key: "tier3" as keyof ThesisResult,
    label: "Tier 3",
    sublabel: "Deep Upstream",
    alphaLabel: "Highest Alpha",
    border: "border-purple-500/30",
    headerText: "text-purple-400",
    badge: "bg-purple-950/60 text-purple-400 border border-purple-500/40",
    ticker: "text-purple-300",
    capCollapsed: "text-purple-800",
    capExpanded: "text-purple-400",
  },
] as const;

const COVERAGE_STYLE: Record<Company["analyst_coverage"], string> = {
  heavy: "text-zinc-600 border-zinc-800",
  moderate: "text-zinc-600 border-zinc-800",
  light: "text-amber-700 border-amber-900/60",
  minimal: "text-emerald-700 border-emerald-900/60",
};

const COVERAGE_SHORT: Record<Company["analyst_coverage"], string> = {
  heavy: "Heavy",
  moderate: "Moderate",
  light: "Light",
  minimal: "Minimal",
};

const COVERAGE_TOOLTIP: Record<Company["analyst_coverage"], string> = {
  heavy: "Followed by 10+ analysts. Widely known to institutions. Limited informational edge.",
  moderate: "Followed by 4–9 analysts. Known but not crowded. Some room for differentiated views.",
  light: "Followed by 1–3 analysts. Under the radar of most institutions. Potential informational edge.",
  minimal: "Little to no analyst coverage. Largely unknown to institutional investors. Highest potential for mispricing.",
};

const ALPHA_TOOLTIP: Record<string, string> = {
  "Low Alpha": "Fully priced in by the market. Included for context and thesis framing, not as an opportunity.",
  "Moderate Alpha": "Growing institutional interest but not yet consensus. Opportunity exists but the window is narrowing.",
  "High Alpha": "Critical to the thesis but under-followed. The market hasn't fully connected this company to the trend.",
  "Highest Alpha": "Deep upstream, minimal coverage, high thesis relevance. Highest potential return but also highest risk and lowest liquidity.",
};

const BOTTLENECK_TOOLTIP =
  "Supply chain bottleneck: This company sits at a critical chokepoint — sole supplier, no viable alternatives, or controls a scarce resource. Disruption here ripples through the entire chain.";

const VALID_TICKER = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/i;
function isInvestable(ticker: string): boolean {
  return ticker.toLowerCase() !== "private" && VALID_TICKER.test(ticker);
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconChevron({ expanded, className }: { expanded: boolean; className?: string }) {
  return (
    <svg
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      width="12" height="12" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconExternalLink({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10" height="10" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ── Live Data Panel ────────────────────────────────────────────────────────

function LiveDataPanel({ ticker, entry }: { ticker: string; entry: LiveEntry | undefined }) {
  if (!entry || entry.status === "loading") {
    return (
      <div className="flex items-center gap-2 py-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-zinc-700 animate-pulse"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        ))}
        <span className="font-mono text-xs text-zinc-700">Fetching live data…</span>
      </div>
    );
  }

  if (entry.status === "error") {
    return (
      <p className="font-mono text-xs text-zinc-700 italic py-1">
        Live data unavailable for {ticker}
      </p>
    );
  }

  const { data } = entry;
  const changePos = (data.change ?? 0) >= 0;
  const pricePct =
    data.yearLow != null && data.yearHigh != null && data.price != null
      ? Math.max(0, Math.min(100, ((data.price - data.yearLow) / (data.yearHigh - data.yearLow)) * 100))
      : null;

  return (
    <div className="rounded-lg bg-[#080c14] border border-sky-900/30 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-xs text-sky-500/70 uppercase tracking-widest">
          Live Data
        </span>
        <a
          href={`https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          Yahoo Finance
          <IconExternalLink />
        </a>
      </div>

      {/* Price + change */}
      {data.price != null && (
        <div className="flex items-baseline gap-2 mb-3">
          <span className="font-mono font-bold text-lg tabular-nums text-white">
            {fmtPrice(data.price)}
          </span>
          {data.change != null && (
            <span className={`font-mono text-xs tabular-nums ${changePos ? "text-emerald-400" : "text-red-400"}`}>
              {changePos ? "+" : ""}{data.change.toFixed(2)}
              {data.changePercent != null && (
                <> ({changePos ? "+" : ""}{data.changePercent.toFixed(2)}%)</>
              )}
            </span>
          )}
        </div>
      )}

      {/* Key metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-3">
        <div>
          <p className="font-mono text-xs text-zinc-600 mb-0.5">Market Cap</p>
          <p className="font-mono text-xs text-zinc-300 tabular-nums">{fmtLiveCap(data.marketCap)}</p>
        </div>
        {data.pe != null && (
          <div>
            <p className="font-mono text-xs text-zinc-600 mb-0.5">P/E Ratio</p>
            <p className="font-mono text-xs text-zinc-300 tabular-nums">{data.pe.toFixed(1)}×</p>
          </div>
        )}
        {data.volume != null && (
          <div>
            <p className="font-mono text-xs text-zinc-600 mb-0.5">Volume</p>
            <p className="font-mono text-xs text-zinc-300 tabular-nums">{fmtVolume(data.volume)}</p>
          </div>
        )}
        {data.employees != null && (
          <div>
            <p className="font-mono text-xs text-zinc-600 mb-0.5">Employees</p>
            <p className="font-mono text-xs text-zinc-300 tabular-nums">
              {data.employees.toLocaleString()}
            </p>
          </div>
        )}
        {data.sector && (
          <div>
            <p className="font-mono text-xs text-zinc-600 mb-0.5">Sector</p>
            <p className="font-mono text-xs text-zinc-300">{data.sector}</p>
          </div>
        )}
        {data.industry && (
          <div>
            <p className="font-mono text-xs text-zinc-600 mb-0.5">Industry</p>
            <p className="font-mono text-xs text-zinc-300">{data.industry}</p>
          </div>
        )}
      </div>

      {/* 52-week range bar */}
      {pricePct !== null && data.yearLow != null && data.yearHigh != null && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono text-xs text-zinc-700 tabular-nums">{fmtPrice(data.yearLow)}</span>
            <span className="font-mono text-xs text-zinc-700 uppercase tracking-widest" style={{ fontSize: "9px" }}>52-Week Range</span>
            <span className="font-mono text-xs text-zinc-700 tabular-nums">{fmtPrice(data.yearHigh)}</span>
          </div>
          <div className="relative h-1 bg-zinc-800 rounded-full">
            <div
              className="absolute inset-y-0 left-0 bg-sky-700/60 rounded-full"
              style={{ width: `${pricePct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-sky-500 shadow-sm"
              style={{ left: `${pricePct}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function TierGrid({ result }: { result: ThesisResult }) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [liveCache, setLiveCache] = useState<Record<string, LiveEntry>>({});
  const fetchingRef = useRef<Set<string>>(new Set());

  // Deep dive state
  const [deepDiveTicker, setDeepDiveTicker] = useState<string | null>(null);
  const [deepDiveName, setDeepDiveName] = useState("");
  const [deepDiveCache, setDeepDiveCache] = useState<Record<string, CacheEntry>>({});

  async function fetchLiveData(ticker: string) {
    if (fetchingRef.current.has(ticker) || liveCache[ticker]) return;
    fetchingRef.current.add(ticker);
    setLiveCache((prev) => ({ ...prev, [ticker]: { status: "loading" } }));

    try {
      const res = await fetch(`/api/company/${encodeURIComponent(ticker)}`);
      const entry: LiveEntry = res.ok
        ? { status: "success", data: await res.json() }
        : { status: "error" };
      setLiveCache((prev) => ({ ...prev, [ticker]: entry }));
    } catch {
      setLiveCache((prev) => ({ ...prev, [ticker]: { status: "error" } }));
    }
  }

  function toggleCard(key: string, ticker: string) {
    const isCurrentlyOpen = expandedCards.has(key);
    setExpandedCards((prev) => {
      const next = new Set(prev);
      isCurrentlyOpen ? next.delete(key) : next.add(key);
      return next;
    });
    if (!isCurrentlyOpen) {
      fetchLiveData(ticker);
    }
  }

  function fetchDeepDive(ticker: string, name: string) {
    setDeepDiveCache((prev) => ({ ...prev, [ticker]: { status: "loading" } }));
    fetch(`/api/deep-dive/${encodeURIComponent(ticker)}?name=${encodeURIComponent(name)}`)
      .then((r) => r.json())
      .then((data) =>
        setDeepDiveCache((prev) => ({
          ...prev,
          [ticker]: data.error
            ? { status: "error", message: data.error }
            : { status: "done", data },
        }))
      )
      .catch(() =>
        setDeepDiveCache((prev) => ({
          ...prev,
          [ticker]: { status: "error", message: "Request failed" },
        }))
      );
  }

  function handleDeepDive(ticker: string, name: string) {
    setDeepDiveTicker(ticker);
    setDeepDiveName(name);
    if (!deepDiveCache[ticker]) {
      fetchDeepDive(ticker, name);
    }
  }

  return (
    <>
      {/* Deep Dive Modal */}
      {deepDiveTicker && deepDiveCache[deepDiveTicker] && (
        <DeepDiveModal
          ticker={deepDiveTicker}
          name={deepDiveName}
          cacheEntry={deepDiveCache[deepDiveTicker]}
          onClose={() => setDeepDiveTicker(null)}
          onRefresh={() => fetchDeepDive(deepDiveTicker, deepDiveName)}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {TIERS.map((tier) => {
          const companies = result[tier.key] ?? [];
          return (
            <div
              key={tier.key}
              className={`border ${tier.border} rounded-2xl p-5 bg-[#0c0c14] flex flex-col`}
            >
              {/* Tier header */}
              <div className="mb-4">
                <div className={`font-mono text-xs uppercase tracking-widest ${tier.headerText} mb-1`}>
                  {tier.label}
                </div>
                <div className="text-white font-semibold text-sm mb-2">
                  {tier.sublabel}
                </div>
                <Tooltip content={ALPHA_TOOLTIP[tier.alphaLabel]}>
                  <span className={`inline-block font-mono text-xs px-2.5 py-0.5 rounded-full cursor-default ${tier.badge}`}>
                    {tier.alphaLabel}
                  </span>
                </Tooltip>
              </div>

              <div className="border-t border-zinc-800/60 mb-3" />

              {/* Company cards */}
              <div className="flex flex-col gap-2 flex-1">
                {companies.map((company, idx) => {
                  const cardKey = `${tier.key}-${company.ticker}-${idx}`;
                  const isExpanded = expandedCards.has(cardKey);
                  const liveEntry = liveCache[company.ticker];

                  return (
                    <div
                      key={cardKey}
                      onClick={() => toggleCard(cardKey, company.ticker)}
                      className="rounded-lg border border-zinc-800/50 bg-[#0f0f18] p-3 cursor-pointer hover:border-zinc-700/60 transition-colors"
                    >
                      {/* Line 1: Ticker + Name + Bottleneck */}
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2 min-w-0">
                        <span className={`font-mono font-bold text-sm leading-tight flex-shrink-0 ${tier.ticker}`}>
                          {company.ticker}
                        </span>
                        <span className="text-zinc-300 text-xs font-medium leading-tight break-words min-w-0">
                          {company.name}
                        </span>
                        {company.bottleneck && (
                          <Tooltip content={BOTTLENECK_TOOLTIP}>
                            <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-orange-950/60 text-orange-400 border border-orange-700/50 leading-none cursor-default">
                              ⚡ Bottleneck
                            </span>
                          </Tooltip>
                        )}
                      </div>

                      {/* Line 2: Market cap + Coverage + Chevron */}
                      <div className="flex items-start gap-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 flex-1 min-w-0">
                          <span className={`font-mono text-xs tabular-nums ${tier.capCollapsed}`}>
                            {company.marketCap}
                          </span>
                          <Tooltip content={COVERAGE_TOOLTIP[company.analyst_coverage]}>
                            <span className={`font-mono text-xs border rounded px-1.5 py-0.5 leading-none cursor-default ${COVERAGE_STYLE[company.analyst_coverage]}`}>
                              {COVERAGE_SHORT[company.analyst_coverage]}
                            </span>
                          </Tooltip>
                        </div>
                        <IconChevron
                          expanded={isExpanded}
                          className="flex-shrink-0 text-zinc-700 mt-0.5"
                        />
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-zinc-800/40">
                          {/* AI-generated content */}
                          <div className="flex items-baseline gap-2 mb-3">
                            <span className={`font-mono font-bold text-base tabular-nums ${tier.capExpanded}`}>
                              {company.marketCap}
                            </span>
                            <span className="font-mono text-xs text-zinc-600">market cap (AI est.)</span>
                          </div>
                          <p className="text-zinc-500 text-xs leading-relaxed mb-2">
                            {company.description}
                          </p>
                          <p className="text-zinc-600 text-xs leading-relaxed italic mb-3">
                            {company.chain_reasoning}
                          </p>

                          {/* Deep Dive button */}
                          {isInvestable(company.ticker) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeepDive(company.ticker, company.name);
                              }}
                              className="flex items-center gap-1 font-mono text-xs text-zinc-600 hover:text-sky-400 transition-colors mb-3"
                            >
                              <IconSearch />
                              <span>Deep Dive</span>
                            </button>
                          )}

                          {/* Divider before live data */}
                          <div className="border-t border-zinc-800/40 mb-3" />

                          {/* Live data section */}
                          <LiveDataPanel ticker={company.ticker} entry={liveEntry} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
