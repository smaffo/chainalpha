import { NextResponse } from "next/server";
import getDb from "@/lib/db";
import { generateTitle } from "@/lib/utils";

export async function GET() {
  const db = getDb();

  const rows = db
    .prepare(
      `WITH cross_tickers AS (
         SELECT ticker
         FROM chain_results
         WHERE ticker != ''
         GROUP BY ticker
         HAVING COUNT(DISTINCT thesis_id) > 1
       )
       SELECT
         cr.ticker,
         cr.company_name,
         cr.tier,
         cr.bottleneck,
         cr.thesis_id,
         t.title,
         t.thesis_text
       FROM chain_results cr
       JOIN cross_tickers ct ON ct.ticker = cr.ticker
       JOIN theses t ON t.id = cr.thesis_id
       ORDER BY cr.ticker, cr.thesis_id`
    )
    .all() as Array<{
    ticker: string;
    company_name: string;
    tier: number;
    bottleneck: number;
    thesis_id: number;
    title: string;
    thesis_text: string;
  }>;

  const map = new Map<
    string,
    {
      ticker: string;
      name: string;
      appearances: Array<{
        thesisId: number;
        title: string;
        tier: number;
        bottleneck: boolean;
      }>;
      anyBottleneck: boolean;
    }
  >();

  for (const row of rows) {
    if (!map.has(row.ticker)) {
      map.set(row.ticker, {
        ticker: row.ticker,
        name: row.company_name,
        appearances: [],
        anyBottleneck: false,
      });
    }
    const entry = map.get(row.ticker)!;
    const thesisTitle = row.title || generateTitle(row.thesis_text);
    const isBottleneck = row.bottleneck === 1;
    entry.appearances.push({
      thesisId: row.thesis_id,
      title: thesisTitle,
      tier: row.tier,
      bottleneck: isBottleneck,
    });
    if (isBottleneck) entry.anyBottleneck = true;
  }

  const result = Array.from(map.values()).sort((a, b) => {
    if (b.appearances.length !== a.appearances.length) {
      return b.appearances.length - a.appearances.length;
    }
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json(result);
}
