import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  FileText,
  Gavel,
  Megaphone,
  Sparkles,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';

import { Countdown } from '@/components/site/Countdown';
import { Badge, LinkButton, SectionHeading, StatTile } from '@/components/ui';
import { getHubStats, getLeaderboard, getNewsFeed } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { formatDate, formatDateTime, medalFor } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STEPS = [
  {
    icon: FileText,
    title: 'Submit the pitch',
    body: 'One form: title, what you are building, the problem it solves, your team, and any deck or document you want reviewers to read.',
  },
  {
    icon: Gavel,
    title: 'Reviewers triage',
    body: 'The Hub team reads every submission and moves it along the pipeline — under review, accepted, finalist. You are emailed at every step.',
  },
  {
    icon: Megaphone,
    title: 'Pitch day',
    body: 'Finalists take the floor on the competition date. Judges score on problem, product, feasibility and the strength of the team.',
  },
  {
    icon: Trophy,
    title: 'Results go public',
    body: 'When the Hub publishes results, the leaderboard opens to the whole campus — ranks, scores and judge notes.',
  },
];

export default async function HomePage() {
  const store = getStore();
  const [settings, stats, news, leaderboard] = await Promise.all([
    store.getSettings(),
    getHubStats(),
    getNewsFeed(3),
    getLeaderboard(),
  ]);

  const deadlinePassed = Boolean(
    settings.submission_deadline && new Date(settings.submission_deadline).getTime() < Date.now(),
  );
  const openForSubmissions = settings.submission_enabled && !deadlinePassed;
  const podium = leaderboard.rows.slice(0, 3);

  return (
    <>
      {/* ---------------------------------------------------------------- Hero */}
      <section className="relative overflow-hidden">
        <div className="grid-backdrop absolute inset-0 opacity-[0.35]" aria-hidden />
        <div
          className="absolute -top-40 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-lime/[0.07] blur-[120px]"
          aria-hidden
        />

        <div className="shell relative grid gap-14 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:py-24">
          <div className="animate-in">
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="lime">
                <Sparkles className="h-3 w-3" aria-hidden /> {settings.hub_name} semester competition
              </Badge>
              {openForSubmissions ? (
                <Badge tone="info">Submissions open</Badge>
              ) : (
                <Badge tone="neutral">Submissions closed</Badge>
              )}
            </div>

            <h1 className="mt-6 text-[2.5rem] leading-[1.05] sm:text-5xl lg:text-[3.75rem]">
              Pitch the idea.
              <br />
              <span className="text-lime">Earn the floor.</span>
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-mute-300 sm:text-[17px]">
              PITCHATON is where {settings.hub_name} founders put their semester project in front of
              the people who can move it forward. Submit once, track every stage, and find out where
              you stand when the results drop.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              {openForSubmissions ? (
                <LinkButton href="/signup" size="lg" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                  Submit your pitch
                </LinkButton>
              ) : (
                <LinkButton href="/news" size="lg" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                  See what&apos;s next
                </LinkButton>
              )}
              <LinkButton
                href="/leaderboard"
                variant="secondary"
                size="lg"
                icon={<Trophy className="h-4 w-4" aria-hidden />}
              >
                {settings.results_published ? 'View leaderboard' : 'Leaderboard'}
              </LinkButton>
            </div>

            <dl className="mt-10 flex flex-wrap gap-x-8 gap-y-4 text-sm">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-lime" aria-hidden />
                <dt className="sr-only">Eligibility</dt>
                <dd className="text-mute-300">Open to every {settings.hub_name} student</dd>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-lime" aria-hidden />
                <dt className="sr-only">Team size</dt>
                <dd className="text-mute-300">Solo or team up to 12</dd>
              </div>
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-lime" aria-hidden />
                <dt className="sr-only">Attachments</dt>
                <dd className="text-mute-300">Decks & docs up to 50MB each</dd>
              </div>
            </dl>
          </div>

          {/* Deadline / timeline panel */}
          <aside className="animate-in card p-6 shadow-lifted sm:p-7">
            <p className="eyebrow">Key dates</p>
            <h2 className="mt-3 text-lg">
              {openForSubmissions ? 'Submission window is live' : 'This round is underway'}
            </h2>

            <div className="mt-6 space-y-5">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-mute-500">
                  <Upload className="h-3.5 w-3.5" aria-hidden /> Submissions close
                </div>
                <p className="mt-1.5 text-sm text-white">
                  {settings.submission_deadline ? formatDateTime(settings.submission_deadline) : 'Announced soon'}
                </p>
                {settings.submission_deadline && !deadlinePassed && (
                  <Countdown target={settings.submission_deadline} className="mt-3" />
                )}
              </div>

              <div className="hairline pt-5">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-mute-500">
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Competition day
                </div>
                <p className="mt-1.5 text-sm text-white">
                  {settings.competition_date ? formatDateTime(settings.competition_date) : 'Announced soon'}
                </p>
              </div>
            </div>

            <p className="hairline mt-6 pt-5 text-xs leading-relaxed text-mute-500">
              {settings.submission_enabled
                ? 'Founders can submit and edit while the window is open. You will get an email the moment your status changes.'
                : 'Submission intake is paused. The Hub posts the next window in the news feed.'}
            </p>
          </aside>
        </div>
      </section>

      {/* --------------------------------------------------------------- Stats */}
      <section className="shell">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Pitches this semester"
            value={stats.totalPitches}
            hint={stats.submissionsThisMonth ? `${stats.submissionsThisMonth} this month` : 'Waiting for the first one'}
            icon={<FileText className="h-4 w-4" aria-hidden />}
          />
          <StatTile label="Founders on board" value={stats.teams} hint="Across all submissions" icon={<Users className="h-4 w-4" aria-hidden />} />
          <StatTile label="Categories" value={stats.categories.length || '—'} hint="Named by the teams themselves" icon={<Sparkles className="h-4 w-4" aria-hidden />} />
          <StatTile
            label="Results"
            value={settings.results_published ? 'Published' : 'Pending'}
            hint={settings.results_published ? 'Leaderboard is live' : 'Judging in progress'}
            tone={settings.results_published ? 'lime' : 'default'}
            icon={<Trophy className="h-4 w-4" aria-hidden />}
          />
        </div>
      </section>

      {/* ---------------------------------------------------------- How it works */}
      <section id="how-it-works" className="shell section scroll-mt-24">
        <SectionHeading
          eyebrow="How it works"
          title="Four stages, zero guesswork"
          description="Everyone can see exactly where a pitch stands. Founders get an email at every transition; the Hub gets a single dashboard to run the whole semester."
        />

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card-interactive group relative p-5">
              <span className="absolute right-4 top-4 font-mono text-xs text-mute-600">0{index + 1}</span>
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-lime/25 bg-lime/10 text-lime">
                <step.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mute-400">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* --------------------------------------------------------- Leaderboard teaser */}
      <section className="shell">
        <div className="card overflow-hidden">
          <div className="flex flex-col gap-4 border-b border-white/[0.07] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div>
              <p className="eyebrow">Leaderboard</p>
              <h2 className="mt-2 text-xl">
                {settings.results_published ? 'This semester&apos;s front-runners' : 'Results drop after pitch day'}
              </h2>
            </div>
            <LinkButton href="/leaderboard" variant={settings.results_published ? 'primary' : 'secondary'} size="sm">
              {settings.results_published ? 'Full ranking' : 'What gets published'}
            </LinkButton>
          </div>

          {settings.results_published && podium.length ? (
            <ul className="divide-y divide-white/[0.07]">
              {podium.map((row) => {
                const medal = medalFor(row.rank);
                return (
                  <li key={row.pitch.id} className="flex items-center gap-4 p-5 sm:px-7">
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-mono text-sm font-semibold ${
                        medal === 'gold'
                          ? 'border-lime/40 bg-lime/15 text-lime'
                          : medal === 'silver'
                            ? 'border-white/20 bg-white/[0.08] text-white'
                            : 'border-status-review/30 bg-status-review/10 text-status-review'
                      }`}
                    >
                      #{row.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{row.pitch.title}</p>
                      <p className="mt-0.5 truncate text-xs text-mute-500">
                        {row.pitch.category ?? 'Uncategorised'} · {row.team.join(', ') || 'Team hidden'}
                      </p>
                    </div>
                    {row.score !== null && (
                      <span className="font-mono text-sm tabular-nums text-mute-200">{row.score}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="p-6 sm:p-7">
              <p className="max-w-2xl text-sm leading-relaxed text-mute-400">
                The board stays locked until the Hub publishes the official results — no half-finished
                rankings, no speculation. Once it opens you will see rank, score, judge notes and the
                full team behind each pitch.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- News */}
      {news.length > 0 && (
        <section className="shell section">
          <SectionHeading
            eyebrow="Hub news"
            title="Spotlights & announcements"
            description="Winners, milestones and everything the Hub wants founders to know."
            action={
              <LinkButton href="/news" variant="ghost" size="sm" icon={<ArrowRight className="h-4 w-4" aria-hidden />}>
                All posts
              </LinkButton>
            }
          />

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {news.map((post) => (
              <article key={post.id} className="card-interactive flex flex-col overflow-hidden">
                {post.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URLs
                  <img
                    src={post.image_url}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                )}
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-2xs uppercase tracking-[0.16em] text-mute-500">{formatDate(post.published_at)}</p>
                  <h3 className="mt-2 text-base leading-snug">
                    <Link href={`/news/${post.id}`} className="transition hover:text-lime">
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mute-400">{post.content}</p>
                  {post.featured_pitch && (
                    <p className="mt-4 text-xs text-lime">Featuring {post.featured_pitch.title}</p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------ Final CTA */}
      <section className="shell pb-4">
        <div className="relative overflow-hidden rounded-2xl border border-lime/20 bg-gradient-to-br from-lime/[0.12] via-charcoal-900 to-charcoal-900 p-8 sm:p-12">
          <div className="grid-backdrop absolute inset-0 opacity-20" aria-hidden />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl sm:text-3xl">
                {openForSubmissions ? 'Your idea deserves a room full of judges' : 'Get ready for the next round'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-mute-300 sm:text-[15px]">
                Submitting takes about ten minutes. Bring the problem, the product and the team —
                the Hub handles the rest.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <LinkButton href={openForSubmissions ? '/signup' : '/news'} size="lg">
                {openForSubmissions ? 'Start your submission' : 'Read the latest'}
              </LinkButton>
              <LinkButton href="/login" variant="secondary" size="lg">
                Founder log in
              </LinkButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
