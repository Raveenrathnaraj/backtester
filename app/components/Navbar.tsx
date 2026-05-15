'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@heroui/react';
import ThemeSwitch from './ThemeSwitch';

export default function Navbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch {
      router.push('/');
    }
  };

  return (
    <nav className="sticky top-0 z-50 h-16 border-b border-border backdrop-blur-xl bg-surface/80">
      <div className="flex items-center justify-between h-full max-w-5xl mx-auto px-6">
        <a href="/dashboard" className="flex items-center gap-2.5 font-bold text-foreground no-underline tracking-tight">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          >
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Kite Backtester
        </a>

        <div className="flex items-center gap-2">
          <ThemeSwitch />
          <Button
            variant="ghost"
            size="sm"
            isPending={loggingOut}
            onPress={handleLogout}
          >
            {loggingOut ? 'Logging out…' : 'Logout'}
          </Button>
        </div>
      </div>
    </nav>
  );
}
