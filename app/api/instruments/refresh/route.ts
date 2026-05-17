import { NextRequest, NextResponse } from 'next/server';
import { upsertInstruments, getInstrumentCount } from '@/lib/db/instruments';

/**
 * POST /api/instruments/refresh
 *
 * Cron-compatible endpoint that fetches an NSE index (default: NIFTY TOTAL MARKET)
 * and upserts all constituent symbols into the instruments table.
 */

const NSE_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchNSEIndex(indexName: string) {
  const homeRes = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': NSE_USER_AGENT },
  });

  const cookies = homeRes.headers.get('set-cookie');
  if (!cookies) throw new Error('Failed to get NSE cookies');

  const apiUrl = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(indexName)}`;
  const apiRes = await fetch(apiUrl, {
    headers: {
      'User-Agent': NSE_USER_AGENT,
      Referer: 'https://www.nseindia.com/market-data/live-equity-market',
      Cookie: cookies,
      Accept: '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  if (!apiRes.ok) {
    throw new Error(`NSE API returned ${apiRes.status}`);
  }

  return apiRes.json();
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const indexName = searchParams.get('index') || 'NIFTY TOTAL MARKET';

  try {
    const nseData = await fetchNSEIndex(indexName);

    const nseStocks = nseData.data
      .filter((s: any) => s.symbol !== indexName && s.meta)
      .map((s: any) => ({
        symbol: s.symbol as string,
        companyName: (s.meta?.companyName || s.symbol) as string,
        industry: (s.meta?.industry || 'Unknown') as string,
        series: (s.series || 'EQ') as string,
        isinCode: (s.meta?.isin || '') as string,
      }));

    if (nseStocks.length === 0) {
      return NextResponse.json(
        { error: 'No stocks returned from NSE' },
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
    console.error('Instruments refresh error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
