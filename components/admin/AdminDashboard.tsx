'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { FileText, ListChecks, Newspaper, Settings2, Trophy } from 'lucide-react';

import { NewsTab } from '@/components/admin/NewsTab';
import { PitchesTab } from '@/components/admin/PitchesTab';
import { ResultsTab } from '@/components/admin/ResultsTab';
import { SettingsTab } from '@/components/admin/SettingsTab';
import { Alert, Badge, StatTile, Tabs } from '@/components/ui';
import type { AdminSettings, EmailLogEntry, PitchDetail, PitchStatus } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

type TabId = 'pitches' | 'results' | 'news' | 'settings';

export interface AdminDashboardProps {
  user: { full_name: string; email: string };
  settings: AdminSettings;
  pitches: PitchDetail[];
  results: Array<{
    id: string;
    pitch_id: string;
    rank: number;
    score: number | null;
    notes: string | null;
    uploaded_at: string;
    pitch: { id: string; code: string; title: string; category: string | null; status: PitchStatus } | null;
  }>;
  candidates: Array<{
    id: string;
    code: string;
    title: string;
    category: string | null;
    status: PitchStatus;
    result: { rank: number; score: number | null } | null;
  }>;
  posts: Array<{
    id: string;
    title: string;
    content: string;
    image_url: string | null;
    featured_pitch_id: string | null;
    published_at: string;
    featured_pitch: { id: string; code: string; title: string } | null;
  }>;
  health: {
    storage: 'local' | 'supabase';
    database: 'local' | 'supabase';
    email: 'resend' | 'log-only';
    adminCodeConfigured: boolean;
  };
  emailStatus: { emails: EmailLogEntry[]; configured: boolean; from: string; adminInbox: string };
  stats: {
    totalPitches: number;
    teams: number;
    filesStored: number;
    categories: string[];
    users: number;
    resultsEntered: number;
    submissionsThisMonth: number;
    byStatus: Record<string, number>;
  };
  categories: string[];
}

/**
 * Admin console.
 * Four tabs — Pitches, Results, News, Settings — with counters that stay
 * accurate by re-fetching the server payload after every mutation.
 */
export function AdminDashboard(props: AdminDashboardProps) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('pitches');

  const onChanged = useCallback(() => router.refresh(), [router]);
  const { stats, settings } = props;

  const pendingReview = (stats.byStatus.submitted ?? 0) + (stats.byStatus.under_review ?? 0);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow">Admin console</p>
          <h1 className="mt-3 text-3xl sm:text-4xl">Run the semester</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute-400">
            Signed in as {props.user.full_name} ({props.user.email}). Everything below is live — changes
            hit the public site immediately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={settings.submission_enabled ? 'lime' : 'neutral'}>
            Submissions {settings.submission_enabled ? 'open' : 'closed'}
          </Badge>
          <Badge tone={settings.results_published ? 'lime' : 'neutral'}>
            Leaderboard {settings.results_published ? 'live' : 'hidden'}
          </Badge>
          <Badge tone={settings.edit_mode_enabled ? 'info' : 'neutral'}>
            Edits {settings.edit_mode_enabled ? 'open' : 'closed'}
          </Badge>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Submissions"
          value={stats.totalPitches}
          hint={`${stats.submissionsThisMonth} this month`}
          icon={<FileText className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Awaiting triage"
          value={pendingReview}
          hint={pendingReview ? 'Submitted or under review' : 'Inbox is clear'}
          tone={pendingReview ? 'lime' : 'default'}
          icon={<ListChecks className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Founders"
          value={stats.teams}
          hint={`${stats.users} account${stats.users === 1 ? '' : 's'} · ${stats.filesStored} file(s)`}
          icon={<Trophy className="h-4 w-4" aria-hidden />}
        />
        <StatTile
          label="Results recorded"
          value={stats.resultsEntered}
          hint={settings.results_published ? 'Published publicly' : 'Not published yet'}
          tone={settings.results_published ? 'lime' : 'default'}
          icon={<Trophy className="h-4 w-4" aria-hidden />}
        />
      </section>

      {settings.submission_deadline && (
        <Alert tone="info">
          Submission deadline: <span className="text-white">{formatDateTime(settings.submission_deadline)}</span>
          {settings.competition_date && (
            <>
              {' '}· Competition day:{' '}
              <span className="text-white">{formatDateTime(settings.competition_date)}</span>
            </>
          )}
        </Alert>
      )}

      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'pitches', label: 'Pitches', count: stats.totalPitches, icon: <FileText className="h-4 w-4" aria-hidden /> },
          { id: 'results', label: 'Results', count: stats.resultsEntered, icon: <Trophy className="h-4 w-4" aria-hidden /> },
          { id: 'news', label: 'News', count: props.posts.length, icon: <Newspaper className="h-4 w-4" aria-hidden /> },
          { id: 'settings', label: 'Settings', icon: <Settings2 className="h-4 w-4" aria-hidden /> },
        ]}
      />

      <div role="tabpanel" aria-label={tab}>
        {tab === 'pitches' && <PitchesTab pitches={props.pitches} onChanged={onChanged} />}
        {tab === 'results' && (
          <ResultsTab
            results={props.results}
            candidates={props.candidates}
            settings={settings}
            onChanged={onChanged}
          />
        )}
        {tab === 'news' && <NewsTab posts={props.posts} pitches={props.candidates} onChanged={onChanged} />}
        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            health={props.health}
            emailStatus={props.emailStatus}
            onChanged={onChanged}
          />
        )}
      </div>
    </div>
  );
}
