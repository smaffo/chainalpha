import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateTitle } from "@/lib/utils";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an elite macro research analyst specializing in supply chain intelligence and non-obvious investment themes. Your job is to identify emerging investment theses that most retail investors and even many institutional investors are NOT yet focused on.

Rules for thesis generation:
1. Each thesis must be SPECIFIC and TIMELY — tied to something happening right now (a policy change, supply disruption, capex announcement, regulatory shift, technology inflection)
2. Each thesis must be NON-OBVIOUS — avoid well-known themes like "AI is growing" or "defense spending is up". Instead, find the second-order and third-order effects that create supply chain opportunities
3. Each thesis must focus on SUPPLY CHAIN DYNAMICS — who supplies what to whom, where are the bottlenecks, what's under-followed
4. Each thesis should be DIFFERENT from the user's existing research (provided below) — suggest complementary angles, not overlaps
5. Think about: emerging regulations, infrastructure bottlenecks, reshoring shifts, material scarcity, technology transitions, demographic shifts with supply chain implications
6. Each thesis should be 2-3 sentences: state the macro trend, explain why NOW, and hint at the supply chain angle

Return ONLY a JSON array, no markdown, no backticks:
[
  {
    "title": "3-5 word title",
    "thesis": "Full 2-3 sentence thesis description with specific supply chain angle",
    "catalyst": "What recent event or trend makes this timely RIGHT NOW"
  }
]

Generate exactly 4 thesis suggestions.`;

export async function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT title, thesis_text FROM theses ORDER BY last_mapped_at DESC LIMIT 10`
    )
    .all() as Array<{ title: string; thesis_text: string }>;

  const existingList =
    rows.length > 0
      ? rows
          .map((t) => `- ${t.title || generateTitle(t.thesis_text)}`)
          .join("\n")
      : "None yet.";

  const today = new Date().toISOString().split("T")[0];
  const userPrompt = `Current date: ${today}. The user has already mapped these theses:\n${existingList}\n\nSearch for current market developments, recent policy changes, earnings trends, and supply chain disruptions. Then suggest 4 NEW investment theses that complement but don't overlap with the user's existing research. Focus on non-obvious supply chain opportunities.`;

  try {
    const response = await client.beta.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
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

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "No suggestions in response" },
        { status: 500 }
      );
    }

    const data = JSON.parse(jsonMatch[0]);
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error("Suggest theses error:", err);
    if (err instanceof Error && err.message.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit hit — try again in a moment" },
        { status: 429 }
      );
    }
    return NextResponse.json({ error: "Suggestion failed" }, { status: 500 });
  }
}
