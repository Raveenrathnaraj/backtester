import { NextRequest, NextResponse } from 'next/server';
import { upsertInstruments, getInstrumentsBySymbols } from '@/lib/db/instruments';

/**
 * NSE requires a session cookie from the homepage.
 * This helper performs the "cookie dance" to fetch index data.
 */
async function fetchNSEIndex(index: string) {
  const userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  
  const homeRes = await fetch('https://www.nseindia.com/', {
    headers: { 'User-Agent': userAgent }
  });
  
  const cookies = homeRes.headers.get('set-cookie');
  if (!cookies) throw new Error('Failed to get NSE cookies');

  const apiUrl = `https://www.nseindia.com/api/equity-stockIndices?index=${encodeURIComponent(index)}`;
  const apiRes = await fetch(apiUrl, {
    headers: {
      'User-Agent': userAgent,
      'Referer': 'https://www.nseindia.com/market-data/live-equity-market',
      'Cookie': cookies,
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!apiRes.ok) {
    throw new Error(`NSE API returned ${apiRes.status}`);
  }

  return apiRes.json();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get('index');

  if (!index) {
    return NextResponse.json({ error: 'Index parameter is required' }, { status: 400 });
  }

  try {
    const nseData = await fetchNSEIndex(index);

    const nseStocks = nseData.data
      .filter((s: any) => s.symbol !== 'NIFTY 50' && s.symbol !== index)
      .map((s: any) => ({
        symbol: s.symbol as string,
        companyName: (s.meta?.companyName || s.symbol) as string,
        industry: (s.meta?.industry || 'Unknown') as string,
        series: (s.series || 'EQ') as string,
        isinCode: (s.meta?.isin || '') as string,
      }));

    const nseSymbols = nseStocks.map((s: any) => s.symbol);

    if (nseSymbols.length === 0) {
      return NextResponse.json({ stocks: [] });
    }

    // Look up which symbols already exist in our instruments table
    const existingRows = await getInstrumentsBySymbols(nseSymbols);
    const existingSet = new Set(existingRows.map((r) => r.symbol));

    // Auto-insert any symbols we haven't seen before
    const newStocks = nseStocks.filter((s: any) => !existingSet.has(s.symbol));
    if (newStocks.length > 0) {
      await upsertInstruments(newStocks);
    }

    // Re-read all matching rows (now including newly inserted ones)
    const allLocalRows = await getInstrumentsBySymbols(nseSymbols);

    // Build response
    const stocks = nseSymbols.map((symbol: string) => {
      const local = allLocalRows.find((r) => r.symbol === symbol);
      const nseStock = nseStocks.find((s: any) => s.symbol === symbol);
      return {
        symbol,
        name: local?.companyName || nseStock?.companyName || symbol,
        kiteToken: local?.kiteToken || null,
        industry: local?.industry || nseStock?.industry || 'Unknown',
      };
    });

    return NextResponse.json({
      indexName: nseData.metadata.indexName,
      stocks,
    });
  } catch (error: any) {
    console.error('NSE Fetch Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
