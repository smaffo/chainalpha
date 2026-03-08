import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { Company, ThesisResult } from "@/lib/types";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 150_000,
  maxRetries: 2,
});

// ── Stage 1: structural chain map ────────────────────────────────────────────

const STAGE1_SYSTEM = `You are a structural supply chain analyst. Given an investment thesis, map the full industrial value chain as a hierarchy of functional NODES organized by tier. Do NOT list specific companies. Only list supply chain roles/categories.

Define four structural tiers:
- Tier 0 — End demand creators: Companies generating the final demand that drives this thesis
- Tier 1 — System integrators / platform providers: Companies assembling or delivering the primary solutions
- Tier 2 — Critical component suppliers: Companies providing essential parts, subsystems, or enabling technologies
- Tier 3 — Raw materials / enabling infrastructure: Upstream inputs, specialty materials, niche equipment, foundational services

Rules:
- Generate exactly this many nodes per tier: Tier 0: 2 nodes (the primary demand drivers that everyone knows), Tier 1: 2 nodes, Tier 2: 3 nodes, Tier 3: 3 nodes. Total: 10 nodes.
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

// ── Step 2A: web search for candidates ───────────────────────────────────────

const STEP2A_SYSTEM = `You are a financial research assistant. Your ONLY job is to search the web and find publicly traded companies that operate in a specific supply chain category. Search thoroughly and cast a wide net.

Rules:
- Search for companies using multiple relevant queries
- ONLY include companies that are currently publicly traded on major exchanges (NYSE, NASDAQ, LSE, Frankfurt, Tokyo, Hong Kong, Euronext, ASX)
- Verify each company is real and currently trading (not acquired, not delisted, not private)
- Use the company's PRIMARY listing ticker and canonical name
- Include approximate current market cap

Return ONLY a JSON array of candidates, no other text, no markdown:
[
  { "company_name": "Full Name", "ticker": "PRIMARY.EXCHANGE", "market_cap": "~$XB" }
]

Find 8-12 candidate companies. Cast a wide net — include both well-known and obscure names.`;

// ── Step 2B: validate and rank ────────────────────────────────────────────────

const STEP2B_SYSTEM = `You are an investment research analyst specializing in supply chain analysis. You will receive a list of candidate companies found via web search for a specific supply chain node, within the context of an investment thesis.

Your job is to:
1. VALIDATE: Remove any company that doesn't have genuine, specific structural exposure to this supply chain node. No narrative association — only companies with real revenue tied to this function.
2. RANK: Order remaining companies by structural importance to this node — companies with higher revenue concentration in this specific function rank higher.
3. SELECT: Pick the top 2-3 companies that best represent this supply chain node.
4. ANALYZE each selected company:
   - chain_reasoning: 1-2 sentences explaining HOW this company specifically connects to this node
   - description: 1-2 sentences about what the company does
   - analyst_coverage: heavy (10+ analysts), moderate (4-9), light (1-3), minimal (0)
   - bottleneck: true ONLY if the company is one of 3 or fewer global suppliers for this function AND customers cannot switch without 12+ months of requalification. Most companies are NOT bottlenecks.

TIER PLACEMENT RULES based on the tier of the parent node:
- Tier 0: These are context companies. Keep the most recognizable mega-caps.
- Tier 1: Well-known but not household names. Market cap typically $10B-$200B.
- Tier 2: Under-followed enablers. Prioritize companies with moderate or light coverage.
- Tier 3: Deep upstream hidden gems. MUST be under $5B market cap. Prioritize companies with light or minimal coverage. A $60B company is NEVER Tier 3.

Return ONLY a JSON array, no markdown:
[
  {
    "company_name": "Full Name",
    "ticker": "PRIMARY.EXCHANGE",
    "market_cap": "~$XB",
    "analyst_coverage": "moderate",
    "bottleneck": false,
    "chain_reasoning": "Specific explanation of structural connection",
    "description": "What the company does"
  }
]`;

// ── Fallback: memory-based approach (when 2A fails) ───────────────────────────

function fallbackSystem(nodeName: string, nodeDesc: string, thesisText: string, tier: number): string {
  const countInstruction = tier === 0
    ? "List 2-3 companies maximum. For Tier 0: These MUST be the most recognizable, largest companies driving this thesis. The user should look at Tier 0 and immediately understand what the thesis is about. For an AI thesis, that means NVIDIA, Amazon, Microsoft etc. Do NOT try to be creative or obscure in Tier 0 — this tier is context, not discovery."
    : "List exactly 2 companies. No more.";
  return `You are a financial research analyst specializing in public equity identification. List publicly traded companies that operate in the following supply chain category:

