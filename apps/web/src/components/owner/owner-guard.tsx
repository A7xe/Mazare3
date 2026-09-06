'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Loader2, ShieldAlert, Clock } from 'lucide-react';
import { getMe } from '@/lib/api-auth';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type GuardState = 'loading' | 'allowed' | 'login' | 'forbidden' | 'pending' | 'suspended' | 'rejected';

/** Add Farm deep-link — send non-approved users to partner status (API remains the security boundary). */
function isAddFarmDeepLink(pathname: string): boolean {
  return (
    pathname === '/owner/properties/new' ||
    pathname.endsWith('/owner/properties/new') ||
    /\/owner\/properties\/new(\/|\?|$)/.test(pathname)
  );
}

export function OwnerGuard({ children }: { children: ReactNode }) {
  const t = useTranslations('owner');
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getMe();
        if (cancelled) return;
        const user = res.data.user;
        if (user.role === 'admin') {
          setState('allowed');
          return;
        }
        if (user.role !== 'owner') {
          // Prefer partner application/status over a dead-end forbidden page for Add Farm deep links.
          if (isAddFarmDeepLink(pathname)) {
            router.replace('/become-owner');
            return;
          }
          setState('forbidden');
          return;
        }
        const ps = user.ownerProfileStatus;
        if (ps === 'approved') {
          setState('allowed');
        } else if (ps === 'suspended') {
          setState('suspended');
        } else if (ps === 'pending') {
          if (isAddFarmDeepLink(pathname)) {
            router.replace('/become-owner');
            return;
          }
          setState('pending');
        } else if (ps === 'rejected') {
          if (isAddFarmDeepLink(pathname)) {
            router.replace('/become-owner');
            return;
          }
          setState('rejected');
        } else {
          if (isAddFarmDeepLink(pathname)) {
            router.replace('/become-owner');
            return;
          }
          setState('forbidden');
        }
      } catch {
        if (cancelled) return;
        setState('login');
        router.replace(`/auth?returnUrl=${encodeURIComponent(pathname)}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (state === 'loading' || state === 'login') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <div data-testid="owner-pending" className="mx-auto max-w-lg px-4 py-20 text-center">
        <Clock className="mx-auto h-12 w-12 text-primary" />
        <h1 className="mt-4 text-2xl font-bold text-navy">{t('pendingTitle')}</h1>
        <p className="mt-2 text-muted">{t('pendingHint')}</p>
        <Button asChild className="mt-6 shadow-soft" variant="outline">
          <Link href="/become-owner">{t('viewApplication')}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'suspended') {
    return (
      <div data-testid="owner-suspended" className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-danger" />
        <h1 className="mt-4 text-2xl font-bold text-navy">{t('suspendedTitle')}</h1>
        <p className="mt-2 text-muted">{t('suspendedHint')}</p>
        <Button asChild className="mt-6 shadow-soft">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'rejected' || state === 'forbidden') {
    return (
      <div
        data-testid="owner-forbidden"
        className="mx-auto max-w-lg px-4 py-20 text-center"
      >
        <ShieldAlert className="mx-auto h-12 w-12 text-danger" />
        <h1 className="mt-4 text-2xl font-bold text-navy">{t('forbiddenTitle')}</h1>
        <p className="mt-2 text-muted">
          {state === 'rejected' ? t('rejectedHint') : t('forbiddenHint')}
        </p>
        {state === 'rejected' && (
          <Button asChild className="mt-6 shadow-soft">
            <Link href="/become-owner">{t('reapply')}</Link>
          </Button>
        )}
        {state === 'forbidden' && (
          <Button asChild className="mt-6 shadow-soft">
            <Link href="/become-owner" data-testid="owner-forbidden-become-owner">
              {t('viewApplication')}
            </Link>
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
