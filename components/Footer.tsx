import Link from 'next/link';
import { Zap } from 'lucide-react';

export function Footer({
  hubName,
  institution,
}: {
  hubName: string;
  institution: string;
}) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 border-t border-white/[0.07] bg-charcoal-950">
      <div className="shell grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4 lg:py-16">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-charcoal-950">
              <Zap className="h-4 w-4" strokeWidth={2.5} aria-hidden />
            </span>
            <span className="text-sm font-extrabold tracking-[0.14em] text-white">PITCHATON</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-mute-400">
            The {hubName} semester pitch competition: founders submit, reviewers decide, the whole
            campus watches the leaderboard.
          </p>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute-500">Platform</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              { href: '/leaderboard', label: 'Leaderboard' },
              { href: '/news', label: 'Hub news' },
              { href: '/signup', label: 'Submit a pitch' },
              { href: '/login', label: 'Log in' },
            ].map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-mute-400 transition hover:text-lime">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-mute-500">The Hub</p>
          <ul className="mt-4 space-y-2.5 text-sm text-mute-400">
            <li>{institution}</li>
            <li>
              <a href="mailto:contacteihpitchaton@gmail.com" className="transition hover:text-lime">
                contacteihpitchaton@gmail.com
              </a>
            </li>
            <li className="text-mute-500">Submissions close on the posted deadline.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.07]">
        <div className="shell flex flex-col items-center justify-between gap-3 py-6 text-xs text-mute-500 sm:flex-row">
          <p>© {year} {hubName}. Built for the semester pitch competition.</p>
          <p className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
            Dark by design · Neon lime by instinct
          </p>
        </div>
      </div>
    </footer>
  );
}
