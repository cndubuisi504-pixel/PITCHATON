import 'server-only';

import { config, emailsConfigured } from './config';
import { getStore } from './store';
import type { EmailLogEntry, Pitch, PitchStatus } from './types';
import { formatDateTime, statusLabel } from './utils';

/**
 * Transactional email.
 *
 * Delivery goes through Resend's HTTP API (free tier: 3,000 mails/month, no
 * card required). When RESEND_API_KEY is absent — local dev, previews, or a
 * Hub that hasn't set it up yet — every message is still rendered and written
 * to the email log, which the admin can read in Settings → Email log. Nothing
 * is silently lost, and a mail outage can never break a submission.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  kind: EmailLogEntry['kind'];
}

export interface SendEmailResult {
  delivered: boolean;
  status: EmailLogEntry['status'];
  detail?: string;
}

function shell(title: string, bodyHtml: string, cta?: { label: string; href: string }): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#101011;font-family:Inter,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101011;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#1a1a1a;border:1px solid #313131;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:24px 28px;border-bottom:1px solid #2a2a2a;">
                <span style="display:inline-block;color:#d3ff01;font-size:16px;font-weight:800;letter-spacing:0.18em;">PITCHATON</span>
                <span style="display:block;color:#8f8f8c;font-size:12px;margin-top:4px;">${config.site.hubName} · Semester Pitch Competition</span>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <h1 style="margin:0 0 16px;color:#f4f4f5;font-size:22px;line-height:1.3;">${title}</h1>
                <div style="color:#d6d6d6;font-size:15px;line-height:1.65;">${bodyHtml}</div>
                ${
                  cta
                    ? `<div style="margin-top:26px;">
                        <a href="${cta.href}" style="display:inline-block;background:#d3ff01;color:#111111;font-weight:700;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:14px;">${cta.label}</a>
                       </div>`
                    : ''
                }
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 26px;border-top:1px solid #2a2a2a;color:#6e6e6b;font-size:12px;line-height:1.6;">
                Sent automatically by PITCHATON · ${config.site.institution}<br />
                Reply to this email if anything looks wrong.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const store = getStore();
  const to = config.email.devOverride || input.to;
  const subject = config.email.devOverride ? `[dev → ${input.to}] ${input.subject}` : input.subject;

  if (!emailsConfigured) {
    await store.logEmail({
      to_email: to,
      subject: input.subject,
      body: input.text,
      kind: input.kind,
      status: 'queued',
      error: 'RESEND_API_KEY not configured — message rendered and queued in the email log.',
    });
    return { delivered: false, status: 'queued', detail: 'email-not-configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [to],
        subject,
        html: input.html,
        text: input.text,
        reply_to: config.adminEmails[0],
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      await store.logEmail({
        to_email: to,
        subject: input.subject,
        body: input.text,
        kind: input.kind,
        status: 'failed',
        error: `${response.status} ${detail}`.slice(0, 500),
      });
      return { delivered: false, status: 'failed', detail: detail.slice(0, 200) };
    }

    await store.logEmail({
      to_email: to,
      subject: input.subject,
      body: input.text,
      kind: input.kind,
      status: 'sent',
      error: null,
    });
    return { delivered: true, status: 'sent' };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    await store.logEmail({
      to_email: to,
      subject: input.subject,
      body: input.text,
      kind: input.kind,
      status: 'failed',
      error: message.slice(0, 500),
    });
    return { delivered: false, status: 'failed', detail: message };
  }
}

/* ------------------------------------------------------------------ *
 * Templates
 * ------------------------------------------------------------------ */

const dash = () => `${config.site.url.replace(/\/$/, '')}/dashboard`;

export async function sendSubmissionConfirmation(params: {
  to: string;
  founderName: string;
  pitch: Pitch;
  deadline: string | null;
}) {
  const { to, founderName, pitch, deadline } = params;
  const body = `<p style="margin:0 0 14px;">Hi ${founderName.split(' ')[0] || 'there'},</p>
    <p style="margin:0 0 14px;">We have your pitch — <strong style="color:#d3ff01;">${pitch.title}</strong> (${pitch.code}) is officially in the running${pitch.category ? ` for <em>${pitch.category}</em>` : ''}.</p>
    <p style="margin:0 0 14px;">What happens next: reviewers at the Hub read every submission, then move it through review → accepted → finalist. You'll get an email the moment your status changes.</p>
    ${deadline ? `<p style="margin:0 0 14px;color:#8f8f8c;font-size:13px;">Submission window closes ${formatDateTime(deadline)}.</p>` : ''}
    <p style="margin:0;">Good luck — build something worth pitching.</p>`;

  return sendEmail({
    to,
    subject: `PITCHATON · We received “${pitch.title}”`,
    html: shell(`Submission confirmed — ${pitch.code}`, body, {
      label: 'Open your dashboard',
      href: dash(),
    }),
    text: `Hi ${founderName},\n\nWe received your pitch "${pitch.title}" (${pitch.code}).\n\nTrack its status any time: ${dash()}\n\n— ${config.site.hubName} PITCHATON`,
    kind: 'submission',
  });
}

