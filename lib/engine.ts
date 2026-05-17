import type {
  Candle,
  Trade,
  EquityPoint,
  BacktestSummary,
  BacktestConfig,
} from "@/types/backtester";
import type {
  StrategyAction,
  StrategyContext,
  PositionInfo,
  LotInfo,
} from "@/types/strategy";
import { createIndicatorFunctions } from "./indicators";

interface Holding {
  lots: LotInfo[];
  totalShares: number;
  avgEntryPrice: number;
  peakSinceEntry: number;
}

/**
 * Pure backtesting engine. No I/O, no API calls.
 *
 * Accepts a strategy function body (string) that is compiled and
 * executed in a sandboxed scope via `new Function()`.
 *
 * The strategy function receives a StrategyContext and returns a StrategyAction.
 * Positions are tracked using individual lots (FIFO for sells).
 *
 * @param stockData Map of symbol → sorted candles (including lookback period)
 * @param config Backtest configuration
 * @param strategyCode The strategy function body string
 * @returns trades, equity curve, and summary statistics
 */
export function runBacktest(
  stockData: Map<string, Candle[]>,
  config: BacktestConfig,
  strategyCode: string,
): { trades: Trade[]; equityCurve: EquityPoint[]; summary: BacktestSummary } {
  const { startDate, endDate, amountPerBuy } = config;

  // Compile strategy function once
  // eslint-disable-next-line no-new-func
  const strategyFn = new Function("ctx", strategyCode) as (
    ctx: StrategyContext,
  ) => StrategyAction;

  // Collect all unique trading dates in [startDate, endDate]
  const tradingDatesSet = new Set<string>();
  for (const candles of stockData.values()) {
    for (const c of candles) {
      if (c.date >= startDate && c.date <= endDate) {
        tradingDatesSet.add(c.date);
      }
    }
  }
  const tradingDates = [...tradingDatesSet].sort();

  if (tradingDates.length === 0) {
    return { trades: [], equityCurve: [], summary: emptySummary() };
  }

  // Pre-build per-symbol date-indexed maps for O(1) lookups
  const symbolCandles = new Map<string, Map<string, Candle>>();
  const symbolCandleArrays = new Map<string, Candle[]>();
  for (const [symbol, candles] of stockData) {
    const map = new Map<string, Candle>();
    for (const c of candles) {
      map.set(c.date, c);
    }
    symbolCandles.set(symbol, map);
    symbolCandleArrays.set(symbol, candles);
  }

  const holdings = new Map<string, Holding>();
  const trades: Trade[] = [];
  let totalDeployed = 0;
  let totalReturned = 0;

  // Equity curve tracking
  const equityCurve: EquityPoint[] = [];

  for (const date of tradingDates) {
    for (const [symbol, candleMap] of symbolCandles) {
      const todayCandle = candleMap.get(date);
      if (!todayCandle) continue;

      const holding = holdings.get(symbol);
      const allCandles = symbolCandleArrays.get(symbol)!;

      // Update peak since entry
      if (holding) {
        holding.peakSinceEntry = Math.max(
          holding.peakSinceEntry,
          todayCandle.high,
        );
      }

      // Build StrategyContext
      const position = holding
        ? buildPositionInfo(holding, todayCandle.close, date)
        : null;
      const ctx: StrategyContext = {
        candle: todayCandle,
        symbol,
        history: allCandles,
        position,
        portfolio: {
          totalOpenPositions: holdings.size,
          totalDeployed,
        },
        indicators: createIndicatorFunctions(allCandles, date),
        config: { amountPerBuy },
      };

      // Execute strategy
      let action: StrategyAction;
      try {
        action = strategyFn(ctx);
      } catch {
        // If strategy throws, treat as 'hold'
        action = { action: "hold" };
      }

      // Interpret action
      if (action.action === "buy") {
        let sharesToBuy: number;

        if ("useAmount" in action && action.useAmount) {
          sharesToBuy = Math.floor(action.amount / todayCandle.close);
        } else if ("shares" in action) {
          sharesToBuy = typeof action.shares === "number" ? action.shares : 0;
        } else {
          sharesToBuy = 0;
        }

        if (sharesToBuy <= 0) continue;

        const newLot: LotInfo = {
          entryDate: date,
          entryPrice: todayCandle.close,
          shares: sharesToBuy,
        };

        if (holding) {
          // Step-up: add to existing position
          holding.lots.push(newLot);
          holding.totalShares += sharesToBuy;
          holding.avgEntryPrice = computeAvgEntryPrice(holding.lots);
        } else {
          // New position
          holdings.set(symbol, {
            lots: [newLot],
            totalShares: sharesToBuy,
            avgEntryPrice: todayCandle.close,
            peakSinceEntry: todayCandle.close,
          });
        }

        totalDeployed += todayCandle.close * sharesToBuy;
      } else if (action.action === "sell" && holding) {
        let sharesToSell: number;

        if ("useFraction" in action && action.useFraction) {
          sharesToSell = Math.floor(holding.totalShares * action.fraction);
        } else if ("shares" in action) {
          sharesToSell =
            action.shares === "all"
              ? holding.totalShares
              : Math.min(action.shares as number, holding.totalShares);
        } else {
          sharesToSell = holding.totalShares;
        }

        if (sharesToSell <= 0) continue;

        // FIFO sell from oldest lots
        const exitPrice = todayCandle.close;
        let remaining = sharesToSell;

        while (remaining > 0 && holding.lots.length > 0) {
          const lot = holding.lots[0];
          const sellFromLot = Math.min(remaining, lot.shares);

          const pnlAbs = (exitPrice - lot.entryPrice) * sellFromLot;
          const pnlPct = ((exitPrice - lot.entryPrice) / lot.entryPrice) * 100;
          const holdingDays = daysBetween(lot.entryDate, date);

          trades.push({
            symbol,
            entryDate: lot.entryDate,
            entryPrice: lot.entryPrice,
            exitDate: date,
            exitPrice,
            peakSinceEntry: holding.peakSinceEntry,
            pnlAbs,
            pnlPct,
            holdingDays,
            shares: sellFromLot,
            status: "closed",
          });

          totalReturned += exitPrice * sellFromLot;
          lot.shares -= sellFromLot;
          remaining -= sellFromLot;

          if (lot.shares <= 0) {
            holding.lots.shift(); // Remove exhausted lot
          }
        }

        holding.totalShares -= sharesToSell;

        if (holding.totalShares <= 0 || holding.lots.length === 0) {
          holdings.delete(symbol);
        } else {
          holding.avgEntryPrice = computeAvgEntryPrice(holding.lots);
        }
      }
      // action === 'hold' → do nothing
    }

    // Compute daily equity: sum of all open positions at market value
    let equity = 0;
    for (const [symbol, holding] of holdings) {
      const candleMap = symbolCandles.get(symbol)!;
      const todayCandle = candleMap.get(date);
      const price = todayCandle ? todayCandle.close : holding.avgEntryPrice; // fallback if no data today
      equity += price * holding.totalShares;
    }
    // Add realized P&L from closed trades
    const closedPnL = trades
      .filter((t) => t.status === "closed")
      .reduce((sum, t) => sum + t.pnlAbs, 0);
    equity += closedPnL;

    equityCurve.push({ date, equity });
  }

  // Close any remaining open positions at last available price
  const lastDate = tradingDates[tradingDates.length - 1];
  for (const [symbol, holding] of holdings) {
    const candleMap = symbolCandles.get(symbol)!;
    // Find last available candle
    let lastCandle: Candle | undefined;
    for (let i = tradingDates.length - 1; i >= 0; i--) {
      lastCandle = candleMap.get(tradingDates[i]);
      if (lastCandle) break;
    }

    const exitPrice = lastCandle?.close ?? holding.avgEntryPrice;

    // Record each remaining lot as an open trade
    for (const lot of holding.lots) {
      const pnlAbs = (exitPrice - lot.entryPrice) * lot.shares;
      const pnlPct = ((exitPrice - lot.entryPrice) / lot.entryPrice) * 100;
      const holdingDays = daysBetween(lot.entryDate, lastDate);

      trades.push({
        symbol,
        entryDate: lot.entryDate,
        entryPrice: lot.entryPrice,
        exitDate: null,
        exitPrice: null,
        peakSinceEntry: holding.peakSinceEntry,
        pnlAbs,
        pnlPct,
        holdingDays,
        shares: lot.shares,
        status: "open",
      });

      totalReturned += exitPrice * lot.shares;
    }
  }

  const summary = computeSummary(
    trades,
    equityCurve,
    totalDeployed,
    totalReturned,
  );
  return { trades, equityCurve, summary };
}

