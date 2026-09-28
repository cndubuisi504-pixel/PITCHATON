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
  Role,
  UserRecord,
} from '../types';

/**
 * Storage driver contract.
 *
 * Two implementations exist:
 *   • `local.ts`    — zero-setup JSON engine used for local dev & previews
 *   • `supabase.ts` — Postgres + Storage driver for production
 *
 * The rest of the app only ever talks to this interface, so switching
 * infrastructure never touches a page or component.
 */

export interface CreateUserInput {
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
}

export interface CreatePitchInput {
  title: string;
  description: string;
  category: string | null;
  created_by: string;
  founders: Array<Omit<Founder, 'id' | 'pitch_id' | 'created_at'>>;
  editable: boolean;
}

export interface UpdatePitchInput {
  title?: string;
  description?: string;
  category?: string | null;
}

export interface CreateFileInput {
  pitch_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number;
  storage_path: string | null;
}

export interface CreateNewsInput {
  title: string;
  content: string;
  image_url: string | null;
  featured_pitch_id: string | null;
  created_by: string | null;
}

export interface UpsertResultInput {
  pitch_id: string;
  rank: number;
  score: number | null;
  notes: string | null;
}

export interface AdminSettingsPatch {
  submission_deadline?: string | null;
  competition_date?: string | null;
  submission_enabled?: boolean;
  edit_mode_enabled?: boolean;
  results_published?: boolean;
  hub_name?: string;
  institution_name?: string;
}

export interface Store {
  readonly driver: 'local' | 'supabase';

  /* users */
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  countUsers(): Promise<number>;
  /** Used to decide whether an admin bootstrap claim is still available. */
  countAdmins(): Promise<number>;

  /* pitches */
  listPitches(filter?: { created_by?: string; status?: PitchStatus }): Promise<Pitch[]>;
  getPitch(id: string): Promise<Pitch | null>;
  getPitchDetail(id: string): Promise<PitchDetail | null>;
  listPitchDetails(filter?: {
    created_by?: string;
    status?: PitchStatus;
    limit?: number;
  }): Promise<PitchDetail[]>;
  createPitch(input: CreatePitchInput): Promise<Pitch>;
  updatePitch(id: string, patch: UpdatePitchInput): Promise<Pitch>;
  setPitchStatus(id: string, status: PitchStatus): Promise<Pitch>;
  setPitchEditable(id: string, editable: boolean): Promise<Pitch>;
  deletePitch(id: string): Promise<void>;
  pitchSummaries(ids: string[]): Promise<Map<string, PitchSummary>>;

  /* founders */
  replaceFounders(pitchId: string, founders: CreatePitchInput['founders']): Promise<Founder[]>;
  listFounders(pitchId: string): Promise<Founder[]>;

  /* files */
  addFile(input: CreateFileInput): Promise<PitchFile>;
  updateFile(
    id: string,
    patch: Partial<Pick<PitchFile, 'file_url' | 'file_name' | 'file_type' | 'file_size'>>,
  ): Promise<PitchFile>;
  getFile(id: string): Promise<PitchFile | null>;
  listFiles(pitchId: string): Promise<PitchFile[]>;
  deleteFile(id: string): Promise<PitchFile | null>;

  /* results */
  listResults(): Promise<Result[]>;
  getResultForPitch(pitchId: string): Promise<Result | null>;
  upsertResult(input: UpsertResultInput): Promise<Result>;
  deleteResult(pitchId: string): Promise<void>;

  /* news */
  listNews(limit?: number): Promise<HubNews[]>;
  createNews(input: CreateNewsInput): Promise<HubNews>;
  deleteNews(id: string): Promise<void>;

  /* settings */
  getSettings(): Promise<AdminSettings>;
  updateSettings(patch: AdminSettingsPatch): Promise<AdminSettings>;

  /* email log */
  logEmail(entry: Omit<EmailLogEntry, 'id' | 'created_at'>): Promise<EmailLogEntry>;
  listEmails(limit?: number): Promise<EmailLogEntry[]>;
}
