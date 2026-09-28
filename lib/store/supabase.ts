import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { config } from '../config';
import type {
  AdminSettings,
  EmailLogEntry,
  Founder,
  HubNews,
  Pitch,
  PitchDetail,
  PitchFile,
  PitchStatus,
  PitchSummary,
  PublicUser,
  Result,
  UserRecord,
} from '../types';
import type {
  AdminSettingsPatch,
  CreateFileInput,
  CreateNewsInput,
  CreatePitchInput,
  CreateUserInput,
  Store,
  UpdatePitchInput,
  UpsertResultInput,
} from './types';

/**
 * Production driver: Supabase (Postgres + Storage) over the service-role key.
 *
 * Every call runs server-side only. Row Level Security is enabled in
 * `supabase-schema.sql` so that even if the anon key ever leaked, the browser
 * still could not read another founder's pitch — the API routes are the only
 * path to data, and they enforce ownership + role checks themselves.
 */

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!config.supabase.url || !config.supabase.serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or unset them to use the local driver.',
    );
  }
  if (!client) {
    client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

async function unwrap<T>(promise: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await promise;
  if (error) {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: unknown }).message)
        : 'Database error';
    throw new Error(message);
  }
  return (data ?? ([] as unknown as T)) as T;
}

function toPublicUser(user: UserRecord | null): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    created_at: user.created_at,
  };
}

