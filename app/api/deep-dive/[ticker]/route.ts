import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a financial research analyst. Use the web_search tool to gather current, accurate information about the company. Search for recent earnings, news, insider transactions, institutional ownership changes, and analyst ratings. After researching, respond with ONLY a valid JSON object matching the exact structure provided. No markdown, no code fences, no explanations — just the raw JSON.`;

const JSON_SCHEMA = `{
  "catalysts": [
    { "text": "Q4 earnings beat estimates, revenue +18% YoY", "date": "Feb 2026", "sentiment": "positive" },
    { "text": "New $50M defense contract announced", "date": "Jan 2026", "sentiment": "positive" },
    { "text": "CFO departure announced", "date": "Dec 2025", "sentiment": "negative" }
  ],
  "insiderActivity": {
    "buys": 2,
    "sells": 1,
    "netValue": "$340K net purchased",
    "notable": "CEO bought $220K on Feb 12, 2026"
  },
  "smartMoney": {
    "institutionCount": 245,
    "topHolders": "Vanguard, BlackRock, State Street",
    "recentChanges": "2 new positions initiated, Vanguard increased 12%"
  },
  "analystSentiment": {
    "buy": 3,
    "hold": 1,
    "sell": 0,
    "avgPriceTarget": "$145",
    "currentPrice": "$118",
    "upside": "+23%"
  },
  "lastUpdated": "2026-03-04"
}`;

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

  const userPrompt = `Research ${companyName} (ticker: ${ticker}). Find the latest news, recent earnings results, insider buying/selling activity in the last 90 days, institutional holder changes, and analyst ratings. Return ONLY a JSON object with the exact structure specified, no markdown, no backticks, no explanation.\n\nThe JSON must have exactly this structure:\n${JSON_SCHEMA}`;

  try {
    // Use beta client for web search tool
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      betas: ["web-search-2025-03-05"],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ type: "web_search_20250305", name: "web_search" }] as any,
      messages: [{ role: "user", content: userPrompt }],
    });

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
  } catch (err) {
    console.error("Deep dive error:", err);
    return NextResponse.json({ error: "Research failed" }, { status: 500 });
  }
}