NODE: ${nodeName}
ROLE: ${nodeDesc}
THESIS CONTEXT: ${thesisText}

Rules:
1. ONLY list companies traded on major exchanges (NYSE, NASDAQ, LSE, Frankfurt, Tokyo, Hong Kong, Euronext)
2. Use CANONICAL COMPANY IDENTITY — not ticker symbols. Output each company with its PRIMARY listing ticker only.
3. BOTTLENECK FLAG — use this sparingly. Flag bottleneck = true ONLY for companies that are genuinely irreplaceable:
   - One of 3 or fewer global suppliers AND customers cannot switch without 12+ months of requalification
   - OR controls a scarce natural resource with no synthetic substitute
   Most companies are NOT bottlenecks.
4. Provide 1-2 sentences of chain_reasoning explaining HOW this company connects to this node.
5. ${countInstruction}
6. Include approximate market cap and analyst coverage level (heavy: 10+ analysts, moderate: 4-9, light: 1-3, minimal: 0)
7. TIER 3 SIZE CONSTRAINT: Tier 3 companies must be under $2B market cap. A $60B conglomerate is NEVER Tier 3.
8. IMPORTANT: Tier placement reflects INVESTMENT DISCOVERY VALUE, not just supply chain position.

Return ONLY a JSON array, no markdown, no backticks:
[
  {
    "company_name": "Full Name",
    "ticker": "TICK",
    "market_cap": "~$6B",
    "analyst_coverage": "moderate",
    "bottleneck": false,
    "chain_reasoning": "...",
    "description": "..."
  }
]`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

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

interface CandidateCompany {
  company_name: string;
  ticker: string;
  market_cap: string;
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// Handles text blocks from responses that may include web_search result blocks
function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n");
}

const COVERAGE_ADJ: Record<string, number> = { minimal: 2, light: 1, moderate: 0, heavy: -1 };
const TIER_BASE = [2, 4, 6, 8];

function calcAlphaScore(tier: number, coverage: string, bottleneck: boolean): number {
  const base = TIER_BASE[tier] ?? 2;
  const adj = COVERAGE_ADJ[coverage] ?? 0;
  return Math.max(1, Math.min(10, base + adj + (bottleneck ? 2 : 0)));
}

function parseMarketCapNum(cap: string): number | null {
  const s = cap.replace(/[~$,\s]/g, "");
  const m = s.match(/^([\d.]+)([KMBTkmbt]?)$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mul: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  return n * (mul[m[2].toLowerCase()] ?? 1);
}

function enforceTierFloor(c: EnrichedCompany): EnrichedCompany {
  const cap = parseMarketCapNum(c.marketCap);
  const heavy = c.analyst_coverage === "heavy";
  let maxTier = 3;

  if (cap !== null && cap > 100e9) maxTier = Math.min(maxTier, 1);
  else if (cap !== null && cap > 30e9) maxTier = Math.min(maxTier, 2);

  if (heavy) maxTier = Math.min(maxTier, 2);
  if (heavy && cap !== null && cap > 50e9) maxTier = Math.min(maxTier, 1);

  // Tier 3 size constraint: >$5B → Tier 2; Tier 2: >$50B → Tier 1
  if (c.tier === 3 && cap !== null && cap > 5e9) maxTier = Math.min(maxTier, 2);
  if (c.tier === 2 && cap !== null && cap > 50e9) maxTier = Math.min(maxTier, 1);

  return c.tier <= maxTier ? c : { ...c, tier: maxTier };
}

const PRIVATE_TICKER_RE = /private|not publicly traded|n\/a|not listed|unlisted/i;
const PRIVATE_NAME_RE = /\(private|\bnot investable\b/i;
const ACQUIRED_RE = /\bacquired\b|\bdelisted\b/i;

function isPubliclyTraded(c: EnrichedCompany): boolean {
  return (
    !PRIVATE_TICKER_RE.test(c.ticker) &&
    !PRIVATE_NAME_RE.test(c.name) &&
    !ACQUIRED_RE.test(`${c.name} ${c.description} ${c.chain_reasoning}`)
  );
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

function toEnriched(raw: RawCompany[], tier: number, nodeName: string): EnrichedCompany[] {
  return raw.map((c): EnrichedCompany => ({
    name: c.company_name,
    ticker: c.ticker,
    marketCap: c.market_cap,
    description: c.description,
    chain_reasoning: c.chain_reasoning,
    bottleneck: Boolean(c.bottleneck),
    analyst_coverage: c.analyst_coverage ?? "moderate",
    alphaScore: String(calcAlphaScore(tier, c.analyst_coverage ?? "moderate", Boolean(c.bottleneck))),
    supply_chain_node: nodeName,
    tier,
  }));
}

// ── Node processing (2A → 2B with fallback) ───────────────────────────────────

async function processNode(tier: number, node: StructureNode, thesisText: string): Promise<EnrichedCompany[]> {
  // Step 2A: web search for candidates
  let candidates: CandidateCompany[] = [];
  try {
    const res2A = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: STEP2A_SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search" }] as any,
      messages: [{
        role: "user",
        content: `Search the web for publicly traded companies operating in: ${node.name} — ${node.description}. Find companies across all major global exchanges. Include both large established players and small under-followed specialists.`,
      }],
    });
    const text2A = extractText(res2A.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonArray(text2A);
    if (parsed.length > 0) {
      candidates = parsed as CandidateCompany[];
    }
  } catch (err) {
    console.error(`map-thesis step2A: node "${node.name}" search failed:`, err);
  }

  // If 2A yielded no candidates, fall back to memory-based generation
  if (candidates.length === 0) {
    console.warn(`map-thesis step2A: no candidates for "${node.name}", using fallback`);
    try {
      const res = await client.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1024,
        system: fallbackSystem(node.name, node.description, thesisText, tier),
        messages: [{ role: "user", content: "List the companies." }],
      });
      const content = res.content[0];
      if (content.type !== "text") return [];
      return toEnriched(parseJsonArray(content.text) as RawCompany[], tier, node.name);
    } catch (err) {
      console.error(`map-thesis fallback: node "${node.name}" failed:`, err);
      return [];
    }
  }

  // Step 2B: validate, rank, and analyze candidates
  try {
    const res2B = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: STEP2B_SYSTEM,
      messages: [{
        role: "user",
        content: `Thesis: ${thesisText}
