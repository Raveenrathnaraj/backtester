import { createServiceClient } from "@/lib/supabase/service";
import type { BacktestSummary, Trade, EquityPoint } from "@/types/backtester";

const supabase = createServiceClient();

/**
 * Save a completed backtest run. Returns the new UUID.
 */
export async function saveBacktestRun(
  userId: string,
  config: { startDate: string; endDate: string; amountPerBuy: number },
  totalStocks: number,
  summary: BacktestSummary,
  trades: Trade[],
  equityCurve: EquityPoint[],
  durationMs: number,
  strategyId?: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("backtest_runs")
    .insert({
      user_id: userId,
      start_date: config.startDate,
      end_date: config.endDate,
      amount_per_buy: config.amountPerBuy,
      total_stocks: totalStocks,
      summary,
      trades,
      equity_curve: equityCurve,
      duration_ms: durationMs,
      strategy_id: strategyId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to save backtest run: ${error.message}`);
  return data.id;
}

/**
 * List past backtest runs for a user (most recent first).
 */
export async function listBacktestRuns(userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("backtest_runs")
    .select(
      "id, start_date, end_date, amount_per_buy, total_stocks, summary, created_at, duration_ms",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list backtest runs: ${error.message}`);

  return (data ?? []).map((row: any) => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    amountPerBuy: row.amount_per_buy,
    totalStocks: row.total_stocks,
    summary: row.summary as BacktestSummary,
    createdAt: row.created_at,
    durationMs: row.duration_ms,
  }));
}

/**
 * Get a specific backtest run by ID (with user guard).
 */
export async function getBacktestRun(userId: string, id: string) {
  const { data, error } = await supabase
    .from("backtest_runs")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get backtest run: ${error.message}`);
  if (!data) return null;

  return {
    id: data.id,
    startDate: data.start_date,
    endDate: data.end_date,
    amountPerBuy: data.amount_per_buy,
    totalStocks: data.total_stocks,
    summary: data.summary as BacktestSummary,
    trades: data.trades as Trade[],
    equityCurve: data.equity_curve as EquityPoint[],
    createdAt: data.created_at,
    durationMs: data.duration_ms,
    strategyId: data.strategy_id,
  };
}
