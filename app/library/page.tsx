"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SavedThesis } from "@/lib/types";
import { formatDate, generateTitle } from "@/lib/utils";

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

const DOMINANT_STRIP = [
  "bg-zinc-600",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-purple-500",
] as const;

function getDominantTier(t: SavedThesis): number {
  const counts = [t.tier0_count, t.tier1_count, t.tier2_count, t.tier3_count];
  let best = 0;
  for (let i = 1; i < 4; i++) {
    if (counts[i] >= counts[best]) best = i;
  }
  return best;
}

export default function Library() {
  const router = useRouter();
  const [theses, setTheses] = useState<SavedThesis[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchTheses() {
    try {
      const res = await fetch("/api/theses");
      if (res.ok) setTheses(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTheses();
  }, []);

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await fetch(`/api/theses/${id}`, { method: "DELETE" });
    setTheses((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = search.trim()
    ? theses.filter((t) => {
        const q = search.toLowerCase();
        const title = (t.title || generateTitle(t.thesis_text)).toLowerCase();
        return title.includes(q) || t.thesis_text.toLowerCase().includes(q);
      })
    : theses;

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">My Theses</h1>
            <p className="text-zinc-500 text-sm mt-1 font-mono">{theses.length} saved</p>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
              New thesis
            </button>
          </Link>
        </div>

        {/* Search */}
        {theses.length > 0 && (
          <div className="mb-8">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search theses..."
              className="w-full max-w-sm bg-[#0f0f17] border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div key={i} className="w-1.5 h-4 rounded-full bg-zinc-800 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && theses.length === 0 && (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-sm mb-4">No theses saved yet</p>
            <Link href="/">
              <button className="px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                Map your first thesis
              </button>
            </Link>
          </div>
        )}

        {/* No search results */}
        {!loading && theses.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-12 font-mono">
            No matches for &ldquo;{search}&rdquo;
          </p>
        )}

        {/* Thesis grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            const displayTitle = t.title || generateTitle(t.thesis_text);
            const dominant = getDominantTier(t);
            const hiddenGems = t.tier2_count + t.tier3_count;

            return (
              <div
                key={t.id}
                onClick={() => router.push(`/research/${t.id}`)}
                className="group relative rounded-2xl border border-zinc-800/50 bg-[#0c0c14] hover:border-zinc-700/60 cursor-pointer transition-all flex overflow-hidden"
              >
                <div className={`w-1 flex-shrink-0 ${DOMINANT_STRIP[dominant]}`} />
                <div className="flex-1 p-5 flex flex-col min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h2 className="text-white font-semibold text-sm leading-snug">{displayTitle}</h2>
                    <button
                      onClick={(e) => handleDelete(e, t.id)}
                      title="Delete"
                      className="flex-shrink-0 p-1.5 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-zinc-800/60 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <IconTrash />
                    </button>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed line-clamp-3 flex-1 mb-4">
                    {t.thesis_text}
                  </p>
                  <div className="mt-auto space-y-2.5">
                    <div className="flex items-center gap-3">
                      {t.bottleneck_count > 0 && (
                        <span className="font-mono text-xs text-amber-500">
                          ⚡ {t.bottleneck_count} bottleneck{t.bottleneck_count !== 1 ? "s" : ""}
                        </span>
                      )}
                      {hiddenGems > 0 && (
                        <span className="font-mono text-xs text-emerald-600">
                          {hiddenGems} hidden gem{hiddenGems !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs text-zinc-600">{formatDate(t.last_mapped_at)}</span>
                      <span className="font-mono text-xs text-zinc-600">{t.company_count} co.</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
