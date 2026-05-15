import ClientForm from './ClientForm';

export const metadata = {
  title: 'Dashboard | Kite Backtester',
  description: 'Fetch and analyze historical market data from Zerodha Kite Connect.',
};

export default function DashboardPage() {
  return (
    <div className="max-w-2xl w-full mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted text-sm mt-1">
          Fetch historical OHLCV candle data from Zerodha Kite Connect for analysis and backtesting.
        </p>
      </div>
      <ClientForm />
    </div>
  );
}
