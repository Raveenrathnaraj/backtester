import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLoginUrl } from '@/lib/kite';
import LoginClient from './LoginClient';

export const metadata = {
  title: 'Login | Kite Backtester',
  description: 'Authenticate with Zerodha Kite Connect to access the backtester dashboard.',
};

export default async function LoginPage() {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get('kite_access_token');

  if (isAuthenticated) {
    redirect('/dashboard');
  }

  const loginUrl = getLoginUrl();

  return <LoginClient loginUrl={loginUrl} />;
}
