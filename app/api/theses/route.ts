import { NextResponse } from "next/server";
import getDb from "@/lib/db";

export async function GET() {
  const db = getDb();
  const theses = db
    .prepare(
      `SELECT
         t.id,
         t.thesis_text,
         t.title,
         t.created_at,
         t.last_mapped_at,
         COUNT(cr.id) AS company_count,
         SUM(CASE WHEN cr.tier = 0 THEN 1 ELSE 0 END) AS tier0_count,
         SUM(CASE WHEN cr.tier = 1 THEN 1 ELSE 0 END) AS tier1_count,
         SUM(CASE WHEN cr.tier = 2 THEN 1 ELSE 0 END) AS tier2_count,
         SUM(CASE WHEN cr.tier = 3 THEN 1 ELSE 0 END) AS tier3_count,
         SUM(CASE WHEN cr.bottleneck = 1 THEN 1 ELSE 0 END) AS bottleneck_count
       FROM theses t
       LEFT JOIN chain_results cr ON cr.thesis_id = t.id
       GROUP BY t.id
       ORDER BY t.last_mapped_at DESC`
    )
    .all();
  return NextResponse.json(theses);
}
