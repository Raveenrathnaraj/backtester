import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getKiteInstanceFromToken } from "@/lib/kite";
import {
  getAllInstruments,
  updateKiteToken,
  upsertInstruments,
} from "@/lib/db/instruments";
import { getMissingRanges, storeCandles } from "@/lib/db/candle-cache";
import type { Candle } from "@/types/backtester";

import { fetchNSEIndex } from "@/lib/nse";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("kite_access_token")?.value;

  if (!accessToken) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: any) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        const indexName = "NIFTY TOTAL MARKET";

        // --- Phase 1: Fetch from NSE ---
        send({
          phase: "NSE Fetch",
          message: `Fetching constituents for ${indexName}...`,
          progress: 5,
        });

        const nseData = await fetchNSEIndex(indexName);
        const nseStocks = nseData.data
          .filter((s: any) => s.symbol !== indexName && s.meta)
          .map((s: any) => ({
            symbol: s.symbol as string,
            companyName: (s.meta?.companyName || s.symbol) as string,
            industry: (s.meta?.industry || "Unknown") as string,
            series: (s.series || "EQ") as string,
            isinCode: (s.meta?.isin || "") as string,
          }));

        if (nseStocks.length === 0) {
          throw new Error("No stocks returned from NSE");
        }

        send({
          phase: "NSE Upsert",
          message: `Upserting ${nseStocks.length} instruments to DB...`,
          progress: 10,
        });

        await upsertInstruments(nseStocks);

        // --- Phase 2: Resolve Kite Tokens ---
        send({
          phase: "Tokens",
          message: "Fetching instrument tokens from Kite...",
          progress: 15,
        });

        const kc = getKiteInstanceFromToken(accessToken);
        const kiteInstruments: any[] = await kc.getInstruments("NSE");
        const kiteMap = new Map<string, number>();
        for (const inst of kiteInstruments) {
          if (inst.instrument_type === "EQ") {
            kiteMap.set(inst.tradingsymbol, inst.instrument_token);
          }
        }

        const dbInstruments = await getAllInstruments();
        let matchedCount = 0;
        const validStocks: { symbol: string; token: number }[] = [];

        for (const inst of dbInstruments) {
          const token = kiteMap.get(inst.symbol);
          if (token) {
            await updateKiteToken(inst.symbol, token);
            validStocks.push({ symbol: inst.symbol, token });
            matchedCount++;
          }
        }

        send({
          phase: "Tokens",
          message: `Matched ${matchedCount}/${dbInstruments.length} tokens.`,
          progress: 20,
        });

        // --- Phase 3: Fetch Historical Data ---
        // Jan 1 2000 to Today
        const startDate = "2000-01-01";
        const endDate = new Date().toISOString().slice(0, 10);

        let skipped = 0;
        let fetched = 0;
        let failed = 0;
        const startTime = Date.now();

        for (let i = 0; i < validStocks.length; i++) {
          const { symbol, token } = validStocks[i];
          const missingRanges = await getMissingRanges(
            symbol,
            startDate,
            endDate,
          );

          if (missingRanges.length === 0) {
            skipped++;
          } else {
            let success = true;
            for (const range of missingRanges) {
              // Kite API limits 'day' candles to ~2000 days. Chunk into 5-year intervals (~1826 days).
              let currentStart = new Date(range.from);
              const finalEnd = new Date(range.to);

              while (currentStart <= finalEnd) {
                let chunkEnd = new Date(currentStart);
                chunkEnd.setFullYear(chunkEnd.getFullYear() + 5);

                if (chunkEnd > finalEnd) {
                  chunkEnd = finalEnd;
                }

                const fromStr = currentStart.toISOString().slice(0, 10);
                const toStr = chunkEnd.toISOString().slice(0, 10);

                try {
                  const raw = await kc.getHistoricalData(
                    String(token),
                    "day",
                    fromStr,
                    toStr,
                  );

                  const candles: Candle[] = raw.map((r: any) => ({
                    date:
                      typeof r.date === "string"
                        ? r.date.slice(0, 10)
                        : new Date(r.date).toISOString().slice(0, 10),
                    open: r.open,
                    high: r.high,
                    low: r.low,
                    close: r.close,
                  }));

                  await storeCandles(symbol, fromStr, toStr, candles);
                  await sleep(350); // Throttle Kite API rate limit ~3 req/sec
                } catch (err: any) {
                  console.warn(
                    `Failed to fetch ${symbol} [${fromStr} → ${toStr}]:`,
                    err?.message,
                  );
                  success = false;
                }

                currentStart = new Date(chunkEnd);
                currentStart.setDate(currentStart.getDate() + 1); // Next day
              }
            }

            if (success) {
              fetched++;
            } else {
              failed++;
            }
          }

          if ((i + 1) % 5 === 0 || i === validStocks.length - 1) {
            const pct = 20 + Math.round(((i + 1) / validStocks.length) * 80);

            // Calculate ETA
            const elapsedMs = Date.now() - startTime;
            const avgTimePerStock = elapsedMs / (i + 1);
            const remainingStocks = validStocks.length - (i + 1);
            const etaMs = avgTimePerStock * remainingStocks;
            const etaMinutes = Math.floor(etaMs / 60000);
            const etaSeconds = Math.floor((etaMs % 60000) / 1000);
            const etaFormatted = `${etaMinutes}m ${etaSeconds}s`;

            send({
              phase: "Historical",
              message: `Processed ${i + 1}/${validStocks.length} (${skipped} cached, ${fetched} fetched, ${failed} failed)`,
              progress: pct,
              eta: etaFormatted,
              stats: {
                current: i + 1,
                total: validStocks.length,
                skipped,
                fetched,
                failed,
                symbol,
              },
            });
          }
        }

        send({
          phase: "Done",
          message: "Data population complete!",
          progress: 100,
        });
      } catch (err: any) {
        send({
          phase: "Error",
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
