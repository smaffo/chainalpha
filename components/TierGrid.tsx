"use client";

import { useState } from "react";
import { Company, ThesisResult } from "@/lib/types";
import { Tooltip } from "./Tooltip";

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
  heavy:
    "Followed by 10+ analysts. Widely known to institutions. Limited informational edge.",
  moderate:
    "Followed by 4–9 analysts. Known but not crowded. Some room for differentiated views.",
  light:
    "Followed by 1–3 analysts. Under the radar of most institutions. Potential informational edge.",
  minimal:
    "Little to no analyst coverage. Largely unknown to institutional investors. Highest potential for mispricing.",
};

const ALPHA_TOOLTIP: Record<string, string> = {
  "Low Alpha":
    "Fully priced in by the market. Included for context and thesis framing, not as an opportunity.",
  "Moderate Alpha":
    "Growing institutional interest but not yet consensus. Opportunity exists but the window is narrowing.",
  "High Alpha":
    "Critical to the thesis but under-followed. The market hasn't fully connected this company to the trend.",
  "Highest Alpha":
    "Deep upstream, minimal coverage, high thesis relevance. Highest potential return but also highest risk and lowest liquidity.",
};

const BOTTLENECK_TOOLTIP =
  "Supply chain bottleneck: This company sits at a critical chokepoint — sole supplier, no viable alternatives, or controls a scarce resource. Disruption here ripples through the entire chain.";

// ── Icons ──────────────────────────────────────────────────────────────────

function IconChevron({
  expanded,
  className,
}: {
  expanded: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""} ${className ?? ""}`}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────

export function TierGrid({ result }: { result: ThesisResult }) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  function toggleCard(key: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
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
              <div
                className={`font-mono text-xs uppercase tracking-widest ${tier.headerText} mb-1`}
              >
                {tier.label}
              </div>
              <div className="text-white font-semibold text-sm mb-2">
                {tier.sublabel}
              </div>
              <Tooltip content={ALPHA_TOOLTIP[tier.alphaLabel]}>
                <span
                  className={`inline-block font-mono text-xs px-2.5 py-0.5 rounded-full cursor-default ${tier.badge}`}
                >
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

                return (
                  <div
                    key={cardKey}
                    onClick={() => toggleCard(cardKey)}
                    className="rounded-lg border border-zinc-800/50 bg-[#0f0f18] p-3 cursor-pointer hover:border-zinc-700/60 transition-colors"
                  >
                    {/* Line 1: Ticker + Name + Bottleneck */}
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
                      <span
                        className={`font-mono font-bold text-sm leading-tight flex-shrink-0 ${tier.ticker}`}
                      >
                        {company.ticker}
                      </span>
                      <span className="text-zinc-300 text-xs font-medium leading-tight">
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
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs flex-shrink-0 tabular-nums ${tier.capCollapsed}`}
                      >
                        {company.marketCap}
                      </span>
                      <Tooltip
                        content={COVERAGE_TOOLTIP[company.analyst_coverage]}
                      >
                        <span
                          className={`font-mono text-xs border rounded px-1.5 py-0.5 leading-none cursor-default ${COVERAGE_STYLE[company.analyst_coverage]}`}
                        >
                          {COVERAGE_SHORT[company.analyst_coverage]}
                        </span>
                      </Tooltip>
                      <IconChevron
                        expanded={isExpanded}
                        className="ml-auto text-zinc-700 flex-shrink-0"
                      />
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-zinc-800/40">
                        {/* Market cap — primary financial data, displayed large */}
                        <div className="flex items-baseline gap-2 mb-3">
                          <span
                            className={`font-mono font-bold text-base tabular-nums ${tier.capExpanded}`}
                          >
                            {company.marketCap}
                          </span>
                          <span className="font-mono text-xs text-zinc-600">
                            market cap
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs leading-relaxed mb-2">
                          {company.description}
                        </p>
                        <p className="text-zinc-600 text-xs leading-relaxed italic">
                          {company.chain_reasoning}
                        </p>
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
  );
}