async function nextPitchCode(): Promise<string> {
  const rows = await unwrap<Array<{ code: string | null }>>(
    db().from('pitches').select('code'),
  );
  let max = 0;
  for (const row of rows ?? []) {
    const match = /^PCH-(\d+)$/.exec(row.code ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PCH-${String(max + 1).padStart(4, '0')}`;
}

export const supabaseStore: Store = {
  driver: 'supabase',

  /* ---------------- users ---------------- */

  async findUserByEmail(email) {
    const { data, error } = await db()
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as UserRecord) ?? null;
  },

  async findUserById(id) {
    const { data, error } = await db().from('users').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as UserRecord) ?? null;
  },

  async createUser(input: CreateUserInput) {
    const { data, error } = await db()
      .from('users')
      .insert({
        email: input.email.toLowerCase(),
        password_hash: input.password_hash,
        full_name: input.full_name,
        role: input.role,
      })
      .select('*')
      .single();
    if (error) {
      if (error.code === '23505' || /duplicate/i.test(error.message)) {
        throw new Error('An account with this email already exists');
      }
      throw new Error(error.message);
    }
    return data as UserRecord;
  },

  async countUsers() {
    const { count, error } = await db().from('users').select('id', { count: 'exact' }).limit(1);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  async countAdmins() {
    const { count, error } = await db()
      .from('users')
      .select('id', { count: 'exact' })
      .eq('role', 'admin')
      .limit(1);
    if (error) throw new Error(error.message);
    return count ?? 0;
  },

  /* ---------------- pitches ---------------- */

  async listPitches(filter = {}) {
    let query = db().from('pitches').select('*').order('created_at', { ascending: false });
    if (filter.created_by) query = query.eq('created_by', filter.created_by);
    if (filter.status) query = query.eq('status', filter.status);
    return unwrap<Pitch[]>(query as unknown as PromiseLike<{ data: Pitch[] | null; error: unknown }>);
  },

  async getPitch(id) {
    const { data, error } = await db().from('pitches').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Pitch) ?? null;
  },

  async getPitchDetail(id) {
    const details = await supabaseStore.listPitchDetails({ limit: 1, created_by: undefined });
    const match = details.find((item) => item.id === id);
    if (match) return match;
    const pitch = await supabaseStore.getPitch(id);
    if (!pitch) return null;
    const [founders, files, result, owner] = await Promise.all([
      supabaseStore.listFounders(id),
      supabaseStore.listFiles(id),
      supabaseStore.getResultForPitch(id),
      supabaseStore.findUserById(pitch.created_by),
    ]);
    return { ...pitch, founders, files, result, owner: toPublicUser(owner) };
  },

  async listPitchDetails(filter = {}) {
    let query = db()
      .from('pitches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filter.limit ?? 500);
    if (filter.created_by) query = query.eq('created_by', filter.created_by);
    if (filter.status) query = query.eq('status', filter.status);

    const pitches = await unwrap<Pitch[]>(
      query as unknown as PromiseLike<{ data: Pitch[] | null; error: unknown }>,
    );
    if (!pitches?.length) return [];

    const ids = pitches.map((pitch) => pitch.id);
    const [founders, files, results, users] = await Promise.all([
      unwrap<Founder[]>(db().from('founders').select('*').in('pitch_id', ids)),
      unwrap<PitchFile[]>(db().from('files').select('*').in('pitch_id', ids)),
      unwrap<Result[]>(db().from('results').select('*').in('pitch_id', ids)),
      unwrap<UserRecord[]>(
        db()
          .from('users')
          .select('*')
          .in('id', Array.from(new Set(pitches.map((pitch) => pitch.created_by)))),
      ),
    ]);

    return pitches.map<PitchDetail>((pitch) => ({
      ...pitch,
      founders: (founders ?? []).filter((founder) => founder.pitch_id === pitch.id),
      files: (files ?? []).filter((file) => file.pitch_id === pitch.id),
      result: (results ?? []).find((result) => result.pitch_id === pitch.id) ?? null,
      owner: toPublicUser((users ?? []).find((user) => user.id === pitch.created_by) ?? null),
    }));
  },

  async createPitch(input: CreatePitchInput) {
    const code = await nextPitchCode();
    const { data, error } = await db()
      .from('pitches')
      .insert({
        code,
        title: input.title,
        description: input.description,
        category: input.category,
        status: 'submitted',
        editable: input.editable,
        created_by: input.created_by,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    const pitch = data as Pitch;

    if (input.founders.length) {
      const { error: founderError } = await db()
        .from('founders')
        .insert(input.founders.map((founder) => ({ ...founder, pitch_id: pitch.id })));
      if (founderError) {
        // Roll back so we never persist a pitch without its team.
        await db().from('pitches').delete().eq('id', pitch.id);
        throw new Error(founderError.message);
      }
    }
    return pitch;
  },

  async updatePitch(id, patch: UpdatePitchInput) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) payload.title = patch.title;
    if (patch.description !== undefined) payload.description = patch.description;
    if (patch.category !== undefined) payload.category = patch.category;
    const { data, error } = await db()
      .from('pitches')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Pitch;
  },

  async setPitchStatus(id, status: PitchStatus) {
    const { data, error } = await db()
      .from('pitches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Pitch;
  },

  async setPitchEditable(id, editable) {
    const { data, error } = await db()
      .from('pitches')
      .update({ editable, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Pitch;
  },

  async deletePitch(id) {
    // Child rows cascade via foreign keys.
    const { error } = await db().from('pitches').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async pitchSummaries(ids) {
    const map = new Map<string, PitchSummary>();
    if (!ids.length) return map;
    const rows = await unwrap<Pitch[]>(db().from('pitches').select('*').in('id', ids));
    for (const pitch of rows ?? []) {
      map.set(pitch.id, {
        id: pitch.id,
        code: pitch.code,
        title: pitch.title,
        category: pitch.category,
        status: pitch.status,
      });
    }
    return map;
  },

  /* ---------------- founders ---------------- */

  async replaceFounders(pitchId, founders) {
    const { error: deleteError } = await db().from('founders').delete().eq('pitch_id', pitchId);
    if (deleteError) throw new Error(deleteError.message);
    if (!founders.length) return [];
    return unwrap<Founder[]>(
      db()
        .from('founders')
        .insert(founders.map((founder) => ({ ...founder, pitch_id: pitchId })))
        .select('*'),
    );
  },

  async listFounders(pitchId) {
    return unwrap<Founder[]>(db().from('founders').select('*').eq('pitch_id', pitchId));
  },

  /* ---------------- files ---------------- */

  async addFile(input: CreateFileInput) {
    const { data, error } = await db()
      .from('files')
      .insert({
        pitch_id: input.pitch_id,
        file_name: input.file_name,
        file_url: input.file_url,
        file_type: input.file_type,
        file_size: input.file_size,
        storage_path: input.storage_path,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as PitchFile;
  },

  async updateFile(id, patch) {
    const { data, error } = await db()
      .from('files')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as PitchFile;
  },

  async getFile(id) {
    const { data, error } = await db().from('files').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as PitchFile) ?? null;
  },

  async listFiles(pitchId) {
    return unwrap<PitchFile[]>(db().from('files').select('*').eq('pitch_id', pitchId));
  },

  async deleteFile(id) {
    const { data, error } = await db().from('files').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(error.message);
    const file = (data as PitchFile) ?? null;
    if (file?.storage_path) {
      await db().storage.from(config.supabase.bucket).remove([file.storage_path]);
    }
    if (file) {
      const { error: deleteError } = await db().from('files').delete().eq('id', id);
      if (deleteError) throw new Error(deleteError.message);
    }
    return file;
  },

  /* ---------------- results ---------------- */

  async listResults() {
    const rows = await unwrap<Result[]>(db().from('results').select('*'));
    return (rows ?? []).sort((a, b) => a.rank - b.rank);
  },

  async getResultForPitch(pitchId) {
    const { data, error } = await db()
      .from('results')
      .select('*')
      .eq('pitch_id', pitchId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as Result) ?? null;
  },

  async upsertResult(input: UpsertResultInput) {
    const { data, error } = await db()
      .from('results')
      .upsert(
        {
          pitch_id: input.pitch_id,
          rank: input.rank,
          score: input.score,
          notes: input.notes,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: 'pitch_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as Result;
  },

  async deleteResult(pitchId) {
    const { error } = await db().from('results').delete().eq('pitch_id', pitchId);
    if (error) throw new Error(error.message);
  },

  /* ---------------- news ---------------- */

  async listNews(limit = 50) {
    return unwrap<HubNews[]>(
      db()
        .from('hub_news')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(limit),
    );
  },

  async createNews(input: CreateNewsInput) {
    const { data, error } = await db()
      .from('hub_news')
      .insert({
        title: input.title,
        content: input.content,
        image_url: input.image_url,
        featured_pitch_id: input.featured_pitch_id,
        created_by: input.created_by,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as HubNews;
  },

  async deleteNews(id) {
    const { error } = await db().from('hub_news').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  /* ---------------- settings ---------------- */

  async getSettings() {
    const { data, error } = await db()
      .from('admin_settings')
      .select('*')
      .eq('id', 'singleton')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as AdminSettings;

    const { data: created, error: createError } = await db()
      .from('admin_settings')
      .insert({ id: 'singleton' })
      .select('*')
      .single();
    if (createError) throw new Error(createError.message);
    return created as AdminSettings;
  },

  async updateSettings(patch: AdminSettingsPatch) {
    await supabaseStore.getSettings(); // guarantees the singleton row exists
    const { data, error } = await db()
      .from('admin_settings')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 'singleton')
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as AdminSettings;
  },

  /* ---------------- email log ---------------- */

  async logEmail(entry) {
    const { data, error } = await db()
      .from('email_log')
      .insert({
        to_email: entry.to_email,
        subject: entry.subject,
        body: entry.body,
        kind: entry.kind,
        status: entry.status,
        error: entry.error,
      })
      .select('*')
      .single();
    if (error) {
      console.warn('[pitchaton] could not write email log:', error.message);
      return {
        id: 'unlogged',
        ...entry,
        created_at: new Date().toISOString(),
      } as EmailLogEntry;
    }
    return data as EmailLogEntry;
  },

  async listEmails(limit = 100) {
    return unwrap<EmailLogEntry[]>(
      db().from('email_log').select('*').order('created_at', { ascending: false }).limit(limit),
    );
  },
};
