import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Company, ThesisResult } from "@/lib/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 90_000,
  maxRetries: 2,
});

// ── Stage 1 system prompt ────────────────────────────────────────────────────

const STAGE1_SYSTEM = `You are a structural supply chain analyst. Given an investment thesis, map the full industrial value chain as a hierarchy of functional NODES organized by tier. Do NOT list specific companies. Only list supply chain roles/categories.

Define four structural tiers:
- Tier 0 — End demand creators: Companies generating the final demand that drives this thesis
- Tier 1 — System integrators / platform providers: Companies assembling or delivering the primary solutions
- Tier 2 — Critical component suppliers: Companies providing essential parts, subsystems, or enabling technologies
- Tier 3 — Raw materials / enabling infrastructure: Upstream inputs, specialty materials, niche equipment, foundational services

Rules:
- Generate 3-5 nodes per tier
- Each node should be a specific supply chain function, not a vague category (Good: 'Grain-oriented electrical steel for transformer cores' Bad: 'Materials')
- Nodes should trace a logical chain — each tier feeds into the tier above it
- Think globally, not just US-centric
- For each node provide a 1-sentence description of what this supply chain role does and why it matters to the thesis

Also generate a short 3-5 word title that captures the core theme (e.g. "AI Infrastructure Buildout"). Title-cased noun phrase, no punctuation.

Return ONLY a JSON object, no markdown, no backticks:
{
  "title": "Short Thesis Title",
  "tiers": [
    {
      "tier": 0,
      "nodes": [
        { "name": "Hyperscale Cloud Providers", "description": "Companies operating massive data center fleets driving AI compute demand" }
      ]
    },
    { "tier": 1, "nodes": [...] },
    { "tier": 2, "nodes": [...] },
    { "tier": 3, "nodes": [...] }
  ]
}`;

// ── Stage 2 system prompt (per node) ────────────────────────────────────────

