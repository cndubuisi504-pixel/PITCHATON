import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { apiAdmin } from '@/lib/guards';
import { getStore } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/results/bulk — paste-in batch upload.
 *
 * Accepts either a CSV/TSV blob (`csv` field, header row optional) or a JSON
 * array (`rows`). Columns: Pitch ID | Rank | Score | Notes. Rows that cannot be
 * matched to a pitch are reported back — never silently dropped.
 */

interface ParsedRow {
  pitch_code: string;
  rank: string;
  score: string;
  notes: string;
}

function splitLine(line: string): string[] {
  if (line.includes('\t') && !line.includes(',')) return line.split('\t');
  // Minimal CSV split that understands quoted cells.
  const cells: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(csv: string): ParsedRow[] {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  let start = 0;
  const first = splitLine(lines[0]).map((cell) => cell.toLowerCase());
  if (first[0]?.includes('pitch')) start = 1; // header row

  const rows: ParsedRow[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const cells = splitLine(lines[i]);
    if (!cells[0]) continue;
    rows.push({
      pitch_code: cells[0] ?? '',
      rank: cells[1] ?? '',
      score: cells[2] ?? '',
      notes: cells[3] ?? '',
    });
  }
  return rows;
}

export async function POST(request: NextRequest) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const body = await readJson(request);
  const store = getStore();

  let incoming: ParsedRow[] = [];
  if (typeof body.csv === 'string' && body.csv.trim()) {
    incoming = parseCsv(body.csv);
  } else if (Array.isArray(body.rows)) {
    incoming = body.rows.map((raw) => {
      const row = (raw ?? {}) as Record<string, unknown>;
      return {
        pitch_code: String(row.pitch_id ?? row.code ?? row.pitch_code ?? '').trim(),
        rank: String(row.rank ?? '').trim(),
        score: String(row.score ?? '').trim(),
        notes: String(row.notes ?? '').trim(),
      };
    });
  }

  if (!incoming.length) {
    return jsonError('Paste at least one row: Pitch ID, Rank, Score, Notes.', 422, 'csv');
  }
  if (incoming.length > 500) {
    return jsonError('Maximum 500 rows per batch.', 422, 'csv');
  }

  const pitches = await store.listPitchDetails({});
  const byCode = new Map<string, (typeof pitches)[number]>();
  for (const pitch of pitches) {
    byCode.set(pitch.code.toUpperCase(), pitch);
    byCode.set(pitch.id.toLowerCase(), pitch);
  }

  const applied: Array<{ pitch: string; rank: number; score: number | null }> = [];
  const errors: Array<{ row: number; message: string }> = [];

  for (let index = 0; index < incoming.length; index += 1) {
    const row = incoming[index];
    const lineNo = index + 1;
    const pitch = byCode.get(row.pitch_code.toUpperCase()) ?? byCode.get(row.pitch_code.toLowerCase());
    if (!pitch) {
      errors.push({ row: lineNo, message: `No pitch found for “${row.pitch_code}” (use the Pitch ID column).` });
      continue;
    }
    const rank = Number(row.rank);
    if (!Number.isFinite(rank) || rank < 1) {
      errors.push({ row: lineNo, message: `Rank “${row.rank}” is not a positive number.` });
      continue;
    }
    const score = row.score === '' ? null : Number(row.score);
    if (score !== null && !Number.isFinite(score)) {
      errors.push({ row: lineNo, message: `Score “${row.score}” is not a number.` });
      continue;
    }

    await store.upsertResult({
      pitch_id: pitch.id,
      rank: Math.round(rank),
      score,
      notes: row.notes || null,
    });
    applied.push({ pitch: pitch.code, rank: Math.round(rank), score });
  }

  return jsonOk({ applied, errors, appliedCount: applied.length, errorCount: errors.length });
}
