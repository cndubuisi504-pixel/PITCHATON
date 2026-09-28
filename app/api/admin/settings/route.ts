import type { NextRequest } from 'next/server';

import { jsonError, jsonOk, readJson } from '@/lib/api';
import { apiAdmin } from '@/lib/guards';
import { getStore } from '@/lib/store';
import type { AdminSettingsPatch } from '@/lib/store/types';
import { ValidationError, booleanValue, optionalString } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;
  return jsonOk({ settings: await getStore().getSettings() });
}

/** PATCH /api/admin/settings — deadlines, submission window, publish switch. */
export async function PATCH(request: NextRequest) {
  const guard = await apiAdmin();
  if ('response' in guard) return guard.response;

  const body = await readJson(request);

  /** Accepts ISO strings or `datetime-local` values (interpreted as UTC-naive → ISO). */
  const parseDate = (value: unknown, field: string): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;
    if (typeof value !== 'string') throw new ValidationError(field, 'Enter a valid date and time');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new ValidationError(field, 'Enter a valid date and time');
    return date.toISOString();
  };

  try {
    const patch: AdminSettingsPatch = {};

    const deadline = parseDate(body.submission_deadline, 'submission_deadline');
    if (deadline !== undefined) patch.submission_deadline = deadline;

    const competition = parseDate(body.competition_date, 'competition_date');
    if (competition !== undefined) patch.competition_date = competition;

    if (body.submission_enabled !== undefined) {
      patch.submission_enabled = booleanValue(body.submission_enabled, true);
    }
    if (body.edit_mode_enabled !== undefined) {
      patch.edit_mode_enabled = booleanValue(body.edit_mode_enabled, false);
    }
    if (body.results_published !== undefined) {
      patch.results_published = booleanValue(body.results_published, false);
    }
    if (body.hub_name !== undefined) {
      patch.hub_name =
        optionalString(body.hub_name, 'hub_name', { max: 60, label: 'Hub name' }) ?? 'ICT Hub';
    }
    if (body.institution_name !== undefined) {
      patch.institution_name =
        optionalString(body.institution_name, 'institution_name', {
          max: 120,
          label: 'Institution line',
        }) ?? 'ICT Hub · Enugu, Nigeria';
    }

    if (!Object.keys(patch).length) {
      return jsonError('Nothing to update.', 422);
    }

    const settings = await getStore().updateSettings(patch);
    return jsonOk({ settings });
  } catch (error) {
    if (error instanceof ValidationError) return jsonError(error.message, 422, error.field);
    console.error('[pitchaton:settings]', error);
    return jsonError('Could not save settings.', 500);
  }
}
