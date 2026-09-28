'use client';

import Link from 'next/link';
import { Loader2, X } from 'lucide-react';
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import { cn, STATUS_META } from '@/lib/utils';
import type { PitchStatus } from '@/lib/types';

/* ------------------------------------------------------------------ *
 * Button
 * ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-lime text-charcoal-950 hover:bg-lime-300 active:bg-lime-500 shadow-[0_10px_30px_-14px_rgba(211,255,1,0.55)]',
  secondary: 'bg-white/[0.06] text-white hover:bg-white/[0.11] border border-white/10',
  ghost: 'text-mute-200 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-status-rejected/15 text-status-rejected hover:bg-status-rejected/25 border border-status-rejected/30',
  outline: 'border border-lime/40 text-lime hover:bg-lime/10',
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5 rounded-lg',
  md: 'h-11 px-5 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[15px] gap-2 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition duration-150',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  icon,
  external,
  fullWidth,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
  external?: boolean;
  fullWidth?: boolean;
}) {
  const classes = cn(
    'inline-flex select-none items-center justify-center font-semibold transition duration-150',
    buttonVariants[variant],
    buttonSizes[size],
    fullWidth && 'w-full',
    className,
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        {icon}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      {icon}
    </Link>
  );
}

/* ------------------------------------------------------------------ *
 * Form primitives
 * ------------------------------------------------------------------ */

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, hint, error, required, children, className }: FieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium text-mute-200">
        {label}
        {required && <span className="text-lime">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs leading-relaxed text-mute-500">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-status-rejected">
          {error}
        </p>
      )}
    </div>
  );
}

const controlClass =
  'w-full rounded-xl border border-white/[0.09] bg-charcoal-950/70 px-3.5 py-2.5 text-sm text-white ' +
  'placeholder:text-mute-500 transition focus:border-lime/60 focus:bg-charcoal-950 ' +
  'focus:outline-none focus:ring-2 focus:ring-lime/25 disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cn(controlClass, 'h-11', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(controlClass, 'min-h-[7rem] resize-y leading-relaxed', className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <select ref={ref} className={cn(controlClass, 'h-11 appearance-none bg-charcoal-950 pr-9', className)} {...rest}>
        {children}
      </select>
    );
  },
);

