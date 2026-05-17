import BacktestDashboard from './BacktestDashboard';

export const metadata = {
  title: 'Dashboard | AlphaForge',
  description: 'View your recent backtests, monitor your active strategies, and analyze your performance.',
};

export default function DashboardPage() {
  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">
          Backtest Dashboard
        </h1>
      </div>
      <BacktestDashboard />
    </div>
  );
}
