'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthBreadcrumbExtrasValue = {
  propertyTitle: string | null;
  setPropertyTitle: (title: string | null) => void;
};

const AuthBreadcrumbExtrasContext = createContext<AuthBreadcrumbExtrasValue>({
  propertyTitle: null,
  setPropertyTitle: () => undefined,
});

export function AuthBreadcrumbExtrasProvider({ children }: { children: ReactNode }) {
  const [propertyTitle, setPropertyTitle] = useState<string | null>(null);
  const value = useMemo(() => ({ propertyTitle, setPropertyTitle }), [propertyTitle]);
  return (
    <AuthBreadcrumbExtrasContext.Provider value={value}>{children}</AuthBreadcrumbExtrasContext.Provider>
  );
}

export function useAuthBreadcrumbExtras() {
  return useContext(AuthBreadcrumbExtrasContext);
}

/** Publish a real property title into the authenticated breadcrumb (clears on unmount). */
export function useAuthBreadcrumbPropertyTitle(title: string | null | undefined) {
  const { setPropertyTitle } = useAuthBreadcrumbExtras();
  const trimmed = title?.trim() || null;
  useEffect(() => {
    setPropertyTitle(trimmed);
    return () => setPropertyTitle(null);
  }, [setPropertyTitle, trimmed]);
}
