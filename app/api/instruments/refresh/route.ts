import { NextRequest, NextResponse } from "next/server";
import { upsertInstruments, getInstrumentCount } from "@/lib/db/instruments";

/**
 * POST /api/instruments/refresh
 *
 * Cron-compatible endpoint that fetches an NSE index (default: NIFTY TOTAL MARKET)
 * and upserts all constituent symbols into the instruments table.
 */

import { fetchNSEIndex } from "@/lib/nse";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const indexName = searchParams.get("index") || "NIFTY TOTAL MARKET";

  try {
    const nseData = await fetchNSEIndex(indexName);

    const nseStocks = nseData.data
      .filter((s: any) => s.symbol !== indexName && s.meta)
      .map((s: any) => ({
        symbol: s.symbol as string,
        companyName: (s.meta?.companyName || s.symbol) as string,
        industry: (s.meta?.industry || "Unknown") as string,
        series: (s.series || "EQ") as string,
        isinCode: (s.meta?.isin || "") as string,
      }));

    if (nseStocks.length === 0) {
      return NextResponse.json(
        { error: "No stocks returned from NSE" },
        { status: 502 },
      );
    }

    // Count before
    const beforeCount = await getInstrumentCount();

    // Upsert all stocks
    await upsertInstruments(nseStocks);

    // Count after
    const afterCount = await getInstrumentCount();

    return NextResponse.json({
      success: true,
      index: indexName,
      fetched: nseStocks.length,
      newInstruments: afterCount - beforeCount,
      totalInstruments: afterCount,
    });
  } catch (error: any) {
    console.error("Instruments refresh error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
