"use client";

import { useEffect, useRef, useState } from "react";

const MESSAGES = [
  "Analyzing macro thesis...",
  "Tracing supply chain layers...",
  "Identifying Tier 0 obvious plays...",
  "Mapping Tier 1 smart money targets...",
  "Discovering Tier 2 hidden enablers...",
  "Uncovering Tier 3 deep upstream...",
  "Detecting bottlenecks...",
  "Scoring alpha potential...",
  "Finalizing chain map...",
];

const TOTAL_SECS = 70;

interface MappingProgressProps {
  error?: string | null;
  onRetry?: () => void;
}

export function MappingProgress({ error, onRetry }: MappingProgressProps) {
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (error) return;
    startRef.current = Date.now();
    setMsgIdx(0);
    setElapsed(0);

    const msgTimer = setInterval(
      () => setMsgIdx((i) => Math.min(i + 1, MESSAGES.length - 1)),
      8_000
    );
    const elapsedTimer = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1_000
    );
    return () => {
      clearInterval(msgTimer);
      clearInterval(elapsedTimer);
    };
  }, [error]);

  const pct = Math.min((elapsed / TOTAL_SECS) * 100, 95);

  if (error) {
    return (
      <div className="py-3 space-y-3">
        <p className="font-mono text-xs text-red-400">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-4 py-1.5 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
        <span className="font-mono text-xs text-zinc-400 transition-all duration-300">
          {MESSAGES[msgIdx]}
        </span>
      </div>
      <div className="h-px bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs text-zinc-700 tabular-nums">{elapsed}s elapsed</span>
    </div>
  );
}