/** Accessible on/off switch used across the admin Settings tab. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <label htmlFor={id} className="cursor-pointer text-sm font-medium text-white">
          {label}
        </label>
        {description && <p className="mt-1 text-xs leading-relaxed text-mute-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition duration-200',
          checked ? 'border-lime/60 bg-lime/25' : 'border-white/10 bg-white/[0.08]',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <span
          className={cn(
            'absolute top-[3px] h-4 w-4 rounded-full transition-all duration-200',
            checked ? 'left-[22px] bg-lime' : 'left-[3px] bg-mute-400',
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces & data display
 * ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  interactive,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  as?: 'div' | 'article' | 'section' | 'li';
}) {
  return <Tag className={cn(interactive ? 'card-interactive' : 'card', className)}>{children}</Tag>;
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'lime' | 'danger' | 'info';
  className?: string;
}) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.05] text-mute-300',
    lime: 'border-lime/35 bg-lime/[0.12] text-lime',
    danger: 'border-status-rejected/30 bg-status-rejected/[0.12] text-status-rejected',
    info: 'border-status-accepted/30 bg-status-accepted/[0.12] text-status-accepted',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusPill({ status, className }: { status: PitchStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider',
        meta.chip,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-14 text-center">
      {icon && <div className="mb-4 grid h-11 w-11 place-items-center rounded-full bg-white/[0.05] text-mute-300">{icon}</div>}
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-mute-400">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg bg-white/[0.06]', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-mute-400', className)} aria-hidden />;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center sm:text-center',
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="text-2xl leading-tight sm:text-3xl lg:text-[2.1rem]">{title}</h2>
        {description && <p className="mt-3 text-pretty text-sm leading-relaxed text-mute-400 sm:text-[15px]">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: ReactNode;
  tone?: 'default' | 'lime';
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mute-500">{label}</p>
        {icon && <span className={cn('text-mute-500', tone === 'lime' && 'text-lime')}>{icon}</span>}
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tabular-nums text-white sm:text-3xl', tone === 'lime' && 'text-lime')}>
        {value}
      </p>
      {hint && <p className="mt-1.5 text-xs text-mute-500">{hint}</p>}
    </div>
  );
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: 'border-white/10 bg-white/[0.04] text-mute-200',
    success: 'border-lime/30 bg-lime/[0.08] text-lime-100',
    warning: 'border-status-review/30 bg-status-review/[0.08] text-status-review',
    danger: 'border-status-rejected/30 bg-status-rejected/[0.08] text-status-rejected',
  } as const;
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3.5 text-sm', tones[tone])}>
      <div className="min-w-0">
        {title && <p className="font-semibold text-white">{title}</p>}
        {children && <div className={cn('leading-relaxed', title && 'mt-1 text-mute-300')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Modal — focus-trapped, ESC to close, scroll-locked
 * ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' } as const;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-white/10 bg-charcoal-900 shadow-lifted sm:rounded-2xl',
          widths[size],
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[0.07] bg-charcoal-900/95 px-5 py-4 backdrop-blur sm:px-6">
          <div>
            <h3 className="text-base font-semibold text-white sm:text-lg">{title}</h3>
            {description && <p className="mt-1 text-xs leading-relaxed text-mute-400">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-mute-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="sticky bottom-0 flex flex-wrap justify-end gap-2 border-t border-white/[0.07] bg-charcoal-900/95 px-5 py-4 backdrop-blur sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Tabs — arrow-key navigable, used by the admin dashboard
 * ------------------------------------------------------------------ */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: Array<{ id: T; label: string; count?: number; icon?: ReactNode }>;
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const index = tabs.findIndex((tab) => tab.id === active);
  return (
    <div role="tablist" aria-label="Sections" className={cn('no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-charcoal-900/70 p-1', className)}>
      {tabs.map((tab, position) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                event.preventDefault();
                const direction = event.key === 'ArrowRight' ? 1 : -1;
                const next = tabs[(index + direction + tabs.length) % tabs.length];
                onChange(next.id);
              }
            }}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition',
              selected ? 'bg-lime text-charcoal-950' : 'text-mute-300 hover:bg-white/[0.05] hover:text-white',
            )}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.count === 'number' && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                  selected ? 'bg-charcoal-950/15 text-charcoal-950' : 'bg-white/[0.07] text-mute-300',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
      <span className="sr-only" aria-live="polite">
        {tabs[index]?.label} selected
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Toasts — single provider, imperative helper
 * ------------------------------------------------------------------ */

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  message?: string;
  tone: ToastTone;
  title?: string;
}

const ToastContext = createContext<{
  push: (toast: { message?: string; tone?: ToastTone; title?: string }) => void;
} | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo(
    () => ({
      push: ({ message, tone = 'info', title }: { message?: string; tone?: ToastTone; title?: string }) => {
        const id = Date.now() + Math.random();
        setToasts((current) => [...current, { id, message, tone, title }]);
        setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 6000);
      },
    }),
    [],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex flex-col items-center gap-2 p-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto w-full max-w-sm animate-fade-up rounded-xl border px-4 py-3 shadow-lifted backdrop-blur',
              toast.tone === 'success' && 'border-lime/35 bg-lime/[0.12]',
              toast.tone === 'error' && 'border-status-rejected/35 bg-[#2a1418]/95',
              toast.tone === 'info' && 'border-white/10 bg-charcoal-850/95',
            )}
          >
            {toast.title && <p className="text-sm font-semibold text-white">{toast.title}</p>}
            {toast.message && (
              <p
                className={cn(
                  'text-sm leading-relaxed',
                  toast.tone === 'error' ? 'text-status-rejected' : 'text-mute-200',
                  toast.title && 'mt-0.5',
                )}
              >
                {toast.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Safe no-op if a component renders outside the provider (e.g. tests).
    return { push: () => undefined };
  }
  return context;
}
