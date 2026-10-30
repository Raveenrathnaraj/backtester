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
 * Pure backtesting engine with realistic portfolio accounting,
 * execution models (next-bar open or same-bar close), and slippage/brokerage fees.
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
  const {
    startDate,
    endDate,
    amountPerBuy,
    initialCapital = 1000000, // Default ₹10 Lakhs
    executionModel = "next_open", // Default to realistic next-bar open fill
    slippagePct = 0.05, // 0.05% slippage
    brokerageFeePct = 0.1, // 0.1% transaction cost / STT / exchange fee
  } = config;

  const totalFeeRate = (slippagePct + brokerageFeePct) / 100;

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
    return { trades: [], equityCurve: [], summary: emptySummary(initialCapital) };
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

  let cash = initialCapital;
  let totalDeployed = 0;
  let totalReturned = 0;
  let maxCapitalDeployed = 0;

  // Pending orders queued for next-bar execution
  interface PendingOrder {
    symbol: string;
    action: StrategyAction;
    signalDate: string;
  }
  const pendingOrders: PendingOrder[] = [];

  // Equity curve tracking
  const equityCurve: EquityPoint[] = [];

  for (let dateIndex = 0; dateIndex < tradingDates.length; dateIndex++) {
    const date = tradingDates[dateIndex];

    // --- PHASE 1: EXECUTE PENDING ORDERS (if executionModel === 'next_open') ---
    if (executionModel === "next_open" && pendingOrders.length > 0) {
      // Process pending orders at today's OPEN price
      const ordersToExecute = [...pendingOrders];
      pendingOrders.length = 0;

      // Prioritize sells first to free up cash
      ordersToExecute.sort((a, b) => {
        if (a.action.action === "sell" && b.action.action !== "sell") return -1;
        if (a.action.action !== "sell" && b.action.action === "sell") return 1;
        return 0;
      });

      for (const order of ordersToExecute) {
        const candleMap = symbolCandles.get(order.symbol);
        const todayCandle = candleMap?.get(date);
        if (!todayCandle) continue;

        const holding = holdings.get(order.symbol);
        const openPrice = todayCandle.open;

        if (order.action.action === "sell" && holding) {
          executeSell(
            order.symbol,
            holding,
            order.action,
            openPrice,
            date,
            totalFeeRate,
          );
        } else if (order.action.action === "buy") {
          executeBuy(
            order.symbol,
            holding,
            order.action,
            openPrice,
            date,
            totalFeeRate,
          );
        }
      }
    }

    // --- PHASE 2: UPDATE HIGHS & EVALUATE STRATEGY SIGNALS ---
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

      // Calculate current portfolio value for context
      let currentPositionsValue = 0;
      for (const [hSym, h] of holdings) {
        const c = symbolCandles.get(hSym)?.get(date);
        const p = c ? c.close : h.avgEntryPrice;
        currentPositionsValue += p * h.totalShares;
      }
      const portfolioValue = cash + currentPositionsValue;

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
          cash,
          portfolioValue,
        },
        indicators: createIndicatorFunctions(allCandles, date),
        config: { amountPerBuy },
      };

      // Execute strategy function
      let action: StrategyAction;
      try {
        action = strategyFn(ctx);
      } catch {
        action = { action: "hold" };
      }

      if (action.action === "hold") continue;

      if (executionModel === "next_open") {
        // Queue order for next trading day's open
        pendingOrders.push({
          symbol,
          action,
          signalDate: date,
        });
      } else {
        // Same-bar close execution
        if (action.action === "buy") {
          executeBuy(
            symbol,
            holding,
            action,
            todayCandle.close,
            date,
            totalFeeRate,
          );
        } else if (action.action === "sell" && holding) {
          executeSell(
            symbol,
            holding,
            action,
            todayCandle.close,
            date,
            totalFeeRate,
          );
        }
      }
    }

    // --- PHASE 3: RECORD DAILY NAV / EQUITY ---
    let openPositionsValue = 0;
    for (const [symbol, holding] of holdings) {
      const candleMap = symbolCandles.get(symbol)!;
      const todayCandle = candleMap.get(date);
      const price = todayCandle ? todayCandle.close : holding.avgEntryPrice;
      openPositionsValue += price * holding.totalShares;
    }

    const dailyEquity = cash + openPositionsValue;
    if (openPositionsValue > maxCapitalDeployed) {
      maxCapitalDeployed = openPositionsValue;
    }

    equityCurve.push({
      date,
      equity: Math.round(dailyEquity * 100) / 100,
      cash: Math.round(cash * 100) / 100,
      openPositionsValue: Math.round(openPositionsValue * 100) / 100,
    });
  }

  // --- PHASE 4: CLOSE OPEN POSITIONS AT FINAL DATE ---
  const lastDate = tradingDates[tradingDates.length - 1];
  for (const [symbol, holding] of holdings) {
    const candleMap = symbolCandles.get(symbol)!;
    let lastCandle: Candle | undefined;
    for (let i = tradingDates.length - 1; i >= 0; i--) {
      lastCandle = candleMap.get(tradingDates[i]);
      if (lastCandle) break;
    }

    const rawExitPrice = lastCandle?.close ?? holding.avgEntryPrice;
    // Mark to market at final bar
    for (const lot of holding.lots) {
      const pnlAbs = (rawExitPrice - lot.entryPrice) * lot.shares;
      const pnlPct = ((rawExitPrice - lot.entryPrice) / lot.entryPrice) * 100;
      const holdingDays = daysBetween(lot.entryDate, lastDate);

      trades.push({
        symbol,
        entryDate: lot.entryDate,
        entryPrice: lot.entryPrice,
        exitDate: null,
        exitPrice: null,
        peakSinceEntry: holding.peakSinceEntry,
        pnlAbs: Math.round(pnlAbs * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        holdingDays,
        shares: lot.shares,
        status: "open",
      });

      totalReturned += rawExitPrice * lot.shares;
    }
  }

  // Final summary calculation
  const summary = computeSummary(
    trades,
    equityCurve,
    initialCapital,
    totalDeployed,
    totalReturned,
    maxCapitalDeployed,
  );

  return { trades, equityCurve, summary };

  // --- Helper execution closures ---

  function executeBuy(
    symbol: string,
    existingHolding: Holding | undefined,
    action: StrategyAction & { action: "buy" },
    executionPrice: number,
    date: string,
    feeRate: number,
  ) {
    // Effective price factoring slippage
    const effectiveEntryPrice = executionPrice * (1 + feeRate);

    let budget = 0;
    if ("useAmount" in action && action.useAmount) {
      budget = action.amount;
    } else if ("shares" in action && typeof action.shares === "number") {
      budget = action.shares * effectiveEntryPrice;
    }

    // Capital check: cannot spend more cash than available
    const availableCash = Math.max(0, cash);
    const amountToSpend = Math.min(budget, availableCash);
    if (amountToSpend < effectiveEntryPrice) return; // Cannot afford 1 share

    const sharesToBuy = Math.floor(amountToSpend / effectiveEntryPrice);
    if (sharesToBuy <= 0) return;

    const totalCost = sharesToBuy * effectiveEntryPrice;
    cash -= totalCost;
    totalDeployed += totalCost;

    const newLot: LotInfo = {
      entryDate: date,
      entryPrice: Math.round(effectiveEntryPrice * 100) / 100,
      shares: sharesToBuy,
    };

    if (existingHolding) {
      existingHolding.lots.push(newLot);
      existingHolding.totalShares += sharesToBuy;
      existingHolding.avgEntryPrice = computeAvgEntryPrice(existingHolding.lots);
      existingHolding.peakSinceEntry = Math.max(
        existingHolding.peakSinceEntry,
        executionPrice,
      );
    } else {
      holdings.set(symbol, {
        lots: [newLot],
        totalShares: sharesToBuy,
        avgEntryPrice: Math.round(effectiveEntryPrice * 100) / 100,
        peakSinceEntry: executionPrice,
      });
    }
  }

  function executeSell(
    symbol: string,
    holding: Holding,
    action: StrategyAction & { action: "sell" },
    executionPrice: number,
    date: string,
    feeRate: number,
  ) {
    let sharesToSell = 0;
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

    if (sharesToSell <= 0) return;

    // Effective exit price factoring slippage and brokerage
    const effectiveExitPrice = executionPrice * (1 - feeRate);
    let remaining = sharesToSell;

    while (remaining > 0 && holding.lots.length > 0) {
      const lot = holding.lots[0];
      const sellFromLot = Math.min(remaining, lot.shares);

      const pnlAbs = (effectiveExitPrice - lot.entryPrice) * sellFromLot;
      const pnlPct = ((effectiveExitPrice - lot.entryPrice) / lot.entryPrice) * 100;
      const holdingDays = daysBetween(lot.entryDate, date);

      trades.push({
        symbol,
        entryDate: lot.entryDate,
        entryPrice: lot.entryPrice,
        exitDate: date,
        exitPrice: Math.round(effectiveExitPrice * 100) / 100,
        peakSinceEntry: holding.peakSinceEntry,
        pnlAbs: Math.round(pnlAbs * 100) / 100,
        pnlPct: Math.round(pnlPct * 100) / 100,
        holdingDays,
        shares: sellFromLot,
        status: "closed",
      });

      const proceeds = effectiveExitPrice * sellFromLot;
      cash += proceeds;
      totalReturned += proceeds;

      lot.shares -= sellFromLot;
      remaining -= sellFromLot;

      if (lot.shares <= 0) {
        holding.lots.shift();
      }
    }

    holding.totalShares -= sharesToSell;
    if (holding.totalShares <= 0 || holding.lots.length === 0) {
      holdings.delete(symbol);
    } else {
      holding.avgEntryPrice = computeAvgEntryPrice(holding.lots);
    }
  }
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
    avgEntryPrice: Math.round(holding.avgEntryPrice * 100) / 100,
    peakSinceEntry: holding.peakSinceEntry,
    currentPnlPct: Math.round(currentPnlPct * 100) / 100,
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
  initialCapital: number,
  totalDeployed: number,
  totalReturned: number,
  maxCapitalDeployed: number,
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

  const finalEquity =
    equityCurve.length > 0
      ? equityCurve[equityCurve.length - 1].equity
      : initialCapital;

  // True Portfolio Return based on initial capital
  const totalReturnPct =
    initialCapital > 0
      ? ((finalEquity - initialCapital) / initialCapital) * 100
      : 0;

  const avgHoldingDays =
    trades.length > 0
      ? trades.reduce((sum, t) => sum + t.holdingDays, 0) / trades.length
      : 0;

  // Max drawdown on portfolio equity curve
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

  // Institutional Metrics: CAGR & Sharpe Ratio
  let cagrPct = 0;
  let sharpeRatio = 0;

  if (equityCurve.length > 1) {
    const firstDate = new Date(equityCurve[0].date + "T00:00:00Z");
    const lastDate = new Date(
      equityCurve[equityCurve.length - 1].date + "T00:00:00Z",
    );
    const totalDays = Math.max(
      1,
      (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const years = totalDays / 365.25;

    if (years > 0.05 && finalEquity > 0 && initialCapital > 0) {
      cagrPct = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;
    }

    // Daily returns array for Sharpe Ratio
    const dailyReturns: number[] = [];
    for (let i = 1; i < equityCurve.length; i++) {
      const prev = equityCurve[i - 1].equity;
      const curr = equityCurve[i].equity;
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev);
      }
    }

    if (dailyReturns.length > 5) {
      const meanReturn =
        dailyReturns.reduce((sum, r) => sum + r, 0) / dailyReturns.length;
      const variance =
        dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
        dailyReturns.length;
      const stdDev = Math.sqrt(variance);

      // Assume 6.5% risk-free rate per annum (approx Indian 91-day T-Bill)
      const dailyRiskFree = 0.065 / 252;
      if (stdDev > 0) {
        sharpeRatio =
          ((meanReturn - dailyRiskFree) / stdDev) * Math.sqrt(252);
      }
    }
  }

  return {
    totalTrades: trades.length,
    openTrades: openTrades.length,
    closedTrades: closedTrades.length,
    winRate: Math.round(winRate * 10) / 10,
    avgWinPct: Math.round(avgWinPct * 100) / 100,
    avgLossPct: Math.round(avgLossPct * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdownPct: Math.round(maxDrawdownPct * 100) / 100,
    totalReturnPct: Math.round(totalReturnPct * 100) / 100,
    cagrPct: Math.round(cagrPct * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    avgHoldingDays: Math.round(avgHoldingDays),
    totalDeployed: Math.round(totalDeployed),
    maxCapitalDeployed: Math.round(maxCapitalDeployed),
    totalReturned: Math.round(totalReturned),
    initialCapital,
    finalEquity: Math.round(finalEquity),
  };
}

function emptySummary(initialCapital = 1000000): BacktestSummary {
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
    cagrPct: 0,
    sharpeRatio: 0,
    avgHoldingDays: 0,
    totalDeployed: 0,
    maxCapitalDeployed: 0,
    totalReturned: 0,
    initialCapital,
    finalEquity: initialCapital,
  };
}

function daysBetween(from: string, to: string): number {
  const d1 = new Date(from + "T00:00:00Z");
  const d2 = new Date(to + "T00:00:00Z");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}
