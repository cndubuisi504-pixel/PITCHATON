'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

import type { SessionUser } from '@/lib/types';

/**
 * Client-side auth surface.
 *
 * The *authoritative* user comes from the server on every render (the root
 * layout reads the session cookie). This provider only exposes helpers to
 * sign out / refresh, so the browser can never promote itself.
 */

interface AuthContextValue {
  user: SessionUser | null;
  isAdmin: boolean;
  logout: () => Promise<void>;
  refresh: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAdmin: false,
  logout: async () => undefined,
  refresh: () => undefined,
});

export function AuthProvider({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  const router = useRouter();

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isAdmin: user?.role === 'admin', logout, refresh: () => router.refresh() }),
    [user, logout, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
