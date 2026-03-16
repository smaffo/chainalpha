import { supabase } from "@/lib/supabase";
import type { RadarCompany } from "@/lib/types";

export async function GET() {
  // 1. Fetch all node_companies JOIN nodes JOIN trends JOIN companies
  const { data: rows, error } = await supabase
    .from("node_companies")
    .select(
      `company_id, chain_reasoning,
       nodes ( id, name, bottleneck_score, trend_id,
         trends ( id, title )
       ),
       companies ( id, name, ticker, country )`
    );

  if (error) {
    return Response.json({ error: "Database error" }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return Response.json([]);
  }

  // 2. Group by company_id
  const companyMap = new Map<
    number,
    {
      company_id: number;
      name: string;
      ticker: string;
      country: string;
      trendIds: Set<number>;
      bottleneckScores: number[];
      nodeIds: Set<number>;
      appearances: RadarCompany["appearances"];
    }
  >();

  for (const row of (rows as unknown as Array<{
    company_id: number;
    chain_reasoning: string;
    nodes: {
      id: number;
      name: string;
      bottleneck_score: number;
      trend_id: number;
      trends: { id: number; title: string } | null;
    } | null;
    companies: { id: number; name: string; ticker: string; country: string } | null;
  }>)) {
    if (!row.companies || !row.nodes || !row.nodes.trends) continue;

    const cid = row.company_id;
    if (!companyMap.has(cid)) {
      companyMap.set(cid, {
        company_id: cid,
        name: row.companies.name,
        ticker: row.companies.ticker,
        country: row.companies.country,
        trendIds: new Set(),
        bottleneckScores: [],
        nodeIds: new Set(),
        appearances: [],
      });
    }

    const entry = companyMap.get(cid)!;
    const trendId = row.nodes.trends.id;
    entry.trendIds.add(trendId);
    entry.bottleneckScores.push(row.nodes.bottleneck_score ?? 0);
    entry.nodeIds.add(row.nodes.id);
    entry.appearances.push({
      trend_id: trendId,
      trend_title: row.nodes.trends.title,
      node_name: row.nodes.name,
      bottleneck_score: row.nodes.bottleneck_score ?? 0,
    });
  }

  // 3. Filter: trend_count > 1
  const result: RadarCompany[] = [];
  for (const entry of companyMap.values()) {
    const trend_count = entry.trendIds.size;
    if (trend_count < 2) continue;

    const avg_bottleneck =
      entry.bottleneckScores.reduce((a, b) => a + b, 0) / entry.bottleneckScores.length;
    const node_count = entry.nodeIds.size;

    // 4. Signal score formula
    const trend_points = Math.min(trend_count * 10, 40);
    const bottleneck_points = (avg_bottleneck / 100) * 40;
    const node_points = Math.min(node_count * 5, 20);
    const signal_score = Math.round(trend_points + bottleneck_points + node_points);

    result.push({
      company_id: entry.company_id,
      name: entry.name,
      ticker: entry.ticker,
      country: entry.country,
      trend_count,
      avg_bottleneck: Math.round(avg_bottleneck),
      node_count,
      signal_score,
      appearances: entry.appearances,
    });
  }

  // 5. Sort by signal_score DESC
  result.sort((a, b) => b.signal_score - a.signal_score);

  return Response.json(result);
}
