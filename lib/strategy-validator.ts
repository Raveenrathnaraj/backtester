import type { StrategyAction, StrategyContext } from '@/types/strategy';
import type { Candle } from '@/types/backtester';
import { createIndicatorFunctions } from './indicators';

/** Tokens that must never appear in generated strategy code. */
const FORBIDDEN_TOKENS = [
  'require',
  'import',
  'export',
  'fetch',
  'XMLHttpRequest',
  'process',
  'globalThis',
  'window',
  'document',
  'eval',
  'Function',
  'setTimeout',
  'setInterval',
  'setImmediate',
  'queueMicrotask',
  'Deno',
  'Bun',
  '__dirname',
  '__filename',
  'module',
  'exports',
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a strategy function body before saving.
 *
 * 1. Safety scan for forbidden tokens
 * 2. Syntax check via new Function()
 * 3. Dry-run with mock data
 */
export function validateStrategy(code: string): ValidationResult {
  // 1. Safety scan
  for (const token of FORBIDDEN_TOKENS) {
    // Match the token as a standalone word (not part of another identifier)
    const regex = new RegExp(`\\b${token}\\b`, 'g');
    if (regex.test(code)) {
      return {
        valid: false,
        error: `Forbidden token found: "${token}". Strategy code cannot access system APIs.`,
      };
    }
  }

  // 2. Syntax check
  let strategyFn: (ctx: StrategyContext) => unknown;
  try {
    // eslint-disable-next-line no-new-func
    strategyFn = new Function('ctx', code) as (ctx: StrategyContext) => unknown;
  } catch (err: any) {
    return {
      valid: false,
      error: `Syntax error: ${err.message}`,
    };
  }

  // 3. Dry-run with mock data (no position)
  const mockCandles = generateMockCandles(30);
  const mockDate = mockCandles[mockCandles.length - 1].date;
  const mockCtxNoPosition = createMockContext(mockCandles, mockDate, null);

  try {
    const result1 = strategyFn(mockCtxNoPosition);
    const actionCheck1 = validateAction(result1);
    if (!actionCheck1.valid) {
      return {
        valid: false,
        error: `Dry-run (no position): ${actionCheck1.error}`,
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Runtime error (no position): ${err.message}`,
    };
  }

  // 4. Dry-run with mock data (with position)
  const mockCtxWithPosition = createMockContext(mockCandles, mockDate, {
    lots: [{ entryDate: mockCandles[15].date, entryPrice: 100, shares: 50 }],
    totalShares: 50,
    avgEntryPrice: 100,
    peakSinceEntry: 115,
    currentPnlPct: 5,
    daysHeld: 15,
  });

  try {
    const result2 = strategyFn(mockCtxWithPosition);
    const actionCheck2 = validateAction(result2);
    if (!actionCheck2.valid) {
      return {
        valid: false,
        error: `Dry-run (with position): ${actionCheck2.error}`,
      };
    }
  } catch (err: any) {
    return {
      valid: false,
      error: `Runtime error (with position): ${err.message}`,
    };
  }

  return { valid: true };
}

/** Validate that a return value matches the StrategyAction shape. */
function validateAction(result: unknown): ValidationResult {
  if (!result || typeof result !== 'object') {
    return { valid: false, error: `Expected an object, got ${typeof result}` };
  }

  const action = (result as any).action;
  if (!action || !['hold', 'buy', 'sell'].includes(action)) {
    return {
      valid: false,
      error: `Invalid action: "${action}". Must be "hold", "buy", or "sell".`,
    };
  }

  if (action === 'buy') {
    const r = result as any;
    if (r.useAmount === true) {
      if (typeof r.amount !== 'number' || r.amount <= 0) {
        return { valid: false, error: 'Buy with useAmount requires a positive "amount" number.' };
      }
    } else if (typeof r.shares !== 'number' || r.shares <= 0) {
      return { valid: false, error: 'Buy requires a positive "shares" number.' };
    }
  }

  if (action === 'sell') {
    const r = result as any;
    if (r.useFraction === true) {
      if (typeof r.fraction !== 'number' || r.fraction <= 0 || r.fraction > 1) {
        return { valid: false, error: 'Sell with useFraction requires "fraction" between 0 and 1.' };
      }
    } else if (r.shares !== 'all' && (typeof r.shares !== 'number' || r.shares <= 0)) {
      return { valid: false, error: 'Sell requires "shares" as a positive number or "all".' };
    }
  }

  return { valid: true };
}

// --- Mock Data Generators ---

function generateMockCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  let price = 100;

  for (let i = 0; i < count; i++) {
    const date = new Date(2024, 0, i + 1);
    const dateStr = date.toISOString().slice(0, 10);
    const change = (Math.random() - 0.48) * 4; // Slight upward bias
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * 2;
    const low = Math.min(open, close) - Math.random() * 2;

    candles.push({ date: dateStr, open, high, low, close });
    price = close;
  }

  return candles;
}

function createMockContext(
  candles: Candle[],
  date: string,
  position: StrategyContext['position'],
): StrategyContext {
  const todayCandle = candles[candles.length - 1];

  return {
    candle: todayCandle,
    symbol: 'MOCKSTOCK',
    history: candles,
    position,
    portfolio: {
      totalOpenPositions: position ? 1 : 0,
      totalDeployed: position ? position.avgEntryPrice * position.totalShares : 0,
    },
    indicators: createIndicatorFunctions(candles, date),
    config: {
      amountPerBuy: 50000,
    },
  };
}
