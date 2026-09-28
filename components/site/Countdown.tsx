'use client';

import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  closed: boolean;
}

function diff(target: string): Remaining {
  const distance = new Date(target).getTime() - Date.now();
  if (Number.isNaN(distance) || distance <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, closed: true };
  }
  return {
    days: Math.floor(distance / 86_400_000),
    hours: Math.floor((distance / 3_600_000) % 24),
    minutes: Math.floor((distance / 60_000) % 60),
    seconds: Math.floor((distance / 1000) % 60),
    closed: false,
  };
}

/**
 * Live countdown to a deadline. Renders nothing until mounted so the server
 * and client markup agree (avoids hydration mismatches on a live clock).
 */
export function Countdown({
  target,
  label,
  compact,
  className,
}: {
  target: string;
  label?: string;
  compact?: boolean;
  className?: string;
}) {
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    setRemaining(diff(target));
    const timer = setInterval(() => setRemaining(diff(target)), 1000);
    return () => clearInterval(timer);
  }, [target]);

  if (!remaining) {
    return (
      <div className={cn('flex gap-2', className)} aria-hidden>
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="h-14 w-16 animate-pulse-soft rounded-xl bg-white/[0.06]" />
        ))}
      </div>
    );
  }

  if (remaining.closed) {
    return (
      <p className={cn('text-sm font-medium text-mute-300', className)}>
        Submissions are closed for this semester.
      </p>
    );
  }

  const cells = [
    { value: remaining.days, unit: 'days' },
    { value: remaining.hours, unit: 'hrs' },
    { value: remaining.minutes, unit: 'min' },
    { value: remaining.seconds, unit: 'sec' },
  ];

  if (compact) {
    return (
      <p className={cn('font-mono text-sm tabular-nums text-mute-200', className)}>
        {remaining.days}d {String(remaining.hours).padStart(2, '0')}h{' '}
        {String(remaining.minutes).padStart(2, '0')}m {String(remaining.seconds).padStart(2, '0')}s
      </p>
    );
  }

  return (
    <div className={className}>
      {label && <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-mute-500">{label}</p>}
      <div className="flex gap-2">
        {cells.map((cell) => (
          <div
            key={cell.unit}
            className="min-w-[4.25rem] rounded-xl border border-white/[0.08] bg-charcoal-900/80 px-3 py-2.5 text-center"
          >
            <p className="font-mono text-xl font-semibold tabular-nums text-white">
              {String(cell.value).padStart(2, '0')}
            </p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-mute-500">{cell.unit}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
