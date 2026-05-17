"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@heroui/react";
import ThemeSwitch from "./ThemeSwitch";
import FeedbackModal from "./FeedbackModal";
import { createClient } from "@/lib/supabase/browser";
import type { User } from "@supabase/supabase-js";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/strategy", label: "Strategies" },
  { href: "/dashboard/universe", label: "Stock Lists" },
  { href: "/how-to", label: "How to" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Check current auth state
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
      // Also clear the Kite session
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
    }
  };

  return (
    <nav className="sticky top-0 z-50 h-16 border-b border-border backdrop-blur-xl bg-surface/80">
      <div className="flex items-center justify-between h-full max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-6">
          <a
            href="/"
            className="flex items-center gap-2.5 font-bold text-foreground no-underline tracking-tight"
          >
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
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  className={`
                    px-3 py-1.5 rounded-lg text-sm font-medium transition-colors no-underline
                    ${
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-muted hover:text-foreground hover:bg-muted/10"
                    }
                  `}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>

        {/* Desktop Right Side */}
        <div className="hidden sm:flex items-center gap-2">
          <FeedbackModal />
          <ThemeSwitch />
          {!loading &&
            (user ? (
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline text-xs text-muted truncate max-w-[140px]">
                  {user.email}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  isPending={loggingOut}
                  onPress={handleLogout}
                >
                  {loggingOut ? "Logging out…" : "Logout"}
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onPress={() => router.push("/login")}
              >
                Login
              </Button>
            ))}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="sm:hidden flex items-center gap-2">
          <ThemeSwitch />
          <Button
            isIconOnly
            variant="ghost"
            className="border-0"
            onPress={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="18" x2="20" y2="18" />
              </svg>
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMobileMenuOpen && (
        <div className="sm:hidden absolute top-16 left-0 w-full bg-surface/95 backdrop-blur-xl border-b border-border shadow-lg p-4 flex flex-col gap-4 z-50">
          <div className="flex flex-col gap-2">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(link.href);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`
                    px-4 py-2.5 rounded-lg text-sm font-medium transition-colors no-underline
                    ${
                      isActive
                        ? "bg-accent/15 text-accent"
                        : "text-muted hover:text-foreground hover:bg-muted/10"
                    }
                  `}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="h-px bg-border w-full" />

          <div className="flex flex-col items-start gap-4 px-2">
            <FeedbackModal />
            {!loading &&
              (user ? (
                <div className="flex flex-col gap-3 w-full border-t border-border/50 pt-3">
                  <span className="text-xs text-muted truncate">
                    Logged in as {user.email}
                  </span>
                  <Button
                    variant="ghost"
                    className="justify-start w-full px-2"
                    isPending={loggingOut}
                    onPress={() => {
                      setIsMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    {loggingOut ? "Logging out…" : "Logout"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full mt-2"
                  onPress={() => {
                    setIsMobileMenuOpen(false);
                    router.push("/login");
                  }}
                >
                  Login
                </Button>
              ))}
          </div>
        </div>
      )}
    </nav>
  );
}
