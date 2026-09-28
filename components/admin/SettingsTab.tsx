'use client';

import { useState } from 'react';
import { Database, Mail, Save, Send, Server, ShieldCheck } from 'lucide-react';

import { Alert, Badge, Button, Card, Field, Input, Toggle, useToast } from '@/components/ui';
import type { AdminSettings, EmailLogEntry } from '@/lib/types';
import { formatDateTime, toDateTimeLocal } from '@/lib/utils';

interface Health {
  storage: 'local' | 'supabase';
  database: 'local' | 'supabase';
  email: 'resend' | 'log-only';
  adminCodeConfigured: boolean;
}

interface EmailStatus {
  emails: EmailLogEntry[];
  configured: boolean;
  from: string;
  adminInbox: string;
}

/**
 * Admin → Settings.
 * Competition calendar, the three platform switches, branding strings and a
 * platform-health / email-delivery panel. Nothing here is destructive.
 */
export function SettingsTab({
  settings: initialSettings,
  health,
  emailStatus,
  onChanged,
}: {
  settings: AdminSettings;
  health: Health;
  emailStatus: EmailStatus;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [emails, setEmails] = useState(emailStatus.emails);

  async function patch(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { settings?: AdminSettings; error?: string };
      if (!response.ok || !data.settings) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not save settings.' });
        return false;
      }
      setSettings(data.settings);
      toast.push({ tone: 'success', message: successMessage });
      onChanged();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    setTesting(true);
    try {
      const response = await fetch('/api/admin/emails', { method: 'POST' });
      const data = (await response.json()) as { error?: string; result?: { delivered: boolean; detail?: string } };
      if (!response.ok) {
        toast.push({ tone: 'error', title: 'Test email failed', message: data.error ?? 'Unknown error' });
        return;
      }
      toast.push({
        tone: 'success',
        title: 'Test email sent',
        message: `Check ${emailStatus.adminInbox}.`,
      });
      const refresh = await fetch('/api/admin/emails');
      if (refresh.ok) {
        const body = (await refresh.json()) as { emails: EmailLogEntry[] };
        setEmails(body.emails);
      }
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr] xl:items-start">
      <div className="space-y-5">
        {/* Calendar */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Competition calendar</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mute-400">
            These dates drive the public countdown and the founder dashboards.
          </p>

          <div className="mt-5 space-y-4">
            <Field label="Submission deadline" htmlFor="deadline" hint="Local time. Leave empty to hide the countdown.">
              <Input
                id="deadline"
                type="datetime-local"
                value={toDateTimeLocal(settings.submission_deadline)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    submission_deadline: event.target.value ? new Date(event.target.value).toISOString() : null,
                  }))
                }
              />
            </Field>

            <Field label="Competition date" htmlFor="competition" hint="Pitch day — when finalists present.">
              <Input
                id="competition"
                type="datetime-local"
                value={toDateTimeLocal(settings.competition_date)}
                onChange={(event) =>
                  setSettings((current) => ({
                    ...current,
                    competition_date: event.target.value ? new Date(event.target.value).toISOString() : null,
                  }))
                }
              />
            </Field>

            <Button
              onClick={() =>
                void patch(
                  {
                    submission_deadline: settings.submission_deadline,
                    competition_date: settings.competition_date,
                  },
                  'Dates saved.',
                )
              }
              loading={saving}
              icon={<Save className="h-4 w-4" aria-hidden />}
            >
              Save dates
            </Button>
          </div>
        </Card>

        {/* Switches */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Platform switches</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mute-400">
            Flip these any time — changes apply on the next page load for everyone.
          </p>

          <div className="mt-2 divide-y divide-white/[0.07]">
            <Toggle
              label="Allow new submissions"
              description="Off closes the submission form to founders (admins can still preview it)."
              checked={settings.submission_enabled}
              onChange={(next) =>
                void patch({ submission_enabled: next }, next ? 'Submissions open.' : 'Submissions closed.')
              }
              disabled={saving}
            />
            <Toggle
              label="Allow founder edits"
              description="Lets every team edit their pitch and attachments. Per-pitch locks still apply."
              checked={settings.edit_mode_enabled}
              onChange={(next) =>
                void patch(
                  { edit_mode_enabled: next },
                  next ? 'Founders can now edit their submissions.' : 'Founder edits closed.',
                )
              }
              disabled={saving}
            />
            <Toggle
              label="Publish leaderboard publicly"
              description="Opens the results — ranks, scores and judge notes — to the whole campus."
              checked={settings.results_published}
              onChange={(next) =>
                void patch(
                  { results_published: next },
                  next ? 'Leaderboard is live.' : 'Leaderboard hidden.',
                )
              }
              disabled={saving}
            />
          </div>
        </Card>

        {/* Branding */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Branding</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mute-400">
            Shown in the header, footer and every notification email.
          </p>
          <div className="mt-5 space-y-4">
            <Field label="Hub name" htmlFor="hub-name">
              <Input
                id="hub-name"
                value={settings.hub_name}
                maxLength={60}
                onChange={(event) => setSettings((current) => ({ ...current, hub_name: event.target.value }))}
              />
            </Field>
            <Field label="Institution line" htmlFor="institution" hint="Appears in the footer and email footers.">
              <Input
                id="institution"
                value={settings.institution_name}
                maxLength={120}
                onChange={(event) =>
                  setSettings((current) => ({ ...current, institution_name: event.target.value }))
                }
              />
            </Field>
            <Button
              onClick={() =>
                void patch(
                  { hub_name: settings.hub_name, institution_name: settings.institution_name },
                  'Branding updated.',
                )
              }
              loading={saving}
              icon={<Save className="h-4 w-4" aria-hidden />}
            >
              Save branding
            </Button>
          </div>
        </Card>
      </div>

      <div className="space-y-5 xl:sticky xl:top-24">
        {/* Health */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Platform health</h3>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-mute-300">
                <Database className="h-4 w-4 text-mute-500" aria-hidden /> Database
              </span>
              <Badge tone={health.database === 'supabase' ? 'lime' : 'neutral'}>
                {health.database === 'supabase' ? 'Supabase Postgres' : 'Local file store'}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-mute-300">
                <Server className="h-4 w-4 text-mute-500" aria-hidden /> File storage
              </span>
              <Badge tone={health.storage === 'supabase' ? 'lime' : 'neutral'}>
                {health.storage === 'supabase' ? 'Supabase Storage' : 'Local disk'}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-mute-300">
                <Mail className="h-4 w-4 text-mute-500" aria-hidden /> Email delivery
              </span>
              <Badge tone={emailStatus.configured ? 'lime' : 'danger'}>
                {emailStatus.configured ? 'Resend live' : 'Log only'}
              </Badge>
            </li>
          </ul>

          <div className="hairline mt-4 pt-4">
            {emailStatus.configured ? (
              <>
                <p className="text-xs leading-relaxed text-mute-500">
                  Sending as <span className="font-mono text-mute-300">{emailStatus.from}</span>. Admin alerts
                  go to <span className="font-mono text-mute-300">{emailStatus.adminInbox}</span>.
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  onClick={() => void sendTestEmail()}
                  loading={testing}
                  icon={<Send className="h-3.5 w-3.5" aria-hidden />}
                >
                  Send test email
                </Button>
              </>
            ) : (
              <Alert tone="warning" title="Email is not configured yet">
                Set <span className="font-mono">RESEND_API_KEY</span> in your environment to start delivering
                notifications. Until then every message is written to the log below and founders see the same
                status updates in their dashboard.
              </Alert>
            )}
          </div>
        </Card>

        {/* Email log */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">Email log</h3>
            <Badge>{emails.length}</Badge>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-mute-500">
            The last 100 messages generated by the platform. “Queued” means rendered but not delivered
            because no provider key is set.
          </p>

          {emails.length === 0 ? (
            <p className="mt-4 text-sm text-mute-500">No messages yet.</p>
          ) : (
            <ul className="mt-4 max-h-[26rem] space-y-2 overflow-y-auto pr-1">
              {emails.map((email) => (
                <li key={email.id} className="rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm text-mute-200">{email.subject}</p>
                    <span
                      className={`shrink-0 text-[11px] font-semibold uppercase tracking-wider ${
                        email.status === 'sent'
                          ? 'text-lime'
                          : email.status === 'failed'
                            ? 'text-status-rejected'
                            : 'text-status-review'
                      }`}
                    >
                      {email.status}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-mute-500">
                    {email.to_email} · {formatDateTime(email.created_at)} · {email.kind}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Security note */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-lime" aria-hidden /> Access control
          </p>
          <p className="mt-2 text-xs leading-relaxed text-mute-400">
            Admin rights are resolved on the server. The Hub address is always an administrator; anyone
            else needs the admin access code (<span className="font-mono">ADMIN_ACCESS_CODE</span>) once, at
            signup. Role checks run on every request, so revoking access takes effect immediately.
          </p>
          {!health.adminCodeConfigured && (
            <p className="mt-3 rounded-lg border border-status-review/30 bg-status-review/[0.08] px-3 py-2 text-xs leading-relaxed text-status-review">
              No admin access code is set on this deployment, so only addresses in{' '}
              <span className="font-mono">ADMIN_EMAILS</span> can hold admin rights. Set{' '}
              <span className="font-mono">ADMIN_ACCESS_CODE</span> before inviting another organiser.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
