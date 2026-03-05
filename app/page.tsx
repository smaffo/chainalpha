"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SavedThesis } from "@/lib/types";

interface ThesisSuggestion {
  title: string;
  thesis: string;
  catalyst: string;
}

const SUGGESTION_BORDERS = [
  "border-l-zinc-500",
  "border-l-amber-500",
  "border-l-emerald-600",
  "border-l-purple-600",
] as const;

export default function Home() {
  const router = useRouter();
  const [thesis, setThesis] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    theses: number;
    companies: number;
    bottlenecks: number;
  } | null>(null);

  const [suggestions, setSuggestions] = useState<ThesisSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/theses")
      .then((r) => r.json())
      .then((data: SavedThesis[]) => {
        setStats({
          theses: data.length,
          companies: data.reduce((s, t) => s + t.company_count, 0),
          bottlenecks: data.reduce((s, t) => s + t.bottleneck_count, 0),
        });
      })
      .catch(() => {});
  }, []);

  async function handleMapThesis() {
    const text = thesis.trim();
    if (!text) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/map-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesis: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.push(`/research/${data.thesisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function fetchSuggestions() {
    setSuggestLoading(true);
    setSuggestError(null);
    setExpandedIdx(null);
    try {
      const res = await fetch("/api/suggest-theses");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setSuggestions(data);
    } catch (err) {
      setSuggestError(
        err instanceof Error ? err.message : "Failed to load suggestions"
      );
    } finally {
      setSuggestLoading(false);
    }
  }

  async function mapSuggestion(text: string) {
    setThesis(text);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/map-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesis: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.push(`/research/${data.thesisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }


  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-2xl">

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="font-mono text-xs text-zinc-400 tracking-widest uppercase">
              Investment Research
            </span>
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white leading-none mb-3">
            ChainAlpha
          </h1>
          <p className="text-zinc-400 text-lg">
            Find the companies behind the companies
          </p>
        </div>

        {/* Stats bar */}
        {stats && stats.theses > 0 && (
          <div className="mb-8 flex items-stretch gap-px rounded-xl overflow-hidden border border-zinc-800/60">
            {[
              { value: stats.theses, label: "Theses Mapped" },
              { value: stats.companies, label: "Companies Discovered" },
              {
                value: stats.bottlenecks,
                label: "Bottlenecks Identified",
                amber: true,
              },
            ].map(({ value, label, amber }, i) => (
              <div
                key={i}
                className="flex-1 bg-[#0c0c14] px-5 py-4 flex flex-col gap-1"
              >
                <span
                  className={`font-mono text-2xl font-bold leading-none tabular-nums ${amber ? "text-amber-400" : "text-white"}`}
                >
                  {value}
                </span>
                <span className="font-mono text-xs text-zinc-600 uppercase tracking-widest">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Thesis input */}
        <div>
          <label className="block font-mono text-xs text-zinc-400 uppercase tracking-widest mb-3">
            Your Thesis
          </label>
          <textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                handleMapThesis();
            }}
            placeholder="Describe a macro theme, sector trend, or structural shift..."
            rows={4}
            className="w-full bg-[#0f0f17] border border-zinc-800 rounded-xl px-5 py-4 text-slate-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-zinc-600 text-base leading-relaxed transition-colors"
          />

          {/* Map button */}
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <button
              onClick={handleMapThesis}
              disabled={loading || !thesis.trim()}
              className="px-6 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Mapping…" : "Map this thesis"}
            </button>
            <span className="font-mono text-xs text-zinc-600">⌘ + Enter</span>
            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>

          {/* Suggest row */}
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={fetchSuggestions}
              disabled={suggestLoading}
              className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {suggestLoading ? (
                <>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full bg-zinc-500 animate-pulse inline-block"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </span>
                  Scanning markets…
                </>
              ) : (
                <>✨ Suggest theses</>
              )}
            </button>

            {suggestions.length > 0 && !suggestLoading && (
              <button
                onClick={fetchSuggestions}
                className="font-mono text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
              >
                Regenerate
              </button>
            )}

            {suggestError && (
              <p className="font-mono text-xs text-red-400">{suggestError}</p>
            )}
          </div>

          {/* Suggestion cards */}
          {!suggestLoading && suggestions.length > 0 && (
            <div className="mt-4 grid gap-2">
              {suggestions.map((s, i) => {
                const expanded = expandedIdx === i;
                return (
                  <div
                    key={i}
                    className={`rounded-xl bg-[#0f1118] border border-zinc-800/60 border-l-2 ${SUGGESTION_BORDERS[i % 4]} transition-colors`}
                  >
                    {/* Collapsed header — always visible */}
                    <button
                      onClick={() => setExpandedIdx(expanded ? null : i)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#12131f] rounded-xl transition-colors"
                    >
                      <span className="flex-1 text-left font-semibold text-white text-sm">
                        {s.title}
                      </span>
                      <svg
                        className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
                        fill="none" stroke="currentColor" strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded body */}
                    {expanded && (
                      <div className="px-4 pb-4 flex flex-col gap-3">
                        <p className="text-zinc-400 text-xs leading-relaxed">
                          {s.thesis}
                        </p>
                        <span className="self-start inline-flex items-center font-mono text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                          {s.catalyst}
                        </span>
                        <button
                          onClick={() => mapSuggestion(s.thesis)}
                          disabled={loading}
                          className="self-start font-mono text-xs text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {loading ? "Mapping…" : "Map this thesis →"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
