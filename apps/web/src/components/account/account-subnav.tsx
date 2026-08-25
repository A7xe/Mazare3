'use client';

import { useTranslations } from 'next-intl';
import { LogOut } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-auth';
import { useAuthSession } from '@/components/auth/auth-session';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { Button } from '@/components/ui/button';

const LINKS = [
  { href: '/account', key: 'account' as const, testId: 'account-nav-overview' },
  { href: '/account/bookings', key: 'myBookings' as const, testId: 'account-nav-bookings' },
  { href: '/account/favorites', key: 'favorites' as const, testId: 'account-nav-favorites' },
  { href: '/account/support', key: 'support' as const, testId: 'account-nav-support' },
  { href: '/account/notifications', key: 'notifications' as const, testId: 'account-nav-notifications' },
] as const;

export function AccountSubnav() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tN = useTranslations('notifications');
  const pathname = usePathname();
  const router = useRouter();
  const { refresh } = useAuthSession();

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
    <nav className="mb-6 flex flex-nowrap items-center gap-2 overflow-x-auto pb-1" aria-label={t('account')}>
      {LINKS.map((link) => {
        const active =
          link.href === '/account'
            ? pathname === '/account'
            : pathname === link.href || pathname.startsWith(`${link.href}/`);
        const label =
          link.key === 'notifications'
            ? tN('title')
            : link.key === 'support'
              ? t('support')
              : t(link.key);
        return (
          <Link
            key={link.href}
            href={link.href}
            data-testid={link.testId}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-surface text-muted hover:border-primary/30 hover:text-navy',
            )}
          >
            {label}
          </Link>
        );
      })}
      <span className="ms-auto flex shrink-0 items-center gap-1">
        <LocaleSwitcher />
        <Button
          variant="ghost"
          size="sm"
          data-testid="nav-logout"
          className="gap-2"
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4" />
          {tCommon('logout')}
        </Button>
      </span>
    </nav>
  );
}
