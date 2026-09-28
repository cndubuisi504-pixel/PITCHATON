'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Filter,
  Lock,
  LockOpen,
  Search,
  Trash2,
  Trophy,
} from 'lucide-react';

import { PitchDetailBody } from '@/components/pitch/FounderPitches';
import { Button, Card, EmptyState, Input, Modal, Select, StatusPill, useToast } from '@/components/ui';
import { PITCH_STATUSES, type PitchDetail, type PitchStatus } from '@/lib/types';
import { STATUS_META, cn, formatDate, formatDateTime, statusLabel } from '@/lib/utils';

type SortKey = 'recent' | 'oldest' | 'title' | 'team' | 'status';

/**
 * Admin → Pitches.
 * Table of every submission with inline status changes, per-pitch locking,
 * detail review, deletion and a full CSV export.
 */
export function PitchesTab({
  pitches: initialPitches,
  onChanged,
}: {
  pitches: PitchDetail[];
  onChanged: () => void;
}) {
  const toast = useToast();
  const [pitches, setPitches] = useState(initialPitches);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | PitchStatus>('all');
  const [sort, setSort] = useState<SortKey>('recent');
  const [openPitch, setOpenPitch] = useState<PitchDetail | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const rows = pitches
      .filter((pitch) => (status === 'all' ? true : pitch.status === status))
      .filter((pitch) => {
        if (!term) return true;
        return [
          pitch.title,
          pitch.code,
          pitch.category ?? '',
          pitch.owner?.email ?? '',
          ...pitch.founders.map((founder) => `${founder.name} ${founder.email}`),
        ]
          .join(' ')
          .toLowerCase()
          .includes(term);
      });

    const sorted = [...rows];
    if (sort === 'recent') sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sort === 'oldest') sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sort === 'title') sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'team') sorted.sort((a, b) => b.founders.length - a.founders.length);
    if (sort === 'status') sorted.sort((a, b) => a.status.localeCompare(b.status));
    return sorted;
  }, [pitches, query, status, sort]);

  async function changeStatus(pitch: PitchDetail, next: PitchStatus) {
    if (next === pitch.status) return;
    setBusyId(pitch.id);
    try {
      const response = await fetch(`/api/pitches/${pitch.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json()) as {
        pitch?: PitchDetail;
        notified?: number;
        delivered?: number;
        error?: string;
      };
      if (!response.ok || !data.pitch) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not update the status.' });
        return;
      }
      const updated = { ...pitch, status: next };
      setPitches((rows) => rows.map((row) => (row.id === pitch.id ? updated : row)));
      setOpenPitch((current) => (current?.id === pitch.id ? updated : current));
      toast.push({
        tone: 'success',
        title: `${pitch.code} → ${statusLabel(next)}`,
        message: data.notified
          ? `${data.delivered ?? 0} of ${data.notified} notification emails delivered.`
          : undefined,
      });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function toggleEditable(pitch: PitchDetail) {
    setBusyId(pitch.id);
    try {
      const next = !pitch.editable;
      const response = await fetch(`/api/pitches/${pitch.id}/editable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editable: next }),
      });
      if (!response.ok) {
        toast.push({ tone: 'error', message: 'Could not change edit access.' });
        return;
      }
      const updated = { ...pitch, editable: next };
      setPitches((rows) => rows.map((row) => (row.id === pitch.id ? updated : row)));
      setOpenPitch((current) => (current?.id === pitch.id ? updated : current));
      toast.push({
        tone: 'success',
        message: next ? `${pitch.code} is now editable by its team.` : `${pitch.code} locked.`,
      });
    } finally {
      setBusyId(null);
    }
  }

  async function deletePitch(pitch: PitchDetail) {
    const confirmed = window.confirm(
      `Delete ${pitch.code} — “${pitch.title}”? This removes its founders, files and result. This cannot be undone.`,
    );
    if (!confirmed) return;

    setBusyId(pitch.id);
    try {
      const response = await fetch(`/api/pitches/${pitch.id}`, { method: 'DELETE' });
      if (!response.ok) {
        toast.push({ tone: 'error', message: 'Could not delete that pitch.' });
        return;
      }
      setPitches((rows) => rows.filter((row) => row.id !== pitch.id));
      setOpenPitch(null);
      toast.push({ tone: 'success', message: `${pitch.code} deleted.` });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  async function quickResult(pitch: PitchDetail, rank: number) {
    setBusyId(pitch.id);
    try {
      const response = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pitch_id: pitch.id, rank, mark_winner: rank === 1 }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not record that result.' });
        return;
      }
      toast.push({ tone: 'success', title: `Rank #${rank} recorded`, message: `${pitch.code} — ${pitch.title}` });
      onChanged();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-500" aria-hidden />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, pitch ID, category, founder or email…"
              className="pl-9"
              aria-label="Search pitches"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-mute-500" aria-hidden />
              <Select
                value={status}
                onChange={(event) => setStatus(event.target.value as 'all' | PitchStatus)}
                aria-label="Filter by status"
                className="w-[11.5rem]"
              >
                <option value="all">All statuses</option>
                {PITCH_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-mute-500" aria-hidden />
              <Select
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                aria-label="Sort pitches"
                className="w-[10.5rem]"
              >
                <option value="recent">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A–Z</option>
                <option value="team">Largest team</option>
                <option value="status">Status</option>
              </Select>
            </div>

            <a
              href="/api/pitches/export?scope=all"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-lime/40 px-4 text-sm font-semibold text-lime transition hover:bg-lime/10"
            >
              <Download className="h-4 w-4" aria-hidden /> Export CSV
            </a>
          </div>
        </div>

        <p className="mt-3 text-xs text-mute-500">
          Showing <span className="font-mono text-mute-300">{filtered.length}</span> of {pitches.length} submissions
        </p>
      </Card>

      {/* Table (desktop) / cards (mobile) */}
      {filtered.length === 0 ? (
        <EmptyState
          title={pitches.length ? 'No pitches match those filters' : 'No submissions yet'}
          description={
            pitches.length
              ? 'Try a different status or clear the search.'
              : 'Once founders start submitting, every pitch lands here with its team, files and status.'
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-2xl border border-white/[0.07] lg:block">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] bg-charcoal-900/70 text-[11px] uppercase tracking-[0.14em] text-mute-500">
                  <th scope="col" className="px-4 py-3 font-semibold">Pitch</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                  <th scope="col" className="px-4 py-3 text-center font-semibold">Team</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Submitted</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {filtered.map((pitch) => (
                  <tr key={pitch.id} className={cn('transition hover:bg-white/[0.02]', busyId === pitch.id && 'opacity-60')}>
                    <td className="max-w-[20rem] px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => setOpenPitch(pitch)}
                        className="block text-left text-sm font-semibold text-white transition hover:text-lime"
                      >
                        {pitch.title}
                      </button>
                      <p className="mt-0.5 font-mono text-xs text-mute-500">
                        {pitch.code} · {pitch.files.length} file{pitch.files.length === 1 ? '' : 's'}
                        {pitch.editable && ' · editable'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-mute-300">{pitch.category ?? '—'}</td>
                    <td className="px-4 py-3.5 text-center font-mono tabular-nums text-mute-300">{pitch.founders.length}</td>
                    <td className="px-4 py-3.5">
                      <Select
                        value={pitch.status}
                        onChange={(event) => void changeStatus(pitch, event.target.value as PitchStatus)}
                        className="h-9 w-[10.5rem] text-xs"
                        aria-label={`Status for ${pitch.title}`}
                      >
                        {PITCH_STATUSES.map((value) => (
                          <option key={value} value={value}>
                            {STATUS_META[value].label}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-mute-400">{formatDate(pitch.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => void toggleEditable(pitch)}
                          title={pitch.editable ? 'Lock this submission' : 'Allow this team to edit'}
                          aria-label={pitch.editable ? 'Lock submission' : 'Unlock submission'}
                          className="rounded-lg p-2 text-mute-400 transition hover:bg-white/[0.06] hover:text-lime"
                        >
                          {pitch.editable ? <LockOpen className="h-4 w-4" aria-hidden /> : <Lock className="h-4 w-4" aria-hidden />}
                        </button>
                        <button
                          type="button"
                          onClick={() => void quickResult(pitch, 1)}
                          title="Mark as rank #1 winner"
                          aria-label="Mark as winner"
                          className="rounded-lg p-2 text-mute-400 transition hover:bg-lime/10 hover:text-lime"
                        >
                          <Trophy className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deletePitch(pitch)}
                          title="Delete submission"
                          aria-label="Delete submission"
                          className="rounded-lg p-2 text-mute-400 transition hover:bg-status-rejected/10 hover:text-status-rejected"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card list */}
          <ul className="space-y-3 lg:hidden">
            {filtered.map((pitch) => (
              <li key={pitch.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-mute-500">{pitch.code}</p>
                    <button
                      type="button"
                      onClick={() => setOpenPitch(pitch)}
                      className="mt-1 block text-left text-sm font-semibold text-white"
                    >
                      {pitch.title}
                    </button>
                  </div>
                  <StatusPill status={pitch.status} />
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-mute-500">
                  <dd>{pitch.category ?? 'Uncategorised'}</dd>
                  <dd>{pitch.founders.length} founders</dd>
                  <dd>{formatDate(pitch.created_at)}</dd>
                </dl>
                <div className="mt-3 flex items-center gap-2">
                  <Select
                    value={pitch.status}
                    onChange={(event) => void changeStatus(pitch, event.target.value as PitchStatus)}
                    className="h-9 flex-1 text-xs"
                    aria-label={`Status for ${pitch.title}`}
                  >
                    {PITCH_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {STATUS_META[value].label}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" variant="secondary" onClick={() => setOpenPitch(pitch)}>
                    Open
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Detail modal */}
      <Modal
        open={Boolean(openPitch)}
        onClose={() => setOpenPitch(null)}
        title={openPitch?.title ?? ''}
        description={
          openPitch
            ? `${openPitch.code} · ${openPitch.founders.length} founder(s) · submitted ${formatDateTime(openPitch.created_at)}`
            : undefined
        }
        size="xl"
        footer={
          openPitch ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => void toggleEditable(openPitch)}>
                  {openPitch.editable ? 'Lock submission' : 'Open for edits'}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => void quickResult(openPitch, 1)} icon={<Trophy className="h-3.5 w-3.5" aria-hidden />}>
                  Mark winner
                </Button>
              </div>
              <Button size="sm" variant="danger" onClick={() => void deletePitch(openPitch)} icon={<Trash2 className="h-3.5 w-3.5" aria-hidden />}>
                Delete
              </Button>
            </div>
          ) : null
        }
      >
        {openPitch && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-charcoal-950/50 p-3.5">
              <span className="text-xs font-medium uppercase tracking-[0.14em] text-mute-500">Status</span>
              <Select
                value={openPitch.status}
                onChange={(event) => void changeStatus(openPitch, event.target.value as PitchStatus)}
                className="h-9 w-[11rem] text-xs"
                aria-label="Change status"
              >
                {PITCH_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_META[value].label}
                  </option>
                ))}
              </Select>
              {openPitch.owner && (
                <span className="text-xs text-mute-500">
                  Submitted by <span className="text-mute-200">{openPitch.owner.email}</span>
                </span>
              )}
            </div>
            <PitchDetailBody pitch={openPitch} />
          </div>
        )}
      </Modal>
    </div>
  );
}
