import { createServiceClient } from '@/lib/supabase/service';
import type { Candle } from '@/types/backtester';

const supabase = createServiceClient();

/**
 * Get candles from the Supabase cache for a symbol within a date range.
 */
export async function getCachedCandles(
  symbol: string,
  from: string,
  to: string,
): Promise<Candle[]> {
  const { data, error } = await supabase
    .from('candles')
    .select('date, open, high, low, close')
    .eq('symbol', symbol)
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true });

  if (error) throw new Error(`Failed to get cached candles: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    date: typeof row.date === 'string' ? row.date.slice(0, 10) : row.date,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
  }));
}

/**
 * Determine which date sub-ranges still need to be fetched from Kite.
 *
 * Returns an array of { from, to } gaps that need fetching.
 */
export async function getMissingRanges(
  symbol: string,
  from: string,
  to: string,
): Promise<{ from: string; to: string }[]> {
  const { data: fetched, error } = await supabase
    .from('fetch_ranges')
    .select('from_date, to_date')
    .eq('symbol', symbol)
    .lte('from_date', to)
    .gte('to_date', from)
    .order('from_date', { ascending: true });

  if (error)
    throw new Error(`Failed to get fetch ranges: ${error.message}`);

  if (!fetched || fetched.length === 0) {
    return [{ from, to }];
  }

  // Merge overlapping fetched ranges, then find gaps
  const merged = mergeRanges(
    fetched.map((r: any) => ({
      from: r.from_date.slice(0, 10),
      to: r.to_date.slice(0, 10),
    })),
  );
  const gaps: { from: string; to: string }[] = [];

  let cursor = from;
  for (const range of merged) {
    if (cursor < range.from) {
      gaps.push({ from: cursor, to: prevDay(range.from) });
    }
    if (range.to >= cursor) {
      cursor = nextDay(range.to);
    }
  }

  if (cursor <= to) {
    gaps.push({ from: cursor, to });
  }

  return gaps;
}

/**
 * Store newly fetched candles and record the fetch range.
 * Consolidates all fetch ranges for a symbol into a single spanning record.
 */
export async function storeCandles(
  symbol: string,
  from: string,
  to: string,
  data: Candle[],
): Promise<void> {
  // Find global min 'from' and max 'to' for this symbol
  const { data: existing, error: fetchErr } = await supabase
    .from('fetch_ranges')
    .select('from_date, to_date')
    .eq('symbol', symbol);

  if (fetchErr)
    throw new Error(`Failed to get fetch ranges: ${fetchErr.message}`);

  let minFrom = from;
  let maxTo = to;
  for (const r of existing ?? []) {
    const rd = r.from_date.slice(0, 10);
    const rt = r.to_date.slice(0, 10);
    if (rd < minFrom) minFrom = rd;
    if (rt > maxTo) maxTo = rt;
  }

  // Insert candles (upsert — skip duplicates)
  if (data.length > 0) {
    // Batch into chunks of 500 to avoid payload limits
    const BATCH_SIZE = 500;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE).map((candle) => ({
        symbol,
        date: candle.date,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
      }));

      const { error: insertErr } = await supabase
        .from('candles')
        .upsert(batch, { onConflict: 'symbol,date', ignoreDuplicates: true });

      if (insertErr)
        throw new Error(`Failed to insert candles: ${insertErr.message}`);
    }
  }

  // Replace all existing fetch_range records with a single spanning record
  const { error: deleteErr } = await supabase
    .from('fetch_ranges')
    .delete()
    .eq('symbol', symbol);

  if (deleteErr)
    throw new Error(`Failed to delete fetch ranges: ${deleteErr.message}`);

  const { error: insertRangeErr } = await supabase
    .from('fetch_ranges')
    .insert({ symbol, from_date: minFrom, to_date: maxTo });

  if (insertRangeErr)
    throw new Error(
      `Failed to insert fetch range: ${insertRangeErr.message}`,
    );
}

/**
 * Get count of cached symbols (for progress display).
 */
export async function getCachedSymbolCount(
  symbols: string[],
  from: string,
  to: string,
): Promise<number> {
  if (symbols.length === 0) return 0;

  let count = 0;
  for (const symbol of symbols) {
    const missing = await getMissingRanges(symbol, from, to);
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
