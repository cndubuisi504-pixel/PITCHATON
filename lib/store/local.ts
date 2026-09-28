import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

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
 * Zero-setup local storage driver.
 *
 * Everything lives in a single JSON document (`.data/db.json`) behind an
 * in-process write queue, which is plenty for the 100-ish submissions and
 * handful of admin writes a semester produces. Uploaded files land in
 * `.data/uploads/` and are streamed back through `/api/files/[id]`.
 *
 * This is what makes `npm run dev` work with *no* environment variables and
 * what powers the hosted preview. Production uses the Supabase driver.
 */

const DATA_DIR = process.env.PITCHATON_DATA_DIR
  ? path.resolve(process.env.PITCHATON_DATA_DIR)
  : path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
export const LOCAL_UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

interface DbShape {
  version: number;
  users: UserRecord[];
  pitches: Pitch[];
  founders: Founder[];
  files: PitchFile[];
  results: Result[];
  news: HubNews[];
  emails: EmailLogEntry[];
  settings: AdminSettings;
}

const DEFAULT_SETTINGS: AdminSettings = {
  id: 'singleton',
  submission_deadline: null,
  competition_date: null,
  submission_enabled: true,
  edit_mode_enabled: false,
  results_published: false,
  updated_at: new Date().toISOString(),
  hub_name: 'ICT Hub',
  institution_name: 'ICT Hub · Enugu, Nigeria',
};

function emptyDb(): DbShape {
  return {
    version: 1,
    users: [],
    pitches: [],
    founders: [],
    files: [],
    results: [],
    news: [],
    emails: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/* ------------------------------------------------------------------ *
 * Read / write primitives with an in-process mutex
 * ------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();

/** Serialises async work so concurrent requests never interleave writes. */
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function readDb(): Promise<DbShape> {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DbShape>;
    const base = emptyDb();
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings ?? {}) },
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyDb();
    // A corrupt file should not take the whole platform down.
    console.error('[pitchaton] local db unreadable, starting fresh:', error);
    return emptyDb();
  }
}

