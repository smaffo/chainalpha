import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 90_000,   // 90 s — thesis mapping can take 60+ s
  maxRetries: 2,     // auto-retry on 429 / 5xx (SDK default, being explicit)
});

const SYSTEM_PROMPT = `You are an investment research analyst specializing in supply chain mapping and thematic investing.

The goal is not to list small companies. The goal is to trace the supply chain from obvious to non-obvious, identifying companies whose importance to the thesis is disproportionate to the attention they receive from analysts and institutions.

Given an investment thesis, map it into a 4-tier supply chain / alpha spectrum:

- Tier 0: Mega-caps everyone knows. Market cap $50B+. Fully priced in, widely held. Include for context and as benchmarks — not as opportunities. Low alpha.
- Tier 1: Getting smart money attention. $5B–$50B market cap. Growing institutional interest, but the thesis is not fully priced in. Moderate alpha.
- Tier 2: Hidden enablers. $500M–$10B. Critical to the thesis but under-followed by analysts. This is where informed investors find edge. High alpha.
- Tier 3: Deep upstream. Under $500M OR any size if analyst coverage is minimal. Raw materials, niche components, sole-source suppliers, critical infrastructure. Highest potential alpha but also highest risk.

Return 4–5 real, publicly traded companies per tier. Only include companies that genuinely connect to the thesis through supply chain logic.

For each company include these fields:
- name: Full legal company name
- ticker: Exchange ticker symbol
- marketCap: Approximate market cap (e.g. "~$4.2B")
- description: One sentence on what this company does and its surface-level connection to the thesis.
- chain_reasoning: 1–2 sentences tracing WHY this company matters through supply chain logic. Not just "they do X" — explain "they do X, which feeds into Y, which is critical because Z."
- bottleneck: Boolean. Set to true ONLY if the company sits at a genuine chokepoint: sole or near-sole supplier of a critical input, no viable near-term alternatives, hard regulatory moat, or control of a scarce resource. Most companies should be false. Expect 2–3 bottleneck=true companies across all four tiers total — not per tier.
- analyst_coverage: One of "heavy" (10+ sell-side analysts), "moderate" (4–9 analysts), "light" (1–3 analysts), or "minimal" (0 or not widely followed). High thesis-relevance combined with light or minimal coverage is the signal.
- alphaScore: "low" for tier0, "moderate" for tier1, "high" for tier2, "highest" for tier3.

Also generate a short 3–5 word title that captures the core theme of the thesis (e.g. "AI Infrastructure Buildout", "Nuclear Energy Renaissance", "Semiconductor Onshoring Wave"). It should be a noun phrase, title-cased, with no punctuation.

Return ONLY a valid JSON object. No markdown, no explanation, no code fences. Exactly this format:

{
  "title": "Short Thesis Title",
  "tier0": [
    {
      "name": "Full Company Name",
      "ticker": "TICK",
      "marketCap": "~$XXX B",
      "description": "One sentence on what they do and surface connection to thesis.",
      "chain_reasoning": "1–2 sentences tracing the supply chain logic to the thesis.",
      "bottleneck": false,
      "analyst_coverage": "heavy",
      "alphaScore": "low"
    }
  ],
  "tier1": [{ "name": "...", "ticker": "...", "marketCap": "...", "description": "...", "chain_reasoning": "...", "bottleneck": false, "analyst_coverage": "moderate", "alphaScore": "moderate" }],
  "tier2": [{ "name": "...", "ticker": "...", "marketCap": "...", "description": "...", "chain_reasoning": "...", "bottleneck": false, "analyst_coverage": "light", "alphaScore": "high" }],
  "tier3": [{ "name": "...", "ticker": "...", "marketCap": "...", "description": "...", "chain_reasoning": "...", "bottleneck": false, "analyst_coverage": "minimal", "alphaScore": "highest" }]
}`;

type Company = {
  name: string;
  ticker: string;
  marketCap: string;
  description: string;
  chain_reasoning: string;
  bottleneck: boolean;
  analyst_coverage: string;
  alphaScore: string;
};

type ThesisResult = {
  tier0: Company[];
  tier1: Company[];
  tier2: Company[];
  tier3: Company[];
};

const TIER_KEYS = ["tier0", "tier1", "tier2", "tier3"] as const;
const TIER_NUM: Record<string, number> = { tier0: 0, tier1: 1, tier2: 2, tier3: 3 };

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
    await supabase
      .from("chain_results")
      .delete()
      .eq("thesis_id", existingThesisId);
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
        tier: TIER_NUM[key],
        company_name: c.name,
        ticker: c.ticker,
        market_cap: c.marketCap,
        description: c.description,
        chain_reasoning: c.chain_reasoning,
        bottleneck: c.bottleneck,
        analyst_coverage: c.analyst_coverage,
        alpha_score: c.alphaScore,
      });
    }
  }

  if (rows.length > 0) {
    await supabase.from("chain_results").insert(rows);
  }

  return thesisId;
}

function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  // Strip markdown fences
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  // Try to extract JSON object
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { /* fall through */ }
  }
  throw new SyntaxError("No valid JSON found in response");
}

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

export async function POST(request: NextRequest) {
  try {
    const { thesis, thesisId } = await request.json();

    if (!thesis?.trim()) {
      return NextResponse.json({ error: "Thesis is required" }, { status: 400 });
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Map this investment thesis into the 4-tier supply chain alpha framework: ${thesis.trim()}` }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Mapping failed — please try again in a moment" }, { status: 500 });
    }

    let parsed: unknown;
    try {
      parsed = parseJsonResponse(content.text);
    } catch {
      console.error("map-thesis: JSON parse failed. Raw:", content.text.slice(0, 500));
      return NextResponse.json({ error: "Mapping failed — please try again in a moment" }, { status: 500 });
    }

    const { title = "", ...result } = parsed as { title: string } & ThesisResult;
    const savedThesisId = await persistResult(thesis.trim(), result, title, thesisId);

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
