import { db } from './index';
import { strategies } from './schema';
import { desc, eq } from 'drizzle-orm';
import type { ChatMessage, StrategyRecord } from '@/types/strategy';

/**
 * Create a new strategy. Returns the new row ID.
 */
export function createStrategy(
  name: string,
  description: string,
  generatedCode: string,
  chatHistory?: ChatMessage[],
): number {
  const result = db
    .insert(strategies)
    .values({
      name,
      description,
      generatedCode,
      chatHistory: chatHistory ? JSON.stringify(chatHistory) : null,
    })
    .returning({ id: strategies.id })
    .get();

  return result.id;
}

/**
 * Update a strategy in place (overwrite).
 */
export function updateStrategy(
  id: number,
  name: string,
  description: string,
  generatedCode: string,
  chatHistory?: ChatMessage[],
): void {
  db.update(strategies)
    .set({
      name,
      description,
      generatedCode,
      chatHistory: chatHistory ? JSON.stringify(chatHistory) : null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(strategies.id, id))
    .run();
}

/**
 * List all strategies (most recent first).
 */
export function listStrategies(): StrategyRecord[] {
  return db
    .select()
    .from(strategies)
    .orderBy(desc(strategies.createdAt))
    .all()
    .map(parseRow);
}

/**
 * Get a specific strategy by ID.
 */
export function getStrategy(id: number): StrategyRecord | null {
  const row = db
    .select()
    .from(strategies)
    .where(eq(strategies.id, id))
    .get();

  if (!row) return null;
  return parseRow(row);
}

/**
 * Delete a strategy by ID.
 */
export function deleteStrategy(id: number): void {
  db.delete(strategies)
    .where(eq(strategies.id, id))
    .run();
}

/**
 * Get the default strategy. Returns null if none is seeded.
 */
export function getDefaultStrategy(): StrategyRecord | null {
  const row = db
    .select()
    .from(strategies)
    .where(eq(strategies.isDefault, true))
    .get();

  if (!row) return null;
  return parseRow(row);
}

/**
 * Ensure the default 52-week breakout strategy exists.
 * Called on app startup / first run.
 */
export function seedDefaultStrategy(): number {
  const existing = getDefaultStrategy();
  if (existing) return existing.id;

  const code = `// 52-Week High Breakout with 10% Trailing Stop
if (ctx.position) {
  // SELL CHECK: trailing stop at 10% from peak
  var trailingStop = ctx.position.peakSinceEntry * 0.90;
  if (ctx.candle.close <= trailingStop) {
    return { action: 'sell', shares: 'all' };
  }
} else {
  // BUY CHECK: close within 5% of 252-day (52-week) high
  var high52w = ctx.indicators.rollingHigh(252);
  if (high52w !== null && ctx.candle.close >= high52w * 0.95) {
    return { action: 'buy', amount: ctx.config.amountPerBuy, useAmount: true };
  }
}
return { action: 'hold' };`;

  const result = db
    .insert(strategies)
    .values({
      name: '52-Week High Breakout',
      description:
        'Buy when close is within 5% of the rolling 52-week high. Sell with a 10% trailing stop from peak since entry.',
      generatedCode: code,
      isDefault: true,
    })
    .returning({ id: strategies.id })
    .get();

  return result.id;
}

// --- Helpers ---

function parseRow(row: typeof strategies.$inferSelect): StrategyRecord {
  return {
    ...row,
    isDefault: row.isDefault ?? false,
    chatHistory: row.chatHistory
      ? (JSON.parse(row.chatHistory) as ChatMessage[])
      : null,
  };
}
