import AdminClient from './AdminClient';
import LoginClient from '../LoginClient';
import { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getLoginUrl } from '@/lib/kite';

export const metadata: Metadata = {
  title: 'Admin | AlphaForge',
  description: 'Administration controls for AlphaForge.',
};

export default async function AdminPage() {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get('kite_access_token');

  if (!isAuthenticated) {
    return <LoginClient loginUrl={getLoginUrl()} />;
  }

  return <AdminClient />;
}
