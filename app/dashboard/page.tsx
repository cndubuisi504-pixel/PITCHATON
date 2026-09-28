import type { Metadata } from 'next';
import { CalendarClock, Plus, Sparkles, Trophy, Upload } from 'lucide-react';

import { FounderPitches } from '@/components/pitch/FounderPitches';
import { Alert, Badge, LinkButton, StatTile } from '@/components/ui';
import { requireUser } from '@/lib/guards';
import { getNewsFeed } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { formatDateTime, isPitchEditable, relativeTime } from '@/lib/utils';

export const metadata: Metadata = { title: 'Founder dashboard' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser('/dashboard');
  const store = getStore();
  const [settings, pitches, news, params] = await Promise.all([
    store.getSettings(),
    store.listPitchDetails({ created_by: user.id }),
    getNewsFeed(3),
    searchParams,
  ]);

  const deadlinePassed = Boolean(
    settings.submission_deadline && new Date(settings.submission_deadline).getTime() < Date.now(),
  );
  const open = settings.submission_enabled && !deadlinePassed;
  const firstName = user.full_name.split(' ')[0] || 'founder';
  const winners = pitches.filter((pitch) => pitch.status === 'winner').length;
  const finalists = pitches.filter((pitch) => pitch.status === 'finalist').length;
  const inReview = pitches.filter((pitch) => ['submitted', 'under_review'].includes(pitch.status)).length;

  return (
    <div className="shell py-10 lg:py-14">
      {params.denied === 'admin' && (
        <div className="mb-6">
          <Alert tone="warning" title="Admin area is restricted">
            That dashboard belongs to Hub staff. Your account ({user.email}) has founder access — if you
            should be an administrator, ask the Hub lead for the admin access code.
          </Alert>
        </div>
      )}

      <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Founder dashboard</p>
          <h1 className="mt-3 text-3xl sm:text-4xl">Hello, {firstName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute-400">
            Everything you have submitted, the stage each pitch is at, and what the Hub needs from you
            next.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <LinkButton
            href="/submit-pitch"
            size="lg"
            icon={<Plus className="h-4 w-4" aria-hidden />}
            className={open ? '' : 'pointer-events-none opacity-60'}
          >
            New pitch
          </LinkButton>
        </div>
      </header>

      {!open && (
        <div className="mt-6">
          <Alert tone="info" title="Submission window is closed">
            {settings.submission_enabled
              ? `The deadline was ${formatDateTime(settings.submission_deadline)}. Keep your dashboard handy — results and spotlights land here first.`
              : 'The Hub has paused intake for now. Watch the news feed for the next window.'}
          </Alert>
        </div>
      )}

      {open && settings.submission_deadline && (
        <div className="mt-6">
          <Alert tone="success" title="You can still submit or edit">
            Submissions close {formatDateTime(settings.submission_deadline)}. Edits stay open
            {settings.edit_mode_enabled ? ' right now' : ' only when the Hub reopens them'}.
          </Alert>
        </div>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Your pitches" value={pitches.length} hint="This semester" icon={<Upload className="h-4 w-4" aria-hidden />} />
        <StatTile label="In review" value={inReview} hint="Submitted or under review" icon={<CalendarClock className="h-4 w-4" aria-hidden />} />
        <StatTile label="Finalists" value={finalists} hint="Through to the final round" icon={<Trophy className="h-4 w-4" aria-hidden />} />
        <StatTile label="Wins" value={winners} hint={winners ? 'Congratulations' : 'Still to play for'} tone={winners ? 'lime' : 'default'} icon={<Sparkles className="h-4 w-4" aria-hidden />} />
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <section>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl">Your submissions</h2>
            {pitches.some((pitch) => isPitchEditable(pitch, settings)) && <Badge tone="lime">Edits open</Badge>}
          </div>
          <FounderPitches pitches={pitches} settings={settings} />
        </section>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="card p-5">
            <p className="eyebrow">Key dates</p>
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-mute-500">Submissions close</dt>
                <dd className="mt-1 text-white">{formatDateTime(settings.submission_deadline)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-mute-500">Competition day</dt>
                <dd className="mt-1 text-white">{formatDateTime(settings.competition_date)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-mute-500">Results</dt>
                <dd className="mt-1 text-white">
                  {settings.results_published ? 'Published on the leaderboard' : 'Not published yet'}
                </dd>
              </div>
            </dl>
            {settings.results_published && (
              <LinkButton href="/leaderboard" variant="outline" size="sm" className="mt-5 w-full">
                View leaderboard
              </LinkButton>
            )}
          </div>

          {news.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">Hub updates</p>
              <ul className="mt-4 space-y-4">
                {news.map((post) => (
                  <li key={post.id}>
                    <p className="text-xs text-mute-500">{relativeTime(post.published_at)}</p>
                    <a href={`/news/${post.id}`} className="mt-1 block text-sm font-medium text-white transition hover:text-lime">
                      {post.title}
                    </a>
                  </li>
                ))}
              </ul>
              <LinkButton href="/news" variant="ghost" size="sm" className="mt-4 w-full">
                All hub news
              </LinkButton>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
