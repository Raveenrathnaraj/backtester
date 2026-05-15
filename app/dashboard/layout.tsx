import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Navbar from '@/app/components/Navbar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const isAuthenticated = !!cookieStore.get('kite_access_token');

  if (!isAuthenticated) {
    redirect('/');
  }

  return (
    <>
      <Navbar />
      <main className="flex-1 flex flex-col">{children}</main>
    </>
  );
}
