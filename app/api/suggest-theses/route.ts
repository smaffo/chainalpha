import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateTitle } from "@/lib/utils";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// No web search — keeps token usage low and avoids rate limits.
// The model's training data has deep supply chain / macro knowledge.
const SYSTEM_PROMPT = `You are an elite macro research analyst specializing in supply chain intelligence. Generate non-obvious, specific investment theses focused on supply chain dynamics — second and third-order effects, not well-known themes.

Each thesis: 2-3 sentences covering the macro trend, why it matters NOW, and the supply chain angle. Avoid overlap with the user's existing theses.

Return ONLY a JSON array, no markdown, no backticks:
[{"title":"3-5 word title","thesis":"2-3 sentence thesis with supply chain angle","catalyst":"What makes this timely right now"}]

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
  const userPrompt = `Current date: ${today}. User's existing theses:\n${existingList}\n\nSuggest 4 NEW supply chain investment theses that complement but don't overlap with the above. Focus on non-obvious, timely opportunities.`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response format" }, { status: 500 });
    }

    // Strip markdown fences if present
    let text = content.text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("suggest-theses: no JSON array found in:", text.slice(0, 300));
      return NextResponse.json({ error: "No suggestions in response" }, { status: 500 });
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
