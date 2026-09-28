import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, publicPitch, readJson } from '@/lib/api';
import { config } from '@/lib/config';
import { sendAdminNewSubmissionAlert, sendSubmissionConfirmation } from '@/lib/email';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { ValidationError, optionalString, parseFounders, requiredString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/pitches — founders see their own; admins see everything. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to view your pitches.', 401);

  const store = getStore();
  const pitches =
    user.role === 'admin'
      ? await store.listPitchDetails({})
      : await store.listPitchDetails({ created_by: user.id });

  // Founders must never receive another team's contact details.
  const payload =
    user.role === 'admin'
      ? pitches.map(publicPitch)
      : pitches.map((pitch) => ({ ...publicPitch(pitch), owner: null }));

  return jsonOk({ pitches: payload });
}

/**
 * POST /api/pitches — create a submission (JSON).
 *
 * Attachments are uploaded *after* creation through
 * `/api/pitches/:id/files/sign|register` (direct to Supabase Storage) or
 * `/api/pitches/:id/files` (proxied). Keeping the create call small means a
 * 50MB deck never has to travel through a serverless request body.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to submit a pitch.', 401);

  const store = getStore();
  const settings = await store.getSettings();

  // Admins may always enter a pitch (late walk-ins, manual entries); founders
  // only while intake is open and the deadline has not passed.
  if (user.role !== 'admin') {
    if (!settings.submission_enabled) {
      return jsonError('Submissions are currently closed. Follow the news feed for the next window.', 403);
    }
    if (settings.submission_deadline && new Date(settings.submission_deadline).getTime() < Date.now()) {
      return jsonError(
        `The submission deadline was ${new Date(settings.submission_deadline).toLocaleString('en-GB')}.`,
        403,
      );
    }
  }

  const body = await readJson(request);

  try {
    const title = requiredString(body.title, 'title', { min: 3, max: 160, label: 'Title' });
    const description = requiredString(body.description, 'description', {
      min: 40,
      max: 6000,
      label: 'Description',
    });
    const category = optionalString(body.category, 'category', { max: 80, label: 'Category' });
    const founders = parseFounders(body.founders);

    const pitch = await store.createPitch({
      title,
      description,
      category,
      created_by: user.id,
      founders,
      editable: settings.edit_mode_enabled,
    });

    // Notifications are best-effort: never block a successful submission.
    void sendSubmissionConfirmation({
      to: user.email,
      founderName: user.full_name,
      pitch,
      deadline: settings.submission_deadline,
    }).catch((error) => console.error('[pitchaton] confirmation email failed', error));

    const adminEmail = config.adminEmails[0];
    if (adminEmail) {
      void sendAdminNewSubmissionAlert({
        to: adminEmail,
        pitch,
        founders: founders.map((founder) => ({ name: founder.name, email: founder.email })),
      }).catch((error) => console.error('[pitchaton] admin alert failed', error));
    }

    return jsonOk({ pitch }, { status: 201 });
  } catch (error) {
    if (error instanceof ValidationError) {
      return jsonError(error.message, 422, error.field);
    }
    console.error('[pitchaton:create-pitch]', error);
    const message = error instanceof Error ? error.message : 'Could not save your pitch';
    return jsonError(message, 500);
  }
}
