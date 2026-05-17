"use client";

import { useState } from "react";
import { Button, Card } from "@heroui/react";

export default function AdminClient() {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const startPopulate = () => {
    setRunning(true);
    setStatus(null);
    setError(null);

    const eventSource = new EventSource("/api/populate");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.phase === "Error") {
        setError(data.message);
        setRunning(false);
        eventSource.close();
      } else if (data.phase === "Done") {
        setStatus(data);
        setRunning(false);
        eventSource.close();
      } else {
        setStatus(data);
      }
    };

    eventSource.onerror = () => {
      setError("EventSource connection error");
      setRunning(false);
      eventSource.close();
    };
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold mb-8 tracking-tight">
          Admin Controls
        </h1>

        <Card className="p-6">
          <Card.Header className="px-0 pt-0">
            <div>
              <Card.Title>Data Population</Card.Title>
              <Card.Description>
                Fetch instruments from NSE and bulk download historical candles
                since 2000.
              </Card.Description>
            </div>
          </Card.Header>

          <Card.Content className="px-0 mt-6">
            <Button
              variant="primary"
              isDisabled={running}
              onPress={startPopulate}
              className="mb-6"
            >
              {running ? "Populating..." : "Populate Data"}
            </Button>

            {error && (
              <div className="p-4 bg-danger/10 text-danger rounded-xl text-sm mb-4 border border-danger/20">
                {error}
              </div>
            )}

            {status && (
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-muted">{status.phase}</span>
                  <div className="flex gap-4">
                    {status.eta && (
                      <span className="text-muted">ETA: {status.eta}</span>
                    )}
                    <span className="text-foreground">{status.progress}%</span>
                  </div>
                </div>

                {/* Custom Progress Bar since HeroUI progress can be tricky with types */}
                <div className="w-full bg-surface-hover rounded-full h-2.5 mb-4 overflow-hidden">
                  <div
                    className="bg-accent h-2.5 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${status.progress}%` }}
                  ></div>
                </div>

                <p className="text-sm text-muted">{status.message}</p>

                {status.stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 text-center">
                    <div className="p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="text-2xl font-bold">
                        {status.stats.total}
                      </div>
                      <div className="text-xs text-muted uppercase tracking-wider mt-1">
                        Total
                      </div>
                    </div>
                    <div className="p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="text-2xl font-bold text-success">
                        {status.stats.fetched}
                      </div>
                      <div className="text-xs text-muted uppercase tracking-wider mt-1">
                        Fetched
                      </div>
                    </div>
                    <div className="p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="text-2xl font-bold text-accent">
                        {status.stats.skipped}
                      </div>
                      <div className="text-xs text-muted uppercase tracking-wider mt-1">
                        Cached
                      </div>
                    </div>
                    <div className="p-4 bg-surface/50 rounded-xl border border-border">
                      <div className="text-2xl font-bold text-danger">
                        {status.stats.failed}
                      </div>
                      <div className="text-xs text-muted uppercase tracking-wider mt-1">
                        Failed
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card.Content>
        </Card>
      </div>
    </main>
  );
}
