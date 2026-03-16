import { supabase } from "@/lib/supabase";

interface BottleneckNode {
  id: number;
  name: string;
  node_type: string;
  position: number;
  bottleneck_score: number;
  bottleneck_reasoning: string;
  explored: boolean;
  trend_id: number;
  trend_title: string;
  created_at: string;
}

export async function GET() {
  const { data: nodes, error: nodesErr } = await supabase
    .from("nodes")
    .select("id, name, node_type, position, bottleneck_score, bottleneck_reasoning, explored, trend_id, created_at")
    .order("bottleneck_score", { ascending: false });

  if (nodesErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  if (!nodes || nodes.length === 0) {
    return Response.json([]);
  }

  const trendIds = [...new Set(nodes.map((n: { trend_id: number }) => n.trend_id))];
  const { data: trends, error: trendsErr } = await supabase
    .from("trends")
    .select("id, title")
    .in("id", trendIds);

  if (trendsErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const trendMap = new Map(
    (trends ?? []).map((t: { id: number; title: string }) => [t.id, t.title])
  );

  const result: BottleneckNode[] = nodes.map((n: {
    id: number;
    name: string;
    node_type: string;
    position: number;
    bottleneck_score: number;
    bottleneck_reasoning: string;
    explored: boolean;
    trend_id: number;
    created_at: string;
  }) => ({
    ...n,
    trend_title: trendMap.get(n.trend_id) ?? "Unknown",
  }));

  return Response.json(result);
}