Supply chain node: ${node.name} — ${node.description}
Tier: ${tier}

Candidate companies found via web search:
${JSON.stringify(candidates, null, 2)}

Validate, rank, and select the top 2-3 companies. Apply the tier placement rules strictly.`,
      }],
    });
    const content2B = res2B.content[0];
    if (content2B.type !== "text") return [];
    return toEnriched(parseJsonArray(content2B.text) as RawCompany[], tier, node.name);
  } catch (err) {
    console.error(`map-thesis step2B: node "${node.name}" validation failed:`, err);
    return [];
  }
}

// ── Database ──────────────────────────────────────────────────────────────────

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

// ── Error handling ─────────────────────────────────────────────────────────────

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

// ── Main handler ───────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const { thesis, thesisId } = await request.json();

    if (!thesis?.trim()) {
      return NextResponse.json({ error: "Thesis is required" }, { status: 400 });
    }

    const thesisText = thesis.trim();

    // ── Stage 1: structural chain map ─────────────────────────────────────────
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

    // ── Stage 2: process all nodes in parallel (2A search → 2B validate) ─────
    const nodeJobs: Array<{ tier: number; node: StructureNode }> = [];
    for (const tierData of structure.tiers ?? []) {
      for (const node of tierData.nodes ?? []) {
        nodeJobs.push({ tier: tierData.tier, node });
      }
    }

    const nodeResults = await Promise.all(
      nodeJobs.map(({ tier, node }) => processNode(tier, node, thesisText))
    );

    // ── Combine, filter, enforce tier floors, deduplicate ─────────────────────
    const allCompanies = nodeResults.flat().filter(isPubliclyTraded).map(enforceTierFloor);
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
