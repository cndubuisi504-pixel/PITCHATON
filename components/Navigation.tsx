'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, Menu, ShieldCheck, Trophy, X, Zap } from 'lucide-react';

import { useAuth } from '@/components/AuthProvider';
import { Button, LinkButton } from '@/components/ui';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/news', label: 'Hub news' },
  { href: '/#how-it-works', label: 'How it works' },
];

/**
 * Top navigation.
 *
 * Brand mark is a typographic lockup (no logo asset — the Hub can drop one in
 * later without touching layout). Admin entry point only renders for accounts
 * the server has already verified as admins.
 */
export function Navigation({ hubName }: { hubName: string }) {
  const pathname = usePathname();
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href.split('#')[0]) && href.split('#')[0] !== '/';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled ? 'border-white/[0.07] bg-charcoal-950/85 backdrop-blur-xl' : 'border-transparent bg-transparent',
      )}
    >
      <div className="shell flex h-16 items-center justify-between gap-4 lg:h-18">
        <Link href="/" className="group flex items-center gap-2.5" aria-label={`${hubName} PITCHATON home`}>
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-lime text-charcoal-950 shadow-[0_8px_24px_-12px_rgba(211,255,1,0.8)]">
            <Zap className="h-5 w-5" strokeWidth={2.5} aria-hidden />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-extrabold tracking-[0.14em] text-white transition group-hover:text-lime">
              PITCHATON
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-mute-500">
              {hubName} · Semester pitch
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition',
                isActive(link.href) ? 'text-lime' : 'text-mute-300 hover:bg-white/[0.05] hover:text-white',
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              {isAdmin && (
                <LinkButton
                  href="/admin"
                  variant="outline"
                  size="sm"
                  icon={<ShieldCheck className="h-4 w-4" aria-hidden />}
                >
                  Admin
                </LinkButton>
              )}
              <LinkButton
                href="/dashboard"
                variant="secondary"
                size="sm"
                icon={<LayoutDashboard className="h-4 w-4" aria-hidden />}
              >
                Dashboard
              </LinkButton>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void logout()}
                icon={<LogOut className="h-4 w-4" aria-hidden />}
                aria-label="Log out"
              >
                <span className="hidden xl:inline">Log out</span>
              </Button>
            </>
          ) : (
            <>
              <LinkButton href="/login" variant="ghost" size="sm">
                Log in
              </LinkButton>
              <LinkButton href="/signup" size="sm" icon={<Zap className="h-4 w-4" aria-hidden />}>
                Submit a pitch
              </LinkButton>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/10 text-white transition hover:bg-white/[0.06] lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
        </button>
      </div>

      {open && (
        <div id="mobile-nav" className="border-t border-white/[0.07] bg-charcoal-950/[0.97] backdrop-blur-xl lg:hidden">
          <div className="shell space-y-1 py-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'block rounded-lg px-3 py-2.5 text-sm font-medium transition',
                  isActive(link.href) ? 'bg-lime/10 text-lime' : 'text-mute-200 hover:bg-white/[0.05]',
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="hairline mt-3 space-y-2 pt-4">
              {user ? (
                <>
                  <p className="px-3 text-xs text-mute-500">
                    Signed in as <span className="text-mute-200">{user.email}</span>
                  </p>
                  <Link
                    href="/dashboard"
                    className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-mute-200 hover:bg-white/[0.05]"
                  >
                    <LayoutDashboard className="h-4 w-4" aria-hidden /> Founder dashboard
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-lime hover:bg-lime/10"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden /> Admin dashboard
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-mute-200 hover:bg-white/[0.05]"
                  >
                    <LogOut className="h-4 w-4" aria-hidden /> Log out
                  </button>
                </>
              ) : (
                <>
                  <LinkButton href="/signup" fullWidth icon={<Zap className="h-4 w-4" aria-hidden />}>
                    Submit a pitch
                  </LinkButton>
                  <LinkButton href="/login" variant="secondary" fullWidth>
                    Log in
                  </LinkButton>
                </>
              )}
              <Link
                href="/leaderboard"
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-mute-200 hover:bg-white/[0.05]"
              >
                <Trophy className="h-4 w-4" aria-hidden /> Leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
