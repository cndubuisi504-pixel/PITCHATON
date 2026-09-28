'use client';

import { useState } from 'react';
import { CalendarDays, ExternalLink, Image as ImageIcon, Send, Trash2 } from 'lucide-react';

import { Badge, Button, Card, EmptyState, Field, Input, Select, Textarea, useToast } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

interface AdminPost {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  featured_pitch_id: string | null;
  published_at: string;
  featured_pitch: { id: string; code: string; title: string } | null;
}

interface Candidate {
  id: string;
  code: string;
  title: string;
  status: string;
}

/**
 * Admin → News.
 * Publishes hub announcements and winner spotlights; spotlights can notify the
 * featured team by email in the same action.
 */
export function NewsTab({
  posts: initialPosts,
  pitches,
  onChanged,
}: {
  posts: AdminPost[];
  pitches: Candidate[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [posts, setPosts] = useState(initialPosts);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [featuredId, setFeaturedId] = useState('');
  const [notifyTeam, setNotifyTeam] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const response = await fetch('/api/admin/news');
    if (!response.ok) return;
    const data = (await response.json()) as { posts: AdminPost[] };
    setPosts(data.posts);
    onChanged();
  }

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          image_url: imageUrl.trim() || null,
          featured_pitch_id: featuredId || null,
          notify_team: notifyTeam && Boolean(featuredId),
        }),
      });
      const data = (await response.json()) as { notified?: number; error?: string };
      if (!response.ok) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not publish that post.' });
        return;
      }
      toast.push({
        tone: 'success',
        title: 'Published to the hub feed',
        message: data.notified ? `${data.notified} spotlight email(s) delivered.` : undefined,
      });
      setTitle('');
      setContent('');
      setImageUrl('');
      setFeaturedId('');
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(post: AdminPost) {
    if (!window.confirm(`Delete “${post.title}”? This removes it from the public news feed.`)) return;
    const response = await fetch(`/api/admin/news/${post.id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.push({ tone: 'error', message: 'Could not delete that post.' });
      return;
    }
    setPosts((rows) => rows.filter((row) => row.id !== post.id));
    toast.push({ tone: 'success', message: 'Post deleted.' });
    onChanged();
  }

  const featuredPreview = pitches.find((pitch) => pitch.id === featuredId);

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr] xl:items-start">
      <Card className="p-5">
        <h3 className="text-base font-semibold text-white">New post</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-mute-400">
          Announcements, deadlines, winner spotlights — everything here appears publicly in the news feed.
        </p>

        <form onSubmit={publish} className="mt-5 space-y-4">
          <Field label="Headline" htmlFor="news-title" required>
            <Input
              id="news-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="SolarCold wins the semester pitch final"
              maxLength={160}
              required
            />
          </Field>

          <Field label="Story" htmlFor="news-content" required hint="Plain text. Line breaks are preserved.">
            <Textarea
              id="news-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="What happened, who was involved, and what comes next…"
              className="min-h-[10rem]"
              maxLength={8000}
              required
            />
          </Field>

          <Field label="Featured image URL" htmlFor="news-image" hint="Optional. Any public https image link.">
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-500" aria-hidden />
              <Input
                id="news-image"
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="https://…/team-photo.jpg"
                className="pl-9"
              />
            </div>
          </Field>

          <Field label="Spotlight a pitch" htmlFor="news-featured" hint="Links the post to a submission.">
            <Select id="news-featured" value={featuredId} onChange={(event) => setFeaturedId(event.target.value)}>
              <option value="">Not linked to a pitch</option>
              {pitches.map((pitch) => (
                <option key={pitch.id} value={pitch.id}>
                  {pitch.code} · {pitch.title}
                </option>
              ))}
            </Select>
          </Field>

          {featuredPreview && (
            <label className="flex items-start gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-sm text-mute-300">
              <input
                type="checkbox"
                checked={notifyTeam}
                onChange={(event) => setNotifyTeam(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-charcoal-950 accent-lime"
              />
              <span>
                Email the {featuredPreview.title} team about this spotlight
                <span className="mt-0.5 block text-xs text-mute-500">
                  Sends to the submitting account plus every founder listed on the pitch.
                </span>
              </span>
            </label>
          )}

          <Button type="submit" loading={busy} fullWidth icon={<Send className="h-4 w-4" aria-hidden />}>
            Publish post
          </Button>
        </form>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">Published</h3>
          <Badge>{posts.length} post{posts.length === 1 ? '' : 's'}</Badge>
        </div>

        {posts.length === 0 ? (
          <EmptyState
            title="Nothing published yet"
            description="Your first post could be the submission deadline, a judging update, or a spotlight on a standout team."
          />
        ) : (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-xs text-mute-500">
                        <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                        {formatDateTime(post.published_at)}
                      </span>
                      {post.featured_pitch && <Badge tone="lime">Spotlight · {post.featured_pitch.code}</Badge>}
                    </div>
                    <h4 className="mt-2 text-sm font-semibold text-white">{post.title}</h4>
                    <p className="mt-1.5 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-mute-400">
                      {post.content}
                    </p>
                  </div>
                  {post.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL
                    <img src={post.image_url} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={`/news/${post.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-mute-300 transition hover:bg-white/[0.06] hover:text-lime"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden /> View public page
                  </a>
                  <button
                    type="button"
                    onClick={() => void remove(post)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-mute-400 transition hover:bg-status-rejected/10 hover:text-status-rejected"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
