"use client";

import type { SupplyNode, NodeType } from "@/lib/types";

const NODE_TYPE_STYLES: Record<NodeType, { badge: string; bar: string }> = {
  material: { badge: "bg-amber-500/20 text-amber-300 border-amber-500/30", bar: "bg-amber-500" },
  component: { badge: "bg-sky-500/20 text-sky-300 border-sky-500/30", bar: "bg-sky-500" },
  infrastructure: { badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", bar: "bg-emerald-500" },
  process: { badge: "bg-purple-500/20 text-purple-300 border-purple-500/30", bar: "bg-purple-500" },
  system: { badge: "bg-zinc-500/20 text-zinc-300 border-zinc-500/30", bar: "bg-zinc-500" },
};

interface NodeCardProps {
  node: SupplyNode;
  onExplore: (node: SupplyNode) => void;
  isSelected: boolean;
}

export function NodeCard({ node, onExplore, isSelected }: NodeCardProps) {
  const styles = NODE_TYPE_STYLES[node.node_type];
  const barWidth = `${node.bottleneck_score}%`;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors cursor-pointer ${
        isSelected
          ? "border-zinc-500 bg-zinc-800/60"
          : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-900/60"
      }`}
      onClick={() => onExplore(node)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="font-mono text-xs text-zinc-600 flex-shrink-0 w-5 text-right">
            {node.position}
          </span>
          <span className="font-semibold text-sm text-zinc-100 truncate">{node.name}</span>
        </div>
        <span
          className={`flex-shrink-0 font-mono text-xs px-2 py-0.5 rounded-full border ${styles.badge}`}
        >
          {node.node_type}
        </span>
      </div>

      <div className="mt-3 ml-8 space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${styles.bar}`}
              style={{ width: barWidth }}
            />
          </div>
          <span className="font-mono text-xs text-zinc-500 flex-shrink-0">
            Bottleneck {node.bottleneck_score}/100
          </span>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
          {node.bottleneck_reasoning}
        </p>

        <div className="flex justify-end pt-1">
          {node.explored ? (
            <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Explored
            </span>
          ) : (
            <span className="font-mono text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
              Explore →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
