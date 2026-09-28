import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { apiAdmin } from '@/lib/guards';
import { sendSpotlightEmail } from '@/lib/email';
import { getNewsFeed } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { ValidationError, optionalString, requiredString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_RE = /^https?:\/\/\S+$/i;

/** GET /api/admin/news — posts plus the pitch list used to pick a spotlight. */
export async function GET() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const store = getStore();
  const [posts, pitches] = await Promise.all([getNewsFeed(100), store.listPitchDetails({})]);

  return jsonOk({
    posts,
    pitches: pitches.map((pitch) => ({
      id: pitch.id,
      code: pitch.code,
      title: pitch.title,
      status: pitch.status,
      category: pitch.category,
    })),
  });
}

/** POST /api/admin/news — publish an announcement or spotlight. */
export async function POST(request: NextRequest) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const body = await readJson(request);

  try {
    const title = requiredString(body.title, 'title', { min: 3, max: 160, label: 'Headline' });
    const content = requiredString(body.content, 'content', {
      min: 20,
      max: 8000,
      label: 'Story',
    });
    const imageUrl = optionalString(body.image_url, 'image_url', { max: 500, label: 'Image URL' });
    if (imageUrl && !IMAGE_RE.test(imageUrl)) {
      throw new ValidationError('image_url', 'Image URL must start with http:// or https://');
    }

    const featuredPitchId = optionalString(body.featured_pitch_id, 'featured_pitch_id', {
      max: 64,
      label: 'Featured pitch',
    });
    const notifyTeam = body.notify_team === true;

    const store = getStore();
    let featured = null as Awaited<ReturnType<typeof store.getPitchDetail>>;
    if (featuredPitchId) {
      featured = await store.getPitchDetail(featuredPitchId);
      if (!featured) return jsonError('That pitch no longer exists.', 404, 'featured_pitch_id');
    }

    const post = await store.createNews({
      title,
      content,
      image_url: imageUrl,
      featured_pitch_id: featured?.id ?? null,
      created_by: guard.user.id,
    });

    let notified = 0;
    if (notifyTeam && featured) {
      const recipients = new Map<string, string>();
      if (featured.owner) recipients.set(featured.owner.email, featured.owner.full_name);
      for (const founder of featured.founders) {
        if (!recipients.has(founder.email)) recipients.set(founder.email, founder.name);
      }
      const results = await Promise.allSettled(
        Array.from(recipients.entries()).map(([email, name]) =>
          sendSpotlightEmail({ to: email, founderName: name, pitchTitle: featured.title, newsTitle: title }),
        ),
      );
      notified = results.filter((r) => r.status === 'fulfilled' && r.value.delivered).length;
    }

    return jsonOk({ post, notified }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 422, error.field);
    console.error('[pitchaton:news]', error);
    return jsonError('Could not publish that post.', 500);
  }
}
