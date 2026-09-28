'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarDays, Download, FileText, Pencil, Users } from 'lucide-react';

import { Badge, Button, EmptyState, LinkButton, Modal, StatusPill, Tabs } from '@/components/ui';
import type { AdminSettings, PitchDetail } from '@/lib/types';
import { PIPELINE, STATUS_META, formatBytes, formatDate, isPitchEditable, statusLabel } from '@/lib/utils';

type Filter = 'all' | 'active' | 'closed';

/**
 * Founder pitch list with status filtering, a detail drawer and the
 * "edit" entry point (only shown while the Hub has edits open).
 */
export function FounderPitches({
  pitches,
  settings,
}: {
  pitches: PitchDetail[];
  settings: AdminSettings;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [openPitch, setOpenPitch] = useState<PitchDetail | null>(null);

  const counts = useMemo(
    () => ({
      all: pitches.length,
      active: pitches.filter((pitch) => !['winner', 'rejected'].includes(pitch.status)).length,
      closed: pitches.filter((pitch) => ['winner', 'rejected'].includes(pitch.status)).length,
    }),
    [pitches],
  );

  const visible = pitches.filter((pitch) => {
    if (filter === 'active') return !['winner', 'rejected'].includes(pitch.status);
    if (filter === 'closed') return ['winner', 'rejected'].includes(pitch.status);
    return true;
  });

  if (!pitches.length) {
    return (
      <EmptyState
        icon={<FileText className="h-5 w-5" aria-hidden />}
        title="No pitches yet"
        description="Your first submission takes about ten minutes: the idea, the team, and anything reviewers should read."
        action={<LinkButton href="/submit-pitch">Submit your first pitch</LinkButton>}
      />
    );
  }

  return (
    <div className="space-y-5">
      <Tabs
        active={filter}
        onChange={setFilter}
        tabs={[
          { id: 'all', label: 'All pitches', count: counts.all },
          { id: 'active', label: 'In review', count: counts.active },
          { id: 'closed', label: 'Closed', count: counts.closed },
        ]}
        className="w-full sm:w-auto sm:inline-flex"
      />

      <ul className="space-y-4">
        {visible.map((pitch) => {
          const editable = isPitchEditable(pitch, settings);
          return (
            <li key={pitch.id} className="card p-5 transition hover:border-white/[0.12] sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-xs text-mute-500">{pitch.code}</span>
                    <StatusPill status={pitch.status} />
                    {editable && <Badge tone="lime">Editable</Badge>}
                  </div>
                  <h3 className="mt-3 text-lg leading-snug text-white">{pitch.title}</h3>
                  <p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-relaxed text-mute-400">
                    {pitch.description}
                  </p>

                  <dl className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-mute-500">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      <dt className="sr-only">Team</dt>
                      <dd>
                        {pitch.founders.length} founder{pitch.founders.length === 1 ? '' : 's'}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" aria-hidden />
                      <dt className="sr-only">Files</dt>
                      <dd>
                        {pitch.files.length} attachment{pitch.files.length === 1 ? '' : 's'}
                      </dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                      <dt className="sr-only">Submitted</dt>
                      <dd>Submitted {formatDate(pitch.created_at)}</dd>
                    </div>
                    {pitch.category && <dd className="text-lime">{pitch.category}</dd>}
                  </dl>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setOpenPitch(pitch)}>
                    Details
                  </Button>
                  {editable ? (
                    <LinkButton
                      href={`/submit-pitch/${pitch.id}/edit`}
                      variant="outline"
                      size="sm"
                      icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}
                    >
                      Edit
                    </LinkButton>
                  ) : (
                    <span className="self-center text-xs text-mute-600">Locked by the Hub</span>
                  )}
                </div>
              </div>

              {pitch.result && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-lime/25 bg-lime/[0.06] px-4 py-3">
                  <Badge tone="lime">Rank #{pitch.result.rank}</Badge>
                  {pitch.result.score !== null && (
                    <span className="font-mono text-sm text-lime">Score {pitch.result.score}</span>
                  )}
                  {pitch.result.notes && <p className="text-xs text-mute-300">{pitch.result.notes}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal
        open={Boolean(openPitch)}
        onClose={() => setOpenPitch(null)}
        title={openPitch?.title ?? ''}
        description={openPitch ? `${openPitch.code} · submitted ${formatDate(openPitch.created_at)}` : undefined}
        size="lg"
        footer={
          openPitch && isPitchEditable(openPitch, settings) ? (
            <LinkButton href={`/submit-pitch/${openPitch.id}/edit`} size="sm" icon={<Pencil className="h-3.5 w-3.5" aria-hidden />}>
              Edit pitch
            </LinkButton>
          ) : null
        }
      >
        {openPitch && <PitchDetailBody pitch={openPitch} />}
      </Modal>
    </div>
  );
}

export function PitchDetailBody({ pitch }: { pitch: PitchDetail }) {
  return (
    <div className="space-y-7">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <StatusPill status={pitch.status} />
          {pitch.category && <Badge>{pitch.category}</Badge>}
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-mute-300">{pitch.description}</p>
      </div>

      {/* Pipeline tracker */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute-500">Pipeline</p>
        <ol className="mt-3 flex flex-wrap gap-2">
          {PIPELINE.map((stage) => {
            const currentIndex = PIPELINE.indexOf(pitch.status);
            const stageIndex = PIPELINE.indexOf(stage);
            const reached = currentIndex >= stageIndex && pitch.status !== 'rejected';
            return (
              <li
                key={stage}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
                  reached ? 'border-lime/35 bg-lime/10 text-lime' : 'border-white/[0.08] text-mute-500'
                }`}
              >
                {statusLabel(stage)}
              </li>
            );
          })}
          {pitch.status === 'rejected' && (
            <li className="rounded-lg border border-status-rejected/30 bg-status-rejected/10 px-2.5 py-1.5 text-xs font-medium text-status-rejected">
              {statusLabel('rejected')}
            </li>
          )}
        </ol>
        <p className="mt-3 text-xs leading-relaxed text-mute-500">{STATUS_META[pitch.status].hint}</p>
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute-500">
          Team ({pitch.founders.length})
        </p>
        <ul className="mt-3 space-y-2">
          {pitch.founders.map((founder) => (
            <li
              key={founder.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-white">{founder.name}</p>
                <p className="text-xs text-mute-500">{founder.email}</p>
              </div>
              <div className="text-right text-xs text-mute-500">
                {founder.school_year && <p>{founder.school_year}</p>}
                {founder.phone && <p className="font-mono">{founder.phone}</p>}
              </div>
            </li>
          ))}
        </ul>
      </div>

      {pitch.files.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute-500">
            Attachments ({pitch.files.length})
          </p>
          <ul className="mt-3 space-y-2">
            {pitch.files.map((file) => (
              <li key={file.id} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-2.5">
                <FileText className="h-4 w-4 shrink-0 text-lime" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-mute-200">{file.file_name}</span>
                <span className="font-mono text-xs text-mute-500">{formatBytes(file.file_size)}</span>
                <a
                  href={`/api/files/${file.id}`}
                  className="rounded-lg p-1.5 text-mute-400 transition hover:bg-white/[0.06] hover:text-lime"
                  aria-label={`Download ${file.file_name}`}
                >
                  <Download className="h-4 w-4" aria-hidden />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {pitch.result && (
        <div className="rounded-xl border border-lime/25 bg-lime/[0.06] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-lime">Official result</p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="font-mono text-lg font-semibold text-lime">#{pitch.result.rank}</span>
            {pitch.result.score !== null && <span className="text-sm text-mute-200">Score {pitch.result.score}</span>}
          </div>
          {pitch.result.notes && <p className="mt-2 text-sm leading-relaxed text-mute-300">{pitch.result.notes}</p>}
        </div>
      )}
    </div>
  );
}
