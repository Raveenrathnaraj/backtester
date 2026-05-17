'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Spinner, Card } from '@heroui/react';
import type { StrategyRecord } from '@/types/strategy';

export default function StrategyClient() {
  const router = useRouter();
  const [strategies, setStrategies] = useState<StrategyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/strategy')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load strategies');
        return res.json();
      })
      .then((data: StrategyRecord[]) => {
        setStrategies(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to fetch strategies');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-8rem)]">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-muted animate-pulse">Loading strategies…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Strategies</h1>
          <p className="text-sm text-muted mt-1.5">
            Manage your custom AI-generated stock trading strategies and backtesting rules
          </p>
        </div>
        <Button
          variant="primary"
          onPress={() => router.push('/dashboard/strategy/new')}
          className="w-full sm:w-auto"
        >
          + New Strategy
        </Button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-border bg-card/20 text-center">
          <span className="text-4xl mb-4">🤖</span>
          <h3 className="text-lg font-semibold text-foreground">No strategies found</h3>
          <p className="text-sm text-muted max-w-sm mt-1 mb-6">
            You don't have any custom trading strategies yet. Let the AI help you build one!
          </p>
          <Button
            variant="secondary"
            onPress={() => router.push('/dashboard/strategy/new')}
          >
            Create Your First Strategy
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              className="group relative flex flex-col justify-between p-6 rounded-2xl border border-border bg-card/40 hover:bg-card/70 hover:border-accent/40 transition-all duration-300 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <h3 className="font-bold text-lg text-foreground tracking-tight group-hover:text-accent transition-colors truncate">
                    {strategy.name}
                  </h3>
                  {strategy.isDefault && (
                    <span className="flex-shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest bg-accent/15 text-accent border border-accent/20">
                      Default
                    </span>
                  )}
                </div>

                <div className="space-y-2 mb-6">
                  {strategy.description.split('\n').filter(Boolean).map((line, i) => (
                    <div
                      key={`rule-${i}`}
                      className="flex items-start gap-2 text-xs text-muted leading-relaxed"
                    >
                      <span className="mt-1 w-1 h-1 rounded-full bg-accent/60 flex-shrink-0" />
                      <span>{line.replace(/^[•→↗↘◎\-\*]\s*/u, '').replace(/^\*\*(.+?)\*\*/, '$1')}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-4 border-t border-border/40">
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push(`/dashboard/strategy/${strategy.id}`)}
                  className="flex-1 text-xs font-medium"
                >
                  Edit / Refine
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onPress={() => router.push(`/dashboard?strategyId=${strategy.id}`)}
                  className="flex-1 text-xs font-medium text-accent"
                >
                  Backtest
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
