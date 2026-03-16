"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trend } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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

export default function Library() {
  const router = useRouter();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function fetchTrends() {
    try {
      const res = await fetch("/api/trends");
      if (res.ok) setTrends(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTrends();
  }, []);

  async function handleDelete(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    await fetch(`/api/trends/${id}`, { method: "DELETE" });
    setTrends((prev) => prev.filter((t) => t.id !== id));
  }

  const filtered = search.trim()
    ? trends.filter((t) => {
        const q = search.toLowerCase();
        return (
          t.title.toLowerCase().includes(q) ||
          t.thesis_text.toLowerCase().includes(q)
        );
      })
    : trends;

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Trend Library</h1>
            <p className="text-zinc-500 text-sm mt-1 font-mono">{trends.length} saved</p>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
              New trend
            </button>
          </Link>
        </div>

        {/* Search */}
        {trends.length > 0 && (
          <div className="mb-8">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trends..."
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
        {!loading && trends.length === 0 && (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-sm mb-4">No trends mapped yet</p>
            <Link href="/">
              <button className="px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                Map your first trend
              </button>
            </Link>
          </div>
        )}

        {/* No search results */}
        {!loading && trends.length > 0 && filtered.length === 0 && (
          <p className="text-zinc-500 text-sm text-center py-12 font-mono">
            No matches for &ldquo;{search}&rdquo;
          </p>
        )}

        {/* Trend grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => {
            return (
              <div
                key={t.id}
                onClick={() => router.push(`/trend/${t.id}`)}
                className="group relative rounded-2xl border border-zinc-800/50 bg-[#0c0c14] hover:border-zinc-700/60 cursor-pointer transition-all flex flex-col p-5"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h2 className="text-white font-semibold text-sm leading-snug">{t.title}</h2>
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
                <div className="border-t border-zinc-800 pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 font-mono text-xs text-zinc-600">
                      <span>{t.node_count ?? 0} nodes</span>
                      <span>·</span>
                      <span>{t.explored_count ?? 0} explored</span>
                      {(t.max_bottleneck ?? 0) > 0 && (
                        <>
                          <span>·</span>
                          <span className="text-amber-500">{t.max_bottleneck} max</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                      Open →
                    </span>
                  </div>
                  <p className="font-mono text-xs text-zinc-700 mt-1">
                    {formatDate(t.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
