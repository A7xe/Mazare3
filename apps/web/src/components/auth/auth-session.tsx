'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';
import { AuthApiError, getMe, type AuthUser } from '@/lib/api-auth';
import { isCheckoutReturnPath } from '@/lib/checkout-return-path';

type AuthSessionValue = {
  user: AuthUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionValue>({
  user: null,
  ready: false,
  refresh: async () => undefined,
});

export function AuthSessionProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: AuthUser | null;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  const [ready, setReady] = useState(true);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const refresh = useCallback(async () => {
    if (isCheckoutReturnPath(pathname)) {
      setUser(null);
      setReady(true);
      return;
    }
    try {
      const res = await getMe();
      setUser(res.data.user);
    } catch (err) {
      // Transient rate-limit must not wipe a known session mid-navigation.
      if (err instanceof AuthApiError && err.status === 429) {
        setReady(true);
        return;
      }
      setUser(null);
    } finally {
      setReady(true);
    }
  }, [pathname]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(() => ({ user, ready, refresh }), [user, ready, refresh]);
  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
