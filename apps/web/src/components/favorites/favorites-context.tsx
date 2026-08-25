'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { addFavorite, fetchFavoriteIds, removeFavorite } from '@/lib/api-favorites';
import { isCheckoutReturnPath } from '@/lib/checkout-return-path';
import { useAuthSession } from '@/components/auth/auth-session';
import { usePathname } from '@/i18n/navigation';

type FavoritesContextValue = {
  ready: boolean;
  isCustomer: boolean;
  role: string | null;
  ids: Set<string>;
  isFavorited: (propertyId: string) => boolean;
  toggle: (propertyId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, ready: authReady } = useAuthSession();
  const [ready, setReady] = useState(false);
  const [isCustomer, setIsCustomer] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [ids, setIds] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    if (isCheckoutReturnPath(pathname)) {
      setReady(true);
      return;
    }
    if (!authReady) return;
    try {
      if (!user || user.role !== 'customer') {
        setRole(user?.role ?? null);
        setIsCustomer(false);
        setIds(new Set());
        return;
      }
      setRole(user.role);
      setIsCustomer(true);
      const res = await fetchFavoriteIds();
      setIds(new Set(res.data.propertyIds));
    } catch {
      setRole(null);
      setIsCustomer(false);
      setIds(new Set());
    } finally {
      setReady(true);
    }
  }, [pathname, authReady, user]);

  useEffect(() => {
    if (!authReady) {
      setReady(false);
      return;
    }
    void refresh();
  }, [refresh, authReady]);

  const toggle = useCallback(async (propertyId: string) => {
    let currently = false;
    setIds((prev) => {
      currently = prev.has(propertyId);
      const next = new Set(prev);
      if (currently) next.delete(propertyId);
      else next.add(propertyId);
      return next;
    });
    try {
      if (currently) await removeFavorite(propertyId);
      else await addFavorite(propertyId);
    } catch (err) {
      setIds((prev) => {
        const next = new Set(prev);
        if (currently) next.add(propertyId);
        else next.delete(propertyId);
        return next;
      });
      throw err;
    }
  }, []);

  const value = useMemo<FavoritesContextValue>(
    () => ({
      ready,
      isCustomer,
      role,
      ids,
      isFavorited: (propertyId: string) => ids.has(propertyId),
      toggle,
      refresh,
    }),
    [ready, isCustomer, role, ids, toggle, refresh],
  );

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) {
    throw new Error('useFavorites must be used within FavoritesProvider');
  }
  return ctx;
}
