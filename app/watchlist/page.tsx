"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

interface WatchlistItem {
  id: number;
  title: string;
  thesis_text: string;
  catalyst: string;
  added_at: string;
}

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

export default function WatchlistPage() {
  const router = useRouter();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mappingId, setMappingId] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setItems(data); })
      .finally(() => setLoading(false));
  }, []);

  async function handleMap(item: WatchlistItem) {
    setMappingId(item.id);
    try {
      const res = await fetch("/api/map-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thesis: item.thesis_text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.push(`/research/${data.thesisId}`);
    } catch {
      setMappingId(null);
    }
  }

  async function handleDelete(id: number) {
    await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((w) => w.id !== id));
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Watchlist</h1>
            <p className="text-zinc-500 text-sm mt-1 font-mono">
              {loading ? "…" : `${items.length} saved`}
            </p>
          </div>
          <Link href="/">
            <button className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
              New thesis
            </button>
          </Link>
        </div>

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

        {/* Empty */}
        {!loading && items.length === 0 && (
          <div className="text-center py-24">
            <p className="text-zinc-500 text-sm mb-2">No saved theses yet</p>
            <p className="text-zinc-600 text-xs mb-6">
              Save interesting thesis suggestions from the home page to investigate later
            </p>
            <Link href="/">
              <button className="px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                Browse suggestions
              </button>
            </Link>
          </div>
        )}

        {/* Items */}
        {!loading && items.length > 0 && (
          <div className="grid gap-3">
            {items.map((item) => (
              <div key={item.id}
                className="rounded-2xl border border-zinc-800/50 bg-[#0c0c14] p-5 flex gap-4 items-start">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm mb-1.5">{item.title}</p>
                  <p className="text-zinc-500 text-xs leading-relaxed line-clamp-2 mb-3">
                    {item.thesis_text}
                  </p>
                  {item.catalyst && (
                    <span className="inline-flex items-center font-mono text-xs text-amber-500/80 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                      {item.catalyst}
                    </span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="font-mono text-xs text-zinc-600">{formatDate(item.added_at)}</span>
                  <button
                    onClick={() => handleMap(item)}
                    disabled={mappingId === item.id}
                    className="font-mono text-xs text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {mappingId === item.id ? "Mapping…" : "Map this thesis →"}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    title="Remove from watchlist"
                    className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-zinc-800/60 rounded-lg transition-colors"
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
