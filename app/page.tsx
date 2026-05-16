import { cookies } from 'next/headers';
import { getLoginUrl } from '@/lib/kite';
import LandingPage from './LandingPage';

export const metadata = {
  title: 'AlphaForge — Forge Your Trading Alpha',
  description: 'Backtest trading strategies against 20+ years of Indian market data. AI-powered, completely free. alphaforge.one',
  keywords: ['backtesting', 'trading', 'stocks', 'India', 'NSE', 'Nifty', 'AlphaForge', 'free'],
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get('kite_access_token');
  const loginUrl = getLoginUrl();

  return <LandingPage isAuthenticated={isAuthenticated} loginUrl={loginUrl} />;
}
