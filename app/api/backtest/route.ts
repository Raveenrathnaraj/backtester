import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { getKiteInstanceFromToken } from '@/lib/kite';
import {
  getAllInstruments,
  updateKiteToken,
  areTokensStale,
} from '@/lib/db/instruments';
import {
  getCachedCandles,
  getMissingRanges,
  storeCandles,
  getCachedSymbolCount,
} from '@/lib/db/candle-cache';
import { saveBacktestRun } from '@/lib/db/backtest-store';
import { getStrategy, seedDefaultStrategy, getDefaultStrategy } from '@/lib/db/strategy-store';
import { runBacktest } from '@/lib/engine';
import type { BacktestConfig, BacktestProgress, Candle } from '@/types/backtester';

/**
 * POST /api/backtest
 *
 * Runs a backtest via Server-Sent Events (SSE).
 * Streams progress updates as the backtest executes.
 */
export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('kite_access_token')?.value;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let config: BacktestConfig & { strategyId?: number; selectedTokens?: number[] };
  try {
    config = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { startDate, endDate, amountPerBuy, strategyId, selectedTokens } = config;
  if (!startDate || !endDate || !amountPerBuy) {
    return new Response(
      JSON.stringify({ error: 'Missing startDate, endDate, or amountPerBuy' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Load strategy code
  let strategyCode: string;
  let resolvedStrategyId: number | undefined;
  if (strategyId) {
    const strategy = getStrategy(strategyId);
    if (!strategy) {
      return new Response(
        JSON.stringify({ error: 'Strategy not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }
    strategyCode = strategy.generatedCode;
    resolvedStrategyId = strategy.id;
  } else {
    // Fall back to default strategy
    seedDefaultStrategy();
    const defaultStrategy = getDefaultStrategy();
    if (!defaultStrategy) {
      return new Response(
        JSON.stringify({ error: 'No default strategy found' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    strategyCode = defaultStrategy.generatedCode;
    resolvedStrategyId = defaultStrategy.id;
  }

  // Date range for historical data: start 365 days before startDate for lookback
  const lookbackDate = dateMinusDays(startDate, 365);

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: BacktestProgress) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      const startTime = Date.now();

      try {
        // --- Phase 1: Instruments ---
        send({
          phase: 'instruments',
          message: 'Loading Nifty 500 instruments from database...',
        });

        const kc = getKiteInstanceFromToken(accessToken);
        const dbInstruments = getAllInstruments();
        const matched: { symbol: string; token: string }[] = [];
        
        let needsKiteFetch = areTokensStale();
        
        // Also check if we have any missing tokens
        if (!needsKiteFetch) {
          for (const inst of dbInstruments) {
            if (!inst.kiteToken) {
              needsKiteFetch = true;
              break;
            }
          }
        }

        if (needsKiteFetch) {
          send({
            phase: 'instruments',
            message: 'Tokens missing or stale. Fetching fresh list from Kite...',
            progress: 2,
          });
          
          const kiteInstruments: any[] = await kc.getInstruments('NSE');
          
          // Create a quick lookup map from Kite instruments
          const kiteMap = new Map<string, number>();
          for (const inst of kiteInstruments) {
            if (inst.instrument_type === 'EQ') {
              kiteMap.set(inst.tradingsymbol, inst.instrument_token);
            }
          }
          
          // Match our DB instruments and update tokens
          for (const inst of dbInstruments) {
            const token = kiteMap.get(inst.symbol);
            if (token) {
              updateKiteToken(inst.symbol, token);
              matched.push({
                symbol: inst.symbol,
                token: String(token),
              });
            }
          }
        } else {
          // Use cached tokens from DB
          for (const inst of dbInstruments) {
            if (inst.kiteToken) {
              matched.push({
                symbol: inst.symbol,
                token: String(inst.kiteToken),
              });
            }
          }
        }

        // Filter by selected tokens if provided
        let finalMatched = matched;
        if (selectedTokens && selectedTokens.length > 0) {
          const tokenSet = new Set(selectedTokens);
          finalMatched = matched.filter((m) => tokenSet.has(Number(m.token)));
        }

        send({
          phase: 'instruments',
          message: `Ready with ${finalMatched.length} selected stocks`,
          progress: 5,
        });

        // Use finalMatched from here on
        const matchedStocks = finalMatched;

        // --- Phase 2: Historical Data ---
        const cachedCount = getCachedSymbolCount(
          matchedStocks.map((m) => m.symbol),
          lookbackDate,
          endDate,
        );

        send({
          phase: 'historical',
          message: `Starting data fetch: ${cachedCount} cached, ${matchedStocks.length - cachedCount} to fetch`,
          progress: 10,
        });

        const stockData = new Map<string, Candle[]>();
        let fetchedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < matchedStocks.length; i++) {
          const { symbol, token } = matchedStocks[i];

          // Check cache for missing ranges
          const missingRanges = getMissingRanges(
            symbol,
            lookbackDate,
            endDate,
          );

          if (missingRanges.length === 0) {
            // Fully cached — read from DB
            const candles = getCachedCandles(symbol, lookbackDate, endDate);
            if (candles.length > 0) {
              stockData.set(symbol, candles);
            }
            skippedCount++;
          } else {
            // Fetch missing ranges from Kite
            let allCandles: Candle[] = [];

            for (const range of missingRanges) {
              try {
                const raw = await kc.getHistoricalData(
                  token,
                  'day',
                  range.from,
                  range.to,
                );

                const candles: Candle[] = raw.map((r: any) => ({
                  date:
                    typeof r.date === 'string'
                      ? r.date.slice(0, 10)
                      : new Date(r.date).toISOString().slice(0, 10),
                  open: r.open,
                  high: r.high,
                  low: r.low,
                  close: r.close,
                }));

                storeCandles(symbol, range.from, range.to, candles);
                allCandles = allCandles.concat(candles);

                // Rate limit: ~3 req/s
                await sleep(350);
              } catch (err: any) {
                // Skip stocks that fail (e.g., suspended, delisted)
                console.warn(
                  `Failed to fetch ${symbol} [${range.from} → ${range.to}]:`,
                  err?.message,
                );
              }
            }

            // Also read any existing cached candles to get the full picture
            const cachedCandles = getCachedCandles(
              symbol,
              lookbackDate,
              endDate,
            );
            if (cachedCandles.length > 0) {
              stockData.set(symbol, cachedCandles);
            }
            fetchedCount++;
          }

          // Progress update every 5 stocks
          if ((i + 1) % 5 === 0 || i === matched.length - 1) {
            const pct = 10 + Math.round(((i + 1) / matched.length) * 70);
            send({
              phase: 'historical',
              message: `Processing ${i + 1}/${matched.length} stocks (${skippedCount} cached, ${fetchedCount} fetched)`,
              progress: pct,
            });
          }
        }

        send({
          phase: 'historical',
          message: `Data ready: ${stockData.size} stocks with candle data`,
          progress: 80,
        });

        // --- Phase 3: Backtest ---
        send({
          phase: 'backtest',
          message: 'Running backtest engine...',
          progress: 85,
        });

        const result = runBacktest(stockData, config, strategyCode);

        send({
          phase: 'backtest',
          message: `Backtest complete: ${result.trades.length} trades generated`,
          progress: 95,
        });

        // --- Phase 4: Save results ---
        const durationMs = Date.now() - startTime;
        const runId = saveBacktestRun(
          config,
          stockData.size,
          result.summary,
          result.trades,
          result.equityCurve,
          durationMs,
          resolvedStrategyId,
        );

        // --- Done ---
        send({
          phase: 'done',
          message: `Backtest completed in ${(durationMs / 1000).toFixed(1)}s`,
          progress: 100,
          data: {
            trades: result.trades,
            equityCurve: result.equityCurve,
            summary: result.summary,
            runId,
          },
        });
      } catch (err: any) {
        send({
          phase: 'error',
          message: err?.message || 'Unknown error occurred',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateMinusDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
