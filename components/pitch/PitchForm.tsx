'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  FileUp,
  Info,
  Loader2,
  Plus,
  Trash2,
  UploadCloud,
  UserPlus,
  X,
} from 'lucide-react';

import { Alert, Button, Field, Input, Textarea, useToast } from '@/components/ui';
import type { PitchDetail, SessionUser } from '@/lib/types';
import { cn, formatBytes } from '@/lib/utils';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 10;

interface FounderRow {
  key: string;
  name: string;
  email: string;
  phone: string;
  school_year: string;
}

interface UploadItem {
  id: string;
  file: File;
  progress: number;
  error?: string;
}

const YEAR_OPTIONS = ['100 level', '200 level', '300 level', '400 level', '500 level', 'Postgraduate', 'Alumni'];

function newRow(partial: Partial<FounderRow> = {}): FounderRow {
  return {
    key: Math.random().toString(36).slice(2),
    name: '',
    email: '',
    phone: '',
    school_year: '',
    ...partial,
  };
}

/**
 * Pitch submission / edit form.
 *
 * • create → multipart POST with real upload progress (XHR)
 * • edit   → JSON PATCH for the copy, then incremental file add/remove
 */
export function PitchForm({
  mode,
  user,
  initial,
  categories,
  editingAllowed = true,
}: {
  mode: 'create' | 'edit';
  user: SessionUser;
  initial?: PitchDetail;
  categories: string[];
  editingAllowed?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');

  const [founders, setFounders] = useState<FounderRow[]>(() => {
    if (initial?.founders.length) {
      return initial.founders.map((founder) =>
        newRow({
          name: founder.name,
          email: founder.email,
          phone: founder.phone ?? '',
          school_year: founder.school_year ?? '',
        }),
      );
    }
    return [newRow({ name: user.full_name, email: user.email })];
  });

  const [existingFiles, setExistingFiles] = useState(initial?.files ?? []);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const descriptionCount = description.trim().length;
  const canSubmit = useMemo(
    () => title.trim().length >= 3 && descriptionCount >= 40 && founders.some((f) => f.name && f.email),
    [title, descriptionCount, founders],
  );

  function updateFounder(key: string, patch: Partial<FounderRow>) {
    setFounders((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addFounder() {
    if (founders.length >= 12) {
      toast.push({ tone: 'error', message: 'A pitch can list at most 12 founders.' });
      return;
    }
    setFounders((rows) => [...rows, newRow()]);
  }

  function removeFounder(key: string) {
    setFounders((rows) => (rows.length === 1 ? rows : rows.filter((row) => row.key !== key)));
  }

  function acceptFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const accepted: UploadItem[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (uploads.length + accepted.length + existingFiles.length >= MAX_FILES) {
        rejected.push(`${file.name} (file limit reached)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (${formatBytes(file.size)} exceeds 50MB)`);
        continue;
      }
      accepted.push({ id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`, file, progress: 0 });
    }

    if (rejected.length) {
      toast.push({ tone: 'error', title: 'Some files were skipped', message: rejected.join(', ') });
    }
    if (accepted.length) setUploads((current) => [...current, ...accepted]);
  }

  /** Proxied upload with progress — used when Supabase Storage is unavailable. */
  function uploadViaProxy(pitchId: string, items: UploadItem[]): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const form = new FormData();
      for (const item of items) form.append('files', item.file);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `/api/pitches/${pitchId}/files`);
      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploads((current) =>
          current.map((item) =>
            items.some((pending) => pending.id === item.id) ? { ...item, progress: percent } : item,
          ),
        );
      };
      xhr.onload = () => {
        let body: { error?: string } | null = null;
        try {
          body = JSON.parse(xhr.responseText) as { error?: string };
        } catch {
          body = null;
        }
        resolve({ ok: xhr.status >= 200 && xhr.status < 300, error: body?.error });
      };
      xhr.onerror = () => resolve({ ok: false, error: 'Upload failed — check your connection.' });
      xhr.send(form);
    });
  }

  /** PUT a single file to a Supabase signed upload URL, reporting progress. */
  function putToSignedUrl(
    url: string,
    item: UploadItem,
    onProgress: (percent: number) => void,
  ): Promise<{ ok: boolean; error?: string }> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', item.file.type || 'application/octet-stream');
      xhr.setRequestHeader('cache-control', '3600');
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
      };
      xhr.onload = () =>
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          error: xhr.status >= 300 ? `Storage responded ${xhr.status}` : undefined,
        });
      xhr.onerror = () => resolve({ ok: false, error: 'Upload failed — check your connection.' });
      xhr.send(item.file);
    });
  }

  /**
   * Attach files to a pitch.
   *
   * 1. Ask the server how to upload (it also re-checks ownership + limits).
   * 2. Production: bytes go straight from the browser to Supabase Storage via
   *    one-shot signed URLs — no serverless body limit, so 50MB decks work.
   *    Local dev: fall back to the proxied multipart endpoint.
   */
  async function uploadFiles(pitchId: string, items: UploadItem[]): Promise<{ ok: boolean; error?: string }> {
    let mode: 'direct' | 'proxy' = 'proxy';
    let tickets: Array<{ signedUrl: string; path: string }> = [];

    try {
      const response = await fetch(`/api/pitches/${pitchId}/files/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: items.map((item) => ({
            file_name: item.file.name,
            file_type: item.file.type || null,
            file_size: item.file.size,
          })),
        }),
      });
      const data = (await response.json()) as {
        mode?: 'direct' | 'proxy';
        tickets?: Array<{ signedUrl: string; path: string }>;
        error?: string;
      };
      if (!response.ok) return { ok: false, error: data.error ?? 'Could not start the upload.' };
      mode = data.mode ?? 'proxy';
      tickets = data.tickets ?? [];
    } catch {
      mode = 'proxy';
    }

    if (mode === 'proxy' || !tickets.length) {
      return uploadViaProxy(pitchId, items);
    }

    const uploaded: Array<{ storage_path: string; file_name: string; file_type: string | null; file_size: number }> = [];
    for (const [index, item] of items.entries()) {
      const ticket = tickets[index];
      if (!ticket) continue;
      const result = await putToSignedUrl(ticket.signedUrl, item, (percent) =>
        setUploads((current) =>
          current.map((entry) => (entry.id === item.id ? { ...entry, progress: percent } : entry)),
        ),
      );
      if (!result.ok) return { ok: false, error: result.error ?? `Could not upload ${item.file.name}.` };
      uploaded.push({
        storage_path: ticket.path,
        file_name: item.file.name,
        file_type: item.file.type || null,
        file_size: item.file.size,
      });
    }

    const register = await fetch(`/api/pitches/${pitchId}/files/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: uploaded }),
    });
    if (!register.ok) {
      const data = (await register.json()) as { error?: string };
      return { ok: false, error: data.error ?? 'Files uploaded but could not be recorded.' };
    }
    return { ok: true };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors({});

    if (!canSubmit) {
      setFormError('Add a title, at least 40 characters of description, and one founder with a name and email.');
      return;
    }

    setSubmitting(true);
    try {
      const payloadFounders = founders
        .filter((row) => row.name.trim() && row.email.trim())
        .map((row) => ({
          name: row.name.trim(),
          email: row.email.trim(),
          phone: row.phone.trim() || null,
          school_year: row.school_year.trim() || null,
        }));

      if (mode === 'create') {
        const response = await fetch('/api/pitches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim(),
            category: category.trim() || null,
            founders: payloadFounders,
          }),
        });
        const data = (await response.json()) as {
          pitch?: { id: string; code: string; title: string };
          error?: string;
          field?: string;
        };

        if (!response.ok || !data.pitch) {
          if (data.field) setFieldErrors({ [data.field]: data.error ?? 'Check this field' });
          setFormError(data.error ?? 'Could not submit your pitch.');
          return;
        }

        if (uploads.length) {
          const uploaded = await uploadFiles(data.pitch.id, uploads);
          if (!uploaded.ok) {
            setUploads([]);
            toast.push({
              tone: 'error',
              title: 'Pitch saved — attachments failed',
              message: `${uploaded.error ?? 'Try again from your dashboard.'} Your pitch is safely submitted.`,
            });
            router.push('/dashboard');
            router.refresh();
            return;
          }
        }

        toast.push({
          tone: 'success',
          title: `Submitted — ${data.pitch.code}`,
          message: 'Check your inbox for the confirmation email.',
        });
        router.push('/dashboard');
        router.refresh();
        return;
      }

      // ----- edit mode -----
      const response = await fetch(`/api/pitches/${initial!.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: category.trim() || null,
          founders: payloadFounders,
        }),
      });
      const data = (await response.json()) as { error?: string; field?: string };
      if (!response.ok) {
        if (data.field) setFieldErrors({ [data.field]: data.error ?? 'Check this field' });
        setFormError(data.error ?? 'Could not save your changes.');
        return;
      }

      if (uploads.length) {
        const result = await uploadFiles(initial!.id, uploads);
        if (!result.ok) {
          toast.push({
            tone: 'error',
            title: 'Copy saved, files failed',
            message: result.error ?? 'Re-attach the files from your dashboard.',
          });
        } else {
          setUploads([]);
        }
      }

      toast.push({ tone: 'success', title: 'Changes saved', message: 'Your pitch is up to date.' });
      router.push('/dashboard');
      router.refresh();
    } catch {
      setFormError('Network error — your submission was not saved. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeExistingFile(fileId: string) {
    const response = await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      toast.push({ tone: 'error', message: data.error ?? 'Could not remove that file.' });
      return;
    }
    setExistingFiles((files) => files.filter((file) => file.id !== fileId));
    toast.push({ tone: 'success', message: 'Attachment removed.' });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      {formError && (
        <Alert tone="danger" title="We could not save this">
          {formError}
        </Alert>
      )}

      {!editingAllowed && (
        <Alert tone="warning" title="Editing is closed">
          The Hub has locked submissions for this round. You can still read everything below.
        </Alert>
      )}

      {/* ------------------------------------------------------------ Pitch copy */}
      <section className="card p-5 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/[0.12] font-mono text-xs font-bold text-lime">
            01
          </span>
          <h2 className="text-lg">The pitch</h2>
        </div>

        <div className="mt-6 space-y-5">
          <Field
            label="Pitch title"
            htmlFor="title"
            required
            error={fieldErrors.title}
            hint="Short and specific — this is what the leaderboard shows."
          >
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Solar-powered cold storage for market traders"
              maxLength={160}
              disabled={!editingAllowed && mode === 'edit'}
              required
            />
          </Field>

          <Field
            label="Description"
            htmlFor="description"
            required
            error={fieldErrors.description}
            hint={
              descriptionCount < 40
                ? `${Math.max(0, 40 - descriptionCount)} more characters needed`
                : `${descriptionCount} characters`
            }
          >
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What are you building? Who is it for? What problem does it solve, and what makes your approach different?"
              className="min-h-[11rem]"
              maxLength={6000}
              disabled={!editingAllowed && mode === 'edit'}
              required
            />
          </Field>

          <Field
            label="Category"
            htmlFor="category"
            error={fieldErrors.category}
            hint="Open field — type your own or pick a previous one."
          >
            <Input
              id="category"
              list="category-options"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Agritech, Fintech, Health, Campus tools…"
              maxLength={80}
              disabled={!editingAllowed && mode === 'edit'}
            />
            <datalist id="category-options">
              {categories.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          </Field>
        </div>
      </section>

      {/* -------------------------------------------------------------- Founders */}
      <section className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/[0.12] font-mono text-xs font-bold text-lime">
              02
            </span>
            <div>
              <h2 className="text-lg">Founders</h2>
              <p className="text-xs text-mute-500">Everyone listed here gets status updates by email.</p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addFounder}
            disabled={!editingAllowed && mode === 'edit'}
            icon={<UserPlus className="h-4 w-4" aria-hidden />}
          >
            Add founder
          </Button>
        </div>

        {fieldErrors.founders && <p className="mt-4 text-xs font-medium text-status-rejected">{fieldErrors.founders}</p>}

        <div className="mt-6 space-y-4">
          {founders.map((founder, index) => (
            <fieldset
              key={founder.key}
              className="rounded-xl border border-white/[0.07] bg-charcoal-950/50 p-4"
            >
              <legend className="px-1 text-2xs font-semibold uppercase tracking-[0.16em] text-mute-500">
                Founder {index + 1} {index === 0 && '· submitter'}
              </legend>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" htmlFor={`founder-name-${founder.key}`} required className="sm:col-span-1">
                  <Input
                    id={`founder-name-${founder.key}`}
                    value={founder.name}
                    onChange={(event) => updateFounder(founder.key, { name: event.target.value })}
                    placeholder="Chidera Nwosu"
                    autoComplete="off"
                    disabled={!editingAllowed && mode === 'edit'}
                  />
                </Field>
                <Field label="Email" htmlFor={`founder-email-${founder.key}`} required>
                  <Input
                    id={`founder-email-${founder.key}`}
                    type="email"
                    value={founder.email}
                    onChange={(event) => updateFounder(founder.key, { email: event.target.value })}
                    placeholder="chidera@example.com"
                    autoComplete="off"
                    disabled={!editingAllowed && mode === 'edit'}
                  />
                </Field>
                <Field label="Phone" htmlFor={`founder-phone-${founder.key}`}>
                  <Input
                    id={`founder-phone-${founder.key}`}
                    value={founder.phone}
                    onChange={(event) => updateFounder(founder.key, { phone: event.target.value })}
                    placeholder="+234 800 000 0000"
                    autoComplete="off"
                    disabled={!editingAllowed && mode === 'edit'}
                  />
                </Field>
                <Field label="Year / level" htmlFor={`founder-year-${founder.key}`}>
                  <Input
                    id={`founder-year-${founder.key}`}
                    list="year-options"
                    value={founder.school_year}
                    onChange={(event) => updateFounder(founder.key, { school_year: event.target.value })}
                    placeholder="300 level"
                    autoComplete="off"
                    disabled={!editingAllowed && mode === 'edit'}
                  />
                </Field>
              </div>

              {founders.length > 1 && (!(!editingAllowed && mode === 'edit')) && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeFounder(founder.key)}
                    className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-mute-400 transition hover:bg-status-rejected/10 hover:text-status-rejected"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </div>
              )}
            </fieldset>
          ))}
        </div>
        <datalist id="year-options">
          {YEAR_OPTIONS.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      </section>

      {/* ----------------------------------------------------------------- Files */}
      <section className="card p-5 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime/[0.12] font-mono text-xs font-bold text-lime">
            03
          </span>
          <div>
            <h2 className="text-lg">Attachments</h2>
            <p className="text-xs text-mute-500">
              Decks, wireframes, docs, photos — any format, up to 50MB each, {MAX_FILES} files max.
            </p>
          </div>
        </div>

        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            acceptFiles(event.dataTransfer.files);
          }}
          className={cn(
            'mt-6 rounded-xl border border-dashed px-5 py-8 text-center transition',
            dragging ? 'border-lime/60 bg-lime/[0.06]' : 'border-white/[0.12] bg-white/[0.02]',
          )}
        >
          <UploadCloud className={cn('mx-auto h-7 w-7', dragging ? 'text-lime' : 'text-mute-400')} aria-hidden />
          <p className="mt-3 text-sm text-mute-200">
            Drag files here, or{' '}
            <button
              type="button"
              className="font-semibold text-lime underline-offset-2 hover:underline"
              onClick={() => fileInput.current?.click()}
            >
              browse your device
            </button>
          </p>
          <p className="mt-1.5 text-xs text-mute-500">PDF, PPTX, DOCX, ZIP, images — no restrictions</p>
          <input
            ref={fileInput}
            type="file"
            multiple
            className="sr-only"
            onChange={(event) => {
              acceptFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>

        {existingFiles.length > 0 && (
          <ul className="mt-5 space-y-2">
            {existingFiles.map((file) => (
              <li
                key={file.id}
                className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-2.5"
              >
                <FileUp className="h-4 w-4 shrink-0 text-lime" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm text-mute-200">{file.file_name}</span>
                <span className="shrink-0 font-mono text-xs text-mute-500">{formatBytes(file.file_size)}</span>
                {(!(!editingAllowed && mode === 'edit')) && (
                  <button
                    type="button"
                    onClick={() => void removeExistingFile(file.id)}
                    aria-label={`Remove ${file.file_name}`}
                    className="shrink-0 rounded-lg p-1.5 text-mute-500 transition hover:bg-status-rejected/10 hover:text-status-rejected"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {uploads.length > 0 && (
          <ul className="mt-5 space-y-2">
            {uploads.map((item) => (
              <li key={item.id} className="rounded-xl border border-white/[0.07] bg-charcoal-950/50 px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <FileUp className="h-4 w-4 shrink-0 text-mute-300" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-sm text-mute-200">{item.file.name}</span>
                  <span className="shrink-0 font-mono text-xs text-mute-500">{formatBytes(item.file.size)}</span>
                  {submitting && item.progress > 0 ? (
                    <span className="shrink-0 font-mono text-xs text-lime">{item.progress}%</span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUploads((current) => current.filter((entry) => entry.id !== item.id))}
                      aria-label={`Remove ${item.file.name}`}
                      className="shrink-0 rounded-lg p-1.5 text-mute-500 transition hover:bg-white/[0.06] hover:text-white"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                {submitting && (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-lime transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------------------------------------------------------------- Submit */}
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-mute-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          By submitting you confirm the work is your team&apos;s and that the Hub may contact the
          founders listed above about the competition.
        </p>
        <div className="flex shrink-0 gap-3">
          <Button type="button" variant="ghost" onClick={() => router.back()} disabled={submitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            loading={submitting}
            disabled={(!editingAllowed && mode === 'edit') || !canSubmit}
            icon={submitting ? undefined : <Plus className="h-4 w-4" aria-hidden />}
          >
            {mode === 'create' ? 'Submit pitch' : 'Save changes'}
          </Button>
        </div>
      </div>

      {submitting && (
        <p className="flex items-center justify-center gap-2 text-xs text-mute-500 sm:justify-end">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {uploads.length ? 'Uploading attachments and saving…' : 'Saving…'}
        </p>
      )}

      {fieldErrors.files && (
        <p className="flex items-center gap-2 text-xs text-status-rejected">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden /> {fieldErrors.files}
        </p>
      )}
    </form>
  );
}
