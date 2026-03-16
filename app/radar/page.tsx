"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { RadarCompany } from "@/lib/types";
import {
  DeepDiveModal,
  type CacheEntry,
  signalScoreColor,
} from "@/components/DeepDiveModal";

export default function Radar() {
  const [companies, setCompanies] = useState<RadarCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState(0);
  const [bottleneckOnly, setBottleneckOnly] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [deepDiveTicker, setDeepDiveTicker] = useState<string | null>(null);
  const [deepDiveName, setDeepDiveName] = useState("");
  const [deepDiveCache, setDeepDiveCache] = useState<Record<string, CacheEntry>>({});

  useEffect(() => {
    fetch("/api/radar")
      .then((r) => r.json())
      .then((data) => setCompanies(Array.isArray(data) ? data : []))
      .catch(() => setCompanies([]))
      .finally(() => setLoading(false));
  }, []);

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
    if (!deepDiveCache[ticker]) fetchDeepDive(ticker, name);
  }

  const filtered = companies
    .filter((c) => c.signal_score >= minScore)
    .filter((c) => !bottleneckOnly || c.avg_bottleneck >= 70);

  const topSignal = filtered[0] ?? null;

  const SCORE_OPTIONS = [
    { label: "All", value: 0 },
    { label: "50+", value: 50 },
    { label: "70+", value: 70 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-1.5 h-6 rounded-full bg-zinc-700 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
        <p className="font-mono text-xs text-zinc-600 tracking-widest uppercase">Scanning…</p>
      </div>
    );
  }

  return (
    <>
      {deepDiveTicker && deepDiveCache[deepDiveTicker] && (
        <DeepDiveModal
          ticker={deepDiveTicker}
          name={deepDiveName}
          cacheEntry={deepDiveCache[deepDiveTicker]}
          onClose={() => setDeepDiveTicker(null)}
          onRefresh={() => fetchDeepDive(deepDiveTicker, deepDiveName)}
        />
      )}

      <div className="min-h-screen px-6 py-12">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight font-mono uppercase">
              Radar
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Companies appearing across multiple supply chain trends
            </p>
          </div>

          {/* Signal summary bar */}
          {companies.length > 0 && (
            <div className="mb-4 flex items-center gap-6 px-4 py-3 rounded-xl border border-zinc-800 bg-[#0c0c14]">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xl font-bold text-white tabular-nums">
                  {filtered.length}
                </span>
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">signals</span>
              </div>
              <div className="w-px h-8 bg-zinc-800" />
              <div className="flex flex-col gap-0.5">
                <span className="font-mono text-xl font-bold text-amber-500 tabular-nums">
                  {filtered.filter((c) => c.avg_bottleneck >= 70).length}
                </span>
                <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">bottlenecks</span>
              </div>
              {topSignal && (
                <>
                  <div className="w-px h-8 bg-zinc-800" />
                  <div className="flex flex-col gap-0.5">
                    <span className={`font-mono text-xl font-bold tabular-nums ${signalScoreColor(topSignal.signal_score)}`}>
                      {topSignal.ticker}{" "}
                      <span className="text-base">{topSignal.signal_score}</span>
                    </span>
                    <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest">top signal</span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Filters */}
          {companies.length > 0 && (
            <div className="mb-6 flex items-center gap-5 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={bottleneckOnly}
                  onChange={(e) => setBottleneckOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border border-zinc-700 bg-[#0c0c14] accent-amber-500 cursor-pointer"
                />
                <span className="font-mono text-xs text-zinc-500">High bottleneck only</span>
              </label>
              <div className="w-px h-4 bg-zinc-800" />
              <div className="flex items-center gap-0.5">
                {SCORE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setMinScore(opt.value)}
                    className={`px-2.5 py-1 rounded-md font-mono text-xs transition-colors ${
                      minScore === opt.value
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

          {/* Empty state */}
          {!loading && companies.length === 0 && (
            <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
              <div className="w-12 h-12 rounded-full border border-zinc-800 flex items-center justify-center mb-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-600">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <p className="text-zinc-400 text-sm font-semibold">No signals yet</p>
              <p className="text-zinc-600 text-sm max-w-md leading-relaxed">
                Map multiple trends and explore their nodes to discover companies that appear
                across supply chains.
              </p>
              <Link href="/">
                <button className="mt-4 px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                  Map a trend
                </button>
              </Link>
            </div>
          )}

          {/* Filtered empty */}
          {!loading && companies.length > 0 && filtered.length === 0 && (
            <p className="text-zinc-600 text-sm font-mono text-center py-16">
              No signals match the current filters.
            </p>
          )}

          {/* Company table */}
          {filtered.length > 0 && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <div className="grid grid-cols-[180px_80px_1fr_80px] gap-0 border-b border-zinc-800 px-5 py-2.5 bg-[#0a0a10]">
                {["COMPANY", "TICKER", "TRENDS", "SIGNAL"].map((h) => (
                  <span key={h} className="font-mono text-xs text-zinc-600 uppercase tracking-widest">{h}</span>
                ))}
              </div>
              {filtered.map((company, idx) => {
                const expanded = expandedId === company.company_id;
                return (
                  <div key={company.company_id}
                    className={idx !== filtered.length - 1 ? "border-b border-zinc-800/70" : ""}>
                    <div
                      onClick={() => setExpandedId(expanded ? null : company.company_id)}
                      className={`grid grid-cols-[180px_80px_1fr_80px] gap-0 px-5 py-4 cursor-pointer transition-colors ${
                        expanded
                          ? "bg-zinc-800/60"
                          : idx % 2 === 0
                          ? "bg-[#0c0c14] hover:bg-zinc-900/60"
                          : "bg-[#0a0a10] hover:bg-zinc-900/60"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-sm text-zinc-100 truncate">{company.name}</div>
                        <div className="font-mono text-xs text-zinc-600 mt-0.5">{company.country}</div>
                      </div>
                      <div className="font-mono text-sm text-emerald-400 font-bold self-center">
                        {company.ticker}
                      </div>
                      <div className="flex flex-wrap gap-1.5 items-center pr-4">
                        {Array.from(new Set(company.appearances.map((a) => a.trend_title))).map((title) => (
                          <span key={title}
                            className="font-mono text-xs text-zinc-500 bg-zinc-800/60 border border-zinc-700 rounded px-2 py-0.5 max-w-[140px] truncate">
                            {title}
                          </span>
                        ))}
                      </div>
                      <div className="self-center">
                        <span className={`font-mono text-sm font-bold tabular-nums ${signalScoreColor(company.signal_score)}`}>
                          {company.signal_score}
                        </span>
                        <div className="font-mono text-xs text-zinc-600 mt-0.5">
                          {company.trend_count} trend{company.trend_count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    {/* Expanded row */}
                    {expanded && (
                      <div className="px-5 pb-4 bg-zinc-900/30 border-t border-zinc-800/50">
                        <div className="space-y-2 pt-3">
                          {company.appearances.map((a, i) => (
                            <div key={i} className="flex items-center gap-3 text-xs">
                              <span className="font-mono text-zinc-500 w-32 truncate flex-shrink-0">
                                {a.trend_title}
                              </span>
                              <span className="text-zinc-400 truncate">{a.node_name}</span>
                              <span className={`font-mono flex-shrink-0 ${
                                a.bottleneck_score >= 70 ? "text-amber-400" : "text-zinc-600"
                              }`}>
                                {a.bottleneck_score}
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex justify-end">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeepDive(company.ticker, company.name); }}
                            className="font-mono text-xs text-zinc-400 hover:text-sky-400 transition-colors"
                          >
                            Deep Dive →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
