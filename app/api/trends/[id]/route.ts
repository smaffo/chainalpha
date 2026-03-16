import { supabase } from "@/lib/supabase";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trendId = parseInt(id, 10);
  if (isNaN(trendId)) {
    return Response.json({ error: "Invalid trend id" }, { status: 400 });
  }

  const { data: trend, error: trendErr } = await supabase
    .from("trends")
    .select("id, title, thesis_text, created_at")
    .eq("id", trendId)
    .single();

  if (trendErr || !trend) {
    return Response.json({ error: "Trend not found" }, { status: 404 });
  }

  const { data: nodes, error: nodesErr } = await supabase
    .from("nodes")
    .select("id, trend_id, name, node_type, position, bottleneck_score, bottleneck_reasoning, explored, created_at")
    .eq("trend_id", trendId)
    .order("position", { ascending: true });

  if (nodesErr) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  return Response.json({ trend, nodes: nodes ?? [] });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trendId = parseInt(id, 10);
  if (isNaN(trendId)) {
    return Response.json({ error: "Invalid trend id" }, { status: 400 });
  }

  const { error } = await supabase.from("trends").delete().eq("id", trendId);
  if (error) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
