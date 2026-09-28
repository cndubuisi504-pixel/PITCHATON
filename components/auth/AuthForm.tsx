'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';

import { Alert, Button, Field, Input, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'signup';

interface AuthFormProps {
  mode: Mode;
  nextPath?: string;
}

interface ApiResponse {
  user?: { role: 'founder' | 'admin'; full_name: string; email: string };
  notice?: string;
  error?: string;
  field?: string;
}

/**
 * One shared form for every account type.
 *
 * Founders and organisers use the same screen — the difference is the optional
 * "I'm an administrator" claim, which the server validates against
 * ADMIN_ACCESS_CODE. The UI never decides a role; it only reports what the
 * server assigned.
 */
export function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const toast = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [wantsAdmin, setWantsAdmin] = useState(false);
  const [adminCode, setAdminCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === 'signup' && password !== confirm) {
      setError('Those passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const endpoint = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const payload =
        mode === 'signup'
          ? {
              full_name: fullName,
              email,
              password,
              is_admin: wantsAdmin,
              admin_code: wantsAdmin ? adminCode : undefined,
            }
          : { email, password };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        setError(data.error ?? 'Something went wrong. Try again.');
        return;
      }

      const role = data.user?.role ?? 'founder';
      toast.push({
        tone: 'success',
        title: mode === 'signup' ? 'Welcome to PITCHATON' : `Welcome back, ${data.user?.full_name?.split(' ')[0] ?? ''}`.trim(),
        message: role === 'admin' ? 'Admin access confirmed — opening your dashboard.' : 'You are signed in.',
      });

      if (data.notice) setNotice(data.notice);

      const destination = nextPath ?? (role === 'admin' ? '/admin' : '/dashboard');
      router.replace(destination);
      router.refresh();
    } catch {
      setError('Network error — check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      {error && <Alert tone="danger" title="We could not continue">{error}</Alert>}
      {notice && <Alert tone="warning" title="Heads up">{notice}</Alert>}

      {mode === 'signup' && (
        <Field label="Full name" htmlFor="full_name" required>
          <Input
            id="full_name"
            name="full_name"
            autoComplete="name"
            placeholder="Chidera Nwosu"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </Field>
      )}

      <Field label="Email" htmlFor="email" required>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </Field>

      <Field
        label="Password"
        htmlFor="password"
        required
        hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
      >
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="pr-11"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-mute-400 transition hover:bg-white/[0.06] hover:text-white"
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      </Field>

      {mode === 'signup' && (
        <>
          <Field label="Confirm password" htmlFor="confirm" required>
            <Input
              id="confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="••••••••"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>

          {/* Admin claim — collapsed by default so founders never see noise. */}
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <button
              type="button"
              onClick={() => setWantsAdmin((value) => !value)}
              aria-expanded={wantsAdmin}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="flex items-center gap-2.5">
                <ShieldCheck className={cn('h-4 w-4', wantsAdmin ? 'text-lime' : 'text-mute-500')} aria-hidden />
                <span>
                  <span className="block text-sm font-medium text-white">I&apos;m an administrator</span>
                  <span className="mt-0.5 block text-xs text-mute-500">
                    Hub staff only — requires the admin access code
                  </span>
                </span>
              </span>
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full transition',
                  wantsAdmin ? 'bg-lime' : 'bg-white/15',
                )}
                aria-hidden
              />
            </button>

            {wantsAdmin && (
              <div className="mt-4 animate-fade-up">
                <Field
                  label="Admin access code"
                  htmlFor="admin_code"
                  hint="Issued by the Hub lead. Not required for the official Hub address."
                >
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-mute-500" aria-hidden />
                    <Input
                      id="admin_code"
                      value={adminCode}
                      onChange={(event) => setAdminCode(event.target.value)}
                      placeholder="Access code"
                      className="pl-9"
                      autoComplete="off"
                    />
                  </div>
                </Field>
              </div>
            )}
          </div>
        </>
      )}

      <Button type="submit" size="lg" fullWidth loading={loading}>
        {mode === 'signup' ? 'Create my account' : 'Log in'}
      </Button>

      <p className="text-center text-sm text-mute-400">
        {mode === 'signup' ? (
          <>
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-lime hover:underline">
              Log in
            </Link>
          </>
        ) : (
          <>
            New to PITCHATON?{' '}
            <Link href="/signup" className="font-medium text-lime hover:underline">
              Create an account
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
