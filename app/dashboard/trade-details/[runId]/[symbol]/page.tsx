import { notFound } from "next/navigation";
import Link from "next/link";
import { getBacktestRun } from "@/lib/db/backtest-store";
import { getUserId } from "@/lib/get-user-id";

import { Card } from "@heroui/react";
import type { Trade } from "@/types/backtester";

interface Props {
  params: Promise<{
    runId: string;
    symbol: string;
  }>;
}

export default async function TradeDetailsPage({ params }: Props) {
  const userId = await getUserId();
  const { runId, symbol } = await params;
  const decodedSymbol = decodeURIComponent(symbol);

  const run = await getBacktestRun(userId, runId);

  if (!run) {
    notFound();
  }

  const trades = run.trades.filter((t) => t.symbol === decodedSymbol);

  if (trades.length === 0) {
    notFound();
  }

  // Calculate symbol summaries
  const totalPnlAbs = trades.reduce((sum, t) => sum + (t.pnlAbs ?? 0), 0);
  const totalHoldingDays = trades.reduce(
    (sum, t) => sum + (t.holdingDays ?? 0),
    0,
  );
  const avgHoldingDays = Math.round(totalHoldingDays / trades.length);
  const isOpen = trades.some((t) => t.status === "open");

  const totalShares = trades.reduce((sum, t) => sum + (t.shares ?? 0), 0);
  const totalInvested = trades.reduce(
    (sum, t) => sum + (t.entryPrice ?? 0) * (t.shares ?? 0),
    0,
  );
  const avgEntryPrice = totalShares > 0 ? totalInvested / totalShares : 0;
  const netPnlPct = totalInvested > 0 ? (totalPnlAbs / totalInvested) * 100 : 0;

  // We map the raw trades to a UI-friendly list
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-muted hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {decodedSymbol}{" "}
            <span className="text-muted text-xl font-normal ml-2">
              Trade Details
            </span>
          </h1>
          <p className="text-muted text-sm">
            Run #{runId} &bull; {run.startDate} to {run.endDate}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Trades
            </span>
            <span className="text-2xl font-mono">{trades.length}</span>
          </Card>
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Total Invested
            </span>
            <span className="text-2xl font-mono">
              {formatINR(totalInvested)}
            </span>
          </Card>
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Avg Buy Price
            </span>
            <span className="text-2xl font-mono">
              ₹{avgEntryPrice.toFixed(2)}
            </span>
          </Card>
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Net P&L
            </span>
            <span
              className={`text-2xl font-mono ${totalPnlAbs > 0 ? "text-success" : totalPnlAbs < 0 ? "text-danger" : ""}`}
            >
              {formatINR(totalPnlAbs)}
              <span className="text-xs font-normal ml-1 font-sans">
                ({netPnlPct >= 0 ? "+" : ""}
                {netPnlPct.toFixed(2)}%)
              </span>
            </span>
          </Card>
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Avg Holding
            </span>
            <span className="text-2xl font-mono">{avgHoldingDays} days</span>
          </Card>
          <Card className="p-4 flex flex-col gap-1 border-border/50">
            <span className="text-xs font-semibold text-muted uppercase tracking-wider">
              Status
            </span>
            <span
              className={`text-2xl font-mono capitalize ${isOpen ? "text-warning font-semibold" : "text-muted"}`}
            >
              {isOpen ? "Active" : "Closed"}
            </span>
          </Card>
        </div>

        <Card className="w-full mt-4 border-2 border-border shadow-sm bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/20 border-b-2 border-border font-semibold">
                <tr>
                  <th className="px-4 py-3 font-medium">Entry Date</th>
                  <th className="px-4 py-3 font-medium">Entry Price</th>
                  <th className="px-4 py-3 font-medium">Qty (Shares)</th>
                  <th className="px-4 py-3 font-medium">Invested ₹</th>
                  <th className="px-4 py-3 font-medium">Exit Date</th>
                  <th className="px-4 py-3 font-medium">Exit Price</th>
                  <th className="px-4 py-3 font-medium">P&L %</th>
                  <th className="px-4 py-3 font-medium">P&L ₹</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade, i) => (
                  <tr
                    key={`${trade.entryDate}-${i}`}
                    className="border-b border-border/50 hover:bg-muted/5 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-foreground">
                      {trade.entryDate}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      ₹{(trade.entryPrice ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted">
                      {trade.shares}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {formatINR((trade.entryPrice ?? 0) * (trade.shares ?? 0))}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {trade.exitDate || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {trade.exitPrice != null
                        ? `₹${trade.exitPrice.toFixed(2)}`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-semibold font-mono text-xs ${
                        (trade.pnlPct ?? 0) > 0
                          ? "text-success"
                          : (trade.pnlPct ?? 0) < 0
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {trade.pnlPct != null
                        ? `${trade.pnlPct > 0 ? "+" : ""}${trade.pnlPct.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td
                      className={`px-4 py-3 font-mono text-xs ${
                        (trade.pnlAbs ?? 0) > 0
                          ? "text-success"
                          : (trade.pnlAbs ?? 0) < 0
                            ? "text-danger"
                            : "text-muted"
                      }`}
                    >
                      {trade.pnlAbs != null ? formatINR(trade.pnlAbs) : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted font-mono text-xs">
                      {trade.holdingDays}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          trade.status === "open"
                            ? "bg-warning/15 text-warning"
                            : "bg-muted/10 text-muted"
                        }`}
                      >
                        {trade.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
