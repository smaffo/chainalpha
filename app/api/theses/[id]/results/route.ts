import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: rows, error } = await supabase
    .from("chain_results")
    .select("tier, company_name, ticker, market_cap, description, chain_reasoning, bottleneck, analyst_coverage, alpha_score, supply_chain_node")
    .eq("thesis_id", Number(id))
    .order("tier")
    .order("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const result: Record<string, unknown[]> = {
    tier0: [],
    tier1: [],
    tier2: [],
    tier3: [],
  };

  for (const row of rows ?? []) {
    const key = `tier${row.tier}`;
    result[key].push({
      name: row.company_name,
      ticker: row.ticker,
      marketCap: row.market_cap,
      description: row.description,
      chain_reasoning: row.chain_reasoning,
      bottleneck: row.bottleneck === true,
      analyst_coverage: row.analyst_coverage,
      alphaScore: row.alpha_score,
      supply_chain_node: row.supply_chain_node ?? undefined,
    });
  }

  return NextResponse.json(result);
}
