import BacktestDashboard from './BacktestDashboard';

export const metadata = {
  title: 'Dashboard | Kite Backtester',
  description:
    'Run 52-week high breakout backtests across Nifty 500 stocks with Zerodha Kite Connect.',
};

export default function DashboardPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Backtest Dashboard
        </h1>
        <p className="text-muted text-sm mt-1">
          52-week high breakout strategy with 10% trailing stop loss across
          Nifty 500 stocks.
        </p>
      </div>
      <BacktestDashboard />
    </div>
  );
}
