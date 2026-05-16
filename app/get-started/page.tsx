import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GetStartedClient from './GetStartedClient';

export const metadata = {
  title: 'Get Started | AlphaForge',
  description: 'Create strategies, build stock lists, or start backtesting with AlphaForge.',
};

export default async function GetStartedPage() {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get('kite_access_token');

  if (!isAuthenticated) {
    redirect('/');
  }

  return <GetStartedClient />;
}
