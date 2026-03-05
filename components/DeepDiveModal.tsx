"use client";

import { useEffect, useRef, useState } from "react";

// ── Deep dive loading messages ───────────────────────────────────────────────

const DIVE_MESSAGES = [
  "Scanning recent news and catalysts...",
  "Checking insider trading activity...",
  "Analyzing institutional holders...",
  "Gathering analyst ratings...",
  "Compiling research...",
];

// ── Types ───────────────────────────────────────────────────────────────────

export interface Catalyst {
  text: string;
  date: string;
  sentiment: "positive" | "negative" | "neutral";
}

export interface DeepDiveData {
  catalysts: Catalyst[];
  insiderActivity: {
    buys: number;
    sells: number;
    netValue: string;
    notable: string;
  };
  smartMoney: {
    institutionCount: number;
    topHolders: string;
    recentChanges: string;
  };
  analystSentiment: {
    buy: number;
    hold: number;
    sell: number;
    avgPriceTarget: string;
    currentPrice: string;
    upside: string;
  };
  lastUpdated: string;
}

export type CacheEntry =
  | { status: "loading" }
  | { status: "done"; data: DeepDiveData }
  | { status: "error"; message: string };

// ── Score helpers ───────────────────────────────────────────────────────────

export function signalScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-zinc-500";
}

export function convictionScoreColor(score: number): string {
  if (score >= 60) return "text-emerald-400";
  if (score >= 40) return "text-amber-400";
  return "text-red-400";
}

export function calcConvictionScore(signalScore: number, data: DeepDiveData): number {
  let score = signalScore;

  const { buys, sells, notable } = data.insiderActivity;
  const notableLower = notable.toLowerCase();
  if (buys >= 3) {
    score += 15;
  } else if (buys > sells) {
    score += 10;
  } else if (sells > buys) {
    if (notableLower.includes("ceo") || notableLower.includes("cfo")) {
      score -= 15;
    } else {
      score -= 10;
    }
  }

  const { buy, hold, sell, upside } = data.analystSentiment;
  const upsideNum = parseFloat(upside.replace(/[^0-9.]/g, "")) || 0;
  const upsidePct = upside.trimStart().startsWith("-") ? -upsideNum : upsideNum;
  if (buy > hold + sell && upsidePct > 20) {
    score += 10;
  } else if (sell > buy) {
    score -= 10;
  }

  const changes = data.smartMoney.recentChanges.toLowerCase();
  if (changes.includes("new position")) {
    score += 10;
  } else if (changes.includes("increas") || changes.includes("added")) {
    score += 5;
  } else if (changes.includes("trim") || changes.includes("decreas") || changes.includes("reduc")) {
    score -= 5;
  }

  const posCount = data.catalysts.filter((c) => c.sentiment === "positive").length;
  const negCount = data.catalysts.filter((c) => c.sentiment === "negative").length;
  if (posCount > negCount + 1) {
    score += 5;
  } else if (negCount > posCount) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

// ── Icons ───────────────────────────────────────────────────────────────────

export function IconSearch() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconX() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

// ── Deep dive loading body ───────────────────────────────────────────────────

function ModalLoadingBody() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    startRef.current = Date.now();
    const msgTimer = setInterval(
      () => setMsgIdx((i) => Math.min(i + 1, DIVE_MESSAGES.length - 1)),
      5_000
    );
    const elapsedTimer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1_000
    );
    return () => {
      clearInterval(msgTimer);
      clearInterval(elapsedTimer);
    };
  }, []);

  return (
    <div className="p-5 flex flex-col gap-4" style={{ minHeight: "320px" }}>
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
        <span className="font-mono text-xs text-zinc-400 transition-all duration-300">
          {DIVE_MESSAGES[msgIdx]}
        </span>
      </div>
      <span className="font-mono text-xs text-zinc-700 tabular-nums">{elapsed}s</span>
    </div>
  );
}

// ── Modal internals ─────────────────────────────────────────────────────────

const SENTIMENT_COLOR = {
  positive: "text-emerald-400",
  negative: "text-red-400",
  neutral: "text-zinc-400",
};

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[10px] text-zinc-600 uppercase tracking-widest mb-3">
      {children}
    </p>
  );
}

