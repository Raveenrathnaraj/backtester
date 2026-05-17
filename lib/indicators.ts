import type { Candle } from "@/types/backtester";

/**
 * Technical indicator functions.
 * All functions take a sorted candle array and a target date,
 * and compute the indicator using candles up to (and including) that date.
 */

// --- Helpers ---

/** Get candles up to and including the given date. */
function candlesUpTo(candles: Candle[], date: string): Candle[] {
  const result: Candle[] = [];
  for (const c of candles) {
    if (c.date <= date) result.push(c);
    else break; // candles are sorted
  }
  return result;
}

/** Get the last N closing prices up to the given date. */
function lastNCloses(candles: Candle[], date: string, n: number): number[] {
  const relevant = candlesUpTo(candles, date);
  return relevant.slice(-n).map((c) => c.close);
}

// --- SMA ---

export function computeSMA(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const closes = lastNCloses(candles, date, period);
  if (closes.length < period) return null;
  return closes.reduce((sum, c) => sum + c, 0) / period;
}

// --- EMA ---

export function computeEMA(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const relevant = candlesUpTo(candles, date);
  if (relevant.length < period) return null;

  const multiplier = 2 / (period + 1);

  // Seed EMA with SMA of first `period` candles
  let ema = 0;
  for (let i = 0; i < period; i++) {
    ema += relevant[i].close;
  }
  ema /= period;

  // Apply EMA formula for remaining candles
  for (let i = period; i < relevant.length; i++) {
    ema = (relevant[i].close - ema) * multiplier + ema;
  }

  return ema;
}

// --- RSI ---

export function computeRSI(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const relevant = candlesUpTo(candles, date);
  // Need at least period + 1 candles to compute period changes
  if (relevant.length < period + 1) return null;

  const changes: number[] = [];
  for (let i = 1; i < relevant.length; i++) {
    changes.push(relevant[i].close - relevant[i - 1].close);
  }

  // Initial average gain/loss from last `period` changes
  const recentChanges = changes.slice(-period);

  let avgGain = 0;
  let avgLoss = 0;
  for (const ch of recentChanges) {
    if (ch > 0) avgGain += ch;
    else avgLoss += Math.abs(ch);
  }
  avgGain /= period;
  avgLoss /= period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// --- Rolling High ---

export function computeRollingHigh(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const relevant = candlesUpTo(candles, date);
  // Use candles before the current date for the rolling window
  const windowCandles = relevant.slice(0, -1).slice(-period);
  if (windowCandles.length === 0) return null;

  let max = windowCandles[0].high;
  for (let i = 1; i < windowCandles.length; i++) {
    if (windowCandles[i].high > max) max = windowCandles[i].high;
  }
  return max;
}

// --- Rolling Low ---

export function computeRollingLow(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const relevant = candlesUpTo(candles, date);
  const windowCandles = relevant.slice(0, -1).slice(-period);
  if (windowCandles.length === 0) return null;

  let min = windowCandles[0].low;
  for (let i = 1; i < windowCandles.length; i++) {
    if (windowCandles[i].low < min) min = windowCandles[i].low;
  }
  return min;
}

// --- ATR (Average True Range) ---

export function computeATR(
  candles: Candle[],
  period: number,
  date: string,
): number | null {
  const relevant = candlesUpTo(candles, date);
  if (relevant.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = 1; i < relevant.length; i++) {
    const high = relevant[i].high;
    const low = relevant[i].low;
    const prevClose = relevant[i - 1].close;
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose),
    );
    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  if (recentTR.length < period) return null;

  return recentTR.reduce((sum, tr) => sum + tr, 0) / period;
}

// --- Bollinger Bands ---

