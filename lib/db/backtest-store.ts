import { db } from './index';
import { backtestRuns } from './schema';
import { desc, eq } from 'drizzle-orm';
import type { BacktestSummary, Trade, EquityPoint } from '@/types/backtester';

/**
 * Save a completed backtest run. Returns the new row ID.
 */
export function saveBacktestRun(
  config: { startDate: string; endDate: string; amountPerBuy: number },
  totalStocks: number,
  summary: BacktestSummary,
  trades: Trade[],
  equityCurve: EquityPoint[],
  durationMs: number,
  strategyId?: number,
): number {
  const result = db
    .insert(backtestRuns)
    .values({
      startDate: config.startDate,
      endDate: config.endDate,
      amountPerBuy: config.amountPerBuy,
      totalStocks,
      summary: JSON.stringify(summary),
      trades: JSON.stringify(trades),
      equityCurve: JSON.stringify(equityCurve),
      durationMs,
      strategyId: strategyId ?? null,
    })
    .returning({ id: backtestRuns.id })
    .get();

  return result.id;
}

/**
 * List past backtest runs (most recent first).
 */
export function listBacktestRuns(limit = 20) {
  return db
    .select({
      id: backtestRuns.id,
      startDate: backtestRuns.startDate,
      endDate: backtestRuns.endDate,
      amountPerBuy: backtestRuns.amountPerBuy,
      totalStocks: backtestRuns.totalStocks,
      summary: backtestRuns.summary,
      createdAt: backtestRuns.createdAt,
      durationMs: backtestRuns.durationMs,
    })
    .from(backtestRuns)
    .orderBy(desc(backtestRuns.createdAt))
    .limit(limit)
    .all()
    .map((row) => ({
      ...row,
      summary: JSON.parse(row.summary) as BacktestSummary,
    }));
}

/**
 * Get a specific backtest run by ID.
 */
export function getBacktestRun(id: number) {
  const row = db
    .select()
    .from(backtestRuns)
    .where(eq(backtestRuns.id, id))
    .get();

  if (!row) return null;

  return {
    ...row,
    summary: JSON.parse(row.summary) as BacktestSummary,
    trades: JSON.parse(row.trades) as Trade[],
    equityCurve: JSON.parse(row.equityCurve) as EquityPoint[],
  };
}
