import 'server-only';

import { getStore } from './store';
import type { AdminSettings, LeaderboardRow, NewsWithPitch, PitchDetail, PitchSummary } from './types';
import { sortByRank } from './utils';

/**
 * Public read models shared by pages and API routes.
 * Nothing here is secret: results are gated on `results_published` inside the
 * query itself so an unpublished board can never leak through a page or an API.
 */

export async function getLeaderboard(): Promise<{
  settings: AdminSettings;
  rows: LeaderboardRow[];
}> {
  const store = getStore();
  const settings = await store.getSettings();
  if (!settings.results_published) return { settings, rows: [] };

  const results = await store.listResults();
  if (!results.length) return { settings, rows: [] };

  const pitchIds = results.map((result) => result.pitch_id);
  const summaries = await store.pitchSummaries(pitchIds);

  const rows: LeaderboardRow[] = [];
  for (const result of sortByRank(results)) {
    const pitch = summaries.get(result.pitch_id);
    if (!pitch) continue;
    const founders = await store.listFounders(result.pitch_id);
    rows.push({
      rank: result.rank,
      score: result.score,
      notes: result.notes,
      pitch,
      team: founders.map((founder) => founder.name),
    });
  }

  return { settings, rows };
}

export async function getNewsFeed(limit = 30): Promise<NewsWithPitch[]> {
  const store = getStore();
  const posts = await store.listNews(limit);
  const featuredIds = posts
    .map((post) => post.featured_pitch_id)
    .filter((id): id is string => Boolean(id));
  const summaries = featuredIds.length ? await store.pitchSummaries(featuredIds) : new Map();

  return posts.map((post) => ({
    ...post,
    featured_pitch: post.featured_pitch_id
      ? (summaries.get(post.featured_pitch_id) as PitchSummary | undefined) ?? null
      : null,
  }));
}

/** Public-safe pitch projection used by news/leaderboard cross-links. */
export function toPitchSummary(pitch: PitchDetail): PitchSummary {
  return {
    id: pitch.id,
    code: pitch.code,
    title: pitch.title,
    category: pitch.category,
    status: pitch.status,
  };
}

export interface HubStats {
  totalPitches: number;
  byStatus: Record<string, number>;
  categories: string[];
  teams: number;
  filesStored: number;
  submissionsThisMonth: number;
}

export async function getHubStats(): Promise<HubStats> {
  const store = getStore();
  const pitches = await store.listPitchDetails({ limit: 1000 });

  const byStatus: Record<string, number> = {};
  const categories = new Set<string>();
  let teams = 0;
  let filesStored = 0;
  let submissionsThisMonth = 0;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  for (const pitch of pitches) {
    byStatus[pitch.status] = (byStatus[pitch.status] ?? 0) + 1;
    if (pitch.category) categories.add(pitch.category);
    teams += pitch.founders.length;
    filesStored += pitch.files.length;
    if (new Date(pitch.created_at).getTime() >= monthStart.getTime()) submissionsThisMonth += 1;
  }

  return {
    totalPitches: pitches.length,
    byStatus,
    categories: Array.from(categories).sort(),
    teams,
    filesStored,
    submissionsThisMonth,
  };
}
