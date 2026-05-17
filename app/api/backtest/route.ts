import { NextRequest } from "next/server";
import { getAllInstruments } from "@/lib/db/instruments";
import { getCachedCandles, getCachedSymbolCount } from "@/lib/db/candle-cache";
import { saveBacktestRun } from "@/lib/db/backtest-store";
import {
  getStrategy,
  seedDefaultStrategy,
  getDefaultStrategy,
} from "@/lib/db/strategy-store";
import { getUserIdFromRequest } from "@/lib/get-user-id";
import { runBacktest } from "@/lib/engine";
import type {
  BacktestConfig,
  BacktestProgress,
  Candle,
} from "@/types/backtester";

/**
 * POST /api/backtest
 *
 * Runs a backtest via Server-Sent Events (SSE).
 * Streams progress updates as the backtest executes.
 */
export async function POST(request: NextRequest) {
  const userId = getUserIdFromRequest(request);

  let config: BacktestConfig & {
    strategyId?: string;
    selectedTokens?: number[];
  };
  try {
    config = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { startDate, endDate, amountPerBuy, strategyId, selectedTokens } =
    config;
  if (!startDate || !endDate || !amountPerBuy) {
    return new Response(
      JSON.stringify({ error: "Missing startDate, endDate, or amountPerBuy" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Load strategy code
  let strategyCode: string;
  let resolvedStrategyId: string | undefined;
  if (strategyId) {
    const strategy = await getStrategy(userId, strategyId);
    if (!strategy) {
      return new Response(JSON.stringify({ error: "Strategy not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    strategyCode = strategy.generatedCode;
    resolvedStrategyId = strategy.id;
  } else {
    // Fall back to default strategy
    await seedDefaultStrategy(userId);
    const defaultStrategy = await getDefaultStrategy(userId);
    if (!defaultStrategy) {
      return new Response(
        JSON.stringify({ error: "No default strategy found" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
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
          phase: "instruments",
          message: "Loading Nifty 500 instruments from database...",
        });

        const dbInstruments = await getAllInstruments();
        const matched: { symbol: string; token: string }[] = [];

        for (const inst of dbInstruments) {
          if (inst.kiteToken) {
            matched.push({
              symbol: inst.symbol,
              token: String(inst.kiteToken),
            });
          }
        }

        // Filter by selected tokens if provided
        let finalMatched = matched;
        if (selectedTokens && selectedTokens.length > 0) {
          const tokenSet = new Set(selectedTokens);
          finalMatched = matched.filter((m) => tokenSet.has(Number(m.token)));
        }

        send({
          phase: "instruments",
          message: `Ready with ${finalMatched.length} selected stocks`,
          progress: 5,
        });

        // Use finalMatched from here on
        const matchedStocks = finalMatched;

        // --- Phase 2: Historical Data ---
        const cachedCount = await getCachedSymbolCount(
          matchedStocks.map((m) => m.symbol),
          lookbackDate,
          endDate,
        );

        send({
          phase: "historical",
          message: `Loading historical data: ${cachedCount} stocks available`,
          progress: 10,
        });

        const stockData = new Map<string, Candle[]>();
        let loadedCount = 0;

        const CHUNK_SIZE = 20;
        for (let i = 0; i < matchedStocks.length; i += CHUNK_SIZE) {
          const chunk = matchedStocks.slice(i, i + CHUNK_SIZE);

          await Promise.all(
            chunk.map(async ({ symbol }) => {
              const candles = await getCachedCandles(
                symbol,
                lookbackDate,
                endDate,
              );
              if (candles.length > 0) {
                stockData.set(symbol, candles);
              }
            }),
          );

          loadedCount += chunk.length;
          const pct =
            10 + Math.round((loadedCount / matchedStocks.length) * 70);
          send({
            phase: "historical",
            message: `Loaded ${loadedCount}/${matchedStocks.length} stocks from database`,
            progress: pct,
          });
        }

        send({
          phase: "historical",
          message: `Data ready: ${stockData.size} stocks loaded`,
          progress: 80,
        });

        // --- Phase 3: Backtest ---
        send({
          phase: "backtest",
          message: "Running backtest engine...",
          progress: 85,
        });

        const result = runBacktest(stockData, config, strategyCode);

        send({
          phase: "backtest",
          message: `Backtest complete: ${result.trades.length} trades generated`,
          progress: 95,
        });

        // --- Phase 4: Save results ---
        const durationMs = Date.now() - startTime;
        const runId = await saveBacktestRun(
          userId,
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
          phase: "done",
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
          phase: "error",
          message: err?.message || "Unknown error occurred",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function dateMinusDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
