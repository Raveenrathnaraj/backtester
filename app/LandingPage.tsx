'use client';

import { Button } from '@heroui/react';
import ThemeSwitch from './components/ThemeSwitch';

/* ─── Icon Components ─── */
const LogoIcon = ({ className = '' }: { className?: string }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ─── Feature data ─── */
const features = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8" /><path d="M12 8v8" />
      </svg>
    ),
    title: '100% Free',
    description: 'No subscriptions, no credit cards, no hidden fees. AlphaForge is completely free for everyone to use.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
    title: 'AI-Powered Strategies',
    description: 'Describe your trading strategy in plain English. Our Gemini AI translates it into executable backtesting code.',
    gradient: 'from-violet-500 to-purple-500',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" /><path d="M9 21V9" />
      </svg>
    ),
    title: 'NSE Data Since 2000',
    description: 'Test against 20+ years of NSE historical data — Nifty 50, Nifty 500, sectoral indices, and 2000+ Indian stocks with custom watchlists.',
    gradient: 'from-cyan-500 to-blue-500',
  },
];

/* ─── Steps data ─── */
const steps = [
  {
    step: '01',
    title: 'Connect',
    description: 'Link your Zerodha Kite account in one click. We only read historical data — zero trading permissions.',
  },
  {
    step: '02',
    title: 'Configure',
    description: 'Pick your stock universe, define a strategy in plain English or code, set your date range, and capital.',
  },
  {
    step: '03',
    title: 'Analyze',
    description: 'Get detailed equity curves, trade logs, win rates, drawdown analysis, and risk metrics — instantly.',
  },
];

/* ─── Highlights ─── */
const highlights = [
  'Full NSE coverage — Nifty 50, 500 & more',
  'Batch-test across random date windows',
  'Built-in stock universe manager',
  'Real equity curves with Lightweight Charts',
  'Dark & light mode support',
  'Export trade logs & results',
];

