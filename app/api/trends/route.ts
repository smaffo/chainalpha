import { supabase } from "@/lib/supabase";
import type { Trend } from "@/lib/types";

export async function GET() {
  const { data: trends, error: trendsErr } = await supabase
    .from("trends")
    .select("id, title, thesis_text, created_at")
    .order("created_at", { ascending: false });

  if (trendsErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const { data: nodes, error: nodesErr } = await supabase
    .from("nodes")
    .select("trend_id, bottleneck_score, explored");

  if (nodesErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  // Join in JS
  const result: Trend[] = (trends ?? []).map((t: { id: number; title: string; thesis_text: string; created_at: string }) => {
    const trendNodes = (nodes ?? []).filter((n: { trend_id: number }) => n.trend_id === t.id);
    const explored = trendNodes.filter((n: { explored: boolean }) => n.explored).length;
    const maxBottleneck = trendNodes.reduce(
      (max: number, n: { bottleneck_score: number }) => Math.max(max, n.bottleneck_score ?? 0),
      0
    );
    return {
      ...t,
      node_count: trendNodes.length,
      explored_count: explored,
      max_bottleneck: maxBottleneck,
    };
  });

  return Response.json(result);
}
