import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Trophy } from 'lucide-react';

import { Badge, LinkButton } from '@/components/ui';
import { getNewsFeed } from '@/lib/queries';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

async function loadPost(id: string) {
  const posts = await getNewsFeed(100);
  return posts.find((post) => post.id === id) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) return { title: 'Post not found' };
  return {
    title: post.title,
    description: post.content.slice(0, 160),
    openGraph: {
      title: post.title,
      description: post.content.slice(0, 160),
      images: post.image_url ? [post.image_url] : undefined,
      type: 'article',
    },
  };
}

export default async function NewsPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, all] = await Promise.all([loadPost(id), getNewsFeed(50)]);
  if (!post) notFound();

  const related = all.filter((item) => item.id !== post.id).slice(0, 3);

  return (
    <article className="shell py-10 lg:py-16">
      <Link href="/news" className="inline-flex items-center gap-2 text-sm text-mute-400 transition hover:text-lime">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All hub news
      </Link>

      <header className="mt-8 max-w-3xl">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="lime">Hub update</Badge>
          <span className="text-xs text-mute-500">{formatDateTime(post.published_at)}</span>
        </div>
        <h1 className="mt-5 text-3xl leading-tight sm:text-4xl lg:text-[2.75rem]">{post.title}</h1>
      </header>

      {post.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL
        <img
          src={post.image_url}
          alt=""
          className="mt-8 max-h-[28rem] w-full rounded-2xl border border-white/[0.07] object-cover"
        />
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="max-w-prose space-y-5 whitespace-pre-wrap text-[15px] leading-relaxed text-mute-200">
          {post.content}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          {post.featured_pitch && (
            <div className="card border-lime/25 bg-lime/[0.05] p-5">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-lime">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> Featured pitch
              </p>
              <p className="mt-3 text-sm font-semibold text-white">{post.featured_pitch.title}</p>
              <p className="mt-1 font-mono text-xs text-mute-400">
                {post.featured_pitch.code}
                {post.featured_pitch.category ? ` · ${post.featured_pitch.category}` : ''}
              </p>
              <LinkButton href="/leaderboard" variant="outline" size="sm" className="mt-4 w-full">
                See the leaderboard
              </LinkButton>
            </div>
          )}

          {related.length > 0 && (
            <div className="card p-5">
              <p className="eyebrow">More from the Hub</p>
              <ul className="mt-4 space-y-3.5">
                {related.map((item) => (
                  <li key={item.id}>
                    <Link href={`/news/${item.id}`} className="text-sm font-medium text-mute-200 transition hover:text-lime">
                      {item.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </article>
  );
}
