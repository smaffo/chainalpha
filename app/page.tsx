"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SavedThesis } from "@/lib/types";

const EXAMPLE_THESES = [
  "AI infrastructure will require massive energy and cooling buildout through 2030",
  "Onshoring semiconductor manufacturing will drive US chip equipment demand",
  "The obesity drug boom will reshape food, medical devices, and insurance",
];

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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
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

        {/* Stats bar — accumulated intelligence */}
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

          {/* Example theses */}
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_THESES.map((ex) => (
              <button
                key={ex}
                onClick={() => setThesis(ex)}
                className="font-mono text-xs text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 rounded-full px-3 py-1 transition-colors"
              >
                {ex.length > 52 ? ex.slice(0, 52) + "…" : ex}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center gap-4 flex-wrap">
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
        </div>
      </div>
    </main>
  );
}
