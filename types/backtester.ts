// Core OHLC candle
export interface Candle {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// Trade record output
export interface Trade {
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string | null;
  exitPrice: number | null;
  peakSinceEntry: number;
  pnlAbs: number;
  pnlPct: number;
  holdingDays: number;
  shares: number;
  status: "closed" | "open";
}

// Equity curve data point
export interface EquityPoint {
  date: string;
  equity: number;
  cash?: number;
  openPositionsValue?: number;
}

// Portfolio summary stats
export interface BacktestSummary {
  totalTrades: number;
  openTrades: number;
  closedTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  profitFactor: number;
  maxDrawdownPct: number;
  totalReturnPct: number;
  cagrPct?: number;
  sharpeRatio?: number;
  avgHoldingDays: number;
  totalDeployed: number;
  maxCapitalDeployed?: number;
  totalReturned: number;
  initialCapital?: number;
  finalEquity?: number;
}

// Backtest configuration
export interface BacktestConfig {
  startDate: string;
  endDate: string;
  amountPerBuy: number;
  initialCapital?: number;
  executionModel?: "next_open" | "same_close";
  slippagePct?: number; // e.g. 0.05 for 0.05%
  brokerageFeePct?: number; // e.g. 0.1 for 0.1% per leg
}

// SSE progress events
export interface BacktestProgress {
  phase: "instruments" | "historical" | "backtest" | "done" | "error";
  message: string;
  progress?: number; // 0-100
  data?: {
    trades: Trade[];
    equityCurve: EquityPoint[];
    summary: BacktestSummary;
    runId: string;
  };
}
