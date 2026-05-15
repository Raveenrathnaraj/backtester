'use client';

import { Card } from '@heroui/react';
import ThemeSwitch from './components/ThemeSwitch';

export default function LoginClient({ loginUrl }: { loginUrl: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4">
        <ThemeSwitch />
      </div>

      {/* Logo */}
      <div className="mb-8 flex items-center justify-center w-16 h-16 rounded-2xl bg-accent text-accent-foreground">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>

      {/* Card */}
      <Card className="w-full max-w-md">
        <Card.Content className="flex flex-col items-center text-center gap-4 p-8">
          <h1 className="text-2xl font-bold tracking-tight">Kite Backtester</h1>
          <p className="text-muted text-sm max-w-xs">
            Connect your Zerodha account to fetch historical market data and run backtests.
          </p>

          {/* Use a native <a> tag with HeroUI's BEM button class for reliable navigation */}
          <a
            href={loginUrl}
            className="button button--lg w-full mt-2 inline-flex items-center justify-center gap-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Login with Kite Connect
          </a>

          <p className="text-xs text-muted mt-2">
            Powered by Zerodha Kite Connect API
          </p>
        </Card.Content>
      </Card>
    </div>
  );
}
