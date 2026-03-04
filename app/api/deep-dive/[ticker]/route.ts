import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Keep prompts lean to stay within the 30K token/min rate limit.
const SYSTEM_PROMPT = `You are a financial research analyst. Use web_search to find current data on the company, then respond with ONLY a valid JSON object — no markdown, no code fences, no explanations.`;

// Compact schema: keys only, no verbose example values.
const JSON_SCHEMA = `{"catalysts":[{"text":"...","date":"Mon YYYY","sentiment":"positive|negative|neutral"}],"insiderActivity":{"buys":0,"sells":0,"netValue":"...","notable":"..."},"smartMoney":{"institutionCount":0,"topHolders":"...","recentChanges":"..."},"analystSentiment":{"buy":0,"hold":0,"sell":0,"avgPriceTarget":"...","currentPrice":"...","upside":"+X%"},"lastUpdated":"YYYY-MM-DD"}`;

const DELAY_MS = 6000; // wait before retrying a 429

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callAnthropic(userPrompt: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client.beta.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    betas: ["web-search-2025-03-05"],
    tools: [{ type: "web_search_20250305", name: "web_search" }] as any,
    messages: [{ role: "user", content: userPrompt }],
  });
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
    let response;
    try {
      response = await callAnthropic(userPrompt);
    } catch (err: unknown) {
      // Retry once after a delay on rate limit
      if (
        err instanceof Error &&
        err.message.includes("429")
      ) {
        await sleep(DELAY_MS);
        response = await callAnthropic(userPrompt);
      } else {
        throw err;
      }
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "No structured data in response" },
        { status: 500 }
      );
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Deep dive error:", err);
    if (err instanceof Error && err.message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit hit — wait a moment and try again" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }
}
