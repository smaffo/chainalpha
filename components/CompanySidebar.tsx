"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { SupplyNode, NodeCompany } from "@/lib/types";
import { DeepDiveModal, type CacheEntry } from "@/components/DeepDiveModal";

const EXPLORE_MESSAGES = [
  "Searching for key players...",
  "Scanning equity markets...",
  "Identifying market leaders...",
  "Verifying public listings...",
  "Compiling company profiles...",
];

interface CompanySidebarProps {
  node: SupplyNode | null;
  trendText: string;
  onClose: () => void;
  readonly?: boolean;
}

export function CompanySidebar({ node, onClose, readonly }: CompanySidebarProps) {
  const [companies, setCompanies] = useState<NodeCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msgIdx, setMsgIdx] = useState(0);
  const [deepDiveTicker, setDeepDiveTicker] = useState<string | null>(null);
  const [deepDiveName, setDeepDiveName] = useState("");
  const [deepDiveCache, setDeepDiveCache] = useState<Record<string, CacheEntry>>({});
  const msgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadedNodeRef = useRef<number | null>(null);

  const startMsgCycle = useCallback(() => {
    setMsgIdx(0);
    if (msgTimerRef.current) clearInterval(msgTimerRef.current);
    msgTimerRef.current = setInterval(
      () => setMsgIdx((i) => Math.min(i + 1, EXPLORE_MESSAGES.length - 1)),
      3_000
    );
  }, []);

  const stopMsgCycle = useCallback(() => {
    if (msgTimerRef.current) {
      clearInterval(msgTimerRef.current);
      msgTimerRef.current = null;
    }
  }, []);

  const loadCompanies = useCallback(
    async (nodeId: number, forceRefresh = false) => {
      if (!forceRefresh && loadedNodeRef.current === nodeId && companies.length > 0) return;

      setLoading(true);
      setError(null);
      startMsgCycle();

      try {
        if (!forceRefresh) {
          // Try GET first (from DB)
          const res = await fetch(`/api/explore-node/${nodeId}`);
          if (!res.ok) throw new Error("Failed to load companies");
          const data = await res.json();
          if (data.explored && data.companies?.length > 0) {
            setCompanies(data.companies);
            loadedNodeRef.current = nodeId;
            return;
          }
        }

        // POST to explore (or refresh)
        const res = await fetch(`/api/explore-node/${nodeId}`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to explore node");
        }
        const data = await res.json();
        setCompanies(data.companies ?? []);
        loadedNodeRef.current = nodeId;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load. Try again.");
        setCompanies([]);
      } finally {
        setLoading(false);
        stopMsgCycle();
      }
    },
    [companies.length, startMsgCycle, stopMsgCycle]
  );

  useEffect(() => {
    if (!node) {
      setCompanies([]);
      setError(null);
      loadedNodeRef.current = null;
      return;
    }
    loadCompanies(node.id);
  }, [node?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => stopMsgCycle();
  }, [stopMsgCycle]);

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

  if (!node) return null;

  return (
    <>
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-[#0d0d14] border-l border-zinc-800 z-30 flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-zinc-800">
          <div className="min-w-0 pr-3">
            <p className="font-mono text-xs text-zinc-500 mb-1">
              Position {node.position} · {node.node_type}
            </p>
            <h2 className="font-semibold text-sm text-zinc-100 leading-snug">{node.name}</h2>
            <p className="mt-1 font-mono text-xs text-zinc-600">
              Bottleneck {node.bottleneck_score}/100
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors p-1"
            aria-label="Close sidebar"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && (
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                <span className="font-mono text-xs text-zinc-400 transition-all duration-300">
                  {EXPLORE_MESSAGES[msgIdx]}
                </span>
              </div>
              <div className="h-px bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full animate-pulse w-1/2" />
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="py-4 space-y-3">
              <p className="font-mono text-xs text-red-400">{error}</p>
              <button
                onClick={() => node && loadCompanies(node.id, true)}
                className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-4 py-1.5 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && companies.length > 0 && (
            <div className="space-y-3">
              {companies.map((company) => (
                <div
                  key={company.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-sm text-zinc-100">{company.name}</span>
                    <span className="flex-shrink-0 font-mono text-xs text-zinc-500 border border-zinc-700 rounded px-1.5 py-0.5">
                      {company.country}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-zinc-400">{company.ticker}</p>
                  <div className="h-px bg-zinc-800" />
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    {company.chain_reasoning || company.description}
                  </p>
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => handleDeepDive(company.ticker, company.name)}
                      className="font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Deep Dive →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && !error && companies.length === 0 && (
            <p className="font-mono text-xs text-zinc-600 py-4">No companies found.</p>
          )}
        </div>

        {/* Footer */}
        {!readonly && !loading && companies.length > 0 && (
          <div className="p-5 border-t border-zinc-800">
            <button
              onClick={() => node && loadCompanies(node.id, true)}
              className="w-full font-mono text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-xl py-2.5 transition-colors"
            >
              Refresh companies
            </button>
          </div>
        )}
      </div>

      {deepDiveTicker && deepDiveCache[deepDiveTicker] && (
        <DeepDiveModal
          ticker={deepDiveTicker}
          name={deepDiveName}
          cacheEntry={deepDiveCache[deepDiveTicker]}
          onClose={() => setDeepDiveTicker(null)}
          onRefresh={() => fetchDeepDive(deepDiveTicker, deepDiveName)}
        />
      )}
    </>
  );
}
