import type { Metadata } from 'next';
import Link from 'next/link';
import { Megaphone, Sparkles } from 'lucide-react';

import { Badge, Card, EmptyState, SectionHeading } from '@/components/ui';
import { getNewsFeed } from '@/lib/queries';
import { formatDate, relativeTime } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Hub news',
  description:
    'Announcements and winner spotlights from the ICT Hub semester pitch competition.',
};
export const dynamic = 'force-dynamic';

export default async function NewsPage() {
  const posts = await getNewsFeed(50);
  const [lead, ...rest] = posts;

  return (
    <div className="shell py-10 lg:py-16">
      <header className="max-w-3xl">
        <p className="eyebrow">Hub news</p>
        <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl">Spotlights & announcements</h1>
        <p className="mt-4 text-pretty text-sm leading-relaxed text-mute-400 sm:text-base">
          Deadlines, judging updates, winner spotlights and everything the Hub wants founders to know —
          written by the team, published the moment it matters.
        </p>
      </header>

      {posts.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<Megaphone className="h-5 w-5" aria-hidden />}
            title="No posts yet"
            description="The Hub has not published anything this semester. Check the leaderboard for results, or sign up to submit your pitch in the meantime."
          />
        </div>
      ) : (
        <>
          {/* Lead story */}
          <article className="mt-10 grid gap-6 lg:grid-cols-2 lg:items-center">
            <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-charcoal-900">
              {lead.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL
                <img src={lead.image_url} alt="" className="h-72 w-full object-cover lg:h-96" />
              ) : (
                <div className="grid-backdrop grid h-72 place-items-center bg-charcoal-950 lg:h-96">
                  <Sparkles className="h-8 w-8 text-lime/40" aria-hidden />
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Badge tone="lime">Latest</Badge>
                <span className="text-xs text-mute-500">
                  {formatDate(lead.published_at)} · {relativeTime(lead.published_at)}
                </span>
              </div>
              <h2 className="mt-4 text-2xl leading-tight sm:text-3xl">
                <Link href={`/news/${lead.id}`} className="transition hover:text-lime">
                  {lead.title}
                </Link>
              </h2>
              <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-mute-300 sm:text-[15px]">
                {lead.content}
              </p>
              {lead.featured_pitch && (
                <p className="mt-4 text-sm text-lime">
                  Spotlighting {lead.featured_pitch.title} ({lead.featured_pitch.code})
                </p>
              )}
              <Link
                href={`/news/${lead.id}`}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-lime hover:underline"
              >
                Read the full post →
              </Link>
            </div>
          </article>

          {rest.length > 0 && (
            <section className="mt-16">
              <SectionHeading eyebrow="Archive" title="Earlier posts" />
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((post) => (
                  <Card key={post.id} as="article" interactive className="flex flex-col overflow-hidden">
                    {post.image_url && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL
                      <img src={post.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />
                    )}
                    <div className="flex flex-1 flex-col p-5">
                      <p className="text-2xs uppercase tracking-[0.16em] text-mute-500">
                        {formatDate(post.published_at)}
                      </p>
                      <h3 className="mt-2 text-base leading-snug">
                        <Link href={`/news/${post.id}`} className="transition hover:text-lime">
                          {post.title}
                        </Link>
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-mute-400">{post.content}</p>
                      {post.featured_pitch && (
                        <p className="mt-auto pt-4 text-xs text-lime">Featuring {post.featured_pitch.title}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
