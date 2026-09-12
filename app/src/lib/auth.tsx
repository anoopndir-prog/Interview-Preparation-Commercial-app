import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError, setAuthToken, setUnauthorizedHandler } from './api';
import { loadToken, saveToken } from './storage';
import type { Me } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthContextValue {
  status: Status;
  me: Me | null;
  refresh: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [me, setMe] = useState<Me | null>(null);

  const signOut = useCallback(async () => {
    setAuthToken(null);
    await saveToken(null);
    setMe(null);
    setStatus('signedOut');
  }, []);

  const refresh = useCallback(async () => {
    try {
      setMe(await api.me());
    } catch (err) {
      // Offline: stay signed in with the last known state; 401 is handled by signOut.
      if (!(err instanceof ApiError) || err.status !== 0) throw err;
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void signOut());
    (async () => {
      const token = await loadToken();
      if (!token) return setStatus('signedOut');
      setAuthToken(token);
      setStatus('signedIn');
      await refresh().catch(() => undefined);
    })();
    return () => setUnauthorizedHandler(null);
  }, [refresh, signOut]);

  const signIn = useCallback(
    async (token: string) => {
      setAuthToken(token);
      await saveToken(token);
      setStatus('signedIn');
      await refresh().catch(() => undefined);
    },
    [refresh],
  );

  const value = useMemo(() => ({ status, me, refresh, signIn, signOut }), [status, me, refresh, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
