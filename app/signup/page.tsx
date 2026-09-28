import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';

import { AuthForm } from '@/components/auth/AuthForm';
import { Alert } from '@/components/ui';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Create your account' };
export const dynamic = 'force-dynamic';

const CHECKLIST = [
  'Name your pitch and the problem it solves',
  'Add every founder with contacts',
  'Attach your deck, wireframes or docs',
  'Track review status in real time',
];

export default async function SignupPage() {
  const [user, settings] = await Promise.all([getCurrentUser(), getStore().getSettings()]);
  if (user) redirect(user.role === 'admin' ? '/admin' : '/dashboard');

  const deadlinePassed = Boolean(
    settings.submission_deadline && new Date(settings.submission_deadline).getTime() < Date.now(),
  );
  const open = settings.submission_enabled && !deadlinePassed;

  return (
    <div className="shell grid gap-12 py-12 lg:grid-cols-2 lg:items-start lg:py-20">
      <div className="mx-auto w-full max-w-md animate-in">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-mute-400 transition hover:text-lime">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to home
        </Link>

        <h1 className="mt-8 text-3xl sm:text-4xl">Create your account</h1>
        <p className="mt-3 text-sm leading-relaxed text-mute-400">
          You can create the account now and submit your pitch right after — nothing here is
          destructive, and submissions stay editable while the window is open.
        </p>

        {!open && (
          <div className="mt-6">
            <Alert tone="warning" title="Submission intake is paused">
              You can still create an account. The Hub will reopen submissions for the next window and
              announce it in the news feed.
            </Alert>
          </div>
        )}

        <div className="mt-8">
          <AuthForm mode="signup" />
        </div>
      </div>

      <aside className="lg:sticky lg:top-24">
        <div className="card p-7">
          <p className="eyebrow">What you&apos;ll need</p>
          <h2 className="mt-3 text-xl">Ten minutes, one solid idea</h2>
          <ul className="mt-6 space-y-3.5 text-sm text-mute-300">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex gap-3">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lime" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="hairline mt-7 pt-6">
            <p className="text-xs leading-relaxed text-mute-500">
              Accounts are per founder, not per team — but each pitch can list up to 12 team members,
              so one teammate can own the submission for everyone. Team members listed on a pitch also
              receive status updates by email.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="text-xs leading-relaxed text-mute-400">
            <span className="font-semibold text-white">Hub staff?</span> Tick “I&apos;m an
            administrator” on the form and enter the access code. The official Hub address is
            recognised automatically.
          </p>
        </div>
      </aside>
    </div>
  );
}
