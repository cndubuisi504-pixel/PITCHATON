import { jsonError, jsonOk } from '@/lib/api';
import { config, emailsConfigured } from '@/lib/config';
import { sendEmail } from '@/lib/email';
import { apiAdmin } from '@/lib/guards';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/admin/emails — delivery log + configuration state. */
export async function GET() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const emails = await getStore().listEmails(100);
  return jsonOk({
    emails,
    configured: emailsConfigured,
    from: config.email.from,
    adminInbox: config.adminEmails[0],
  });
}

/** POST /api/admin/emails — send a test message to the signed-in admin. */
export async function POST() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  if (!emailsConfigured) {
    return jsonError(
      'RESEND_API_KEY is not set, so nothing can be delivered yet. Messages are still written to the log below.',
      400,
    );
  }

  const result = await sendEmail({
    to: guard.user.email,
    subject: 'PITCHATON · test email',
    html: `<p style="margin:0;">Delivery works. Notifications for submissions, status changes and spotlights will land in founder inboxes like this.</p>`,
    text: 'Delivery works. PITCHATON notifications are live.',
    kind: 'test',
  });

  return jsonOk({ result });
}
