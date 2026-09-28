import { supabaseConfigured } from '../config';
import { localStore } from './local';
import { supabaseStore } from './supabase';
import type { Store } from './types';

/**
 * Picks the storage driver at runtime.
 *
 *   SUPABASE_SERVICE_ROLE_KEY present  →  Supabase Postgres + Storage
 *   otherwise                          →  local JSON engine (zero setup)
 *
 * This is what lets the same codebase run instantly in local development and
 * on Vercel against a real database, with no code branches anywhere else.
 */
function select(): Store {
  return supabaseConfigured ? supabaseStore : localStore;
}

let cached: Store | null = null;

export function getStore(): Store {
  if (process.env.NODE_ENV !== 'production') {
    // In dev we re-check on every call so flipping env vars needs no restart.
    return select();
  }
  if (!cached) cached = select();
  return cached;
}

export function storageDriverName(): 'local' | 'supabase' {
  return supabaseConfigured ? 'supabase' : 'local';
}

export type { Store } from './types';
