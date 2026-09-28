import { NextResponse, type NextRequest } from 'next/server';

import { jsonError } from '@/lib/api';
import { getCurrentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { STATUS_META, toCsv } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/pitches/export — CSV of pitches + founders + results.
 * Admins export everything; a founder can export their own submissions.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return jsonError('Sign in to export data.', 401);

  const scope = new URL(request.url).searchParams.get('scope') ?? 'all';
  const store = getStore();

  const pitches = await store.listPitchDetails(
    user.role === 'admin' && scope === 'all' ? {} : { created_by: user.id },
  );

  const rows: Array<Array<unknown>> = [
    [
      'Pitch ID',
      'Title',
      'Category',
      'Status',
      'Team size',
      'Founders',
      'Founder emails',
      'Phones',
      'Year/level',
      'Files',
      'Submitted',
      'Last updated',
      'Rank',
      'Score',
      'Result notes',
      'Submitted by',
    ],
  ];

  for (const pitch of pitches) {
    rows.push([
      pitch.code,
      pitch.title,
      pitch.category ?? '',
      STATUS_META[pitch.status]?.label ?? pitch.status,
      pitch.founders.length,
      pitch.founders.map((founder) => founder.name).join(' | '),
      pitch.founders.map((founder) => founder.email).join(' | '),
      pitch.founders.map((founder) => founder.phone ?? '').join(' | '),
      pitch.founders.map((founder) => founder.school_year ?? '').join(' | '),
      pitch.files.length,
      pitch.created_at,
      pitch.updated_at,
      pitch.result?.rank ?? '',
      pitch.result?.score ?? '',
      pitch.result?.notes ?? '',
      pitch.owner?.email ?? '',
    ]);
  }

  const csv = toCsv(rows);
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pitchaton-export-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
