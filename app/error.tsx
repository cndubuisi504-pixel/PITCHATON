'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

import { Button, LinkButton } from '@/components/ui';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[pitchaton] render error:', error);
  }, [error]);

  return (
    <div className="shell flex min-h-[70vh] flex-col items-center justify-center py-20 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full border border-status-review/30 bg-status-review/10 text-status-review">
        <AlertTriangle className="h-5 w-5" aria-hidden />
      </span>
      <h1 className="mt-6 text-2xl sm:text-3xl">Something broke on our side</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-mute-400">
        The page failed to render. Your data is safe — try again, and if it keeps happening, email the
        Hub team.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <LinkButton href="/news" variant="secondary">
          Read hub news
        </LinkButton>
      </div>
      {error.digest && <p className="mt-6 font-mono text-2xs text-mute-600">ref {error.digest}</p>}
    </div>
  );
}
