'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';
import { logout } from '@/lib/api-auth';
import { Loader2, LogOut } from 'lucide-react';
import { NotificationBell } from './notification-bell';
import { useAuthSession } from '@/components/auth/auth-session';

export function SiteHeader() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, refresh } = useAuthSession();

  const showOwnerPanel = user?.role === 'owner' && user.ownerProfileStatus === 'approved';
  const showAdminPanel = user?.role === 'admin';
  const isAuthPage =
    pathname.startsWith('/auth') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup');

  async function handleLogout() {
    try {
      await logout();
    } finally {
      await refresh();
      router.push('/');
      router.refresh();
    }
  }

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

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {showOwnerPanel && (
            <Link
              href="/owner"
              data-testid="nav-owner-dashboard"
              className="text-sm font-medium text-primary transition-colors hover:text-navy"
            >
              {tNav('ownerDashboard')}
            </Link>
          )}
          {showAdminPanel && (
            <Link
              href="/admin"
              data-testid="nav-admin-dashboard"
              className="text-sm font-medium text-primary transition-colors hover:text-navy"
            >
              {tNav('adminDashboard')}
            </Link>
          )}
          <LocaleSwitcher />
          {!ready ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted" aria-hidden />
          ) : user && !isAuthPage ? (
            <>
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                data-testid="nav-logout-mobile"
                className="sm:hidden"
                aria-label={t('logout')}
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4" />
              </Button>
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
          ) : !user && isAuthPage ? (
            <Button size="sm" asChild className="shadow-soft">
              <Link href="/auth">
                {t('login')}
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
