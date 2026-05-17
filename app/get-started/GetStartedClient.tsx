"use client";

import ThemeSwitch from "@/app/components/ThemeSwitch";

/* ─── Icons ─── */
const LogoIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const ArrowRight = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/* ─── Card data ─── */
const cards = [
  {
    href: "/dashboard",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    title: "Backtest Dashboard",
    description:
      "Run backtests with your strategies against 20+ years of historical NSE data. View equity curves, trade logs, win rates, and risk metrics.",
    gradient: "from-amber-500 to-orange-600",
    tag: "Core",
  },
  {
    href: "/dashboard/strategy/new",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z" />
        <circle cx="12" cy="15" r="2" />
      </svg>
    ),
    title: "Create Strategy",
    description:
      "Describe a trading strategy in plain English. Our Gemini AI will ask the right questions and generate executable backtesting code for you.",
    gradient: "from-violet-500 to-purple-600",
    tag: "AI-Powered",
  },
  {
    href: "/dashboard/universe",
    icon: (
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
    title: "Create Stock List",
    description:
      "Build custom watchlists from NSE indices — Nifty 50, Nifty 500, sectoral indices, or hand-pick individual stocks for targeted backtesting.",
    gradient: "from-cyan-500 to-blue-600",
    tag: "NSE Coverage",
  },
];

export default function GetStartedPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* ━━━ Navbar ━━━ */}
      <nav className="sticky top-0 z-50 h-16 border-b border-border/50 backdrop-blur-xl bg-background/70">
        <div className="flex items-center justify-between h-full max-w-6xl mx-auto px-6">
          <a
            href="/"
            className="flex items-center gap-2.5 font-bold text-foreground no-underline tracking-tight text-lg"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white">
              <LogoIcon />
            </div>
            AlphaForge
          </a>
          <ThemeSwitch />
        </div>
      </nav>

      {/* ━━━ Cards ━━━ */}
      <section className="relative px-6 py-12 flex-1">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {cards.map((card, i) => (
            <a
              key={card.title}
              href={card.href}
              className={`animate-fade-in-up delay-${(i + 3) * 100} group relative flex flex-col rounded-2xl border border-border/50 bg-surface/50 backdrop-blur-sm p-7 no-underline text-foreground hover:border-accent/30 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-accent/10`}
            >
              {/* Tag */}
              <span className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-widest bg-accent/8 text-accent border border-accent/15">
                {card.tag}
              </span>

              {/* Icon */}
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${card.gradient} flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform duration-300 shadow-lg`}
              >
                {card.icon}
              </div>

              {/* Content */}
              <h2 className="text-lg font-bold mb-2">{card.title}</h2>
              <p className="text-sm text-muted leading-relaxed flex-1">
                {card.description}
              </p>

              {/* Arrow */}
              <div className="flex items-center gap-1.5 mt-5 text-sm font-medium text-accent opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-1 transition-all duration-300">
                Open
                <ArrowRight />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ━━━ Footer ━━━ */}
      <footer className="border-t border-border/20 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-center text-xs text-muted/50">
          alphaforge.one &middot; Free & open for all traders
        </div>
      </footer>
    </div>
  );
}
