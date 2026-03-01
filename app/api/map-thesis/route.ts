import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import getDb from "@/lib/db";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
const TIER_NUM: Record<string, number> = {
  tier0: 0,
  tier1: 1,
  tier2: 2,
  tier3: 3,
};

function persistResult(
  thesisText: string,
  result: ThesisResult,
  title: string,
  existingThesisId?: number
): number {
  const db = getDb();

  let thesisId: number;

  if (existingThesisId) {
    db.prepare(
      `UPDATE theses SET last_mapped_at = datetime('now'), title = ? WHERE id = ?`
    ).run(title, existingThesisId);
    db.prepare(`DELETE FROM chain_results WHERE thesis_id = ?`).run(
      existingThesisId
    );
    thesisId = existingThesisId;
  } else {
    const info = db
      .prepare(`INSERT INTO theses (thesis_text, title) VALUES (?, ?)`)
      .run(thesisText, title);
    thesisId = info.lastInsertRowid as number;
  }

  const insertCompany = db.prepare(`
    INSERT INTO chain_results
      (thesis_id, tier, company_name, ticker, market_cap, description,
       chain_reasoning, bottleneck, analyst_coverage, alpha_score)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAll = db.transaction((res: ThesisResult) => {
    for (const key of TIER_KEYS) {
      const companies = res[key] ?? [];
      for (const c of companies) {
        insertCompany.run(
          thesisId,
          TIER_NUM[key],
          c.name,
          c.ticker,
          c.marketCap,
          c.description,
          c.chain_reasoning,
          c.bottleneck ? 1 : 0,
          c.analyst_coverage,
          c.alphaScore
        );
      }
    }
  });

  insertAll(result);
  return thesisId;
}

export async function POST(request: NextRequest) {
  try {
    const { thesis, thesisId } = await request.json();

    if (!thesis?.trim()) {
      return NextResponse.json(
        { error: "Thesis is required" },
        { status: 400 }
      );
    }

    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Map this investment thesis into the 4-tier supply chain alpha framework: ${thesis.trim()}`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json(
        { error: "Unexpected response format" },
        { status: 500 }
      );
    }

    // Strip markdown code fences if present
    let jsonText = content.text.trim();
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/^```(?:json)?\n?/, "")
        .replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonText);
    const { title = "", ...result } = parsed as { title: string } & ThesisResult;
    const savedThesisId = persistResult(thesis.trim(), result, title, thesisId);

    return NextResponse.json({ result, thesisId: savedThesisId, title });
  } catch (err) {
    console.error("map-thesis error:", err);
    if (err instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Failed to parse model response as JSON" },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
