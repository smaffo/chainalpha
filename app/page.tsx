"use client";

import { useEffect, useState } from "react";
import type { SupplyNode, Trend } from "@/lib/types";
import { MappingProgress } from "@/components/MappingProgress";
import { NodeCard } from "@/components/NodeCard";
import { CompanySidebar } from "@/components/CompanySidebar";

interface ThesisSuggestion {
  title: string;
  thesis: string;
  catalyst: string;
}

interface SaveState {
  status: "idle" | "saving" | "saved";
  watchlistId: number | null;
}

const SUGGESTION_BORDERS = [
  "border-l-zinc-500",
  "border-l-amber-500",
  "border-l-emerald-600",
  "border-l-purple-600",
] as const;

function IconBookmark({ filled, className }: { filled?: boolean; className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export default function Home() {
  const [trend, setTrend] = useState("");
  const [mapping, setMapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nodes, setNodes] = useState<SupplyNode[]>([]);
  const [trendId, setTrendId] = useState<number | null>(null);
  const [trendTitle, setTrendTitle] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [stats, setStats] = useState<{
    trends: number;
    nodes: number;
    explored: number;
  } | null>(null);

  const [suggestions, setSuggestions] = useState<ThesisSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, SaveState>>({});
  const [feedback, setFeedback] = useState<Record<number, string>>({});

  function showFeedback(i: number, msg: string) {
    setFeedback((prev) => ({ ...prev, [i]: msg }));
    setTimeout(
      () => setFeedback((prev) => { const next = { ...prev }; delete next[i]; return next; }),
      2000
    );
  }

  function reconcileWatchlist(
    suggs: ThesisSuggestion[],
    watchlistItems: Array<{ id: number; thesis_text: string }>
  ) {
    const initial: Record<number, SaveState> = {};
    suggs.forEach((s, i) => {
      const match = watchlistItems.find((w) => w.thesis_text === s.thesis);
      if (match) initial[i] = { status: "saved", watchlistId: match.id };
    });
    setSaved(initial);
  }

  useEffect(() => {
    fetch("/api/trends")
      .then((r) => r.json())
      .then((data: Trend[]) => {
        if (!Array.isArray(data)) return;
        setStats({
          trends: data.length,
          nodes: data.reduce((s, t) => s + (t.node_count ?? 0), 0),
          explored: data.reduce((s, t) => s + (t.explored_count ?? 0), 0),
        });
      })
      .catch(() => {});

    Promise.all([
      fetch("/api/suggest-theses").then((r) => r.json()).catch(() => []),
      fetch("/api/watchlist").then((r) => r.json()).catch(() => []),
    ]).then(([suggestData, watchlistData]) => {
      if (Array.isArray(suggestData) && suggestData.length > 0) {
        setSuggestions(suggestData);
        if (Array.isArray(watchlistData)) reconcileWatchlist(suggestData, watchlistData);
      }
    });
  }, []);

  async function doMapTrend(text: string) {
    setMapping(true);
    setError(null);
    setNodes([]);
    setSelectedNode(null);
    setTrendId(null);
    setTrendTitle("");
    try {
      const res = await fetch("/api/map-trend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trend: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setNodes(data.nodes);
      setTrendId(data.trendId);
      setTrendTitle(data.title);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setMapping(false);
    }
  }

  async function handleMapTrend() {
    const text = trend.trim();
    if (!text) return;
    if (nodes.length > 0) {
      setShowConfirm(true);
      return;
    }
    await doMapTrend(text);
  }

  async function handleConfirmRemap() {
    setShowConfirm(false);
    const text = trend.trim();
    if (!text) return;
    // Delete old trend if exists
    if (trendId !== null) {
      await fetch(`/api/trends/${trendId}`, { method: "DELETE" }).catch(() => {});
    }
    await doMapTrend(text);
  }

  async function fetchSuggestions(refresh = false) {
    setSuggestLoading(true);
    setSuggestError(null);
    setExpandedIdx(null);
    setSaved({});
    try {
      const url = refresh ? "/api/suggest-theses?refresh=1" : "/api/suggest-theses";
      const [suggestRes, watchlistRes] = await Promise.all([
        fetch(url),
        fetch("/api/watchlist"),
      ]);
      const suggestData = await suggestRes.json();
      if (!suggestRes.ok) throw new Error(suggestData.error || "Request failed");
      setSuggestions(suggestData);
      const watchlistData = await watchlistRes.json().catch(() => []);
      if (Array.isArray(watchlistData)) reconcileWatchlist(suggestData, watchlistData);
    } catch (err) {
      setSuggestError(err instanceof Error ? err.message : "Failed to load suggestions");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function mapSuggestion(text: string) {
    setTrend(text);
    await doMapTrend(text);
  }

  async function toggleWatchlist(i: number, s: ThesisSuggestion) {
    const state = saved[i] ?? { status: "idle", watchlistId: null };
    if (state.status === "saving") return;

    if (state.status === "saved" && state.watchlistId !== null) {
      setSaved((prev) => ({ ...prev, [i]: { status: "saving", watchlistId: state.watchlistId } }));
      try {
        await fetch(`/api/watchlist/${state.watchlistId}`, { method: "DELETE" });
        setSaved((prev) => ({ ...prev, [i]: { status: "idle", watchlistId: null } }));
        showFeedback(i, "Removed from watchlist");
      } catch {
        setSaved((prev) => ({ ...prev, [i]: state }));
      }
    } else {
      setSaved((prev) => ({ ...prev, [i]: { status: "saving", watchlistId: null } }));
      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: s.title, thesis_text: s.thesis, catalyst: s.catalyst }),
        });
        const data = await res.json();
        if (data.duplicate) {
          setSaved((prev) => ({ ...prev, [i]: { status: "saved", watchlistId: data.id } }));
          showFeedback(i, "Already in watchlist");
        } else {
          setSaved((prev) => ({ ...prev, [i]: { status: "saved", watchlistId: data.id } }));
          showFeedback(i, "Added to watchlist");
        }
      } catch {
        setSaved((prev) => ({ ...prev, [i]: { status: "idle", watchlistId: null } }));
      }
    }
  }

  function handleNodeExplore(node: SupplyNode) {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }

  return (
    <>
      {/* Confirm remap modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0d14] border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold text-white text-sm">Re-map this trend?</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This will delete the current supply chain and generate a new one.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                className="font-mono text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-lg px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemap}
                className="font-mono text-xs text-black bg-white hover:bg-zinc-100 rounded-lg px-4 py-2 transition-colors"
              >
                Re-map
              </button>
            </div>
          </div>
        </div>
      )}

      <main
        className={`min-h-screen transition-all duration-300 ${
          selectedNode ? "pr-96" : ""
        }`}
      >
        <div className="flex flex-col items-center px-6 py-16">
          <div className="w-full max-w-2xl">

            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-mono text-xs text-zinc-400 tracking-widest uppercase">
                  Supply Chain Intelligence
                </span>
              </div>
              <h1 className="text-5xl font-bold tracking-tight text-white leading-none mb-3">
                ChainAlpha
              </h1>
              <p className="text-zinc-400 text-lg">
                Map the supply chain behind any investment trend
              </p>
            </div>

            {/* Stats bar */}
            {stats && stats.trends > 0 && (
              <div className="mb-8 flex items-stretch gap-px rounded-xl overflow-hidden border border-zinc-800/60">
                {[
                  { value: stats.trends, label: "Trends Mapped" },
                  { value: stats.nodes, label: "Nodes Discovered" },
                  { value: stats.explored, label: "Nodes Explored", amber: true },
                ].map(({ value, label, amber }, i) => (
                  <div key={i} className="flex-1 bg-[#0c0c14] px-5 py-4 flex flex-col gap-1">
                    <span className={`font-mono text-2xl font-bold leading-none tabular-nums ${amber ? "text-amber-400" : "text-white"}`}>
                      {value}
                    </span>
                    <span className="font-mono text-xs text-zinc-600 uppercase tracking-widest">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Trend input */}
            <div>
              <label className="block font-mono text-xs text-zinc-400 uppercase tracking-widest mb-3">
                Investment Trend
              </label>
              <textarea
                value={trend}
                onChange={(e) => setTrend(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleMapTrend();
                }}
                disabled={mapping}
                placeholder="Describe a macro theme, sector trend, or structural shift..."
                rows={4}
                className="w-full bg-[#0f0f17] border border-zinc-800 rounded-xl px-5 py-4 text-slate-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 text-base leading-relaxed transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              />

              {mapping || error ? (
                <div className="mt-3">
                  <MappingProgress
                    error={error}
                    onRetry={() => { setError(null); handleMapTrend(); }}
                  />
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-4 flex-wrap">
                  <button
                    onClick={handleMapTrend}
                    disabled={!trend.trim()}
                    className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Map this trend →
                  </button>
                  <span className="font-mono text-xs text-zinc-600">⌘ + Enter</span>
                </div>
              )}

              {/* Suggest row */}
              <div className="mt-3 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => fetchSuggestions(false)}
                  disabled={suggestLoading}
                  className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {suggestLoading ? (
                    <>
                      <span className="flex gap-0.5">
                        {[0, 1, 2].map((i) => (
                          <span key={i} className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse inline-block"
                            style={{ animationDelay: `${i * 150}ms` }} />
                        ))}
                      </span>
                      Scanning markets…
                    </>
                  ) : <>✨ Suggest trends</>}
                </button>

                {suggestions.length > 0 && !suggestLoading && (
                  <button onClick={() => fetchSuggestions(true)}
                    className="font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
                    Regenerate
                  </button>
                )}

                {suggestError && <p className="font-mono text-xs text-red-400">{suggestError}</p>}
              </div>

              {/* Suggestion cards */}
              {!suggestLoading && suggestions.length > 0 && (
                <div className="mt-4 grid gap-2">
                  {suggestions.map((s, i) => {
                    const expanded = expandedIdx === i;
                    const state = saved[i] ?? { status: "idle", watchlistId: null };
                    const isSaved = state.status === "saved";
                    const isSaving = state.status === "saving";
                    const fb = feedback[i];
                    return (
                      <div key={i} className={`rounded-xl bg-[#0f1118] border border-zinc-800/60 border-l-2 ${SUGGESTION_BORDERS[i % 4]} transition-colors`}>
                        <button
                          onClick={() => setExpandedIdx(expanded ? null : i)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#12131f] rounded-xl transition-colors"
                        >
                          <span className="flex-1 text-left font-semibold text-white text-sm">{s.title}</span>
                          {fb && (
                            <span className="font-mono text-xs text-zinc-400 shrink-0">{fb}</span>
                          )}
                          <span
                            role="button"
                            onClick={(e) => { e.stopPropagation(); toggleWatchlist(i, s); }}
                            title={isSaved ? "Remove from watchlist" : "Save to watchlist"}
                            className={`shrink-0 p-1 rounded transition-colors ${isSaving ? "opacity-40" : isSaved ? "text-amber-400 hover:text-zinc-400" : "text-zinc-600 hover:text-zinc-300"}`}
                          >
                            <IconBookmark filled={isSaved} />
                          </span>
                          <IconChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                        </button>

                        {expanded && (
                          <div className="px-4 pb-4 flex flex-col gap-3">
                            <p className="text-zinc-400 text-xs leading-relaxed">{s.thesis}</p>
                            <span className="self-start inline-flex items-center font-mono text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                              {s.catalyst}
                            </span>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => mapSuggestion(s.thesis)}
                                disabled={mapping}
                                className="font-mono text-xs text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                {mapping ? "Mapping…" : "Map this trend →"}
                              </button>
                              <button
                                onClick={() => toggleWatchlist(i, s)}
                                disabled={isSaving}
                                className={`font-mono text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                  isSaved
                                    ? "text-amber-400 border-amber-500/30 bg-amber-500/10 hover:text-zinc-400 hover:border-zinc-700 hover:bg-transparent"
                                    : "text-zinc-400 border-zinc-700 hover:text-zinc-200 hover:border-zinc-500"
                                }`}
                              >
                                <IconBookmark filled={isSaved} className="w-3.5 h-3.5" />
                                {isSaving ? "…" : isSaved ? "Saved" : "Save to watchlist"}
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

            {/* Supply chain nodes */}
            {nodes.length > 0 && (
              <div className="mt-10">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="font-semibold text-white text-sm">{trendTitle}</h2>
                    <p className="font-mono text-xs text-zinc-500 mt-0.5">
                      {nodes.length} supply chain nodes — click to explore companies
                    </p>
                  </div>
                  <a
                    href={`/trend/${trendId}`}
                    className="font-mono text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 hover:border-zinc-600 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    View saved →
                  </a>
                </div>
                <div className="space-y-2">
                  {nodes.map((node, idx) => (
                    <div key={node.id}>
                      <NodeCard
                        node={node}
                        onExplore={handleNodeExplore}
                        isSelected={selectedNode?.id === node.id}
                      />
                      {idx < nodes.length - 1 && (
                        <div className="flex justify-center my-1">
                          <div className="w-px h-4 bg-zinc-800" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <CompanySidebar
        node={selectedNode}
        trendText={trend}
        onClose={() => setSelectedNode(null)}
      />
    </>
  );
}
