import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateTitle } from "@/lib/utils";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are an elite macro research analyst specializing in supply chain intelligence. Generate non-obvious, specific investment theses focused on supply chain dynamics — second and third-order effects, not well-known themes.

Each thesis: 2-3 sentences covering the macro trend, why it matters NOW, and the supply chain angle. Avoid overlap with the user's existing theses.

Each suggestion MUST cover a DIFFERENT sector and geography. Spread across: energy, technology, materials, healthcare, agriculture, infrastructure, defense, logistics, chemicals, water, mining, biotech, shipping, real estate, telecom. Never suggest two theses from the same sector. Think globally: include opportunities in Europe, Asia, Latin America, Middle East, Africa — not just US-centric themes.

CRITICAL RULES FOR THESIS QUALITY:

1. GLOBAL IMPACT: Each thesis must describe a macro trend with GLOBAL implications — not hyper-local infrastructure projects. Think: 'AI data centers need immersion cooling globally' not 'Indonesian nickel smelter logistics'. The trend should affect multiple countries and industries.

2. INVESTABLE SUPPLY CHAINS: The supply chain you're hinting at must lead to PUBLICLY TRADED companies on major exchanges (NYSE, NASDAQ, LSE, Frankfurt, Tokyo). If most companies in the chain would be private or listed on obscure local exchanges, it's a bad thesis for this tool.

3. STRUCTURAL, NOT GEOGRAPHIC: Frame theses around structural shifts (technology transitions, regulatory changes, resource constraints, demand inflections) rather than geographic projects. Good: 'Global semiconductor packaging bottleneck as advanced chips require CoWoS technology' Bad: 'Middle East pharmaceutical cold storage'

4. SECOND-ORDER EFFECTS: The best theses trace from an obvious trend to a non-obvious supply chain consequence. Example: 'AI compute demand → power consumption surge → grid transformer shortage → specialty electrical steel suppliers become bottlenecks'

5. SCALE: Each thesis should represent at least a $50B+ addressable market shift, not niche local opportunities.

Examples of GOOD theses:
- 'Immersion cooling becomes mandatory for next-gen AI data centers, creating bottlenecks in engineered fluids, precision manifolds, and heat exchanger manufacturing'
- 'Global grid infrastructure can't keep pace with electrification — transformer lead times stretch to 3 years, benefiting grain-oriented electrical steel and bushing manufacturers'
- 'Weight-loss drug boom forces reformulation across food, beverage, and packaging industries — supply chains for protein fortification, reduced-sugar processing, and smaller portion packaging shift'

Examples of BAD theses:
- 'Argentine lithium rail resurrection'
- 'Indonesian nickel smelter logistics'
- 'Middle East pharmaceutical cold storage'
- Any thesis where most beneficiaries would be private companies

Return ONLY a JSON array, no markdown, no backticks:
[{"title":"3-5 word title","thesis":"2-3 sentence thesis with supply chain angle","catalyst":"What makes this timely right now"}]

Generate exactly 4 thesis suggestions.`;

function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
  const match = cleaned.match(/\[[\s\S]*\]/);
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
      return "Couldn't generate suggestions right now — try again";
    }
  }
  return null;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

async function generateAndCache(): Promise<NextResponse> {
  // Fetch existing theses, current suggestions cache, and watchlist in parallel
  const [{ data: thesesRows }, { data: cachedRows }, { data: watchlistRows }] =
    await Promise.all([
      supabase
        .from("theses")
        .select("title, thesis_text")
        .order("last_mapped_at", { ascending: false })
        .limit(10),
      supabase
        .from("suggested_theses")
        .select("title"),
      supabase
        .from("watchlist")
        .select("title"),
    ]);

  const existingList =
    (thesesRows ?? []).length > 0
      ? (thesesRows ?? []).map((t) => `- ${t.title || generateTitle(t.thesis_text)}`).join("\n")
      : "None yet.";

  const previousSuggestions = (cachedRows ?? []).map((s) => s.title).filter(Boolean);
  const watchlistTitles = (watchlistRows ?? []).map((w) => w.title).filter(Boolean);

  const today = new Date().toISOString().split("T")[0];

  let userPrompt = `Current date: ${today}. User's existing theses:\n${existingList}\n\nSuggest 4 NEW supply chain investment theses that complement but don't overlap with the above. Focus on non-obvious, timely opportunities.`;

  if (previousSuggestions.length > 0) {
    userPrompt += `\n\nIMPORTANT: Do NOT repeat or rephrase any of these previously suggested theses: ${previousSuggestions.map((t) => `"${t}"`).join(", ")}. Generate completely NEW and DIFFERENT theses covering different sectors, geographies, and supply chain dynamics.`;
  }

  if (watchlistTitles.length > 0) {
    userPrompt += `\n\nAlso do NOT suggest theses similar to these watchlist items: ${watchlistTitles.map((t) => `"${t}"`).join(", ")}.`;
  }

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    temperature: 0.9,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    return NextResponse.json({ error: "Couldn't generate suggestions right now — try again" }, { status: 500 });
  }

  let parsed: unknown;
  try {
    parsed = parseJsonResponse(content.text);
  } catch {
    console.error("suggest-theses: JSON parse failed. Raw:", content.text.slice(0, 300));
    return NextResponse.json({ error: "Couldn't generate suggestions right now — try again" }, { status: 500 });
  }

  let data = parsed as Array<{ title: string; thesis: string; catalyst: string }>;

  // Filter out any suggestion whose title closely matches a watchlist item
  if (watchlistTitles.length > 0) {
    const normalisedWatchlist = watchlistTitles.map(normalise);
    data = data.filter((s) => {
      const norm = normalise(s.title);
      return !normalisedWatchlist.some((w) => w === norm || w.includes(norm) || norm.includes(w));
    });
  }

  // Replace cache — always wipe first for a clean slate
  await supabase.from("suggested_theses").delete().gte("id", 1);
  if (data.length > 0) {
    await supabase.from("suggested_theses").insert(
      data.map((s) => ({ title: s.title, thesis_text: s.thesis, catalyst: s.catalyst }))
    );
  }

  return NextResponse.json(data.map((s) => ({ title: s.title, thesis: s.thesis, catalyst: s.catalyst })));
}

export async function GET(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  // On explicit refresh: wipe the cache immediately so generateAndCache starts clean
  if (refresh) {
    await supabase.from("suggested_theses").delete().gte("id", 1);
  } else {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: cached } = await supabase
      .from("suggested_theses")
      .select("title, thesis_text, catalyst")
      .gte("created_at", cutoff)
      .order("id");

    if ((cached ?? []).length > 0) {
      return NextResponse.json(
        (cached ?? []).map((s) => ({ title: s.title, thesis: s.thesis_text, catalyst: s.catalyst }))
      );
    }
  }

  try {
    return await generateAndCache();
  } catch (err: unknown) {
    console.error("Suggest theses error:", err);
    const msg = apiErrorMessage(err);
    return NextResponse.json(
      { error: msg ?? "Couldn't generate suggestions right now — try again" },
      { status: 500 }
    );
  }
}
