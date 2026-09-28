import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, Clock } from 'lucide-react';
import Link from 'next/link';

import { Countdown } from '@/components/site/Countdown';
import { PitchForm } from '@/components/pitch/PitchForm';
import { Alert } from '@/components/ui';
import { requireUser } from '@/lib/guards';
import { getHubStats } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { formatDateTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Submit a pitch' };
export const dynamic = 'force-dynamic';

export default async function SubmitPitchPage() {
  const user = await requireUser('/submit-pitch');
  const store = getStore();
  const [settings, stats] = await Promise.all([store.getSettings(), getHubStats()]);

  const deadlinePassed = Boolean(
    settings.submission_deadline && new Date(settings.submission_deadline).getTime() < Date.now(),
  );
  const open = settings.submission_enabled && !deadlinePassed;

  // Closed intake: admins can still draft, founders are bounced with context.
  if (!open && user.role !== 'admin') {
    redirect('/dashboard');
  }

  return (
    <div className="shell py-10 lg:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-mute-400 transition hover:text-lime">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <header className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <p className="eyebrow">New submission</p>
          <h1 className="mt-3 text-3xl sm:text-4xl">Pitch it properly</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute-400">
            Reviewers read every word. Lead with the problem and the person feeling it, then show how
            your product fixes it. Attach anything that helps them see it — a deck, screenshots, a
            two-page memo.
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-mute-500">
            <Clock className="h-3.5 w-3.5" aria-hidden /> Window closes
          </div>
          <p className="mt-1.5 text-sm text-white">{formatDateTime(settings.submission_deadline)}</p>
          {settings.submission_deadline && !deadlinePassed && (
            <Countdown target={settings.submission_deadline} className="mt-4" />
          )}
          <div className="hairline mt-5 flex items-center gap-2 pt-4 text-xs text-mute-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {stats.totalPitches} pitch{stats.totalPitches === 1 ? '' : 'es'} already in this semester
          </div>
        </div>
      </header>

      <div className="mt-8 max-w-4xl">
        {!open && (
          <div className="mb-6">
            <Alert tone="warning" title="Submissions are closed — admin preview">
              Real founders cannot reach this form right now. You are seeing it because you are an
              administrator.
            </Alert>
          </div>
        )}
        <PitchForm mode="create" user={user} categories={stats.categories} editingAllowed />
      </div>
    </div>
  );
}
