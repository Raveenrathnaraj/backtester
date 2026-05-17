import LandingPage from './LandingPage';

export const metadata = {
  title: 'AlphaForge — Free AI-Powered Stock Backtester for Indian Markets',
  description: 'Backtest trading strategies against 20+ years of Indian stock market data for free. Build, test, and optimize with our advanced AI strategy builder.',
  keywords: ['backtesting', 'trading', 'stocks', 'India', 'NSE', 'Nifty', 'Nifty 50', 'AI strategy builder', 'AlphaForge', 'free backtester'],
};

export default function HomePage() {
  return <LandingPage isAuthenticated={true} loginUrl="" />;
}