async function writeDb(db: DbShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

async function mutate<T>(task: (db: DbShape) => T | Promise<T>): Promise<T> {
  return withLock(async () => {
    const db = await readDb();
    const output = await task(db);
    await writeDb(db);
    return output;
  });
}

/* ------------------------------------------------------------------ *
 * Pitch helpers
 * ------------------------------------------------------------------ */

/** Sequential, human-friendly pitch code: PCH-0001, PCH-0002 … */
function nextPitchCode(db: DbShape): string {
  let max = 0;
  for (const pitch of db.pitches) {
    const match = /^PCH-(\d+)$/.exec(pitch.code ?? '');
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `PCH-${String(max + 1).padStart(4, '0')}`;
}

function detail(db: DbShape, pitch: Pitch): PitchDetail {
  const owner = db.users.find((user) => user.id === pitch.created_by) ?? null;
  return {
    ...pitch,
    founders: db.founders
      .filter((founder) => founder.pitch_id === pitch.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    files: db.files
      .filter((file) => file.pitch_id === pitch.id)
      .sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at)),
    result: db.results.find((result) => result.pitch_id === pitch.id) ?? null,
    owner: owner
      ? {
          id: owner.id,
          email: owner.email,
          full_name: owner.full_name,
          role: owner.role,
          created_at: owner.created_at,
        }
      : null,
  };
}

/* ------------------------------------------------------------------ *
 * Driver
 * ------------------------------------------------------------------ */

export const localStore: Store = {
  driver: 'local',

  /* ---------------- users ---------------- */

  async findUserByEmail(email) {
    return withLock(async () => {
      const db = await readDb();
      return db.users.find((user) => user.email === email.toLowerCase()) ?? null;
    });
  },

  async findUserById(id) {
    return withLock(async () => {
      const db = await readDb();
      return db.users.find((user) => user.id === id) ?? null;
    });
  },

  async createUser(input: CreateUserInput) {
    return mutate((db) => {
      const exists = db.users.some((user) => user.email === input.email.toLowerCase());
      if (exists) throw new Error('An account with this email already exists');
      const user: UserRecord = {
        id: newId(),
        email: input.email.toLowerCase(),
        password_hash: input.password_hash,
        full_name: input.full_name,
        role: input.role,
        created_at: nowIso(),
      };
      db.users.push(user);
      return user;
    });
  },

  async countUsers() {
    return withLock(async () => {
      const db = await readDb();
      return db.users.length;
    });
  },

  async countAdmins() {
    return withLock(async () => {
      const db = await readDb();
      return db.users.filter((user) => user.role === 'admin').length;
    });
  },

  /* ---------------- pitches ---------------- */

  async listPitches(filter = {}) {
    return withLock(async () => {
      const db = await readDb();
      return db.pitches
        .filter((pitch) => (filter.created_by ? pitch.created_by === filter.created_by : true))
        .filter((pitch) => (filter.status ? pitch.status === filter.status : true))
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
    });
  },

  async getPitch(id) {
    return withLock(async () => {
      const db = await readDb();
      return db.pitches.find((pitch) => pitch.id === id) ?? null;
    });
  },

  async getPitchDetail(id) {
    return withLock(async () => {
      const db = await readDb();
      const pitch = db.pitches.find((item) => item.id === id);
      return pitch ? detail(db, pitch) : null;
    });
  },

  async listPitchDetails(filter = {}) {
    return withLock(async () => {
      const db = await readDb();
      const items = db.pitches
        .filter((pitch) => (filter.created_by ? pitch.created_by === filter.created_by : true))
        .filter((pitch) => (filter.status ? pitch.status === filter.status : true))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, filter.limit ?? 500)
        .map((pitch) => detail(db, pitch));
      return items;
    });
  },

  async createPitch(input: CreatePitchInput) {
    return mutate((db) => {
      const timestamp = nowIso();
      const pitch: Pitch = {
        id: newId(),
        code: nextPitchCode(db),
        title: input.title,
        description: input.description,
        category: input.category,
        status: 'submitted',
        editable: input.editable,
        created_at: timestamp,
        updated_at: timestamp,
        created_by: input.created_by,
      };
      db.pitches.push(pitch);
      for (const founder of input.founders) {
        db.founders.push({
          id: newId(),
          pitch_id: pitch.id,
          name: founder.name,
          email: founder.email,
          phone: founder.phone,
          school_year: founder.school_year,
          created_at: timestamp,
        });
      }
      return pitch;
    });
  },

  async updatePitch(id, patch: UpdatePitchInput) {
    return mutate((db) => {
      const pitch = db.pitches.find((item) => item.id === id);
      if (!pitch) throw new Error('Pitch not found');
      if (patch.title !== undefined) pitch.title = patch.title;
      if (patch.description !== undefined) pitch.description = patch.description;
      if (patch.category !== undefined) pitch.category = patch.category;
      pitch.updated_at = nowIso();
      return pitch;
    });
  },

  async setPitchStatus(id, status: PitchStatus) {
    return mutate((db) => {
      const pitch = db.pitches.find((item) => item.id === id);
      if (!pitch) throw new Error('Pitch not found');
      pitch.status = status;
      pitch.updated_at = nowIso();
      return pitch;
    });
  },

  async setPitchEditable(id, editable) {
    return mutate((db) => {
      const pitch = db.pitches.find((item) => item.id === id);
      if (!pitch) throw new Error('Pitch not found');
      pitch.editable = editable;
      pitch.updated_at = nowIso();
      return pitch;
    });
  },

  async deletePitch(id) {
    return mutate((db) => {
      db.pitches = db.pitches.filter((pitch) => pitch.id !== id);
      db.founders = db.founders.filter((founder) => founder.pitch_id !== id);
      db.files = db.files.filter((file) => file.pitch_id !== id);
      db.results = db.results.filter((result) => result.pitch_id !== id);
      db.news = db.news.map((post) =>
        post.featured_pitch_id === id ? { ...post, featured_pitch_id: null } : post,
      );
    });
  },

  async pitchSummaries(ids) {
    return withLock(async () => {
      const db = await readDb();
      const set = new Set(ids);
      const map = new Map<string, PitchSummary>();
      for (const pitch of db.pitches) {
        if (!set.has(pitch.id)) continue;
        map.set(pitch.id, {
          id: pitch.id,
          code: pitch.code,
          title: pitch.title,
          category: pitch.category,
          status: pitch.status,
        });
      }
      return map;
    });
  },

  /* ---------------- founders ---------------- */

  async replaceFounders(pitchId, founders) {
    return mutate((db) => {
      db.founders = db.founders.filter((founder) => founder.pitch_id !== pitchId);
      const timestamp = nowIso();
      const created = founders.map((founder) => {
        const row: Founder = {
          id: newId(),
          pitch_id: pitchId,
          name: founder.name,
          email: founder.email,
          phone: founder.phone,
          school_year: founder.school_year,
          created_at: timestamp,
        };
        db.founders.push(row);
        return row;
      });
      return created;
    });
  },

  async listFounders(pitchId) {
    return withLock(async () => {
      const db = await readDb();
      return db.founders.filter((founder) => founder.pitch_id === pitchId);
    });
  },

  /* ---------------- files ---------------- */

  async addFile(input: CreateFileInput) {
    return mutate((db) => {
      const file: PitchFile = { ...input, id: newId(), uploaded_at: nowIso() };
      db.files.push(file);
      return file;
    });
  },

  async updateFile(id, patch) {
    return mutate((db) => {
      const file = db.files.find((item) => item.id === id);
      if (!file) throw new Error('File not found');
      Object.assign(file, patch);
      return file;
    });
  },

  async getFile(id) {
    return withLock(async () => {
      const db = await readDb();
      return db.files.find((item) => item.id === id) ?? null;
    });
  },

  async listFiles(pitchId) {
    return withLock(async () => {
      const db = await readDb();
      return db.files.filter((file) => file.pitch_id === pitchId);
    });
  },

  async deleteFile(id) {
    return mutate((db) => {
      const file = db.files.find((item) => item.id === id) ?? null;
      db.files = db.files.filter((item) => item.id !== id);
      return file;
    });
  },

  /* ---------------- results ---------------- */

  async listResults() {
    return withLock(async () => {
      const db = await readDb();
      return [...db.results].sort((a, b) => a.rank - b.rank);
    });
  },

  async getResultForPitch(pitchId) {
    return withLock(async () => {
      const db = await readDb();
      return db.results.find((result) => result.pitch_id === pitchId) ?? null;
    });
  },

  async upsertResult(input: UpsertResultInput) {
    return mutate((db) => {
      const existing = db.results.find((result) => result.pitch_id === input.pitch_id);
      if (existing) {
        existing.rank = input.rank;
        existing.score = input.score;
        existing.notes = input.notes;
        existing.uploaded_at = nowIso();
        return existing;
      }
      const result: Result = {
        id: newId(),
        pitch_id: input.pitch_id,
        rank: input.rank,
        score: input.score,
        notes: input.notes,
        uploaded_at: nowIso(),
      };
      db.results.push(result);
      return result;
    });
  },

  async deleteResult(pitchId) {
    return mutate((db) => {
      db.results = db.results.filter((result) => result.pitch_id !== pitchId);
    });
  },

  /* ---------------- news ---------------- */

  async listNews(limit = 50) {
    return withLock(async () => {
      const db = await readDb();
      return [...db.news]
        .sort((a, b) => b.published_at.localeCompare(a.published_at))
        .slice(0, limit);
    });
  },

  async createNews(input: CreateNewsInput) {
    return mutate((db) => {
      const post: HubNews = {
        id: newId(),
        title: input.title,
        content: input.content,
        image_url: input.image_url,
        featured_pitch_id: input.featured_pitch_id,
        published_at: nowIso(),
        created_by: input.created_by,
      };
      db.news.push(post);
      return post;
    });
  },

  async deleteNews(id) {
    return mutate((db) => {
      db.news = db.news.filter((post) => post.id !== id);
    });
  },

  /* ---------------- settings ---------------- */

  async getSettings() {
    return withLock(async () => {
      const db = await readDb();
      return db.settings;
    });
  },

  async updateSettings(patch: AdminSettingsPatch) {
    return mutate((db) => {
      db.settings = {
        ...db.settings,
        ...patch,
        id: 'singleton',
        updated_at: nowIso(),
      };
      return db.settings;
    });
  },

  /* ---------------- email log ---------------- */

  async logEmail(entry) {
    return mutate((db) => {
      const row: EmailLogEntry = { ...entry, id: newId(), created_at: nowIso() };
      db.emails.unshift(row);
      // Keep the log bounded.
      db.emails = db.emails.slice(0, 300);
      return row;
    });
  },

  async listEmails(limit = 100) {
    return withLock(async () => {
      const db = await readDb();
      return db.emails.slice(0, limit);
    });
  },
};

export const localPaths = { DATA_DIR, DB_PATH, UPLOAD_DIR: LOCAL_UPLOAD_DIR };