export function computeBBands(
  candles: Candle[],
  period: number,
  stddev: number,
  date: string,
): { upper: number; middle: number; lower: number } | null {
  const closes = lastNCloses(candles, date, period);
  if (closes.length < period) return null;

  const middle = closes.reduce((sum, c) => sum + c, 0) / period;

  const variance =
    closes.reduce((sum, c) => sum + (c - middle) ** 2, 0) / period;
  const sd = Math.sqrt(variance);

  return {
    upper: middle + stddev * sd,
    middle,
    lower: middle - stddev * sd,
  };
}

// --- MACD ---

export function computeMACD(
  candles: Candle[],
  fast: number,
  slow: number,
  signalPeriod: number,
  date: string,
): { macd: number; signal: number; histogram: number } | null {
  const relevant = candlesUpTo(candles, date);
  // Need enough candles for the slow EMA + signal smoothing
  if (relevant.length < slow + signalPeriod) return null;

  // Helper: compute EMA series from closes
  const closes = relevant.map((c) => c.close);

  const emaFromCloses = (data: number[], period: number): number[] => {
    const result: number[] = [];
    const multiplier = 2 / (period + 1);

    // Seed with SMA
    let ema = 0;
    for (let i = 0; i < period; i++) {
      ema += data[i];
    }
    ema /= period;
    result.push(ema);

    for (let i = period; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
      result.push(ema);
    }
    return result;
  };

  const fastEMA = emaFromCloses(closes, fast);
  const slowEMA = emaFromCloses(closes, slow);

  // MACD line: fast EMA - slow EMA (aligned from the end)
  const macdLine: number[] = [];
  const offset = fastEMA.length - slowEMA.length;
  for (let i = 0; i < slowEMA.length; i++) {
    macdLine.push(fastEMA[i + offset] - slowEMA[i]);
  }

  if (macdLine.length < signalPeriod) return null;

  // Signal line: EMA of MACD line
  const signalLine = emaFromCloses(macdLine, signalPeriod);

  const macdValue = macdLine[macdLine.length - 1];
  const signalValue = signalLine[signalLine.length - 1];

  return {
    macd: macdValue,
    signal: signalValue,
    histogram: macdValue - signalValue,
  };
}

// --- Previous Close ---

export function getPrevClose(
  candles: Candle[],
  date: string,
  n: number,
): number | null {
  const relevant = candlesUpTo(candles, date);
  // Index of the candle N days before the last one
  const idx = relevant.length - 1 - n;
  if (idx < 0) return null;
  return relevant[idx].close;
}

// --- Indicator Factory ---

/**
 * Creates the `indicators` object for a StrategyContext.
 * Uses memoization to avoid recomputing the same indicator
 * with the same parameters within a single strategy evaluation.
 */
export function createIndicatorFunctions(
  candles: Candle[],
  date: string,
): {
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
} {
  const memo = new Map<string, unknown>();

  const memoize = <T>(key: string, fn: () => T): T => {
    if (memo.has(key)) return memo.get(key) as T;
    const result = fn();
    memo.set(key, result);
    return result;
  };

  return {
    sma: (period) =>
      memoize(`sma-${period}`, () => computeSMA(candles, period, date)),
    ema: (period) =>
      memoize(`ema-${period}`, () => computeEMA(candles, period, date)),
    rsi: (period) =>
      memoize(`rsi-${period}`, () => computeRSI(candles, period, date)),
    rollingHigh: (period) =>
      memoize(`rh-${period}`, () => computeRollingHigh(candles, period, date)),
    rollingLow: (period) =>
      memoize(`rl-${period}`, () => computeRollingLow(candles, period, date)),
    atr: (period) =>
      memoize(`atr-${period}`, () => computeATR(candles, period, date)),
    bbands: (period, stddev = 2) =>
      memoize(`bb-${period}-${stddev}`, () =>
        computeBBands(candles, period, stddev, date),
      ),
    macd: (fast = 12, slow = 26, signal = 9) =>
      memoize(`macd-${fast}-${slow}-${signal}`, () =>
        computeMACD(candles, fast, slow, signal, date),
      ),
    prevClose: (n) => memoize(`pc-${n}`, () => getPrevClose(candles, date, n)),
  };
}