export async function sendStatusChangeEmail(params: {
  to: string;
  founderName: string;
  pitch: Pitch;
  status: PitchStatus;
}) {
  const { to, founderName, pitch, status } = params;
  const label = statusLabel(status);
  const winner = status === 'winner';

  const body = `<p style="margin:0 0 14px;">Hi ${founderName.split(' ')[0] || 'there'},</p>
    <p style="margin:0 0 14px;">Your pitch <strong style="color:#d3ff01;">${pitch.title}</strong> (${pitch.code}) just moved to <strong>${label}</strong>.</p>
    ${
      winner
        ? `<p style="margin:0 0 14px;">🏆 That is the top spot. The Hub will be in touch about the spotlight post and next steps.</p>`
        : `<p style="margin:0 0 14px;">Keep an eye on your inbox and the Hub news feed for the next milestone.</p>`
    }
    <p style="margin:0;">— ${config.site.hubName} review team</p>`;

  return sendEmail({
    to,
    subject: `PITCHATON · “${pitch.title}” is now ${label}`,
    html: shell(`Status update: ${label}`, body, {
      label: 'See the full status',
      href: dash(),
    }),
    text: `Hi ${founderName},\n\nYour pitch "${pitch.title}" (${pitch.code}) moved to: ${label}.\n\nDetails: ${dash()}`,
    kind: 'status',
  });
}

export async function sendSpotlightEmail(params: {
  to: string;
  founderName: string;
  pitchTitle: string;
  newsTitle: string;
}) {
  const { to, founderName, pitchTitle, newsTitle } = params;
  const body = `<p style="margin:0 0 14px;">Hi ${founderName.split(' ')[0] || 'there'},</p>
    <p style="margin:0 0 14px;">The Hub just published a spotlight featuring <strong style="color:#d3ff01;">${pitchTitle}</strong>: “${newsTitle}”.</p>
    <p style="margin:0;">Share it — this is the kind of visibility that opens doors.</p>`;

  return sendEmail({
    to,
    subject: `PITCHATON · You're featured in the Hub news feed`,
    html: shell('Your pitch is in the spotlight', body, {
      label: 'Read the post',
      href: `${config.site.url.replace(/\/$/, '')}/news`,
    }),
    text: `Hi ${founderName},\n\nThe Hub published a spotlight featuring "${pitchTitle}": "${newsTitle}".\n\nRead it: ${config.site.url.replace(/\/$/, '')}/news`,
    kind: 'spotlight',
  });
}

export async function sendAdminNewSubmissionAlert(params: {
  to: string;
  pitch: Pitch;
  founders: Array<{ name: string; email: string }>;
}) {
  const { to, pitch, founders } = params;
  const team = founders.map((f) => `${f.name} (${f.email})`).join(', ');
  const body = `<p style="margin:0 0 14px;">A new pitch landed on PITCHATON.</p>
    <p style="margin:0 0 10px;"><strong style="color:#d3ff01;">${pitch.title}</strong> — ${pitch.code}</p>
    <p style="margin:0 0 10px;color:#8f8f8c;font-size:13px;">Category: ${pitch.category ?? 'not set'}</p>
    <p style="margin:0 0 10px;color:#8f8f8c;font-size:13px;">Team: ${team}</p>
    <p style="margin:0;">Open the admin dashboard to triage it.</p>`;

  return sendEmail({
    to,
    subject: `PITCHATON · New submission: ${pitch.title}`,
    html: shell('New submission received', body, {
      label: 'Open admin dashboard',
      href: `${config.site.url.replace(/\/$/, '')}/admin`,
    }),
    text: `New submission: ${pitch.title} (${pitch.code})\nCategory: ${pitch.category ?? 'not set'}\nTeam: ${team}\n\nAdmin: ${config.site.url.replace(/\/$/, '')}/admin`,
    kind: 'system',
  });
}