function stage2System(nodeName: string, nodeDesc: string, thesisText: string): string {
  return `You are a financial research analyst specializing in public equity identification. List publicly traded companies that operate in the following supply chain category:

NODE: ${nodeName}
ROLE: ${nodeDesc}
THESIS CONTEXT: ${thesisText}

Rules:
1. ONLY list companies traded on major exchanges (NYSE, NASDAQ, LSE, Frankfurt, Tokyo, Hong Kong, Euronext)
2. Use CANONICAL COMPANY IDENTITY — not ticker symbols. Merge listings that represent the same company (e.g., ADR vs primary listing). Output each company with its PRIMARY listing ticker only. Example: Siemens AG uses SIE.DE (not SIEGY)
3. Identify STRUCTURAL BOTTLENECKS defined as:
   - Limited number of suppliers (3 or fewer globally)
   - High switching costs for customers
   - Regulatory or technological barriers to entry
   - Capacity constraints that cannot be resolved in under 2 years
   - Critical input required by multiple downstream industries
   Flag bottleneck as true ONLY if the company meets at least 2 of these criteria
4. Provide 1-2 sentences of chain_reasoning explaining specifically HOW this company connects to this supply chain node and WHY it matters to the thesis
5. List 3-5 companies per node. Prioritize companies whose products are required by multiple downstream industries — these represent cross-thesis structural importance
6. Include approximate market cap and analyst coverage level (heavy: 10+ analysts, moderate: 4-9, light: 1-3, minimal: 0)
7. Do not include a company unless it has genuine, specific exposure to this node. No narrative association — only structural exposure

Return ONLY a JSON array, no markdown, no backticks:
[
  {
    "company_name": "Flowserve Corporation",
    "ticker": "FLS",
    "market_cap": "~$6B",
    "analyst_coverage": "moderate",
    "bottleneck": false,
    "chain_reasoning": "Leading manufacturer of industrial pumps and flow control equipment used in data center cooling loops. Supplies to all major cooling system integrators.",
    "description": "Designs and manufactures precision pumps, valves, and seals for critical flow applications across energy, water, and industrial markets."
  }
]`;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface StructureNode {
  name: string;
  description: string;
}

interface ChainStructure {
  title: string;
  tiers: Array<{
    tier: number;
    nodes: StructureNode[];
  }>;
}

interface RawCompany {
  company_name: string;
  ticker: string;
  market_cap: string;
  analyst_coverage: string;
  bottleneck: boolean;
  chain_reasoning: string;
  description: string;
}

interface EnrichedCompany {
  name: string;
  ticker: string;
  marketCap: string;
  description: string;
  chain_reasoning: string;
  bottleneck: boolean;
  analyst_coverage: string;
  alphaScore: string;
  supply_chain_node: string;
  tier: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseJsonObject(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  throw new SyntaxError("No valid JSON object found");
}

function parseJsonArray(text: string): unknown[] {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    try {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  return [];
}

const COVERAGE_ADJ: Record<string, number> = { minimal: 2, light: 1, moderate: 0, heavy: -1 };
const TIER_BASE = [2, 4, 6, 8];

function calcAlphaScore(tier: number, coverage: string, bottleneck: boolean): number {
  const base = TIER_BASE[tier] ?? 2;
  const adj = COVERAGE_ADJ[coverage] ?? 0;
  return Math.max(1, Math.min(10, base + adj + (bottleneck ? 2 : 0)));
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

function deduplicateCompanies(companies: EnrichedCompany[]): EnrichedCompany[] {
  // Across tiers: keep the highest tier for the same company name
  const byName = new Map<string, EnrichedCompany>();
  for (const c of companies) {
    const key = normalizeName(c.name);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, c);
    } else if (c.tier > existing.tier) {
      byName.set(key, c);
    } else if (c.tier === existing.tier && c.bottleneck && !existing.bottleneck) {
      byName.set(key, c);
    }
  }

  // Within same tier: also deduplicate by ticker
  const byTicker = new Map<string, EnrichedCompany>();
  for (const c of byName.values()) {
    const key = `${c.tier}:${c.ticker.toUpperCase()}`;
    const existing = byTicker.get(key);
    if (!existing || (c.bottleneck && !existing.bottleneck)) {
      byTicker.set(key, c);
    }
  }

  return Array.from(byTicker.values());
}

// ── Database ─────────────────────────────────────────────────────────────────

const TIER_KEYS = ["tier0", "tier1", "tier2", "tier3"] as const;

async function persistResult(
  thesisText: string,
  result: ThesisResult,
  title: string,
  existingThesisId?: number
): Promise<number> {
  let thesisId: number;

  if (existingThesisId) {
    await supabase
      .from("theses")
      .update({ last_mapped_at: new Date().toISOString(), title })
      .eq("id", existingThesisId);
    await supabase.from("chain_results").delete().eq("thesis_id", existingThesisId);
    thesisId = existingThesisId;
  } else {
    const { data, error } = await supabase
      .from("theses")
      .insert({ thesis_text: thesisText, title })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Failed to insert thesis");
    thesisId = data.id;
  }

  const rows = [];
  for (const key of TIER_KEYS) {
    for (const c of result[key] ?? []) {
      rows.push({
        thesis_id: thesisId,
        tier: Number(key.replace("tier", "")),
        company_name: c.name,
        ticker: c.ticker,
        market_cap: c.marketCap,
        description: c.description,
        chain_reasoning: c.chain_reasoning,
        bottleneck: c.bottleneck,
        analyst_coverage: c.analyst_coverage,
        alpha_score: c.alphaScore,
        supply_chain_node: c.supply_chain_node ?? null,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("chain_results").insert(rows);
  }

  return thesisId;
}

// ── Error handling ────────────────────────────────────────────────────────────

function apiErrorMessage(err: unknown): string | null {
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return "This is taking longer than expected — please try again";
  }
  if (err instanceof Anthropic.APIError) {
    if (err.status === 401 || err.status === 403) {
      return "API credits may be exhausted. Check console.anthropic.com to add credits.";
    }
    if (err.status === 429 || (err.status && err.status >= 500)) {
      return "Mapping failed — please try again in a moment";
    }
  }
  return null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { thesis, thesisId } = await request.json();

    if (!thesis?.trim()) {
      return NextResponse.json({ error: "Thesis is required" }, { status: 400 });
    }

    const thesisText = thesis.trim();

    // ── Stage 1: structural chain map ───────────────────────────────────────
    const s1Response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: STAGE1_SYSTEM,
      messages: [{ role: "user", content: `Thesis: ${thesisText}` }],
    });

    const s1Content = s1Response.content[0];
    if (s1Content.type !== "text") {
      return NextResponse.json({ error: "Mapping failed — please try again in a moment" }, { status: 500 });
    }

    let structure: ChainStructure;
    try {
      structure = parseJsonObject(s1Content.text) as ChainStructure;
    } catch {
      console.error("map-thesis stage1: JSON parse failed. Raw:", s1Content.text.slice(0, 300));
      return NextResponse.json({ error: "Mapping failed — please try again in a moment" }, { status: 500 });
    }

    // ── Stage 2: populate companies for each node in parallel ───────────────
    const nodeJobs: Array<{ tier: number; node: StructureNode }> = [];
    for (const tierData of structure.tiers ?? []) {
      for (const node of tierData.nodes ?? []) {
        nodeJobs.push({ tier: tierData.tier, node });
      }
    }

    const nodeResults = await Promise.all(
      nodeJobs.map(async ({ tier, node }) => {
        try {
          const res = await client.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 1024,
            system: stage2System(node.name, node.description, thesisText),
            messages: [{ role: "user", content: "List the companies." }],
          });
          const content = res.content[0];
          if (content.type !== "text") return [];
          const raw = parseJsonArray(content.text) as RawCompany[];
          return raw.map((c): EnrichedCompany => ({
            name: c.company_name,
            ticker: c.ticker,
            marketCap: c.market_cap,
            description: c.description,
            chain_reasoning: c.chain_reasoning,
            bottleneck: Boolean(c.bottleneck),
            analyst_coverage: c.analyst_coverage ?? "moderate",
            alphaScore: String(calcAlphaScore(
              tier,
              c.analyst_coverage ?? "moderate",
              Boolean(c.bottleneck)
            )),
            supply_chain_node: node.name,
            tier,
          }));
        } catch (err) {
          console.error(`map-thesis stage2: node "${node.name}" failed:`, err);
          return [];
        }
      })
    );

    // ── Combine and deduplicate ──────────────────────────────────────────────
    const allCompanies = nodeResults.flat();
    const deduplicated = deduplicateCompanies(allCompanies);

    const result: ThesisResult = { tier0: [], tier1: [], tier2: [], tier3: [] };
    for (const c of deduplicated) {
      const key = `tier${c.tier}` as keyof ThesisResult;
      if (key in result) {
        result[key].push({
          name: c.name,
          ticker: c.ticker,
          marketCap: c.marketCap,
          description: c.description,
          chain_reasoning: c.chain_reasoning,
          bottleneck: c.bottleneck,
          analyst_coverage: c.analyst_coverage as Company["analyst_coverage"],
          alphaScore: c.alphaScore,
          supply_chain_node: c.supply_chain_node,
        });
      }
    }

    const title = structure.title ?? "";
    const savedThesisId = await persistResult(thesisText, result, title, thesisId);

    return NextResponse.json({ result, thesisId: savedThesisId, title });
  } catch (err) {
    console.error("map-thesis error:", err);
    const msg = apiErrorMessage(err);
    return NextResponse.json(
      { error: msg ?? "Mapping failed — please try again in a moment" },
      { status: 500 }
    );
  }
}
