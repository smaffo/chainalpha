import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 90_000,
  maxRetries: 2,
});

const SYSTEM_PROMPT = `You are a financial research analyst. Use web_search to find current data on the company, then respond with ONLY a valid JSON object — no markdown, no code fences, no explanations.`;

const JSON_SCHEMA = `{"catalysts":[{"text":"...","date":"Mon YYYY","sentiment":"positive|negative|neutral"}],"insiderActivity":{"buys":0,"sells":0,"netValue":"...","notable":"..."},"smartMoney":{"institutionCount":0,"topHolders":"...","recentChanges":"..."},"analystSentiment":{"buy":0,"hold":0,"sell":0,"avgPriceTarget":"...","currentPrice":"...","upside":"+X%"},"lastUpdated":"YYYY-MM-DD"}`;

function parseJsonResponse(text: string): unknown {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }
  try { return JSON.parse(cleaned); } catch { /* fall through */ }
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
      return "Research temporarily unavailable — try again";
    }
  }
  return null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const { searchParams } = new URL(request.url);
  const companyName = searchParams.get("name") ?? ticker;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const userPrompt = `Research ${companyName} (${ticker}): latest news, Q4/recent earnings, insider transactions last 90 days, institutional holder changes, analyst ratings. Return ONLY this JSON structure: ${JSON_SCHEMA}`;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (client.beta.messages.create as any)({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      betas: ["web-search-2025-03-05"],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = response.content
      .filter((b: Anthropic.ContentBlock) => b.type === "text")
      .map((b: Anthropic.TextBlock) => b.text)
      .join("");

    let parsed: unknown;
    try {
      parsed = parseJsonResponse(text);
    } catch {
      console.error("deep-dive: JSON parse failed. Raw:", text.slice(0, 500));
      return NextResponse.json({ error: "Research temporarily unavailable — try again" }, { status: 500 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Deep dive error:", err);
    const msg = apiErrorMessage(err);
    return NextResponse.json(
      { error: msg ?? "Research temporarily unavailable — try again" },
      { status: 500 }
    );
  }
}
