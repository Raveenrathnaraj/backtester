import { createServiceClient } from "@/lib/supabase/service";

const supabase = createServiceClient();

export interface DBInstrument {
  symbol: string;
  companyName: string;
  industry: string;
  series: string;
  isinCode: string;
  kiteToken: number | null;
  kiteTokenUpdatedAt: string | null;
}

/**
 * Fetch all NSE equity instruments from the database.
 */
export async function getAllInstruments(): Promise<DBInstrument[]> {
  const { data, error } = await supabase.from("instruments").select("*");

  if (error) throw new Error(`Failed to get instruments: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    symbol: row.symbol,
    companyName: row.company_name,
    industry: row.industry,
    series: row.series,
    isinCode: row.isin_code,
    kiteToken: row.kite_token,
    kiteTokenUpdatedAt: row.kite_token_updated_at,
  }));
}

/**
 * Update the kite token for a specific symbol.
 */
export async function updateKiteToken(
  symbol: string,
  token: number,
): Promise<void> {
  const { error } = await supabase
    .from("instruments")
    .update({
      kite_token: token,
      kite_token_updated_at: new Date().toISOString(),
    })
    .eq("symbol", symbol);

  if (error) throw new Error(`Failed to update kite token: ${error.message}`);
}

/**
 * Check if the stored kite tokens are considered "stale" (> 24 hours old).
 */
export async function areTokensStale(): Promise<boolean> {
  const { data, error } = await supabase
    .from("instruments")
    .select("kite_token_updated_at")
    .limit(1)
    .maybeSingle();

  if (error) return true;
  if (!data || !data.kite_token_updated_at) return true;

  const updatedTime = new Date(data.kite_token_updated_at).getTime();
  const now = Date.now();
  const hoursSinceUpdate = (now - updatedTime) / (1000 * 60 * 60);

  return hoursSinceUpdate > 24;
}

/**
 * Upsert a batch of instruments.
 */
export async function upsertInstruments(
  stocks: {
    symbol: string;
    companyName: string;
    industry: string;
    series: string;
    isinCode: string;
  }[],
): Promise<void> {
  if (stocks.length === 0) return;

  const rows = stocks.map((s) => ({
    symbol: s.symbol,
    company_name: s.companyName,
    industry: s.industry,
    series: s.series,
    isin_code: s.isinCode,
  }));

  const { error } = await supabase
    .from("instruments")
    .upsert(rows, { onConflict: "symbol" });

  if (error) throw new Error(`Failed to upsert instruments: ${error.message}`);
}

/**
 * Get count of instruments.
 */
export async function getInstrumentCount(): Promise<number> {
  const { count, error } = await supabase
    .from("instruments")
    .select("*", { count: "exact", head: true });

  if (error) return 0;
  return count ?? 0;
}

/**
 * Lookup instruments by symbols array.
 */
export async function getInstrumentsBySymbols(
  symbols: string[],
): Promise<DBInstrument[]> {
  if (symbols.length === 0) return [];

  const { data, error } = await supabase
    .from("instruments")
    .select("*")
    .in("symbol", symbols);

  if (error) throw new Error(`Failed to get instruments: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    symbol: row.symbol,
    companyName: row.company_name,
    industry: row.industry,
    series: row.series,
    isinCode: row.isin_code,
    kiteToken: row.kite_token,
    kiteTokenUpdatedAt: row.kite_token_updated_at,
  }));
}
