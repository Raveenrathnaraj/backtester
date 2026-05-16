import { db } from './index';
import { candles, fetchRanges } from './schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import type { Candle } from '@/types/backtester';

/**
 * Get candles from the local cache for a symbol within a date range.
 */
export function getCachedCandles(
  symbol: string,
  from: string,
  to: string,
): Candle[] {
  const rows = db
    .select({
      date: candles.date,
      open: candles.open,
      high: candles.high,
      low: candles.low,
      close: candles.close,
    })
    .from(candles)
    .where(
      and(
        eq(candles.symbol, symbol),
        gte(candles.date, from),
        lte(candles.date, to),
      ),
    )
    .orderBy(candles.date)
    .all();

  return rows;
}

/**
 * Determine which date sub-ranges still need to be fetched from Kite.
 *
 * Strategy: We check fetch_ranges to see which [from, to] windows have
 * already been fetched for this symbol. Then we compute the complement
 * of the requested range minus the union of fetched ranges.
 *
 * Returns an array of { from, to } gaps that need fetching.
 */
export function getMissingRanges(
  symbol: string,
  from: string,
  to: string,
): { from: string; to: string }[] {
  // Get all fetched ranges for this symbol that overlap with [from, to]
  const fetched = db
    .select({
      fromDate: fetchRanges.fromDate,
      toDate: fetchRanges.toDate,
    })
    .from(fetchRanges)
    .where(
      and(
        eq(fetchRanges.symbol, symbol),
        lte(fetchRanges.fromDate, to),
        gte(fetchRanges.toDate, from),
      ),
    )
    .orderBy(fetchRanges.fromDate)
    .all();

  if (fetched.length === 0) {
    return [{ from, to }];
  }

  // Merge overlapping fetched ranges, then find gaps
  const merged = mergeRanges(
    fetched.map((r) => ({ from: r.fromDate, to: r.toDate })),
  );
  const gaps: { from: string; to: string }[] = [];

  let cursor = from;
  for (const range of merged) {
    if (cursor < range.from) {
      // There's a gap before this fetched range
      gaps.push({ from: cursor, to: prevDay(range.from) });
    }
    // Advance cursor past the fetched range
    if (range.to >= cursor) {
      cursor = nextDay(range.to);
    }
  }

  // Gap after the last fetched range
  if (cursor <= to) {
    gaps.push({ from: cursor, to });
  }

  return gaps;
}

/**
 * Store newly fetched candles and record the fetch range.
 */
export function storeCandles(
  symbol: string,
  from: string,
  to: string,
  data: Candle[],
): void {
  if (data.length === 0) {
    // Even if no candles came back (e.g. no trading days), record the range
    db.insert(fetchRanges)
      .values({ symbol, fromDate: from, toDate: to })
      .run();
    return;
  }

  // Use a transaction for atomicity
  db.transaction((tx) => {
    // Insert candles, ignoring duplicates (ON CONFLICT DO NOTHING)
    for (const candle of data) {
      tx.insert(candles)
        .values({
          symbol,
          date: candle.date,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
        })
        .onConflictDoNothing()
        .run();
    }

    // Record the fetched range
    tx.insert(fetchRanges)
      .values({ symbol, fromDate: from, toDate: to })
      .run();
  });
}

/**
 * Get count of cached candles (for progress display)
 */
export function getCachedSymbolCount(
  symbols: string[],
  from: string,
  to: string,
): number {
  if (symbols.length === 0) return 0;

  let count = 0;
  for (const symbol of symbols) {
    const missing = getMissingRanges(symbol, from, to);
    if (missing.length === 0) {
      count++;
    }
  }
  return count;
}

// -- Helpers --

function mergeRanges(
  ranges: { from: string; to: string }[],
): { from: string; to: string }[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
  const merged: { from: string; to: string }[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const current = sorted[i];

    // Overlapping or adjacent — merge
    if (current.from <= nextDay(last.to)) {
      last.to = current.to > last.to ? current.to : last.to;
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}

function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
