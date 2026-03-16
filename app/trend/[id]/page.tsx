"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { SupplyNode, Trend } from "@/lib/types";
import { NodeCard } from "@/components/NodeCard";
import { CompanySidebar } from "@/components/CompanySidebar";

export default function TrendPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [trend, setTrend] = useState<Trend | null>(null);
  const [nodes, setNodes] = useState<SupplyNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<SupplyNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/trends/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          router.replace("/library");
          return;
        }
        setTrend(data.trend);
        setNodes(data.nodes ?? []);
      })
      .catch(() => router.replace("/library"))
      .finally(() => setLoading(false));
  }, [id, router]);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/trends/${id}`, { method: "DELETE" }).catch(() => {});
    router.push("/library");
  }

  function handleNodeExplore(node: SupplyNode) {
    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-1.5 h-4 rounded-full bg-zinc-800 animate-pulse"
              style={{ animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!trend) return null;

  return (
    <>
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0d0d14] border border-zinc-700 rounded-2xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="font-semibold text-white text-sm">Delete this trend?</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This will permanently delete the supply chain and all discovered companies.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="font-mono text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 rounded-lg px-4 py-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="font-mono text-xs text-white bg-red-900/80 hover:bg-red-800 border border-red-700/50 rounded-lg px-4 py-2 transition-colors disabled:opacity-40"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div
        className={`min-h-screen transition-all duration-300 ${selectedNode ? "pr-96" : ""}`}
      >
        <div className="px-6 py-12">
          <div className="max-w-2xl mx-auto">

            {/* Back + actions */}
            <div className="flex items-center justify-between mb-8">
              <Link href="/library" className="flex items-center gap-1.5 font-mono text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
                Library
              </Link>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="font-mono text-xs text-zinc-600 hover:text-red-400 border border-zinc-800 hover:border-red-900/50 rounded-lg px-3 py-1.5 transition-colors"
              >
                Delete
              </button>
            </div>

            {/* Trend header */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white tracking-tight mb-2">
                {trend.title}
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed">{trend.thesis_text}</p>
              <p className="font-mono text-xs text-zinc-700 mt-3">
                {nodes.length} nodes · {nodes.filter((n) => n.explored).length} explored
              </p>
            </div>

            {/* Nodes */}
            {nodes.length === 0 && (
              <p className="font-mono text-xs text-zinc-600">No nodes found.</p>
            )}
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
        </div>
      </div>

      <CompanySidebar
        node={selectedNode}
        trendText={trend.thesis_text}
        onClose={() => setSelectedNode(null)}
      />
    </>
  );
}
