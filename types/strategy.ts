import type { Candle } from "./backtester";

// --- Position & Portfolio Info ---

export interface LotInfo {
  entryDate: string;
  entryPrice: number;
  shares: number;
}

export interface PositionInfo {
  lots: LotInfo[];
  totalShares: number;
  avgEntryPrice: number;
  peakSinceEntry: number;
  currentPnlPct: number;
  daysHeld: number;
}

export interface PortfolioInfo {
  totalOpenPositions: number;
  totalDeployed: number;
}

// --- Indicator Functions ---

export interface IndicatorFunctions {
  sma: (period: number) => number | null;
  ema: (period: number) => number | null;
  rsi: (period: number) => number | null;
  rollingHigh: (period: number) => number | null;
  rollingLow: (period: number) => number | null;
  atr: (period: number) => number | null;
  bbands: (
    period: number,
    stddev?: number,
  ) => { upper: number; middle: number; lower: number } | null;
  macd: (
    fast?: number,
    slow?: number,
    signal?: number,
  ) => { macd: number; signal: number; histogram: number } | null;
  prevClose: (n: number) => number | null;
}

// --- Strategy Context (passed to generated functions) ---

export interface StrategyContext {
  candle: Candle;
  symbol: string;
  history: Candle[];
  position: PositionInfo | null;
  portfolio: PortfolioInfo;
  indicators: IndicatorFunctions;
  config: {
    amountPerBuy: number;
  };
}

// --- Strategy Action (returned by generated functions) ---

export type StrategyAction =
  | { action: "hold" }
  | { action: "buy"; shares: number }
  | { action: "buy"; amount: number; useAmount: true }
  | { action: "sell"; shares: number | "all" }
  | { action: "sell"; fraction: number; useFraction: true };

// --- Chat Types ---

export interface GeneratedStrategy {
  name: string;
  code: string;
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  generatedStrategy?: GeneratedStrategy;
}

// --- DB Record ---

export interface StrategyRecord {
  id: string;
  name: string;
  description: string;
  generatedCode: string;
  chatHistory: ChatMessage[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
