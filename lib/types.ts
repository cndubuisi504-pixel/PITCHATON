/**
 * PITCHATON domain model.
 *
 * These types are the contract between the UI, the API routes and the two
 * storage drivers (local JSON engine for dev/preview, Supabase Postgres for
 * production). Column names mirror `supabase-schema.sql` exactly so a driver
 * swap is invisible to the rest of the app.
 */

export type Role = 'founder' | 'admin';

export const PITCH_STATUSES = [
  'submitted',
  'under_review',
  'accepted',
  'finalist',
  'winner',
  'rejected',
] as const;

export type PitchStatus = (typeof PITCH_STATUSES)[number];

/** Shape stored in the database (contains the password hash — never send to a client). */
export interface UserRecord {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: Role;
  created_at: string;
}

/** Safe projection of a user that can be rendered / serialised. */
export interface PublicUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Pitch {
  id: string;
  /** Human readable Pitch ID used in tables, CSV exports and result uploads. */
  code: string;
  title: string;
  description: string;
  category: string | null;
  status: PitchStatus;
  /** Toggled by an admin to open a submission for founder edits. */
  editable: boolean;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface Founder {
  id: string;
  pitch_id: string;
  name: string;
  email: string;
  phone: string | null;
  school_year: string | null;
  created_at: string;
}

export interface PitchFile {
  id: string;
  pitch_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
  /** Supabase Storage object path (null for the local disk driver). */
  storage_path: string | null;
}

export interface Result {
  id: string;
  pitch_id: string;
  rank: number;
  score: number | null;
  notes: string | null;
  uploaded_at: string;
}

export interface HubNews {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  featured_pitch_id: string | null;
  published_at: string;
  created_by: string | null;
}

export interface AdminSettings {
  id: string;
  submission_deadline: string | null;
  competition_date: string | null;
  submission_enabled: boolean;
  edit_mode_enabled: boolean;
  results_published: boolean;
  updated_at: string;
  /** Displayed in the site header / footer; editable from the Settings tab. */
  hub_name: string;
  institution_name: string;
}

export interface EmailLogEntry {
  id: string;
  to_email: string;
  subject: string;
  body: string;
  kind: 'submission' | 'status' | 'spotlight' | 'test' | 'system';
  status: 'sent' | 'queued' | 'failed';
  error: string | null;
  created_at: string;
}

/** A pitch with everything the UI needs, assembled by the store. */
export interface PitchDetail extends Pitch {
  founders: Founder[];
  files: PitchFile[];
  result: Result | null;
  owner: PublicUser | null;
}

/** Lightweight projection used for leaderboards and news cross-links. */
export interface PitchSummary {
  id: string;
  code: string;
  title: string;
  category: string | null;
  status: PitchStatus;
}

export interface LeaderboardRow {
  rank: number;
  score: number | null;
  notes: string | null;
  pitch: PitchSummary;
  team: string[];
}

export interface NewsWithPitch extends HubNews {
  featured_pitch: PitchSummary | null;
}

export interface SessionUser extends PublicUser {}
