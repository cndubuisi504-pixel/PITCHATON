'use client';

import { useState } from 'react';
import { Download, Eye, EyeOff, Plus, Trash2, Upload } from 'lucide-react';

import { Alert, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Textarea, useToast } from '@/components/ui';
import type { AdminSettings, PitchStatus } from '@/lib/types';
import { formatDateTime, medalFor, toCsv } from '@/lib/utils';

interface ResultRow {
  id: string;
  pitch_id: string;
  rank: number;
  score: number | null;
  notes: string | null;
  uploaded_at: string;
  pitch: { id: string; code: string; title: string; category: string | null; status: PitchStatus } | null;
}

interface Candidate {
  id: string;
  code: string;
  title: string;
  category: string | null;
  status: PitchStatus;
  result: { rank: number; score: number | null } | null;
}

const SAMPLE = `Pitch ID,Rank,Score,Notes
PCH-0001,1,92.5,Sharp problem framing and a clear go-to-market
PCH-0004,2,88,Winning demo — needs a pricing story`;

/**
 * Admin → Results.
 * Manual entry, batch paste-upload, CSV export and the publish switch that
 * opens the public leaderboard.
 */
export function ResultsTab({
  results: initialResults,
  candidates: initialCandidates,
  settings,
  onChanged,
}: {
  results: ResultRow[];
  candidates: Candidate[];
  settings: AdminSettings;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [results, setResults] = useState(initialResults);
  const [candidates] = useState(initialCandidates);
  const [published, setPublished] = useState(settings.results_published);
  const [savingPublish, setSavingPublish] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkErrors, setBulkErrors] = useState<Array<{ row: number; message: string }>>([]);

  const [pitchId, setPitchId] = useState('');
  const [rank, setRank] = useState('1');
  const [score, setScore] = useState('');
  const [notes, setNotes] = useState('');
  const [markWinner, setMarkWinner] = useState(true);
  const [entryBusy, setEntryBusy] = useState(false);

  async function refresh() {
    const response = await fetch('/api/admin/results');
    if (!response.ok) return;
    const data = (await response.json()) as { results: ResultRow[] };
    setResults(data.results);
    onChanged();
  }

  async function submitResult(event: React.FormEvent) {
    event.preventDefault();
    if (!pitchId) {
      toast.push({ tone: 'error', message: 'Choose the pitch this result belongs to.' });
      return;
    }
    setEntryBusy(true);
    try {
      const response = await fetch('/api/admin/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pitch_id: pitchId,
          rank: Number(rank),
          score: score === '' ? null : Number(score),
          notes: notes.trim() || null,
          mark_winner: markWinner && Number(rank) === 1,
        }),
      });
      const data = (await response.json()) as { error?: string; updated?: boolean };
      if (!response.ok) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not save that result.' });
        return;
      }
      toast.push({
        tone: 'success',
        title: data.updated ? 'Result updated' : 'Result recorded',
        message: markWinner && Number(rank) === 1 ? 'The team was notified as winners.' : undefined,
      });
      setPitchId('');
      setRank('1');
      setScore('');
      setNotes('');
      await refresh();
    } finally {
      setEntryBusy(false);
    }
  }

  async function submitBulk() {
    setBulkBusy(true);
    setBulkErrors([]);
    try {
      const response = await fetch('/api/admin/results/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: bulkText }),
      });
      const data = (await response.json()) as {
        appliedCount?: number;
        errorCount?: number;
        errors?: Array<{ row: number; message: string }>;
        error?: string;
      };
      if (!response.ok) {
        toast.push({ tone: 'error', message: data.error ?? 'Could not import those rows.' });
        return;
      }
      setBulkErrors(data.errors ?? []);
      toast.push({
        tone: data.errorCount ? 'info' : 'success',
        title: `${data.appliedCount} row(s) applied`,
        message: data.errorCount ? `${data.errorCount} row(s) need attention — see below.` : undefined,
      });
      await refresh();
      if (!data.errorCount) {
        setBulkOpen(false);
        setBulkText('');
      }
    } finally {
      setBulkBusy(false);
    }
  }

  async function removeResult(row: ResultRow) {
    if (!window.confirm(`Remove the result for ${row.pitch?.code ?? 'this pitch'}?`)) return;
    const response = await fetch(`/api/admin/results?pitch_id=${row.pitch_id}`, { method: 'DELETE' });
    if (!response.ok) {
      toast.push({ tone: 'error', message: 'Could not remove that result.' });
      return;
    }
    setResults((rows) => rows.filter((item) => item.id !== row.id));
    toast.push({ tone: 'success', message: 'Result removed.' });
    onChanged();
  }

  async function togglePublish() {
    setSavingPublish(true);
    try {
      const next = !published;
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results_published: next }),
      });
      if (!response.ok) {
        toast.push({ tone: 'error', message: 'Could not change the publishing state.' });
        return;
      }
      setPublished(next);
      toast.push({
        tone: 'success',
        title: next ? 'Leaderboard published' : 'Leaderboard hidden',
        message: next
          ? 'Anyone can now see the ranking on /leaderboard.'
          : 'Results are private again — only admins can see them.',
      });
      onChanged();
    } finally {
      setSavingPublish(false);
    }
  }

  function exportResults() {
    const rows: Array<Array<unknown>> = [
      ['Pitch ID', 'Title', 'Category', 'Rank', 'Score', 'Notes', 'Recorded'],
      ...results.map((row) => [
        row.pitch?.code ?? '',
        row.pitch?.title ?? '',
        row.pitch?.category ?? '',
        row.rank,
        row.score ?? '',
        row.notes ?? '',
        row.uploaded_at,
      ]),
    ];
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pitchaton-results-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const unpublished = !published && results.length > 0;

  return (
    <div className="space-y-5">
      {/* Publish switch */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-semibold text-white">Public leaderboard</h3>
              <Badge tone={published ? 'lime' : 'neutral'}>{published ? 'Live' : 'Hidden'}</Badge>
            </div>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-mute-400">
              {published
                ? 'The ranking is visible to everyone at /leaderboard. Unpublish to take it down instantly.'
                : 'Results stay private until you publish. Founders still see their own rank on their dashboard.'}
            </p>
            {unpublished && (
              <p className="mt-2 text-xs text-status-review">
                {results.length} result{results.length === 1 ? '' : 's'} recorded and waiting to go live.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={published ? 'secondary' : 'primary'}
              onClick={() => void togglePublish()}
              loading={savingPublish}
              icon={published ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            >
              {published ? 'Unpublish results' : 'Publish results'}
            </Button>
            <Button variant="ghost" onClick={exportResults} disabled={!results.length} icon={<Download className="h-4 w-4" aria-hidden />}>
              Export results CSV
            </Button>
            <Button variant="secondary" onClick={() => setBulkOpen(true)} icon={<Upload className="h-4 w-4" aria-hidden />}>
              Batch upload
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[1fr_1.3fr]">
        {/* Manual entry */}
        <Card className="p-5">
          <h3 className="text-base font-semibold text-white">Record a result</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-mute-400">
            Ranks are unique per pitch; saving twice updates the same row.
          </p>

          <form onSubmit={submitResult} className="mt-5 space-y-4">
            <Field label="Pitch" htmlFor="result-pitch" required>
              <Select id="result-pitch" value={pitchId} onChange={(event) => setPitchId(event.target.value)}>
                <option value="">Choose a submission…</option>
                {candidates.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.code} · {candidate.title}
                    {candidate.result ? ` (rank #${candidate.result.rank})` : ''}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rank" htmlFor="result-rank" required>
                <Input
                  id="result-rank"
                  type="number"
                  min={1}
                  max={999}
                  value={rank}
                  onChange={(event) => setRank(event.target.value)}
                  required
                />
              </Field>
              <Field label="Score" htmlFor="result-score" hint="0–1000, optional">
                <Input
                  id="result-score"
                  type="number"
                  step="0.1"
                  min={0}
                  max={1000}
                  value={score}
                  onChange={(event) => setScore(event.target.value)}
                  placeholder="88.5"
                />
              </Field>
            </div>

            <Field label="Judge notes" htmlFor="result-notes" hint="Shown publicly on the leaderboard.">
              <Textarea
                id="result-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What separated this pitch?"
                className="min-h-[5rem]"
                maxLength={600}
              />
            </Field>

            <label className="flex items-start gap-2.5 text-sm text-mute-300">
              <input
                type="checkbox"
                checked={markWinner}
                onChange={(event) => setMarkWinner(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-charcoal-950 accent-lime"
              />
              <span>
                Notify the team if this is rank #1
                <span className="mt-0.5 block text-xs text-mute-500">
                  Sets the pitch status to Winner and emails every founder.
                </span>
              </span>
            </label>

            <Button type="submit" loading={entryBusy} fullWidth icon={<Plus className="h-4 w-4" aria-hidden />}>
              Save result
            </Button>
          </form>
        </Card>

        {/* Recorded results */}
        <Card className="p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-white">Recorded results</h3>
            <span className="font-mono text-xs text-mute-500">{results.length}</span>
          </div>

          {results.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                title="No results yet"
                description="Record them one by one, or paste a whole judging sheet with batch upload."
              />
            </div>
          ) : (
            <ul className="mt-4 space-y-2.5">
              {results.map((row) => {
                const medal = medalFor(row.rank);
                return (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-3"
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg border font-mono text-sm font-semibold ${
                        medal === 'gold'
                          ? 'border-lime/40 bg-lime/15 text-lime'
                          : medal === 'silver'
                            ? 'border-white/20 bg-white/[0.08] text-white'
                            : medal === 'bronze'
                              ? 'border-status-review/30 bg-status-review/10 text-status-review'
                              : 'border-white/[0.08] text-mute-300'
                      }`}
                    >
                      {row.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {row.pitch?.title ?? 'Deleted pitch'}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-mute-500">
                        {row.pitch?.code} · {row.pitch?.category ?? 'Uncategorised'} ·{' '}
                        {formatDateTime(row.uploaded_at)}
                      </p>
                    </div>
                    {row.score !== null && <span className="font-mono text-sm text-mute-200">{row.score}</span>}
                    <button
                      type="button"
                      onClick={() => void removeResult(row)}
                      aria-label={`Delete result for ${row.pitch?.title ?? 'pitch'}`}
                      className="rounded-lg p-2 text-mute-500 transition hover:bg-status-rejected/10 hover:text-status-rejected"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Batch upload modal */}
      <Modal
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        title="Batch upload results"
        description="Paste rows from a spreadsheet: Pitch ID, Rank, Score, Notes. Header row optional."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitBulk()} loading={bulkBusy} disabled={!bulkText.trim()}>
              Import rows
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Alert tone="info" title="Accepted formats">
            Comma or tab separated. Pitch IDs look like <span className="font-mono">PCH-0001</span> — copy
            them straight from the Pitches tab or the CSV export.
          </Alert>

          <Field label="Rows" htmlFor="bulk-rows">
            <Textarea
              id="bulk-rows"
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={SAMPLE}
              className="min-h-[11rem] font-mono text-xs"
            />
          </Field>

          <button
            type="button"
            className="text-xs font-medium text-lime underline-offset-2 hover:underline"
            onClick={() => setBulkText(SAMPLE)}
          >
            Insert example rows
          </button>

          {bulkErrors.length > 0 && (
            <div className="rounded-xl border border-status-review/30 bg-status-review/[0.08] p-4">
              <p className="text-sm font-semibold text-status-review">Rows that need attention</p>
              <ul className="mt-2 space-y-1 text-xs text-mute-300">
                {bulkErrors.map((error) => (
                  <li key={`${error.row}-${error.message}`}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
