import type { Metadata } from 'next';
import { Award, Lock, Medal, Trophy } from 'lucide-react';

import { Badge, Card, EmptyState, LinkButton, StatTile } from '@/components/ui';
import { getLeaderboard } from '@/lib/queries';
import { formatDateTime, medalFor } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Leaderboard',
  description:
    'Official results of the ICT Hub semester pitch competition — ranks, scores and judge notes.',
};
export const dynamic = 'force-dynamic';

const MEDAL_STYLES = {
  gold: {
    ring: 'border-lime/50 bg-gradient-to-br from-lime/[0.18] to-transparent',
    chip: 'border-lime/50 bg-lime/15 text-lime',
    icon: 'text-lime',
  },
  silver: {
    ring: 'border-white/25 bg-gradient-to-br from-white/[0.10] to-transparent',
    chip: 'border-white/25 bg-white/[0.08] text-white',
    icon: 'text-white',
  },
  bronze: {
    ring: 'border-status-review/40 bg-gradient-to-br from-status-review/[0.14] to-transparent',
    chip: 'border-status-review/40 bg-status-review/[0.12] text-status-review',
    icon: 'text-status-review',
  },
} as const;

export default async function LeaderboardPage() {
  const { settings, rows } = await getLeaderboard();
  const ranked = rows.filter((row) => row.rank <= 3);
  const rest = rows.filter((row) => row.rank > 3);

  return (
    <div className="shell py-10 lg:py-16">
      <header className="max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={settings.results_published ? 'lime' : 'neutral'}>
            {settings.results_published ? 'Official results' : 'Not yet published'}
          </Badge>
          {settings.competition_date && <Badge>Pitch day {formatDateTime(settings.competition_date)}</Badge>}
        </div>
        <h1 className="mt-5 text-3xl sm:text-4xl lg:text-5xl">Leaderboard</h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-mute-400 sm:text-base">
          {settings.results_published
            ? 'Final ranking from the judging panel. Scores are out of 100 unless the panel notes otherwise; judge comments are published verbatim.'
            : 'The Hub publishes results once judging closes — the board below opens automatically at that moment.'}
        </p>
      </header>

      {!settings.results_published ? (
        <div className="mt-10">
          <EmptyState
            icon={<Lock className="h-5 w-5" aria-hidden />}
            title="Results are under wraps"
            description="Nothing here is final yet. Bookmark this page — the ranking appears the moment the Hub publishes it, along with judge notes and the full team list."
            action={<LinkButton href="/news" variant="secondary">Follow hub news meanwhile</LinkButton>}
          />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Trophy className="h-5 w-5" aria-hidden />}
            title="No results recorded yet"
            description="Judging is still in progress. Results will appear here as soon as the panel submits them."
          />
        </div>
      ) : (
        <>
          <section className="mt-10">
            <div className="grid gap-4 sm:grid-cols-3">
              <StatTile label="Pitches ranked" value={rows.length} hint="This semester" icon={<Award className="h-4 w-4" aria-hidden />} />
              <StatTile
                label="Top score"
                value={rows.reduce((best, row) => (row.score !== null && row.score > best ? row.score : best), 0) || '—'}
                hint="Highest recorded score"
                tone="lime"
                icon={<Medal className="h-4 w-4" aria-hidden />}
              />
              <StatTile
                label="Winner"
                value={ranked.find((row) => row.rank === 1)?.pitch.title.slice(0, 22) ?? '—'}
                hint="Rank #1 this semester"
                tone="lime"
                icon={<Trophy className="h-4 w-4" aria-hidden />}
              />
            </div>
          </section>

          {/* Podium */}
          {ranked.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xl">Podium</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {ranked.map((row) => {
                  const medal = medalFor(row.rank) ?? 'bronze';
                  const style = MEDAL_STYLES[medal];
                  const isWinner = row.rank === 1;
                  return (
                    <Card
                      key={row.pitch.id}
                      className={`relative overflow-hidden p-6 ${style.ring} ${isWinner ? 'lg:-mt-2 lg:pb-8' : ''}`}
                    >
                      {isWinner && (
                        <span className="absolute right-4 top-4 rounded-full border border-lime/40 bg-lime/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-lime">
                          Champion
                        </span>
                      )}
                      <div className="flex items-center gap-3">
                        <span className={`grid h-12 w-12 place-items-center rounded-xl border font-mono text-lg font-bold ${style.chip}`}>
                          {row.rank}
                        </span>
                        <div>
                          <p className="text-2xs uppercase tracking-[0.16em] text-mute-500">
                            {row.rank === 1 ? 'First place' : row.rank === 2 ? 'Second place' : 'Third place'}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-mute-400">{row.pitch.code}</p>
                        </div>
                      </div>

                      <h3 className="mt-5 text-lg leading-snug text-white">{row.pitch.title}</h3>
                      {row.pitch.category && <p className="mt-1.5 text-xs text-lime">{row.pitch.category}</p>}

                      {row.team.length > 0 && (
                        <p className="mt-3 text-sm leading-relaxed text-mute-400">{row.team.join(' · ')}</p>
                      )}

                      <div className="mt-5 flex items-baseline gap-3">
                        {row.score !== null ? (
                          <>
                            <span className={`font-mono text-3xl font-semibold ${style.icon}`}>{row.score}</span>
                            <span className="text-xs uppercase tracking-wider text-mute-500">score</span>
                          </>
                        ) : (
                          <span className="text-sm text-mute-400">Score not published</span>
                        )}
                      </div>

                      {row.notes && (
                        <p className="mt-4 rounded-xl border border-white/[0.07] bg-charcoal-950/50 p-3.5 text-sm leading-relaxed text-mute-300">
                          “{row.notes}”
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Full table */}
          {rest.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl">Full ranking</h2>
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.07]">
                <table className="w-full border-collapse text-left text-sm">
                  <caption className="sr-only">Complete leaderboard with rank, pitch, team, score and judge notes</caption>
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-charcoal-900/70 text-[11px] uppercase tracking-[0.14em] text-mute-500">
                      <th scope="col" className="px-4 py-3 font-semibold">Rank</th>
                      <th scope="col" className="px-4 py-3 font-semibold">Pitch</th>
                      <th scope="col" className="hidden px-4 py-3 font-semibold sm:table-cell">Team</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {rest.map((row) => (
                      <tr key={row.pitch.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-4 py-3.5 font-mono text-sm text-mute-300">#{row.rank}</td>
                        <td className="px-4 py-3.5">
                          <p className="font-medium text-white">{row.pitch.title}</p>
                          <p className="mt-0.5 text-xs text-mute-500">
                            {row.pitch.code}
                            {row.pitch.category ? ` · ${row.pitch.category}` : ''}
                          </p>
                          {row.notes && <p className="mt-1.5 max-w-2xl text-xs italic text-mute-400">“{row.notes}”</p>}
                        </td>
                        <td className="hidden px-4 py-3.5 text-mute-400 sm:table-cell">
                          {row.team.join(', ') || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono tabular-nums text-mute-200">
                          {row.score ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <p className="mt-8 text-xs leading-relaxed text-mute-500">
            Published by the Hub. Spotted an error? Email{' '}
            <a href="mailto:contacteihpitchaton@gmail.com" className="text-lime hover:underline">
              contacteihpitchaton@gmail.com
            </a>{' '}
            and the panel will re-check the sheet.
          </p>
        </>
      )}
    </div>
  );
}