/* ─── Main Component ─── */
export default function LandingPage({
  isAuthenticated,
  loginUrl,
}: {
  isAuthenticated: boolean;
  loginUrl: string;
}) {
  const ctaHref = isAuthenticated ? '/get-started' : loginUrl;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* ━━━ Navbar ━━━ */}
      <nav className="sticky top-0 z-50 h-16 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="flex items-center justify-between h-full max-w-6xl mx-auto px-6">
          <a href="/" className="flex items-center gap-2.5 font-bold text-foreground no-underline tracking-tight text-lg">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
              <LogoIcon />
            </div>
            AlphaForge
          </a>
          <div className="flex items-center gap-5">
            <a
              href="/how-to"
              className="text-sm font-medium text-muted hover:text-foreground transition-colors no-underline"
            >
              How to
            </a>
            <ThemeSwitch />
            <a
              href={ctaHref}
              className="button button--sm button--accent hidden sm:inline-flex items-center gap-1.5 no-underline"
            >
              Get Started
              <ArrowRight />
            </a>
          </div>
        </div>
      </nav>

      {/* ━━━ Hero Section ━━━ */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-20 pb-28 sm:pt-28 sm:pb-36 overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] rounded-full bg-gradient-to-br from-indigo-500/20 to-violet-600/10 blur-3xl animate-float-orb" />
          <div className="absolute bottom-[-15%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-br from-cyan-500/15 to-blue-600/10 blur-3xl animate-float-orb-reverse" />
          <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/5 blur-3xl animate-float-orb" style={{ animationDelay: '5s' }} />
          {/* Grid overlay */}
          <div className="absolute inset-0 bg-grid" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto">
          {/* Badge */}
          <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-surface/50 backdrop-blur-md text-xs font-medium text-muted mb-8">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-glow" />
            Free & Open for Everyone &middot; Built for Indian Markets
          </div>

          {/* Headline */}
          <h1 className="animate-fade-in-up delay-100 text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Forge Your
            <br />
            <span className="text-gradient">Trading Alpha</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up delay-200 text-base sm:text-lg md:text-xl text-muted max-w-2xl mx-auto mb-10 leading-relaxed">
            Backtest trading strategies against 20+ years of NSE historical data —
            Nifty 50, Nifty 500, and 2000+ Indian stocks.
            Describe your strategy in plain English — our AI does the rest.
            <span className="font-semibold text-foreground"> Completely free.</span>
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={ctaHref}
              className="button button--lg button--accent inline-flex items-center gap-2 no-underline text-base px-8 shadow-lg shadow-accent/25"
            >
              Get Started — It&apos;s Free
              <ArrowRight />
            </a>
            <a
              href="#features"
              className="button button--lg button--outlined inline-flex items-center gap-2 no-underline text-base px-8"
            >
              Learn More
            </a>
          </div>

          {/* Social proof line */}
          <p className="animate-fade-in-up delay-400 text-xs text-muted/60 mt-8">
            Powered by Zerodha Kite Connect &middot; Google Gemini AI &middot; alphaforge.one
          </p>
        </div>
      </section>

      {/* ━━━ Features Section ━━━ */}
      <section id="features" className="relative px-6 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="animate-fade-in-up text-sm font-semibold uppercase tracking-widest text-accent mb-3">Why AlphaForge?</p>
            <h2 className="animate-fade-in-up delay-100 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Everything you need to
              <br />
              <span className="text-gradient">backtest with confidence</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`animate-fade-in-up delay-${(i + 2) * 100} group relative rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-sm p-8 hover:border-accent/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-accent/5`}
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  {f.icon}
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ How It Works ━━━ */}
      <section className="relative px-6 py-20 sm:py-28 border-t border-border/30">
        {/* Subtle background gradient */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/[0.02] to-transparent" />
        </div>

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="animate-fade-in-up text-sm font-semibold uppercase tracking-widest text-accent mb-3">Simple Workflow</p>
            <h2 className="animate-fade-in-up delay-100 text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight">
              Three steps to
              <br />
              <span className="text-gradient">smarter backtesting</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((s, i) => (
              <div key={s.step} className={`animate-fade-in-up delay-${(i + 2) * 100} text-center md:text-left`}>
                <span className="text-5xl sm:text-6xl font-black text-accent/15 mb-2 block">{s.step}</span>
                <h3 className="text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-muted text-sm leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Highlights ━━━ */}
      <section className="relative px-6 py-20 sm:py-28 border-t border-border/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="animate-fade-in-up text-3xl sm:text-4xl font-bold tracking-tight">
              Built for <span className="text-gradient">serious traders</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {highlights.map((h, i) => (
              <div
                key={h}
                className={`animate-fade-in-up delay-${(i + 1) * 100} flex items-center gap-3 px-5 py-4 rounded-xl border border-border/40 bg-surface/30 hover:border-accent/20 transition-colors`}
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                  <CheckIcon />
                </span>
                <span className="text-sm font-medium">{h}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Final CTA ━━━ */}
      <section className="relative px-6 py-24 sm:py-32 overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-violet-500/5 to-cyan-500/10" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-gradient-to-b from-accent/10 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <h2 className="animate-fade-in-up text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to forge your
            <br />
            <span className="text-gradient">trading edge?</span>
          </h2>
          <p className="animate-fade-in-up delay-100 text-muted text-base sm:text-lg mb-10 max-w-xl mx-auto">
            Join AlphaForge today. No sign-up fees, no subscriptions — just powerful backtesting tools at your fingertips.
          </p>
          <div className="animate-fade-in-up delay-200">
            <a
              href={ctaHref}
              className="button button--lg button--accent inline-flex items-center gap-2 no-underline text-base px-10 shadow-lg shadow-accent/25"
            >
              Start Backtesting Now
              <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* ━━━ Footer ━━━ */}
      <footer className="border-t border-border/30 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <span className="font-semibold text-foreground">AlphaForge</span>
            <span className="text-muted/50">&middot;</span>
            <span>alphaforge.one</span>
          </div>
          <p>© {new Date().getFullYear()} AlphaForge. Free & open for all traders.</p>
        </div>
      </footer>
    </div>
  );
}
