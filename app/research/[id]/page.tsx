"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ThesisResult } from "@/lib/types";
import { TierGrid } from "@/components/TierGrid";
import { formatDate, generateTitle } from "@/lib/utils";

// ── Market cap parsing ─────────────────────────────────────────────────────

function parseMarketCapNum(cap: string): number | null {
  const s = cap.replace(/[~$,\s]/g, "");
  const m = s.match(/^([\d.]+)([KMBTkmbt]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mul: Record<string, number> = {
    k: 1e3, m: 1e6, b: 1e9, t: 1e12,
  };
  return n * (mul[m[2].toLowerCase()] ?? 1);
}

function fmtCapShort(n: number): string {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${Math.round(n / 1e6)}M`;
  return `$${Math.round(n / 1e3)}K`;
}

// ── Icons ──────────────────────────────────────────────────────────────────

function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

function IconRefresh({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function ResearchView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [thesisText, setThesisText] = useState("");
  const [thesisTitle, setThesisTitle] = useState("");
  const [mappedAt, setMappedAt] = useState("");
  const [editedThesis, setEditedThesis] = useState("");
  const [result, setResult] = useState<ThesisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [remapping, setRemapping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-expand textarea: collapse to 0 first so scrollHeight reflects true content height,
  // then grow to fit. min-height is enforced via inline style on the element.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0";
    el.style.height = el.scrollHeight + "px";
  }, [editedThesis]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [tRes, rRes] = await Promise.all([
        fetch(`/api/theses/${id}`),
        fetch(`/api/theses/${id}/results`),
      ]);

      if (!tRes.ok) {
        router.replace("/library");
        return;
      }

      const tData = await tRes.json();
      setThesisText(tData.thesis_text);
      setEditedThesis(tData.thesis_text);
      setThesisTitle(tData.title || generateTitle(tData.thesis_text));
      setMappedAt(tData.last_mapped_at);

      if (rRes.ok) {
        setResult(await rRes.json());
      }

      setLoading(false);
    }

    load();
  }, [id, router]);

  async function handleRemap() {
    const text = editedThesis.trim();
    if (!text) return;
    setRemapping(true);
    setError(null);

    const isUnchanged = text === thesisText.trim();

    try {
      const res = await fetch("/api/map-thesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          thesis: text,
          ...(isUnchanged ? { thesisId: Number(id) } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      if (isUnchanged) {
        setResult(data.result);
        setThesisTitle(data.title || generateTitle(text));
        setMappedAt(new Date().toISOString());
        setRemapping(false);
      } else {
        router.push(`/research/${data.thesisId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setRemapping(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/theses/${id}`, { method: "DELETE" });
    router.push("/library");
  }

  // ── Derived metrics ───────────────────────────────────────────────────────

  const totalCompanies = result ? Object.values(result).flat().length : 0;

  const bottleneckCount = result
    ? Object.values(result).flat().filter((c) => c.bottleneck).length
    : 0;

  const avgTier3Cap = (() => {
    if (!result?.tier3?.length) return null;
    const nums = result.tier3
      .map((c) => parseMarketCapNum(c.marketCap))
      .filter((n): n is number => n !== null);
    if (!nums.length) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  })();

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1.5 h-6 rounded-full bg-zinc-700 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className="font-mono text-xs text-zinc-600 tracking-widest uppercase">
          Loading…
        </p>
      </div>
    );
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Back nav */}
        <div className="mb-8">
          <Link
            href="/library"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors text-sm"
          >
            <IconArrowLeft />
            Library
          </Link>
        </div>

        {/* Thesis context */}
        <div className="mb-0 max-w-3xl">
          {thesisTitle && (
            <h1 className="text-white font-bold text-2xl tracking-tight mb-3">
              {thesisTitle}
            </h1>
          )}

          {/* Auto-expanding textarea with pencil hint */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={editedThesis}
              onChange={(e) => setEditedThesis(e.target.value)}
              style={{ minHeight: "80px", overflow: "hidden" }}
              className="w-full bg-[#0f0f17] border border-zinc-800 rounded-xl px-4 py-3 pr-8 text-zinc-300 resize-none focus:outline-none focus:border-zinc-600 text-sm leading-relaxed transition-colors"
            />
            <div className="absolute top-3 right-3 pointer-events-none text-zinc-700">
              <IconPencil />
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3 flex-wrap">
            <button
              onClick={handleRemap}
              disabled={remapping || !editedThesis.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              <IconRefresh className={remapping ? "animate-spin" : undefined} />
              {remapping ? "Mapping…" : "Re-map"}
            </button>

            <button
              onClick={handleDelete}
              className="ml-auto font-mono text-xs text-zinc-600 hover:text-red-400 transition-colors"
            >
              Delete thesis
            </button>

            {error && <p className="text-red-400 text-sm w-full">{error}</p>}
          </div>
        </div>

        {/* ── Chain Map divider ──────────────────────────────────────────── */}
        <div className="my-8 flex items-center gap-4">
          <span className="font-mono text-xs text-zinc-500 uppercase tracking-widest flex-shrink-0">
            Chain Map
          </span>
          <div className="flex-1 border-t border-zinc-700/70" />
        </div>

        {/* Remapping */}
        {remapping && (
          <div className="flex flex-col items-center justify-center py-24 gap-5">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-6 rounded-full bg-zinc-700 animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="font-mono text-xs text-zinc-600 tracking-widest uppercase">
              Mapping supply chain…
            </p>
          </div>
        )}

        {/* Summary bar + tier grid */}
        {result && !remapping && (
          <>
            {/* Summary bar */}
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <span className="font-mono text-xs text-zinc-400 tabular-nums">
                {totalCompanies} companies
              </span>

              {bottleneckCount > 0 && (
                <span className="font-mono text-xs text-amber-500 tabular-nums">
                  ⚡ {bottleneckCount} bottleneck
                  {bottleneckCount !== 1 ? "s" : ""} identified
                </span>
              )}

              {avgTier3Cap !== null && (
                <span className="font-mono text-xs text-purple-400 tabular-nums">
                  Avg Tier 3 cap: {fmtCapShort(avgTier3Cap)}
                </span>
              )}

              {mappedAt && (
                <span className="font-mono text-xs text-zinc-600">
                  Mapped {formatDate(mappedAt)}
                </span>
              )}
            </div>

            <TierGrid result={result} />
          </>
        )}
      </div>
    </div>
  );
}
