'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { getMe } from '@/lib/api-auth';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

type GuardState = 'loading' | 'allowed' | 'login' | 'forbidden';

export function AdminGuard({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>('loading');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getMe();
        if (cancelled) return;
        if (res.data.user.role === 'admin') {
          setState('allowed');
        } else {
          setState('forbidden');
        }
      } catch {
        if (cancelled) return;
        setState('login');
        router.replace(
          `/auth?mode=email&emailMode=login&returnUrl=${encodeURIComponent(pathname)}`,
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (state === 'loading') {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>{t('loading')}</p>
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div data-testid="admin-forbidden" className="mx-auto max-w-lg px-4 py-20 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-danger" />
        <h1 className="mt-4 text-2xl font-bold text-navy">{t('forbiddenTitle')}</h1>
        <p className="mt-2 text-muted">{t('forbiddenHint')}</p>
        <Button asChild className="mt-6 shadow-soft">
          <Link href="/">{t('backHome')}</Link>
        </Button>
      </div>
    );
  }

  if (state === 'login') {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
