'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@heroui/react';
import ThemeSwitch from './ThemeSwitch';

const navLinks = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/dashboard/universe', label: 'Stock Lists' },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
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
      <div className="flex items-center justify-between h-full max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5 font-bold text-foreground no-underline tracking-tight">
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
            AlphaForge
          </a>

          <div className="hidden sm:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname.startsWith(link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline
                    ${isActive
                      ? 'bg-accent/15 text-accent'
                      : 'text-muted hover:text-foreground hover:bg-muted/10'}
                  `}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>

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

