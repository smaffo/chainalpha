import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateTitle } from "@/lib/utils";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  timeout: 60_000,
  maxRetries: 2,
});

// No web search — keeps token usage low and avoids rate limits.
const SYSTEM_PROMPT = `You are an elite macro research analyst specializing in supply chain intelligence. Generate non-obvious, specific investment theses focused on supply chain dynamics — second and third-order effects, not well-known themes.

Each thesis: 2-3 sentences covering the macro trend, why it matters NOW, and the supply chain angle. Avoid overlap with the user's existing theses.

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

async function generateAndCache(): Promise<NextResponse> {
  const { data: rows } = await supabase
    .from("theses")
    .select("title, thesis_text")
    .order("last_mapped_at", { ascending: false })
    .limit(10);

  const existingList =
    (rows ?? []).length > 0
      ? (rows ?? []).map((t) => `- ${t.title || generateTitle(t.thesis_text)}`).join("\n")
      : "None yet.";

  const today = new Date().toISOString().split("T")[0];
  const userPrompt = `Current date: ${today}. User's existing theses:\n${existingList}\n\nSuggest 4 NEW supply chain investment theses that complement but don't overlap with the above. Focus on non-obvious, timely opportunities.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 1024,
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

  const data = parsed as Array<{ title: string; thesis: string; catalyst: string }>;

  // Replace cache — delete all then re-insert
  await supabase.from("suggested_theses").delete().gte("id", 1);
  await supabase.from("suggested_theses").insert(
    data.map((s) => ({ title: s.title, thesis_text: s.thesis, catalyst: s.catalyst }))
  );

  return NextResponse.json(data.map((s) => ({ title: s.title, thesis: s.thesis, catalyst: s.catalyst })));
}

export async function GET(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  const refresh = req.nextUrl.searchParams.get("refresh") === "1";

  if (!refresh) {
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
