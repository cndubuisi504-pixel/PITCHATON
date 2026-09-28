import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';

import { PitchForm } from '@/components/pitch/PitchForm';
import { Alert, LinkButton } from '@/components/ui';
import { requireUser } from '@/lib/guards';
import { getHubStats } from '@/lib/queries';
import { getStore } from '@/lib/store';
import { formatDate, isPitchEditable } from '@/lib/utils';

export const metadata: Metadata = { title: 'Edit pitch' };
export const dynamic = 'force-dynamic';

export default async function EditPitchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/submit-pitch/${id}/edit`);

  const store = getStore();
  const [pitch, settings, stats] = await Promise.all([
    store.getPitchDetail(id),
    store.getSettings(),
    getHubStats(),
  ]);

  if (!pitch) notFound();
  if (user.role !== 'admin' && pitch.created_by !== user.id) {
    redirect('/dashboard?denied=admin');
  }

  const editable = user.role === 'admin' || isPitchEditable(pitch, settings);

  return (
    <div className="shell py-10 lg:py-14">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-mute-400 transition hover:text-lime">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to dashboard
      </Link>

      <header className="mt-6">
        <p className="eyebrow">Editing {pitch.code}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">{pitch.title}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute-400">
          Submitted {formatDate(pitch.created_at)} · last updated {formatDate(pitch.updated_at)}.
          {editable
            ? ' Changes are live as soon as you save.'
            : ' The Hub has locked this submission — nothing can be changed right now.'}
        </p>
      </header>

      {!editable && (
        <div className="mt-6 max-w-4xl">
          <Alert
            tone="warning"
            title="This submission is locked"
            action={
              <span className="inline-flex items-center gap-1.5 text-xs text-mute-400">
                <Lock className="h-3.5 w-3.5" aria-hidden /> read-only
              </span>
            }
          >
            Reviewers are working from the version you submitted. Ask the Hub team to reopen it if you
            need to change something important.
          </Alert>
        </div>
      )}

      <div className="mt-8 max-w-4xl">
        <PitchForm
          mode="edit"
          user={user}
          initial={pitch}
          categories={stats.categories}
          editingAllowed={editable}
        />
      </div>

      <div className="mt-6 max-w-4xl">
        <LinkButton href="/dashboard" variant="ghost" size="sm">
          Done — back to dashboard
        </LinkButton>
      </div>
    </div>
  );
}
