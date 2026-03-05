import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateTitle } from "@/lib/utils";

export async function GET() {
  const { data: allRows, error } = await supabase
    .from("chain_results")
    .select("ticker, company_name, tier, bottleneck, thesis_id, theses(title, thesis_text)")
    .neq("ticker", "");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Find tickers that appear in more than one thesis
  const tickerTheses = new Map<string, Set<number>>();
  for (const row of allRows ?? []) {
    if (!tickerTheses.has(row.ticker)) tickerTheses.set(row.ticker, new Set());
    tickerTheses.get(row.ticker)!.add(row.thesis_id);
  }
  const crossTickers = new Set(
    [...tickerTheses.entries()]
      .filter(([, theses]) => theses.size > 1)
      .map(([ticker]) => ticker)
  );

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

  for (const row of allRows ?? []) {
    if (!crossTickers.has(row.ticker)) continue;

    if (!map.has(row.ticker)) {
      map.set(row.ticker, {
        ticker: row.ticker,
        name: row.company_name,
        appearances: [],
        anyBottleneck: false,
      });
    }

    const entry = map.get(row.ticker)!;
    const thesis = row.theses as unknown as { title: string; thesis_text: string } | null;
    const thesisTitle = thesis?.title || generateTitle(thesis?.thesis_text ?? "");
    const isBottleneck = row.bottleneck === true;

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
