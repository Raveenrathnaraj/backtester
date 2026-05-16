import { sqliteTable, text, integer, real, primaryKey, index } from 'drizzle-orm/sqlite-core';

// User-defined trading strategies
export const strategies = sqliteTable('strategies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description').notNull(),     // Original plain-English summary
  generatedCode: text('generated_code').notNull(), // The strategy function body
  chatHistory: text('chat_history'),               // JSON: ChatMessage[]
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

// Immutable daily OHLC candles, cached from Kite
export const candles = sqliteTable(
  'candles',
  {
    symbol: text('symbol').notNull(),
    date: text('date').notNull(), // YYYY-MM-DD
    open: real('open').notNull(),
    high: real('high').notNull(),
    low: real('low').notNull(),
    close: real('close').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.symbol, table.date] }),
    index('idx_candles_symbol_date').on(table.symbol, table.date),
  ],
);

// Track fetched date ranges per symbol to avoid re-fetching
export const fetchRanges = sqliteTable(
  'fetch_ranges',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    symbol: text('symbol').notNull(),
    fromDate: text('from_date').notNull(), // YYYY-MM-DD
    toDate: text('to_date').notNull(), // YYYY-MM-DD
    fetchedAt: text('fetched_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [index('idx_fetch_symbol').on(table.symbol)],
);

// Backtest run results (full snapshots)
export const backtestRuns = sqliteTable('backtest_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  amountPerBuy: real('amount_per_buy').notNull(),
  totalStocks: integer('total_stocks').notNull(),
  summary: text('summary').notNull(), // JSON: BacktestSummary
  trades: text('trades').notNull(), // JSON: Trade[]
  equityCurve: text('equity_curve').notNull(), // JSON: EquityPoint[]
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  durationMs: integer('duration_ms'),
  strategyId: integer('strategy_id'),
});

// NSE equity instruments — auto-populated from index lookups
export const instruments = sqliteTable('instruments', {
  symbol: text('symbol').primaryKey(),
  companyName: text('company_name').notNull(),
  industry: text('industry').notNull(),
  series: text('series').notNull(),
  isinCode: text('isin_code').notNull(),
  kiteToken: integer('kite_token'),
  kiteTokenUpdatedAt: text('kite_token_updated_at'),
});

// User-created stock watchlists (custom subsets of index constituents)
export const watchlists = sqliteTable('watchlists', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  baseIndex: text('base_index').notNull(),
  symbols: text('symbols').notNull(),      // JSON: string[]
  tokens: text('tokens').notNull(),         // JSON: number[]
  stockCount: integer('stock_count').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});
