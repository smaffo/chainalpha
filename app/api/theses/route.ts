import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const [{ data: theses, error: thesesError }, { data: results, error: resultsError }] =
    await Promise.all([
      supabase
        .from("theses")
        .select("id, thesis_text, title, created_at, last_mapped_at")
        .order("last_mapped_at", { ascending: false }),
      supabase
        .from("chain_results")
        .select("thesis_id, tier, bottleneck"),
    ]);

  if (thesesError) return NextResponse.json({ error: thesesError.message }, { status: 500 });
  if (resultsError) return NextResponse.json({ error: resultsError.message }, { status: 500 });

  // Compute per-thesis stats from chain_results
  const statsMap = new Map<number, {
    company_count: number;
    tier0_count: number;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
    bottleneck_count: number;
  }>();

  for (const r of results ?? []) {
    if (!statsMap.has(r.thesis_id)) {
      statsMap.set(r.thesis_id, {
        company_count: 0,
        tier0_count: 0,
        tier1_count: 0,
        tier2_count: 0,
        tier3_count: 0,
        bottleneck_count: 0,
      });
    }
    const s = statsMap.get(r.thesis_id)!;
    s.company_count++;
    (s as Record<string, number>)[`tier${r.tier}_count`]++;
    if (r.bottleneck) s.bottleneck_count++;
  }

  const response = (theses ?? []).map((t) => ({
    ...t,
    ...(statsMap.get(t.id) ?? {
      company_count: 0,
      tier0_count: 0,
      tier1_count: 0,
      tier2_count: 0,
      tier3_count: 0,
      bottleneck_count: 0,
    }),
  }));

  return NextResponse.json(response);
}
