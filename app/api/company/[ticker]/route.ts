import { NextResponse } from "next/server";

// Parse a response body as JSON safely — returns null if the body is not valid
// JSON (e.g. FMP's "Premium Query..." plain-text gating responses).
async function safeJson(res: Response): Promise<unknown[] | null> {
  try {
    const text = await res.text();
    const data = JSON.parse(text);
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch {
    return null;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params;
  const apiKey = process.env.FMP_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "FMP API key not configured" },
      { status: 500 }
    );
  }

  // Strip anything after the first whitespace or parenthesis so tickers like
  // "IQE.L (London)" or "BRK.B (NYSE)" resolve to just "IQE.L" / "BRK.B".
  const cleanTicker = ticker.split(/[\s(]/)[0].trim();

  const base = "https://financialmodelingprep.com/stable";
  const opts = { cache: "no-store" } as const;
  const sym = encodeURIComponent(cleanTicker);

  try {
    const [quoteRes, profileRes, ratiosRes] = await Promise.all([
      fetch(`${base}/quote?symbol=${sym}&apikey=${apiKey}`, opts),
      fetch(`${base}/profile?symbol=${sym}&apikey=${apiKey}`, opts),
      fetch(`${base}/ratios-ttm?symbol=${sym}&apikey=${apiKey}`, opts),
    ]);

    const [quoteArr, profileArr, ratiosArr] = await Promise.all([
      safeJson(quoteRes),
      safeJson(profileRes),
      safeJson(ratiosRes), // null if premium-gated
    ]);

    const quote   = quoteArr?.[0]   as Record<string, unknown> | undefined;
    const profile = profileArr?.[0] as Record<string, unknown> | undefined;
    const ratios  = ratiosArr?.[0]  as Record<string, unknown> | undefined;

    if (!quote && !profile) {
      return NextResponse.json({ error: "Ticker not found" }, { status: 404 });
    }

    // fullTimeEmployees comes back as a string from the stable API
    const employees =
      typeof profile?.fullTimeEmployees === "string"
        ? parseInt(profile.fullTimeEmployees, 10) || null
        : typeof profile?.fullTimeEmployees === "number"
        ? profile.fullTimeEmployees
        : null;

    return NextResponse.json({
      ticker: cleanTicker,
      price:         (quote?.price         as number)  ?? null,
      change:        (quote?.change        as number)  ?? null,
      changePercent: (quote?.changePercentage as number) ?? null,
      volume:        (quote?.volume        as number)  ?? null,
      marketCap:     (quote?.marketCap     as number)  ?? null,
      // ratios-ttm may be null if the account tier doesn't include it
      pe:            (ratios?.priceToEarningsRatioTTM as number) ?? null,
      yearHigh:      (quote?.yearHigh      as number)  ?? null,
      yearLow:       (quote?.yearLow       as number)  ?? null,
      sector:        (profile?.sector      as string)  ?? null,
      industry:      (profile?.industry    as string)  ?? null,
      website:       (profile?.website     as string)  ?? null,
      employees,
    });
  } catch (err) {
    console.error("FMP fetch error:", err);
    return NextResponse.json(
      { error: "Failed to fetch market data" },
      { status: 500 }
    );
  }
}
