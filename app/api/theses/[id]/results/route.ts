import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = getDb();

  const rows = db
    .prepare(
      `SELECT * FROM chain_results WHERE thesis_id = ? ORDER BY tier, id`
    )
    .all(id) as Array<{
    tier: number;
    company_name: string;
    ticker: string;
    market_cap: string;
    description: string;
    chain_reasoning: string;
    bottleneck: number;
    analyst_coverage: string;
    alpha_score: string;
  }>;

  const result: Record<string, unknown[]> = {
    tier0: [],
    tier1: [],
    tier2: [],
    tier3: [],
  };

  for (const row of rows) {
    const key = `tier${row.tier}`;
    result[key].push({
      name: row.company_name,
      ticker: row.ticker,
      marketCap: row.market_cap,
      description: row.description,
      chain_reasoning: row.chain_reasoning,
      bottleneck: row.bottleneck === 1,
      analyst_coverage: row.analyst_coverage,
      alphaScore: row.alpha_score,
    });
  }

  return NextResponse.json(result);
}
