import type { Metadata } from 'next';

import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { emailsConfigured, supabaseConfigured } from '@/lib/config';
import { requireAdmin } from '@/lib/guards';
import { getHubStats, getNewsFeed } from '@/lib/queries';
import { getStore, storageDriverName } from '@/lib/store';
import { config } from '@/lib/config';

export const metadata: Metadata = { title: 'Admin console', robots: { index: false } };
export const dynamic = 'force-dynamic';

/**
 * Admin console entry point.
 *
 * Guarded on the server: anonymous visitors go to /login, signed-in founders
 * are bounced to their own dashboard. Nothing below renders for a non-admin.
 */
export default async function AdminPage() {
  const user = await requireAdmin();
  const store = getStore();

  const [settings, pitches, results, posts, emails, users, stats] = await Promise.all([
    store.getSettings(),
    store.listPitchDetails({ limit: 1000 }),
    store.listResults(),
    getNewsFeed(100),
    store.listEmails(100),
    store.countUsers(),
    getHubStats(),
  ]);

  const byId = new Map(pitches.map((pitch) => [pitch.id, pitch]));

  const resultRows = results.map((result) => {
    const pitch = byId.get(result.pitch_id);
    return {
      ...result,
      pitch: pitch
        ? {
            id: pitch.id,
            code: pitch.code,
            title: pitch.title,
            category: pitch.category,
            status: pitch.status,
          }
        : null,
    };
  });

  const candidates = pitches.map((pitch) => ({
    id: pitch.id,
    code: pitch.code,
    title: pitch.title,
    category: pitch.category,
    status: pitch.status,
    result: pitch.result ? { rank: pitch.result.rank, score: pitch.result.score } : null,
  }));

  return (
    <div className="shell py-10 lg:py-14">
      <AdminDashboard
        user={{ full_name: user.full_name, email: user.email }}
        settings={settings}
        pitches={pitches}
        results={resultRows}
        candidates={candidates}
        posts={posts.map((post) => ({
          id: post.id,
          title: post.title,
          content: post.content,
          image_url: post.image_url,
          featured_pitch_id: post.featured_pitch_id,
          published_at: post.published_at,
          featured_pitch: post.featured_pitch
            ? { id: post.featured_pitch.id, code: post.featured_pitch.code, title: post.featured_pitch.title }
            : null,
        }))}
        health={{
          storage: storageDriverName(),
          database: supabaseConfigured ? 'supabase' : 'local',
          email: emailsConfigured ? 'resend' : 'log-only',
          adminCodeConfigured: Boolean(config.adminAccessCode),
        }}
        emailStatus={{
          emails,
          configured: emailsConfigured,
          from: config.email.from,
          adminInbox: config.adminEmails[0] ?? 'contacteihpitchaton@gmail.com',
        }}
        stats={{ ...stats, users, resultsEntered: results.length }}
        categories={stats.categories}
      />
    </div>
  );
}
