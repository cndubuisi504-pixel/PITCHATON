import type { AdminSettings, PitchStatus } from './types';

/** Tiny classname joiner (keeps us dependency-free vs `clsx`). */
export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** For <input type="datetime-local"> values (local time, no seconds). */
export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const diff = Date.now() - then;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(value);
}

export function isPast(value: string | null | undefined): boolean {
  if (!value) return false;
  return new Date(value).getTime() < Date.now();
}

export function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

/* ------------------------------------------------------------------ *
 * Edit rules
 * ------------------------------------------------------------------ */

/**
 * Whether a pitch owner may change this submission right now.
 *
 * True when: an admin unlocked the individual pitch, the Hub opened global
 * edits, or the pitch is still fresh (`submitted`) inside an open intake
 * window — which is how a founder attaches files to a pitch they just created.
 */
export function isPitchEditable(
  pitch: { status: PitchStatus; editable: boolean },
  settings: Pick<AdminSettings, 'submission_enabled' | 'submission_deadline' | 'edit_mode_enabled'>,
): boolean {
  if (pitch.editable || settings.edit_mode_enabled) return true;

  const deadlineOpen =
    !settings.submission_deadline || new Date(settings.submission_deadline).getTime() > Date.now();

  return settings.submission_enabled && deadlineOpen && pitch.status === 'submitted';
}

/* ------------------------------------------------------------------ *
 * Pitch status presentation
 * ------------------------------------------------------------------ */

export const STATUS_META: Record<
  PitchStatus,
  { label: string; hint: string; text: string; chip: string; dot: string }
> = {
  submitted: {
    label: 'Submitted',
    hint: 'Received by the Hub — awaiting triage',
    text: 'text-status-submitted',
    chip: 'bg-status-submitted/[0.12] text-status-submitted border-status-submitted/30',
    dot: 'bg-status-submitted',
  },
  under_review: {
    label: 'Under review',
    hint: 'Reviewers are reading your submission',
    text: 'text-status-review',
    chip: 'bg-status-review/[0.12] text-status-review border-status-review/30',
    dot: 'bg-status-review',
  },
  accepted: {
    label: 'Accepted',
    hint: 'Cleared for the competition floor',
    text: 'text-status-accepted',
    chip: 'bg-status-accepted/[0.12] text-status-accepted border-status-accepted/30',
    dot: 'bg-status-accepted',
  },
  finalist: {
    label: 'Finalist',
    hint: 'Through to the final round',
    text: 'text-status-finalist',
    chip: 'bg-status-finalist/[0.12] text-status-finalist border-status-finalist/30',
    dot: 'bg-status-finalist',
  },
  winner: {
    label: 'Winner',
    hint: 'Took the top prize',
    text: 'text-lime',
    chip: 'bg-lime/15 text-lime border-lime/40',
    dot: 'bg-lime',
  },
  rejected: {
    label: 'Not selected',
    hint: 'Did not advance this semester — pitch again next round',
    text: 'text-status-rejected',
    chip: 'bg-status-rejected/[0.12] text-status-rejected border-status-rejected/30',
    dot: 'bg-status-rejected',
  },
};

export function statusLabel(status: PitchStatus): string {
  return STATUS_META[status]?.label ?? status;
}

/** Ordered pipeline shown on the founder dashboard. */
export const PIPELINE: PitchStatus[] = [
  'submitted',
  'under_review',
  'accepted',
  'finalist',
  'winner',
];

/* ------------------------------------------------------------------ *
 * Misc
 * ------------------------------------------------------------------ */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  if (!parts.length) return '??';
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('');
}

export function slugify(value: string, fallback = 'item'): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || fallback;
}

/** CSV cell escaping (RFC 4180). */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function sortByRank<T extends { rank: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.rank - b.rank);
}

export function medalFor(rank: number): 'gold' | 'silver' | 'bronze' | null {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return null;
}