// --- Helpers ---

function buildPositionInfo(
  holding: Holding,
  currentClose: number,
  currentDate: string,
): PositionInfo {
  const firstLotDate = holding.lots[0]?.entryDate ?? currentDate;
  const currentPnlPct =
    holding.avgEntryPrice > 0
      ? ((currentClose - holding.avgEntryPrice) / holding.avgEntryPrice) * 100
      : 0;

  return {
    lots: holding.lots.map((l) => ({ ...l })),
    totalShares: holding.totalShares,
    avgEntryPrice: holding.avgEntryPrice,
    peakSinceEntry: holding.peakSinceEntry,
    currentPnlPct,
    daysHeld: daysBetween(firstLotDate, currentDate),
  };
}

function computeAvgEntryPrice(lots: LotInfo[]): number {
  let totalValue = 0;
  let totalShares = 0;
  for (const lot of lots) {
    totalValue += lot.entryPrice * lot.shares;
    totalShares += lot.shares;
  }
  return totalShares > 0 ? totalValue / totalShares : 0;
}

function computeSummary(
  trades: Trade[],
  equityCurve: EquityPoint[],
  totalDeployed: number,
  totalReturned: number,
): BacktestSummary {
  const closedTrades = trades.filter((t) => t.status === "closed");
  const openTrades = trades.filter((t) => t.status === "open");

  const wins = closedTrades.filter((t) => t.pnlAbs > 0);
  const losses = closedTrades.filter((t) => t.pnlAbs <= 0);

  const totalGains = wins.reduce((sum, t) => sum + t.pnlAbs, 0);
  const totalLosses = Math.abs(losses.reduce((sum, t) => sum + t.pnlAbs, 0));

  const winRate =
    closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
  const avgWinPct =
    wins.length > 0
      ? wins.reduce((sum, t) => sum + t.pnlPct, 0) / wins.length
      : 0;
  const avgLossPct =
    losses.length > 0
      ? losses.reduce((sum, t) => sum + t.pnlPct, 0) / losses.length
      : 0;
  const profitFactor =
    totalLosses > 0 ? totalGains / totalLosses : totalGains > 0 ? Infinity : 0;

  const totalReturnPct =
    totalDeployed > 0
      ? ((totalReturned - totalDeployed) / totalDeployed) * 100
      : 0;

  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

  // Max drawdown on equity curve
  let maxDrawdownPct = 0;
  if (equityCurve.length > 0) {
    let peak = equityCurve[0].equity;
    for (const point of equityCurve) {
      if (point.equity > peak) peak = point.equity;
      if (peak > 0) {
        const dd = ((peak - point.equity) / peak) * 100;
        if (dd > maxDrawdownPct) maxDrawdownPct = dd;
      }
    }
  }

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate,
    avgWinPct,
    avgLossPct,
    profitFactor,
    maxDrawdownPct,
    totalReturnPct,
    avgHoldingDays,
    totalDeployed,
    totalReturned,
  };
}

function emptySummary(): BacktestSummary {
  return {
    totalTrades: 0,
    openTrades: 0,
    closedTrades: 0,
    winRate: 0,
    avgWinPct: 0,
    avgLossPct: 0,
    profitFactor: 0,
    maxDrawdownPct: 0,
    totalReturnPct: 0,
    avgHoldingDays: 0,
    totalDeployed: 0,
    totalReturned: 0,
  };
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from + "T00:00:00Z");
  const d2 = new Date(to + "T00:00:00Z");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}
