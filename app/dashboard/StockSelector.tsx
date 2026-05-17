"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Card,
  Spinner,
  TextField,
  Input,
  Checkbox,
} from "@heroui/react";
import IndicesData from "@/lib/Indices.json";

interface Stock {
  symbol: string;
  name: string;
  kiteToken: number;
  industry: string;
}

interface StockSelectorProps {
  onSelectionChange: (tokens: number[]) => void;
  disabled?: boolean;
}

export default function StockSelector({
  onSelectionChange,
  disabled,
}: StockSelectorProps) {
  const [selectedIndex, setSelectedIndex] = useState("NIFTY 50");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(
    new Set<string>(),
  );
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load stocks when index changes
  useEffect(() => {
    async function loadStocks() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/stocks/index?index=${encodeURIComponent(selectedIndex)}`,
        );
        if (!res.ok) throw new Error("Failed to fetch stocks");
        const data = await res.json();
        setStocks(data.stocks);
        // Default to all selected for a new index
        const allSymbols = new Set<string>(
          data.stocks.map((s: Stock) => s.symbol),
        );
        setSelectedSymbols(allSymbols);
        onSelectionChange(data.stocks.map((s: Stock) => s.kiteToken));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadStocks();
  }, [selectedIndex]);

  // Filtered stocks based on search query
  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return stocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q),
    );
  }, [stocks, searchQuery]);

  const toggleStock = (symbol: string) => {
    const next = new Set(selectedSymbols);
    if (next.has(symbol)) {
      next.delete(symbol);
    } else {
      next.add(symbol);
    }
    setSelectedSymbols(next);

    // Notify parent of token changes
    const selectedTokens = stocks
      .filter((s) => next.has(s.symbol))
      .map((s) => s.kiteToken);
    onSelectionChange(selectedTokens);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedSymbols);
    filteredStocks.forEach((s) => next.add(s.symbol));
    setSelectedSymbols(next);
    const selectedTokens = stocks
      .filter((s) => next.has(s.symbol))
      .map((s) => s.kiteToken);
    onSelectionChange(selectedTokens);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedSymbols);
    filteredStocks.forEach((s) => next.delete(s.symbol));
    setSelectedSymbols(next);
    const selectedTokens = stocks
      .filter((s) => next.has(s.symbol))
      .map((s) => s.kiteToken);
    onSelectionChange(selectedTokens);
  };

  return (
    <div className="space-y-4">
      {/* Index Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Select Index
          </label>
          <select
            value={selectedIndex}
            onChange={(e) => setSelectedIndex(e.target.value)}
            disabled={loading || disabled}
            className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
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
        </div>

        <div>
          <label className="text-xs font-medium text-muted mb-1.5 block">
            Search Stocks
          </label>
          <TextField
            value={searchQuery}
            onChange={setSearchQuery}
            isDisabled={loading || disabled}
            aria-label="Search stocks"
          >
            <Input placeholder="Symbol, name or industry..." />
          </TextField>
        </div>
      </div>

      {/* Stats and Quick Actions */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted">
          {loading ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Loading constituents...
            </span>
          ) : (
            <span>
              Selected {selectedSymbols.size} of {stocks.length} stocks
              {searchQuery && ` (matching search: ${filteredStocks.length})`}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={loading || disabled || filteredStocks.length === 0}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={deselectAllFiltered}
            disabled={loading || disabled || filteredStocks.length === 0}
            className="text-[10px] font-bold uppercase tracking-wider text-danger hover:text-danger/80 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Stock Grid */}
      <div className="relative min-h-[200px] max-h-[400px] overflow-y-auto border border-border rounded-xl bg-card/30 p-2">
        {error ? (
          <div className="flex items-center justify-center h-full text-danger text-sm p-4">
            {error}
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-full py-12">
            <Spinner />
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="flex items-center justify-center h-full py-12 text-muted text-sm italic">
            No stocks found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredStocks.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => !disabled && toggleStock(stock.symbol)}
                className={`
                  flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer
                  ${
                    selectedSymbols.has(stock.symbol)
                      ? "bg-accent/10 border-accent/30"
                      : "bg-muted/5 border-transparent hover:bg-muted/10"
                  }
                  ${disabled ? "opacity-50 cursor-not-allowed" : ""}
                `}
              >
                <div className="flex-shrink-0">
                  <Checkbox
                    isSelected={selectedSymbols.has(stock.symbol)}
                    isDisabled={disabled}
                    aria-label={`Select ${stock.symbol}`}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold truncate">{stock.symbol}</p>
                  <p className="text-[10px] text-muted truncate">
                    {stock.name}
                  </p>
                  <p className="text-[9px] text-accent/60 truncate mt-0.5 uppercase tracking-tighter">
                    {stock.industry}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
