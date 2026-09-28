import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Trophy, Users } from 'lucide-react';

import { AuthForm } from '@/components/auth/AuthForm';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Log in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const [user, settings, params] = await Promise.all([
    getCurrentUser(),
    getStore().getSettings(),
    searchParams,
  ]);

  if (user) redirect(user.role === 'admin' ? '/admin' : '/dashboard');

  const nextPath = typeof params.next === 'string' && params.next.startsWith('/') ? params.next : undefined;

  return (
    <div className="shell grid gap-12 py-12 lg:grid-cols-2 lg:items-center lg:py-20">
      <div className="mx-auto w-full max-w-md animate-in">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-mute-400 transition hover:text-lime"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Link>

        <h1 className="mt-8 text-3xl sm:text-4xl">Welcome back</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute-400">
          One login for founders and Hub staff. Your role is verified on the server — admins land in
          the dashboard, founders land in theirs.
        </p>

        <div className="mt-8">
          <AuthForm mode="login" nextPath={nextPath} />
        </div>
      </div>

      <aside className="hidden lg:block">
        <div className="card relative overflow-hidden p-8">
          <div className="grid-backdrop absolute inset-0 opacity-25" aria-hidden />
          <div className="relative">
            <p className="eyebrow">Why founders log in</p>
            <h2 className="mt-3 text-xl">Everything about your pitch, in one place</h2>
            <ul className="mt-6 space-y-5 text-sm text-mute-300">
              <li className="flex gap-3">
                <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
                <span>Track your status as reviewers move you through the pipeline.</span>
              </li>
              <li className="flex gap-3">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
                <span>Keep your team roster and attachments up to date in seconds.</span>
              </li>
            </ul>
            <p className="mt-8 text-xs leading-relaxed text-mute-500">
              Hub staff at {settings.institution_name} use the same form with their admin access code.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
