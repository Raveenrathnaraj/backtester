'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Button,
  Card,
  Spinner,
  TextField,
  Input,
  Checkbox,
} from '@heroui/react';
import IndicesData from '@/lib/Indices.json';

// ---------- Types ----------

interface Stock {
  symbol: string;
  name: string;
  kiteToken: number;
  industry: string;
}

interface SavedWatchlist {
  id: number;
  name: string;
  baseIndex: string;
  stockCount: number;
  symbols: string;
  tokens: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Component ----------

export default function UniverseManager() {
  // Saved watchlists
  const [watchlists, setWatchlists] = useState<SavedWatchlist[]>([]);
  const [watchlistsLoading, setWatchlistsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Dropdown selection — could be 'custom:<id>' or an index name
  const [dropdownValue, setDropdownValue] = useState('NIFTY 50');

  // Stocks loaded from the selected source
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set());
  const [originalSymbols, setOriginalSymbols] = useState<Set<string>>(new Set()); // Track if user made changes
  const [stocksLoading, setStocksLoading] = useState(false);
  const [stocksError, setStocksError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Save form (appears inline when list is modified)
  const [listName, setListName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // ---------- Derived: has user modified the selection? ----------

  const isModified = useMemo(() => {
    if (originalSymbols.size === 0) return false;
    if (selectedSymbols.size !== originalSymbols.size) return true;
    for (const sym of selectedSymbols) {
      if (!originalSymbols.has(sym)) return true;
    }
    return false;
  }, [selectedSymbols, originalSymbols]);

  // ---------- Load watchlists ----------

  const loadWatchlists = useCallback(async () => {
    setWatchlistsLoading(true);
    try {
      const res = await fetch('/api/watchlists');
      if (res.ok) {
        const data = await res.json();
        setWatchlists(data);
      }
    } catch {
      // silently fail
    } finally {
      setWatchlistsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWatchlists();
  }, [loadWatchlists]);

  // ---------- Load stocks from source ----------

  const loadFromIndex = useCallback(async (index: string) => {
    setStocksLoading(true);
    setStocksError(null);
    setSaveSuccess(null);
    try {
      const res = await fetch(`/api/stocks/index?index=${encodeURIComponent(index)}`);
      if (!res.ok) throw new Error('Failed to fetch stocks');
      const data = await res.json();
      setStocks(data.stocks);
      const allSymbols = new Set<string>(data.stocks.map((s: Stock) => s.symbol));
      setSelectedSymbols(new Set(allSymbols));
      setOriginalSymbols(new Set(allSymbols));
      setSearchQuery('');
      setListName(`${index} (Custom)`);
    } catch (err: any) {
      setStocksError(err.message);
    } finally {
      setStocksLoading(false);
    }
  }, []);

  const loadFromWatchlist = useCallback((wl: SavedWatchlist) => {
    // We need to reconstruct stock objects from the watchlist symbols
    // For display, we load from the base index and then apply the saved selection
    setStocksLoading(true);
    setStocksError(null);
    setSaveSuccess(null);

    fetch(`/api/stocks/index?index=${encodeURIComponent(wl.baseIndex)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load base index');
        return res.json();
      })
      .then((data) => {
        const savedSymbols: string[] = JSON.parse(wl.symbols);
        setStocks(data.stocks);
        const savedSet = new Set<string>(savedSymbols);
        setSelectedSymbols(new Set(savedSet));
        setOriginalSymbols(new Set(savedSet));
        setSearchQuery('');
        setListName(wl.name);
      })
      .catch((err: any) => setStocksError(err.message))
      .finally(() => setStocksLoading(false));
  }, []);

  // Load stocks when dropdown changes
  const handleDropdownChange = (value: string) => {
    setDropdownValue(value);
    setSaveSuccess(null);

    if (value.startsWith('custom:')) {
      const id = Number(value.split(':')[1]);
      const wl = watchlists.find((w) => w.id === id);
      if (wl) loadFromWatchlist(wl);
    } else {
      loadFromIndex(value);
    }
  };

  // Auto-load NIFTY 50 on first mount
  useEffect(() => {
    loadFromIndex('NIFTY 50');
  }, [loadFromIndex]);

  // ---------- Filtered stocks ----------

  const filteredStocks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return stocks.filter(
      (s) =>
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.industry.toLowerCase().includes(q),
    );
  }, [stocks, searchQuery]);

  // ---------- Stock toggle actions ----------

  const toggleStock = (symbol: string) => {
    const next = new Set(selectedSymbols);
    if (next.has(symbol)) {
      next.delete(symbol);
    } else {
      next.add(symbol);
    }
    setSelectedSymbols(next);
  };

  const selectAllFiltered = () => {
    const next = new Set(selectedSymbols);
    filteredStocks.forEach((s) => next.add(s.symbol));
    setSelectedSymbols(next);
  };

  const deselectAllFiltered = () => {
    const next = new Set(selectedSymbols);
    filteredStocks.forEach((s) => next.delete(s.symbol));
    setSelectedSymbols(next);
  };

  // ---------- Get the display name of the base index ----------

  const currentBaseIndex = useMemo(() => {
    if (dropdownValue.startsWith('custom:')) {
      const id = Number(dropdownValue.split(':')[1]);
      const wl = watchlists.find((w) => w.id === id);
      return wl?.baseIndex || 'Unknown';
    }
    return dropdownValue;
  }, [dropdownValue, watchlists]);

  // ---------- Save watchlist ----------

  const handleSave = async () => {
    if (!listName.trim() || selectedSymbols.size === 0) return;

    setSaving(true);
    setStocksError(null);
    try {
      const selectedStocks = stocks.filter((s) => selectedSymbols.has(s.symbol));
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName.trim(),
          baseIndex: currentBaseIndex,
          symbols: selectedStocks.map((s) => s.symbol),
          tokens: selectedStocks.map((s) => s.kiteToken),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      setSaveSuccess(`"${listName.trim()}" saved with ${selectedSymbols.size} stocks!`);
      // Update original to match current so isModified goes false
      setOriginalSymbols(new Set(selectedSymbols));
      await loadWatchlists();
    } catch (err: any) {
      setStocksError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete watchlist ----------

  const handleDelete = async (id: number) => {
    try {
      await fetch(`/api/watchlists?id=${id}`, { method: 'DELETE' });
      setDeleteConfirmId(null);
      await loadWatchlists();

      // If we deleted the currently selected watchlist, switch to NIFTY 50
      if (dropdownValue === `custom:${id}`) {
        setDropdownValue('NIFTY 50');
        loadFromIndex('NIFTY 50');
      }
    } catch {
      // silently fail
    }
  };

  // ---------- Render ----------

  return (
    <div className="flex flex-col gap-6">
      {/* Source Selector + Save Banner */}
      <Card>
        <Card.Content className="py-4">
          <div className="flex flex-col gap-4">
            {/* Dropdown: All sources in one */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted mb-1.5 block">
                  Select Stock List
                </label>
                <select
                  value={dropdownValue}
                  onChange={(e) => handleDropdownChange(e.target.value)}
                  disabled={stocksLoading}
                  className="w-full px-3 py-2.5 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 transition-shadow"
                >
                  {/* Custom lists first */}
                  {watchlists.length > 0 && (
                    <optgroup label="📋 Your Custom Lists">
                      {watchlists.map((wl) => (
                        <option key={`custom:${wl.id}`} value={`custom:${wl.id}`}>
                          {wl.name} ({wl.stockCount} stocks)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {/* NSE Indices */}
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
                  isDisabled={stocksLoading}
                  aria-label="Search stocks"
                >
                  <Input placeholder="Symbol, name or industry…" />
                </TextField>
              </div>
            </div>

            {/* Save Prompt — appears when user modifies the list */}
            {isModified && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3 p-4 rounded-xl bg-warning/5 border border-warning/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-warning uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                    Save as Custom List
                  </p>
                  <p className="text-[11px] text-muted mb-2">
                    You&apos;ve changed the selection. Give it a name to save for backtesting.
                  </p>
                  <TextField
                    value={listName}
                    onChange={setListName}
                    aria-label="List name"
                  >
                    <Input placeholder="e.g. My Banking Picks, Top 20 IT…" />
                  </TextField>
                </div>
                <Button
                  onPress={handleSave}
                  isPending={saving}
                  isDisabled={!listName.trim() || selectedSymbols.size === 0}
                  className="sm:self-end"
                >
                  {saving ? 'Saving…' : `Save (${selectedSymbols.size} stocks)`}
                </Button>
              </div>
            )}

            {/* Success Message */}
            {saveSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20 text-success text-sm font-medium animate-in fade-in duration-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                {saveSuccess}
              </div>
            )}
          </div>
        </Card.Content>
      </Card>

      {/* Stats and Quick Actions */}
      <div className="flex items-center justify-between px-1">
        <div className="text-xs text-muted">
          {stocksLoading ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Loading stocks…
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="font-bold text-foreground text-sm">{selectedSymbols.size}</span>
              <span>of {stocks.length} stocks selected</span>
              {searchQuery && (
                <span className="text-muted/60">
                  · {filteredStocks.length} matching
                </span>
              )}
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={selectAllFiltered}
            disabled={stocksLoading || filteredStocks.length === 0}
            className="text-[10px] font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors disabled:opacity-40"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={deselectAllFiltered}
            disabled={stocksLoading || filteredStocks.length === 0}
            className="text-[10px] font-bold uppercase tracking-wider text-danger hover:text-danger/80 transition-colors disabled:opacity-40"
          >
            Deselect All
          </button>
        </div>
      </div>

      {/* Stock Grid */}
      <div className="relative min-h-[200px] max-h-[500px] overflow-y-auto border border-border rounded-xl bg-card/30 p-3">
        {stocksError ? (
          <div className="flex items-center justify-center h-full text-danger text-sm p-4">
            {stocksError}
          </div>
        ) : stocksLoading ? (
          <div className="flex items-center justify-center h-full py-16">
            <Spinner />
          </div>
        ) : filteredStocks.length === 0 ? (
          <div className="flex items-center justify-center h-full py-16 text-muted text-sm italic">
            No stocks found matching &quot;{searchQuery}&quot;
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredStocks.map((stock) => {
              const isSelected = selectedSymbols.has(stock.symbol);
              return (
                <div
                  key={stock.symbol}
                  onClick={() => toggleStock(stock.symbol)}
                  className={`
                    flex items-center gap-3 p-2.5 rounded-lg border transition-all cursor-pointer
                    ${isSelected
                      ? 'bg-accent/10 border-accent/30 hover:bg-accent/15'
                      : 'bg-muted/5 border-transparent opacity-50 hover:opacity-75 hover:bg-muted/10'}
                  `}
                >
                  <div className="flex-shrink-0">
                    <Checkbox
                      isSelected={isSelected}
                      aria-label={`Select ${stock.symbol}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{stock.symbol}</p>
                    <p className="text-[10px] text-muted truncate">{stock.name}</p>
                    <p className="text-[9px] text-accent/60 truncate mt-0.5 uppercase tracking-tighter">
                      {stock.industry}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Saved Watchlists Management */}
      {watchlistsLoading ? null : watchlists.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="flex items-center gap-2 text-base">
              <span>📋</span>
              Your Custom Lists
            </Card.Title>
            <Card.Description>
              {watchlists.length} saved list{watchlists.length !== 1 ? 's' : ''}
            </Card.Description>
          </Card.Header>
          <Card.Content className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {watchlists.map((wl) => (
                <div
                  key={wl.id}
                  className={`
                    group relative p-4 rounded-xl border-2 transition-all
                    ${dropdownValue === `custom:${wl.id}`
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/30 hover:bg-accent/3'}
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleDropdownChange(`custom:${wl.id}`)}
                      className="text-left min-w-0 flex-1"
                    >
                      <p className="text-sm font-bold truncate">{wl.name}</p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {wl.stockCount} stocks · from {wl.baseIndex}
                      </p>
                      <p className="text-[10px] text-muted/50 mt-1.5 font-mono">
                        {new Date(wl.updatedAt).toLocaleDateString()}
                      </p>
                    </button>

                    {deleteConfirmId === wl.id ? (
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleDelete(wl.id)}
                          className="px-2.5 py-1 rounded-lg bg-danger/15 text-danger text-[10px] font-bold uppercase tracking-wider hover:bg-danger/25 transition-colors"
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 py-1 rounded-lg bg-muted/10 text-muted text-[10px] font-bold uppercase tracking-wider hover:bg-muted/20 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(wl.id)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger/10 text-muted hover:text-danger transition-all flex-shrink-0"
                        title="Delete list"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card.Content>
        </Card>
      )}
    </div>
  );
}
