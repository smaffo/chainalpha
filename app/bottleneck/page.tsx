"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SupplyNode, NodeType } from "@/lib/types";
import { CompanySidebar } from "@/components/CompanySidebar";

interface BottleneckNode extends SupplyNode {
  trend_title: string;
}

const NODE_TYPE_BADGE: Record<NodeType, string> = {
  material: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  component: "text-sky-300 bg-sky-500/10 border-sky-500/20",
  infrastructure: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
  process: "text-purple-300 bg-purple-500/10 border-purple-500/20",
  system: "text-zinc-300 bg-zinc-500/10 border-zinc-500/20",
};

const SCORE_COLOR = (score: number) => {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-amber-400";
  if (score >= 40) return "text-yellow-500";
  return "text-zinc-400";
};

export default function Bottleneck() {
  const [nodes, setNodes] = useState<BottleneckNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [trendFilter, setTrendFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);

  useEffect(() => {
    fetch("/api/bottleneck")
      .then((r) => r.json())
      .then((data) => {
        setNodes(Array.isArray(data) ? data : []);
      })
      .catch(() => setNodes([]))
      .finally(() => setLoading(false));
  }, []);

  const trendOptions = ["all", ...Array.from(new Set(nodes.map((n) => n.trend_title)))];
  const typeOptions: string[] = [
    "all",
    ...Array.from(new Set(nodes.map((n) => n.node_type))),
  ];

  const filtered = nodes
    .filter((n) => trendFilter === "all" || n.trend_title === trendFilter)
    .filter((n) => typeFilter === "all" || n.node_type === typeFilter);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-1.5 h-6 rounded-full bg-zinc-800 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={`min-h-screen transition-all duration-300 ${selectedNode ? "pr-96" : ""}`}>
        <div className="px-6 py-12">
          <div className="max-w-5xl mx-auto">

            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight font-mono uppercase">
                Bottleneck Nodes
              </h1>
              <p className="text-zinc-500 text-sm mt-1">
                Supply chain nodes ranked by bottleneck concentration score
              </p>
            </div>

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="flex flex-col items-center justify-center py-32 gap-4 text-center">
                <p className="text-zinc-400 text-sm font-semibold">No nodes yet</p>
                <p className="text-zinc-600 text-sm max-w-md">
                  Map a trend to discover supply chain bottlenecks.
                </p>
                <Link href="/">
                  <button className="mt-4 px-5 py-2.5 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-100 transition-all">
                    Map a trend
                  </button>
                </Link>
              </div>
            )}

            {/* Filters */}
            {nodes.length > 0 && (
              <div className="mb-6 flex items-center gap-4 flex-wrap">
                <select
                  value={trendFilter}
                  onChange={(e) => setTrendFilter(e.target.value)}
                  className="bg-[#0f0f17] border border-zinc-800 rounded-lg px-3 py-1.5 font-mono text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  {trendOptions.map((t) => (
                    <option key={t} value={t}>{t === "all" ? "All trends" : t}</option>
                  ))}
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#0f0f17] border border-zinc-800 rounded-lg px-3 py-1.5 font-mono text-xs text-zinc-400 focus:outline-none focus:border-zinc-600 transition-colors"
                >
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>{t === "all" ? "All types" : t}</option>
                  ))}
                </select>
                <span className="font-mono text-xs text-zinc-600">
                  {filtered.length} node{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
            )}

            {/* Table */}
            {filtered.length > 0 && (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_1fr_80px] gap-0 border-b border-zinc-800 px-5 py-2.5 bg-[#0a0a10]">
                  {["NODE", "TYPE", "TREND", "SCORE"].map((h) => (
                    <span key={h} className="font-mono text-xs text-zinc-600 uppercase tracking-widest">
                      {h}
                    </span>
                  ))}
                </div>
                {filtered.map((node, idx) => (
                  <div
                    key={node.id}
                    onClick={() => setSelectedNode((prev) => prev?.id === node.id ? null : node)}
                    className={`grid grid-cols-[1fr_120px_1fr_80px] gap-0 px-5 py-3.5 cursor-pointer transition-colors ${
                      selectedNode?.id === node.id
                        ? "bg-zinc-800/60"
                        : idx % 2 === 0
                        ? "bg-[#0c0c14] hover:bg-zinc-900/60"
                        : "bg-[#0a0a10] hover:bg-zinc-900/60"
                    } ${idx !== filtered.length - 1 ? "border-b border-zinc-800/70" : ""}`}
                  >
                    <div className="min-w-0 pr-4">
                      <div className="font-semibold text-sm text-zinc-100 truncate">{node.name}</div>
                      {node.explored && (
                        <div className="font-mono text-xs text-emerald-500 mt-0.5">● explored</div>
                      )}
                    </div>
                    <div>
                      <span className={`inline-block font-mono text-xs px-2 py-0.5 rounded-full border ${NODE_TYPE_BADGE[node.node_type as NodeType] ?? NODE_TYPE_BADGE.system}`}>
                        {node.node_type}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-zinc-500 truncate pr-4 self-center">
                      {node.trend_title}
                    </div>
                    <div className={`font-mono text-sm font-bold tabular-nums self-center ${SCORE_COLOR(node.bottleneck_score)}`}>
                      {node.bottleneck_score}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <CompanySidebar
        node={selectedNode}
        trendText=""
        onClose={() => setSelectedNode(null)}
        readonly
      />
    </>
  );
}