function ModalBody({ cacheEntry, onRetry }: { cacheEntry: CacheEntry; onRetry: () => void }) {
  if (cacheEntry.status === "loading") {
    return <ModalLoadingBody />;
  }

  if (cacheEntry.status === "error") {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-zinc-400 text-sm">{cacheEntry.message}</p>
        <button
          onClick={onRetry}
          className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-4 py-1.5 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { catalysts, insiderActivity, smartMoney, analystSentiment } = cacheEntry.data;
  const { buy, hold, sell } = analystSentiment;
  const total = buy + hold + sell || 1;
  const upsidePositive = analystSentiment.upside.startsWith("+");

  return (
    <div className="divide-y divide-[#1a1d28]">
      {/* Recent Catalysts */}
      <div className="p-5">
        <SectionHeader>Recent Catalysts</SectionHeader>
        <div className="space-y-2.5">
          {catalysts.map((c, i) => (
            <div key={i} className="flex items-start justify-between gap-3">
              <p className={`text-xs leading-relaxed flex-1 ${SENTIMENT_COLOR[c.sentiment] ?? SENTIMENT_COLOR.neutral}`}>
                {c.text}
              </p>
              <span className="font-mono text-xs text-zinc-600 flex-shrink-0 tabular-nums mt-0.5">
                {c.date}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Insider Activity */}
      <div className="p-5">
        <SectionHeader>Insider Activity — last 90 days</SectionHeader>
        <div className="flex items-center gap-4 mb-2.5">
          <span className="font-mono text-sm">
            <span className="text-emerald-400 font-bold tabular-nums">{insiderActivity.buys}</span>
            <span className="text-zinc-600"> buys</span>
          </span>
          <span className="font-mono text-sm">
            <span className="text-red-400 font-bold tabular-nums">{insiderActivity.sells}</span>
            <span className="text-zinc-600"> sells</span>
          </span>
          <span className="font-mono text-sm font-bold text-white tabular-nums ml-auto">
            {insiderActivity.netValue}
          </span>
        </div>
        {insiderActivity.notable && (
          <p className="font-mono text-xs text-zinc-500">{insiderActivity.notable}</p>
        )}
      </div>

      {/* Smart Money */}
      <div className="p-5">
        <SectionHeader>Institutional Holders</SectionHeader>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-mono text-2xl font-bold text-white tabular-nums">
            {smartMoney.institutionCount.toLocaleString()}
          </span>
          <span className="font-mono text-xs text-zinc-600">institutions</span>
        </div>
        <p className="font-mono text-xs text-zinc-400 mb-1.5">{smartMoney.topHolders}</p>
        <p className="font-mono text-xs text-zinc-600">{smartMoney.recentChanges}</p>
      </div>

      {/* Analyst Sentiment */}
      <div className="p-5">
        <SectionHeader>Analyst Ratings</SectionHeader>
        <div className="flex rounded-full overflow-hidden h-2 mb-2">
          <div className="bg-emerald-500" style={{ width: `${(buy / total) * 100}%` }} />
          <div className="bg-zinc-700" style={{ width: `${(hold / total) * 100}%` }} />
          <div className="bg-red-500" style={{ width: `${(sell / total) * 100}%` }} />
        </div>
        <div className="flex items-center gap-4 mb-3 font-mono text-xs">
          <span className="text-emerald-400 tabular-nums">{buy} buy</span>
          <span className="text-zinc-500 tabular-nums">{hold} hold</span>
          <span className="text-red-400 tabular-nums">{sell} sell</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-zinc-500">
            Target <span className="text-white font-bold">{analystSentiment.avgPriceTarget}</span>
          </span>
          <span className="font-mono text-xs text-zinc-600">vs {analystSentiment.currentPrice}</span>
          <span className={`font-mono text-xs font-bold ${upsidePositive ? "text-emerald-400" : "text-red-400"}`}>
            {analystSentiment.upside}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── DeepDiveModal ───────────────────────────────────────────────────────────

export interface DeepDiveModalProps {
  ticker: string;
  name: string;
  /** Signal score from Radar. Omit to hide the Signal/Conviction section. */
  signalScore?: number;
  cacheEntry: CacheEntry;
  onClose: () => void;
  onRefresh: () => void;
}

export function DeepDiveModal({
  ticker,
  name,
  signalScore,
  cacheEntry,
  onClose,
  onRefresh,
}: DeepDiveModalProps) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const convictionData =
    signalScore !== undefined && cacheEntry.status === "done"
      ? calcConvictionScore(signalScore, cacheEntry.data)
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-[#0f1118] border border-[#1a1d28] rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-[#1a1d28] flex-shrink-0">
          <div>
            {cacheEntry.status === "loading" && (
              <p className="font-mono text-xs text-zinc-500 animate-pulse mb-1">
                Researching {ticker}…
              </p>
            )}
            <div className="font-mono text-xl font-bold text-emerald-400">{ticker}</div>
            <div className="text-zinc-500 text-xs mt-0.5">{name}</div>
            {/* Signal/Conviction — only shown when signalScore is provided (Radar context) */}
            {signalScore !== undefined && (
              <div className="mt-2 font-mono text-xs text-zinc-600 flex items-center gap-1.5">
                <span>Signal</span>
                <span className={signalScoreColor(signalScore)}>{signalScore}</span>
                {convictionData !== null && (() => {
                  const delta = convictionData - signalScore;
                  const arrow = delta > 5 ? "↑" : delta < -5 ? "↓" : "→";
                  const arrowCls = delta > 5 ? "text-emerald-400" : delta < -5 ? "text-red-400" : "text-zinc-600";
                  return (
                    <>
                      <span className="text-zinc-800">→</span>
                      <span>Conviction</span>
                      <span className={convictionScoreColor(convictionData)}>{convictionData}</span>
                      <span className={arrowCls}>{arrow}</span>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-300 transition-colors p-1 -mr-1 -mt-1 flex-shrink-0"
          >
            <IconX />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1">
          <ModalBody cacheEntry={cacheEntry} onRetry={onRefresh} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1a1d28] flex-shrink-0">
          <span className="font-mono text-xs text-zinc-700">
            {cacheEntry.status === "done"
              ? `Last updated: ${cacheEntry.data.lastUpdated}`
              : "\u00a0"}
          </span>
          <button
            onClick={onRefresh}
            disabled={cacheEntry.status === "loading"}
            className="font-mono text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
