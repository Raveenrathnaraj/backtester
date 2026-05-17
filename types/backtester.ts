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
  avgHoldingDays: number;
  totalDeployed: number;
  totalReturned: number;
}

// Backtest configuration
export interface BacktestConfig {
  startDate: string;
  endDate: string;
  amountPerBuy: number;
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
