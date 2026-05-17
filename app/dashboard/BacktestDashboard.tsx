'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  Card,
  Spinner,
  TextField,
  Label,
  Input,
  Pagination,
} from '@heroui/react';
import type {
  BacktestProgress,
  BacktestSummary,
  Trade,
  EquityPoint,
} from '@/types/backtester';
import type { StrategyRecord } from '@/types/strategy';
import EquityChart from './EquityChart';
import IndicesData from '@/lib/Indices.json';

interface SavedWatchlist {
  id: number;
  name: string;
  baseIndex: string;
  stockCount: number;
  symbols: string;
  tokens: string;
}

type SortField = 'symbol' | 'tradeCount' | 'pnlAbs' | 'pnlPct' | 'holdingDays';
type SortDir = 'asc' | 'desc';

type RunResult = {
  id: number;
  startDate: string;
  endDate: string;
  summary: BacktestSummary;
  trades: Trade[];
  equityCurve: EquityPoint[];
  runId: string;
};

export default function BacktestDashboard() {
  const router = useRouter();

  // Config state
  const [startDate, setStartDate] = useState('2023-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const amountPerBuy = 10000; // Default; strategies embed their own amount in generated code
  const [randomRunsCount, setRandomRunsCount] = useState('5');
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);

  // Watchlist state
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [watchlistsLoading, setWatchlistsLoading] = useState(true);
  const [universeValue, setUniverseValue] = useState('NIFTY 50');
  const [universeLoading, setUniverseLoading] = useState(false);

  // Strategy state
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(null);
  const [strategiesLoading, setStrategiesLoading] = useState(true);

  // Fetch strategies + watchlists on mount
  useEffect(() => {
    fetch('/api/strategy')
      .then((res) => res.json())
      .then((data: StrategyRecord[]) => {
        setStrategies(data);
        
        let queryStrategyId: string | null = null;
        try {
          const params = new URLSearchParams(window.location.search);
          queryStrategyId = params.get('strategyId');
        } catch {
          // ignore window undefined on server
        }

        const defaultStrat = 
          (queryStrategyId && data.find((s) => s.id === queryStrategyId)) || 
          data.find((s) => s.isDefault) || 
          data[0];
          
        if (defaultStrat) setSelectedStrategyId(defaultStrat.id);
        setStrategiesLoading(false);
      })
      .catch(() => setStrategiesLoading(false));

    fetch('/api/watchlists')
      .then((res) => res.json())
      .then((data: SavedWatchlist[]) => {
        setWatchlists(data);
        // Auto-select first custom list if available, else NIFTY 50
        if (data.length > 0) {
          const firstId = `custom:${data[0].id}`;
          setUniverseValue(firstId);
          setSelectedTokens(JSON.parse(data[0].tokens));
        } else {
          loadUniverse('NIFTY 50');
        }
        setWatchlistsLoading(false);
      })
      .catch(() => {
        loadUniverse('NIFTY 50');
        setWatchlistsLoading(false);
      });
  }, []);

  const loadUniverse = async (indexName: string) => {
    setUniverseLoading(true);
    try {
      const res = await fetch(`/api/stocks/index?index=${encodeURIComponent(indexName)}`);
      if (res.ok) {
        const data = await res.json();
        const tokens = data.stocks.map((s: any) => s.kiteToken).filter(Boolean);
        setSelectedTokens(tokens);
      }
    } catch {
      // silent
    } finally {
      setUniverseLoading(false);
    }
  };

  const handleUniverseChange = (value: string) => {
    setUniverseValue(value);
    if (value.startsWith('custom:')) {
      const id = Number(value.split(':')[1]);
      const wl = watchlists.find((w) => w.id === id);
      if (wl) setSelectedTokens(JSON.parse(wl.tokens));
    } else {
      loadUniverse(value);
    }
  };

  const selectedStrategy = strategies.find((s) => s.id === selectedStrategyId) || null;

  // Execution state
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<string>('');
  const [progressMessage, setProgressMessage] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [results, setResults] = useState<RunResult[]>([]);
  const [activeRunIndex, setActiveRunIndex] = useState<number>(0);

  // Load results from sessionStorage after initial mount to avoid hydration mismatch
  useEffect(() => {
    try {
      const cachedResults = sessionStorage.getItem('bt_results');
      if (cachedResults) {
        setResults(JSON.parse(cachedResults));
      }
      const cachedIndex = sessionStorage.getItem('bt_activeRunIndex');
      if (cachedIndex) {
        setActiveRunIndex(Number(cachedIndex));
      }
    } catch {
      // silent
    }
  }, []);

  // Persist results to sessionStorage whenever they change
  useEffect(() => {
    try {
      if (results.length > 0) {
        sessionStorage.setItem('bt_results', JSON.stringify(results));
        sessionStorage.setItem('bt_activeRunIndex', String(activeRunIndex));
      }
    } catch {
      // quota exceeded or SSR — silently ignore
    }
  }, [results, activeRunIndex]);

  // Trade log sorting/filtering
  const [sortField, setSortField] = useState<SortField>('pnlAbs');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [tradeFilter, setTradeFilter] = useState<'all' | 'wins' | 'losses'>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 50;

  const abortRef = useRef<AbortController | null>(null);

  const executeBacktest = async (sd: string, ed: string, amount: number, signal: AbortSignal, runPrefix: string = ''): Promise<RunResult> => {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await fetch('/api/backtest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            startDate: sd, 
            endDate: ed, 
            amountPerBuy: amount, 
            strategyId: selectedStrategyId,
            selectedTokens 
          }),
          signal,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Request failed');
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let buffer = '';
        let finalResult: RunResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; 

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const event: BacktestProgress = JSON.parse(line.slice(6));
                setPhase(event.phase);
                setProgressMessage(runPrefix + event.message);
                if (event.progress !== undefined) setProgressPct(event.progress);

                if (event.phase === 'done' && event.data) {
                  finalResult = {
                    id: Date.now() + Math.random(),
                    startDate: sd,
                    endDate: ed,
                    summary: event.data.summary,
                    trades: event.data.trades,
                    equityCurve: event.data.equityCurve,
                    runId: event.data.runId,
                  };
                }

                if (event.phase === 'error') {
                  throw new Error(event.message);
                }
              } catch (e: any) {
                if (e.message && line.includes('"phase":"error"')) throw e;
              }
            }
          }
        }
        
        if (finalResult) resolve(finalResult);
        else throw new Error('Stream ended without completion');
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleRun = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    setActiveRunIndex(0);
    setPhase('');
    setProgressMessage('Starting...');
    setProgressPct(0);
    setCurrentPage(1);
    // Clear cached results so a fresh run starts clean
    try { sessionStorage.removeItem('bt_results'); sessionStorage.removeItem('bt_activeRunIndex'); } catch {}

    abortRef.current = new AbortController();

    try {
      const result = await executeBacktest(startDate, endDate, amountPerBuy, abortRef.current.signal);
      setResults([result]);
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || 'Unknown error');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [startDate, endDate, selectedStrategyId, selectedTokens]);

  const handleRandomTest = useCallback(async () => {
    setRunning(true);
    setError(null);
    setResults([]);
    setActiveRunIndex(0);
    setPhase('');
    setProgressPct(0);
    setCurrentPage(1);
    // Clear cached results so a fresh run starts clean
    try { sessionStorage.removeItem('bt_results'); sessionStorage.removeItem('bt_activeRunIndex'); } catch {}

    const count = Number(randomRunsCount);
    if (count < 1 || count > 20) {
      setError('Random runs must be between 1 and 20');
      setRunning(false);
      return;
    }

    let pairs;
    try {
      pairs = getRandomDateRanges(startDate, endDate, count, 1); // 1 month min
    } catch (err: any) {
      setError(err.message);
      setRunning(false);
      return;
    }

    abortRef.current = new AbortController();
    const allResults: RunResult[] = [];

    try {
      for (let i = 0; i < pairs.length; i++) {
        const prefix = `[Run ${i + 1}/${count}] `;
        setProgressMessage(`${prefix}Starting...`);
        setPhase('batch');
        
        const { start, end } = pairs[i];
        const result = await executeBacktest(start, end, amountPerBuy, abortRef.current.signal, prefix);
        allResults.push(result);
        
        setResults([...allResults]);
        setActiveRunIndex(i); // Auto focus newest run
      }
      setPhase('done');
      setProgressMessage(`Completed ${count} random runs.`);
      setProgressPct(100);
    } catch (err: any) {
      if (err.name !== 'AbortError') setError(err.message || 'Unknown error');
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [startDate, endDate, randomRunsCount, selectedStrategyId, selectedTokens]);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    setRunning(false);
  }, []);

  // Active run data
  const activeResult = results[activeRunIndex] || null;
  const summary = activeResult?.summary || null;
  const trades = activeResult?.trades || [];
  const equityCurve = activeResult?.equityCurve || [];
  const runId = activeResult?.runId || null;

  // Sorted + filtered trades
  // Filtered trades
  const filteredTrades = trades.filter((t) => {
    if (tradeFilter === 'wins') return (t.pnlAbs ?? 0) > 0;
    if (tradeFilter === 'losses') return (t.pnlAbs ?? 0) <= 0;
    return true;
  });

  // Group by symbol
  const aggregatedTradesMap = new Map<string, any>();
  for (const t of filteredTrades) {
    if (!aggregatedTradesMap.has(t.symbol)) {
      aggregatedTradesMap.set(t.symbol, {
        symbol: t.symbol,
        tradeCount: 0,
        pnlAbs: 0,
        pnlPctSum: 0,
        holdingDaysSum: 0,
        status: 'closed',
      });
    }
    const agg = aggregatedTradesMap.get(t.symbol);
    agg.tradeCount += 1;
    agg.pnlAbs += (t.pnlAbs ?? 0);
    agg.pnlPctSum += (t.pnlPct ?? 0);
    agg.holdingDaysSum += (t.holdingDays ?? 0);
    if (t.status === 'open') agg.status = 'open';
  }

  const aggregatedTradesArray = Array.from(aggregatedTradesMap.values()).map(agg => ({
    ...agg,
    pnlPct: agg.tradeCount > 0 ? agg.pnlPctSum / agg.tradeCount : 0,
    holdingDays: agg.tradeCount > 0 ? Math.round(agg.holdingDaysSum / agg.tradeCount) : 0,
  }));

  // Sorted aggregated trades
  const displayTrades = aggregatedTradesArray.sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'symbol':
        cmp = a.symbol.localeCompare(b.symbol);
        break;
      case 'tradeCount':
        cmp = a.tradeCount - b.tradeCount;
        break;
      case 'pnlAbs':
        cmp = a.pnlAbs - b.pnlAbs;
        break;
      case 'pnlPct':
        cmp = a.pnlPct - b.pnlPct;
        break;
      case 'holdingDays':
        cmp = a.holdingDays - b.holdingDays;
        break;
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(displayTrades.length / pageSize);
  const paginatedTrades = displayTrades.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const toggleSort = (field: SortField) => {
    setCurrentPage(1);
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: Configuration + Strategy Rules */}
      <Card>
        <Card.Header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Card.Title>Backtest Setup</Card.Title>
            <Card.Description>
              Configure strategy rules, parameters, and stock universe
            </Card.Description>
          </div>

        </Card.Header>
        <Card.Content>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Left Column: Strategy */}
            <div className="flex flex-col gap-4 text-sm">
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">Strategy</label>
                {strategiesLoading ? (
                  <div className="flex items-center gap-2 text-muted text-xs py-2">
                    <Spinner size="sm" />
                    <span>Loading strategies…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={selectedStrategyId ?? ''}
                      onChange={(e) => setSelectedStrategyId(e.target.value)}
                      disabled={running}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                    >
                      {strategies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}{s.isDefault ? ' (default)' : ''}
                        </option>
                      ))}
                    </select>
                    {selectedStrategy && (
                      <div className="text-sm font-semibold text-foreground mt-1 text-center">
                        {selectedStrategy.name}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onPress={() => router.push('/dashboard/strategy/new')}
                        isDisabled={running}
                        className="flex-1"
                      >
                        + New Strategy
                      </Button>
                      {selectedStrategy && (
                        <Button
                          variant="secondary"
                          size="sm"
                          isIconOnly
                          onPress={() => router.push(`/dashboard/strategy/${selectedStrategy.id}`)}
                          isDisabled={running}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {selectedStrategy && (
                <div className="space-y-2 flex-1">
                  {selectedStrategy.description.split('\n').map((line, i) => (
                    <div
                      key={`desc-${i}`}
                      className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/10"
                    >
                      <span className="mt-0.5 text-accent font-bold text-base">
                        {i === 0 ? '↗' : i === 1 ? '↘' : '◎'}
                      </span>
                      <p className="text-muted mt-0.5">{line}</p>
                    </div>
                  ))}
                </div>
              )}

            </div>

            {/* Right Column: Parameters */}
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <TextField
                  isRequired
                  type="date"
                  value={startDate}
                  onChange={setStartDate}
                  isDisabled={running}
                >
                  <Label>Start Date</Label>
                  <Input />
                </TextField>
                <TextField
                  isRequired
                  type="date"
                  value={endDate}
                  onChange={setEndDate}
                  isDisabled={running}
                >
                  <Label>End Date</Label>
                  <Input />
                </TextField>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted">Stock Universe</label>
                  <a
                    href="/dashboard/universe"
                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors no-underline"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                    </svg>
                    Manage
                  </a>
                </div>
                {watchlistsLoading ? (
                  <div className="flex items-center gap-2 text-muted text-xs py-2">
                    <Spinner size="sm" />
                    <span>Loading stock lists…</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <select
                      value={universeValue}
                      onChange={(e) => handleUniverseChange(e.target.value)}
                      disabled={running || universeLoading}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                    >
                      {watchlists.length > 0 && (
                        <optgroup label="📋 Custom Lists">
                          {watchlists.map((wl) => (
                            <option key={`custom:${wl.id}`} value={`custom:${wl.id}`}>
                              {wl.name} ({wl.stockCount} stocks)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {Object.entries(IndicesData).map(([category, indices]) => (
                        <optgroup key={category} label={category}>
                          {indices.map((idx) => (
                            <option key={idx} value={idx}>
                              {idx}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <div className="text-[11px] text-muted">
                      {universeLoading ? (
                        <span className="flex items-center gap-1.5">
                          <Spinner size="sm" />
                          Loading stocks…
                        </span>
                      ) : (
                        <span>{selectedTokens.length} stocks in universe</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Execution Actions */}
              <div className="mt-2 flex flex-col gap-3">
                <Button
                  onPress={handleRun}
                  isPending={running && phase !== 'batch'}
                  className="w-full"
                >
                  {running && phase !== 'batch' ? 'Running…' : 'Run Backtest'}
                </Button>
                
                {running && phase !== 'batch' && (
                  <Button variant="outline" onPress={handleCancel}>
                    Cancel
                  </Button>
                )}
              </div>

              {/* Batch / Random Runs */}
              <div className="border-t border-border pt-4 mt-auto">
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <TextField
                      isRequired
                      type="number"
                      value={randomRunsCount}
                      onChange={setRandomRunsCount}
                      isDisabled={running}
                    >
                      <Label>Random Runs</Label>
                      <Input min={1} max={20} />
                    </TextField>
                  </div>
                  <Button
                    onPress={handleRandomTest}
                    isPending={running && phase === 'batch'}
                    variant="secondary"
                    className="flex-1"
                  >
                    {running && phase === 'batch' ? 'Running…' : 'Random Test'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted mt-2.5">
                  Batch runs backtests across random date windows (min. 1 month).
                </p>
                {running && phase === 'batch' && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" onPress={handleCancel} className="w-full">
                      Cancel Random Test
                    </Button>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        </Card.Content>
      </Card>

      {/* Progress Bar */}
      {(running || phase === 'error') && (
        <Card>
          <Card.Content className="py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{progressMessage}</span>
                {running && (
                  <span className="font-mono text-xs text-muted">
                    {progressPct}%
                  </span>
                )}
              </div>
              <div className="w-full h-2 rounded-full bg-muted/20 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ease-out ${
                    phase === 'error'
                      ? 'bg-danger'
                      : phase === 'done'
                        ? 'bg-success'
                        : 'bg-accent'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Card>
          <Card.Content className="py-4">
            <div className="flex items-center gap-3 text-danger">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              <span className="text-sm font-medium">{error}</span>
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Random Runs Selection Cards */}
      {results.length > 1 && (
        <Card>
          <Card.Header>
            <Card.Title>Random Test Results</Card.Title>
            <Card.Description>Select a run to view detailed stats</Card.Description>
          </Card.Header>
          <Card.Content className="pt-0">
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 snap-x">
              {results.map((res, i) => (
                <div
                  key={res.id}
                  onClick={() => {
                    setActiveRunIndex(i);
                    setCurrentPage(1);
                  }}
                  className={`flex-shrink-0 w-56 p-4 rounded-xl cursor-pointer border-2 transition-all snap-start ${
                    activeRunIndex === i
                      ? 'border-accent bg-accent/10 shadow-sm'
                      : 'border-border bg-card hover:border-accent/50 hover:bg-accent/5'
                  }`}
                >
                  <p className="text-xs text-muted mb-2 font-mono font-medium">Run {i + 1}</p>
                  <p className="text-[11px] text-muted mb-3 font-mono break-all">{res.startDate} → {res.endDate}</p>
                  <div className="flex justify-between items-center">
                    <span className={`font-bold font-mono ${res.summary.totalReturnPct >= 0 ? 'text-success' : 'text-danger'}`}>
                      {res.summary.totalReturnPct >= 0 ? '+' : ''}{res.summary.totalReturnPct.toFixed(2)}%
                    </span>
                    <span className="text-xs text-muted font-mono">{res.summary.winRate.toFixed(0)}% WR</span>
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Return"
            value={`${summary.totalReturnPct >= 0 ? '+' : ''}${summary.totalReturnPct.toFixed(2)}%`}
            color={summary.totalReturnPct >= 0 ? 'success' : 'danger'}
          />
          <StatCard
            label="Win Rate"
            value={`${summary.winRate.toFixed(1)}%`}
            sub={`${summary.closedTrades} closed trades`}
          />
          <StatCard
            label="Profit Factor"
            value={
              summary.profitFactor === null
                ? '0.00'
                : summary.profitFactor === Infinity
                  ? '∞'
                  : summary.profitFactor.toFixed(2)
            }
            color={(summary.profitFactor ?? 0) >= 1 ? 'success' : 'danger'}
          />
          <StatCard
            label="Max Drawdown"
            value={`-${summary.maxDrawdownPct.toFixed(2)}%`}
            color="danger"
          />
          <StatCard
            label="Total Deployed"
            value={formatINR(summary.totalDeployed)}
          />
          <StatCard
            label="Total Returned"
            value={formatINR(summary.totalReturned)}
            color={summary.totalReturned >= summary.totalDeployed ? 'success' : 'danger'}
          />
          <StatCard
            label="Avg Holding"
            value={`${Math.round(summary.avgHoldingDays)} days`}
          />
          <StatCard
            label="Open Positions"
            value={String(summary.openTrades)}
            sub={`of ${summary.totalTrades} total`}
          />
        </div>
      )}

      {/* Equity Curve */}
      {equityCurve.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>Equity Curve</Card.Title>
            <Card.Description>
              Portfolio value over time (deployed capital + unrealised P&L)
            </Card.Description>
          </Card.Header>
          <Card.Content className="p-0 overflow-hidden rounded-b-xl">
            <EquityChart data={equityCurve} />
          </Card.Content>
        </Card>
      )}

      {/* Trade Log */}
      {trades.length > 0 && (
        <Card>
          <Card.Header className="flex-row items-center justify-between flex-wrap gap-3">
            <div>
              <Card.Title>Trade Summary</Card.Title>
              <Card.Description>
                {displayTrades.length} symbol{displayTrades.length !== 1 ? 's' : ''} shown
                {runId !== null && (
                  <span className="ml-2 text-xs opacity-50">Run #{runId}</span>
                )}
              </Card.Description>
            </div>
            <div className="flex gap-1.5">
              {(['all', 'wins', 'losses'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setTradeFilter(f);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    tradeFilter === f
                      ? 'bg-accent text-accent-foreground'
                      : 'bg-muted/10 text-muted hover:bg-muted/20'
                  }`}
                >
                  {f === 'all'
                    ? `All (${trades.length})`
                    : f === 'wins'
                      ? `Wins (${trades.filter((t) => (t.pnlAbs ?? 0) > 0).length})`
                      : `Losses (${trades.filter((t) => (t.pnlAbs ?? 0) <= 0).length})`}
                </button>
              ))}
            </div>
          </Card.Header>
          <Card.Content className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted uppercase tracking-wider">
                    <SortableHeader
                      label="Symbol"
                      field="symbol"
                      current={sortField}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Trades"
                      field="tradeCount"
                      current={sortField}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Total P&L %"
                      field="pnlPct"
                      current={sortField}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Total P&L ₹"
                      field="pnlAbs"
                      current={sortField}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <SortableHeader
                      label="Avg Days"
                      field="holdingDays"
                      current={sortField}
                      dir={sortDir}
                      onSort={toggleSort}
                    />
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTrades.map((agg, i) => (
                    <tr
                      key={`${agg.symbol}-${i}`}
                      className="border-b border-border/50 hover:bg-muted/5 transition-colors"
                    >
                      <td className="px-4 py-3 font-medium font-mono">
                        {agg.symbol}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {agg.tradeCount}
                      </td>
                      <td
                        className={`px-4 py-3 font-semibold font-mono text-xs ${
                          agg.pnlPct > 0 ? 'text-success' : agg.pnlPct < 0 ? 'text-danger' : 'text-muted'
                        }`}
                      >
                        {agg.pnlPct > 0 ? '+' : ''}{agg.pnlPct.toFixed(2)}%
                      </td>
                      <td
                        className={`px-4 py-3 font-mono text-xs ${
                          agg.pnlAbs > 0 ? 'text-success' : agg.pnlAbs < 0 ? 'text-danger' : 'text-muted'
                        }`}
                      >
                        {formatINR(agg.pnlAbs)}
                      </td>
                      <td className="px-4 py-3 text-muted font-mono text-xs">
                        {agg.holdingDays}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {runId ? (
                          <a 
                            href={`/dashboard/trade-details/${runId}/${agg.symbol}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors text-xs font-semibold"
                          >
                            Details
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                          </a>
                        ) : (
                          <span className="text-muted text-[10px] uppercase">No run ID</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex justify-center">
                <Pagination className="w-full">
                  <Pagination.Summary>
                    Showing {Math.min((currentPage - 1) * pageSize + 1, displayTrades.length)}-{Math.min(currentPage * pageSize, displayTrades.length)} of {displayTrades.length} trades
                  </Pagination.Summary>
                  <Pagination.Content>
                    <Pagination.Item>
                      <Pagination.Previous
                        isDisabled={currentPage === 1}
                        onPress={() => setCurrentPage((p) => p - 1)}
                      >
                        <Pagination.PreviousIcon />
                        <span>Previous</span>
                      </Pagination.Previous>
                    </Pagination.Item>

                    {(() => {
                      const pages: (number | 'ellipsis')[] = [];
                      if (totalPages <= 7) {
                        for (let i = 1; i <= totalPages; i++) {
                          pages.push(i);
                        }
                      } else {
                        pages.push(1);
                        if (currentPage > 3) {
                          pages.push('ellipsis');
                        }
                        const start = Math.max(2, currentPage - 1);
                        const end = Math.min(totalPages - 1, currentPage + 1);
                        for (let i = start; i <= end; i++) {
                          pages.push(i);
                        }
                        if (currentPage < totalPages - 2) {
                          pages.push('ellipsis');
                        }
                        pages.push(totalPages);
                      }
                      return pages.map((p, idx) =>
                        p === 'ellipsis' ? (
                          <Pagination.Item key={`ellipsis-${idx}`}>
                            <Pagination.Ellipsis />
                          </Pagination.Item>
                        ) : (
                          <Pagination.Item key={p}>
                            <Pagination.Link
                              isActive={p === currentPage}
                              onPress={() => setCurrentPage(p)}
                            >
                              {p}
                            </Pagination.Link>
                          </Pagination.Item>
                        )
                      );
                    })()}

                    <Pagination.Item>
                      <Pagination.Next
                        isDisabled={currentPage === totalPages}
                        onPress={() => setCurrentPage((p) => p + 1)}
                      >
                        <span>Next</span>
                        <Pagination.NextIcon />
                      </Pagination.Next>
                    </Pagination.Item>
                  </Pagination.Content>
                </Pagination>
              </div>
            )}
          </Card.Content>
        </Card>
      )}
    </div>
  );
}

// --- Sub-components & Helpers ---

function getRandomDateRanges(startStr: string, endStr: string, count: number, minMonths: number = 1) {
  const startMs = new Date(startStr).getTime();
  const endMs = new Date(endStr).getTime();
  const minDiffMs = minMonths * 30 * 24 * 60 * 60 * 1000; // rough 30-day months
  
  if (endMs - startMs < minDiffMs) {
    throw new Error(`Global date range must be at least ${minMonths} month(s) wide for random testing.`);
  }

  const pairs = [];
  for (let i = 0; i < count; i++) {
    // 1. Pick a random start such that start + minDiff <= end
    const maxStartMs = endMs - minDiffMs;
    const randStartMs = startMs + Math.random() * (maxStartMs - startMs);
    
    // 2. Pick a random end such that randStart + minDiff <= randEnd <= globalEnd
    const minEndMs = randStartMs + minDiffMs;
    const randEndMs = minEndMs + Math.random() * (endMs - minEndMs);
    
    pairs.push({
      start: new Date(randStartMs).toISOString().slice(0, 10),
      end: new Date(randEndMs).toISOString().slice(0, 10),
    });
  }
  return pairs;
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: 'success' | 'danger';
}) {
  const colorClass =
    color === 'success'
      ? 'text-success'
      : color === 'danger'
        ? 'text-danger'
        : 'text-foreground';

  return (
    <Card>
      <Card.Content className="py-4 px-5">
        <p className="text-xs text-muted uppercase tracking-wider font-medium mb-1">
          {label}
        </p>
        <p className={`text-xl font-bold font-mono tracking-tight ${colorClass}`}>
          {value}
        </p>
        {sub && (
          <p className="text-xs text-muted mt-0.5">{sub}</p>
        )}
      </Card.Content>
    </Card>
  );
}

function SortableHeader({
  label,
  field,
  current,
  dir,
  onSort,
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const isActive = current === field;
  return (
    <th className="px-4 py-3 font-medium">
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
          isActive ? 'text-foreground' : ''
        }`}
      >
        {label}
        {isActive && (
          <span className="text-[10px]">{dir === 'asc' ? '▲' : '▼'}</span>
        )}
      </button>
    </th>
  );
}

function formatINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)}Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)}L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)}K`;
  return `${sign}₹${abs.toFixed(0)}`;
}
