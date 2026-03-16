import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import { generateTitle } from "@/lib/utils";

const client = new Anthropic();

export async function POST(req: Request) {
  const { trend } = await req.json();
  if (!trend?.trim()) {
    return Response.json({ error: "Trend text required" }, { status: 400 });
  }

  const systemPrompt = `You are a supply chain analyst. Given an investment trend, map its industrial supply chain as a sequence of 5-7 nodes from raw materials to end product/service.

For each node output a JSON object with:
- name: string (concise node name, e.g. "Lithium Mining", "Battery Cell Manufacturing")
- node_type: one of "material" | "component" | "infrastructure" | "process" | "system"
- position: integer 1..N (1 = most upstream, N = most downstream)
- bottleneck_score: integer 0-100 (how much of a supply bottleneck this node represents — concentration, switching costs, scarcity)
- bottleneck_reasoning: string (1-2 sentences explaining the score)

Output ONLY a JSON array of node objects. No markdown, no explanation, no wrapper object.`;

  const userPrompt = `Investment trend: ${trend}`;

  let rawContent = "";
  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = message.content[0];
    if (block.type !== "text") {
      return Response.json({ error: "Unexpected response format" }, { status: 500 });
    }
    rawContent = block.text.trim();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  // Parse JSON
  let nodes: Array<{
    name: string;
    node_type: string;
    position: number;
    bottleneck_score: number;
    bottleneck_reasoning: string;
  }>;
  try {
    // Strip markdown fences if present
    const cleaned = rawContent.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    nodes = JSON.parse(cleaned);
  } catch {
    return Response.json(
      { error: "Could not map supply chain — try again" },
      { status: 422 }
    );
  }

  // Validate length
  if (!Array.isArray(nodes) || nodes.length < 5 || nodes.length > 7) {
    return Response.json(
      { error: "Could not map supply chain — try again" },
      { status: 422 }
    );
  }

  // Validate required fields
  const valid = nodes.every(
    (n) =>
      n.name &&
      ["material", "component", "infrastructure", "process", "system"].includes(n.node_type) &&
      typeof n.position === "number" &&
      typeof n.bottleneck_score === "number" &&
      n.bottleneck_reasoning
  );
  if (!valid) {
    return Response.json(
      { error: "Could not map supply chain — try again" },
      { status: 422 }
    );
  }

  // Persist to DB
  const title = generateTitle(trend);
  const { data: trendRow, error: trendErr } = await supabase
    .from("trends")
    .insert({ title, thesis_text: trend })
    .select("id")
    .single();

  if (trendErr || !trendRow) {
    return Response.json({ error: "Database error saving trend" }, { status: 500 });
  }

  const nodeRows = nodes.map((n) => ({
    trend_id: trendRow.id,
    name: n.name,
    node_type: n.node_type,
    position: n.position,
    bottleneck_score: n.bottleneck_score,
    bottleneck_reasoning: n.bottleneck_reasoning,
    explored: false,
  }));

  const { data: savedNodes, error: nodesErr } = await supabase
    .from("nodes")
    .insert(nodeRows)
    .select();

  if (nodesErr || !savedNodes) {
    return Response.json({ error: "Database error saving nodes" }, { status: 500 });
  }

  return Response.json({ trendId: trendRow.id, title, nodes: savedNodes });
}
