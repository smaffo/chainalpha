import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "@/lib/supabase";
import type { NodeCompany } from "@/lib/types";

const client = new Anthropic();

// GET — return companies for an already-explored node from DB
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);
  if (isNaN(nodeId)) {
    return Response.json({ error: "Invalid node id" }, { status: 400 });
  }

  const { data: node, error: nodeErr } = await supabase
    .from("nodes")
    .select("explored, created_at")
    .eq("id", nodeId)
    .single();

  if (nodeErr || !node) {
    return Response.json({ error: "Node not found" }, { status: 404 });
  }

  if (!node.explored) {
    return Response.json({ explored: false, companies: [] });
  }

  const { data: rows, error } = await supabase
    .from("node_companies")
    .select(
      `id, company_id, chain_reasoning, companies ( name, ticker, country, description )`
    )
    .eq("node_id", nodeId);

  if (error) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  const companies: NodeCompany[] = (rows ?? []).map((r) => {
    const row = r as unknown as {
      id: number;
      company_id: number;
      chain_reasoning: string;
      companies: { name: string; ticker: string; country: string; description: string } | null;
    };
    return {
      id: row.id,
      company_id: row.company_id,
      name: row.companies?.name ?? "",
      ticker: row.companies?.ticker ?? "",
      country: row.companies?.country ?? "",
      description: row.companies?.description ?? "",
      chain_reasoning: row.chain_reasoning,
    };
  });

  return Response.json({
    explored: true,
    companies,
    exploredAt: node.created_at,
  });
}

// POST — run AI discovery, upsert companies, set explored = true
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const nodeId = parseInt(id, 10);
  if (isNaN(nodeId)) {
    return Response.json({ error: "Invalid node id" }, { status: 400 });
  }

  // Load node + trend context
  const { data: node, error: nodeErr } = await supabase
    .from("nodes")
    .select("*, trends ( thesis_text )")
    .eq("id", nodeId)
    .single();

  if (nodeErr || !node) {
    return Response.json({ error: "Node not found" }, { status: 404 });
  }

  const trendText = (node.trends as { thesis_text: string } | null)?.thesis_text ?? "";

  const systemPrompt = `You are a supply chain equity analyst. Given a supply chain node, identify 3-5 publicly traded companies that are significant players at that node.

For each company output:
- name: string (company full name)
- ticker: string (stock ticker, e.g. "FCX", "ALB")
- country: string (2-letter ISO country code, e.g. "US", "CN", "AU")
- description: string (1-2 sentences on what the company does at this node)
- chain_reasoning: string (1-2 sentences on why this company is relevant to the supply chain node)

Output ONLY a JSON array. No markdown, no explanation, no wrapper.

Rules:
- Only publicly traded companies with a real stock ticker
- 3-5 companies minimum, no more than 5
- Be specific — name the actual dominant players, not generic descriptions`;

  const userPrompt = `Investment trend: ${trendText}
Supply chain node: ${node.name} (${node.node_type}, position ${node.position})
Bottleneck context: ${node.bottleneck_reasoning}

Identify 3-5 publicly traded companies that are key players at this node.`;

  let rawContent = "";
  try {
    // Use web search for fresher company data (sequential, not parallel)
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        } as Parameters<typeof client.messages.create>[0]["tools"] extends Array<infer T> ? T : never,
      ],
    });

    // Extract final text block
    for (const block of message.content.reverse()) {
      if (block.type === "text") {
        rawContent = block.text.trim();
        break;
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI request failed";
    return Response.json({ error: msg }, { status: 502 });
  }

  let aiCompanies: Array<{
    name: string;
    ticker: string;
    country: string;
    description: string;
    chain_reasoning: string;
  }>;

  try {
    const cleaned = rawContent.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "");
    aiCompanies = JSON.parse(cleaned);
  } catch {
    return Response.json({ error: "Failed to parse company data — try again" }, { status: 422 });
  }

  if (!Array.isArray(aiCompanies) || aiCompanies.length < 3) {
    return Response.json({ error: "Not enough companies found — try again" }, { status: 422 });
  }

  // Delete existing node_companies for this node (refresh)
  await supabase.from("node_companies").delete().eq("node_id", nodeId);

  // Upsert companies by ticker
  const nodeCompanyRows: { node_id: number; company_id: number; chain_reasoning: string }[] = [];

  for (const c of aiCompanies) {
    if (!c.ticker || !c.name) continue;

    // Upsert company by ticker
    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("ticker", c.ticker.toUpperCase())
      .single();

    let companyId: number;
    if (existing) {
      companyId = existing.id;
      // Update description if changed
      await supabase
        .from("companies")
        .update({ name: c.name, country: c.country, description: c.description })
        .eq("id", companyId);
    } else {
      const { data: newComp, error: insertErr } = await supabase
        .from("companies")
        .insert({
          name: c.name,
          ticker: c.ticker.toUpperCase(),
          country: c.country,
          description: c.description,
        })
        .select("id")
        .single();
      if (insertErr || !newComp) continue;
      companyId = newComp.id;
    }

    nodeCompanyRows.push({
      node_id: nodeId,
      company_id: companyId,
      chain_reasoning: c.chain_reasoning,
    });
  }

  if (nodeCompanyRows.length === 0) {
    return Response.json({ error: "Failed to save companies — try again" }, { status: 500 });
  }

  const { data: insertedLinks, error: linkErr } = await supabase
    .from("node_companies")
    .insert(nodeCompanyRows)
    .select("id, company_id, chain_reasoning");

  if (linkErr || !insertedLinks) {
    return Response.json({ error: "Database error saving companies" }, { status: 500 });
  }

  // Mark node as explored
  await supabase.from("nodes").update({ explored: true }).eq("id", nodeId);

  // Build response with full company data
  const companyIds = insertedLinks.map((r: { company_id: number }) => r.company_id);
  const { data: companyRows } = await supabase
    .from("companies")
    .select("id, name, ticker, country, description")
    .in("id", companyIds);

  const companyMap = new Map(
    (companyRows ?? []).map((c: { id: number; name: string; ticker: string; country: string; description: string }) => [c.id, c])
  );

  const companies: NodeCompany[] = insertedLinks.map((link: { id: number; company_id: number; chain_reasoning: string }) => {
    const comp = companyMap.get(link.company_id);
    return {
      id: link.id,
      company_id: link.company_id,
      name: comp?.name ?? "",
      ticker: comp?.ticker ?? "",
      country: comp?.country ?? "",
      description: comp?.description ?? "",
      chain_reasoning: link.chain_reasoning,
    };
  });

  return Response.json({ companies });
}
