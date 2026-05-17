import { createServiceClient } from '@/lib/supabase/service';
import type { ChatMessage, StrategyRecord } from '@/types/strategy';

const supabase = createServiceClient();

/**
 * Create a new strategy. Returns the new UUID.
 */
export async function createStrategy(
  userId: string,
  name: string,
  description: string,
  generatedCode: string,
  chatHistory?: ChatMessage[],
): Promise<string> {
  const { data, error } = await supabase
    .from('strategies')
    .insert({
      user_id: userId,
      name,
      description,
      generated_code: generatedCode,
      chat_history: chatHistory ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to create strategy: ${error.message}`);
  return data.id;
}

/**
 * Update a strategy in place (overwrite).
 */
export async function updateStrategy(
  userId: string,
  id: string,
  name: string,
  description: string,
  generatedCode: string,
  chatHistory?: ChatMessage[],
): Promise<void> {
  const { error } = await supabase
    .from('strategies')
    .update({
      name,
      description,
      generated_code: generatedCode,
      chat_history: chatHistory ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to update strategy: ${error.message}`);
}

/**
 * List all strategies for a user (most recent first).
 */
export async function listStrategies(userId: string): Promise<StrategyRecord[]> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to list strategies: ${error.message}`);
  return (data ?? []).map(parseRow);
}

/**
 * Get a specific strategy by ID.
 */
export async function getStrategy(
  userId: string,
  id: string,
): Promise<StrategyRecord | null> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to get strategy: ${error.message}`);
  if (!data) return null;
  return parseRow(data);
}

/**
 * Delete a strategy by ID.
 */
export async function deleteStrategy(userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('strategies')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(`Failed to delete strategy: ${error.message}`);
}

/**
 * Get the default strategy for a user. Returns null if none.
 */
export async function getDefaultStrategy(
  userId: string,
): Promise<StrategyRecord | null> {
  const { data, error } = await supabase
    .from('strategies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_default', true)
    .maybeSingle();

  if (error) throw new Error(`Failed to get default strategy: ${error.message}`);
  if (!data) return null;
  return parseRow(data);
}

/**
 * Ensure the default 52-week breakout strategy exists for a user.
 * Returns the strategy ID.
 */
export async function seedDefaultStrategy(userId: string): Promise<string> {
  const existing = await getDefaultStrategy(userId);
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
    return { action: 'buy', amount: 10000, useAmount: true };
  }
}
return { action: 'hold' };`;

  const { data, error } = await supabase
    .from('strategies')
    .insert({
      user_id: userId,
      name: '52-Week High Breakout',
      description:
        'Buy when close is within 5% of the rolling 52-week high. Sell with a 10% trailing stop from peak since entry.',
      generated_code: code,
      is_default: true,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to seed default strategy: ${error.message}`);
  return data.id;
}

// --- Helpers ---

function parseRow(row: any): StrategyRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    generatedCode: row.generated_code,
    chatHistory: row.chat_history as ChatMessage[] | null,
    isDefault: row.is_default ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
