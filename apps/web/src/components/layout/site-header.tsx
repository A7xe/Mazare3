'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { getMe, logout, type AuthUser } from '@/lib/api-auth';
import { Loader2 } from 'lucide-react';

export function SiteHeader() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await getMe();
        if (!cancelled) setUser(res.data.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const showOwnerPanel = user?.role === 'owner' || user?.role === 'admin';

  async function handleLogout() {
    try {
      await logout();
    } finally {
      setUser(null);
      router.push('/');
      router.refresh();
    }
  }

  const ownerNavLink = showOwnerPanel ? (
    <Link
      href="/owner"
      data-testid="nav-owner-dashboard"
      className="text-sm font-medium text-muted transition-colors hover:text-primary"
    >
      {tNav('ownerDashboard')}
    </Link>
  ) : null;

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/92 shadow-card backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="gradient-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-primary-foreground shadow-soft">
            م
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight text-navy">{t('brand')}</p>
            <p className="text-xs text-muted">{t('tagline')}</p>
          </div>
        </Link>

        <nav className="hidden min-w-0 items-center gap-4 md:flex lg:gap-6">
          <Link
            href="/search"
            className="text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            {tNav('search')}
          </Link>
          {ownerNavLink}
          <Link
            href="/become-owner"
            className="text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            {tNav('becomeOwner')}
          </Link>
          <Link
            href="/account/bookings"
            className="text-sm font-medium text-muted transition-colors hover:text-primary"
          >
            {tNav('myBookings')}
          </Link>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showOwnerPanel && (
            <Link
              href="/owner"
              data-testid="nav-owner-dashboard-mobile"
              className="text-xs font-medium text-primary transition-colors hover:text-navy md:hidden"
            >
              {tNav('ownerDashboard')}
            </Link>
          )}
          <LocaleSwitcher />
          {authLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
          ) : user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                data-testid="nav-logout"
                className="hidden sm:inline-flex"
                onClick={() => void handleLogout()}
              >
                {t('logout')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
                <Link href="/login">{t('login')}</Link>
              </Button>
              <Button size="sm" asChild className="shadow-soft">
                <Link href="/signup">{t('signup')}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
