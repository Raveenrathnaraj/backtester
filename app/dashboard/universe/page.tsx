import UniverseManager from './UniverseManager';

export const metadata = {
  title: 'Stock Lists | Kite Backtester',
  description: 'Create and manage custom stock watchlists for backtesting.',
};

export default function UniversePage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Stock Lists
        </h1>
        <p className="text-muted text-sm mt-1">
          Create custom stock lists from NSE indices for your backtests.
        </p>
      </div>
      <UniverseManager />
    </div>
  );
}
