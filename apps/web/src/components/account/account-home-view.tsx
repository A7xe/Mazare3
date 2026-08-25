'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Bell, Heart, LifeBuoy, Loader2, CalendarCheck } from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { AccountSubnav } from '@/components/account/account-subnav';
import { getMe, type AuthUser } from '@/lib/api-auth';

const SECTIONS = [
  { href: '/account/bookings', key: 'myBookings' as const, testId: 'account-home-bookings', icon: CalendarCheck },
  { href: '/account/favorites', key: 'favorites' as const, testId: 'account-home-favorites', icon: Heart },
  { href: '/account/support', key: 'support' as const, testId: 'account-home-support', icon: LifeBuoy },
  { href: '/account/notifications', key: 'notifications' as const, testId: 'account-home-notifications', icon: Bell },
] as const;

function formatJoined(iso: string | undefined, locale: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
      dateStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AccountHomeView() {
  const t = useTranslations('accountHome');
  const tNav = useTranslations('nav');
  const tN = useTranslations('notifications');
  const locale = useLocale();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMe();
      setUser(res.data.user);
    } catch {
      router.push('/login?returnUrl=' + encodeURIComponent('/account'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const greetingName = user.name?.trim() || user.email;
  const roleKey = user.role === 'owner' || user.role === 'admin' ? user.role : 'customer';
  const statusKey =
    user.status === 'suspended' || user.status === 'deleted' ? user.status : 'active';
  const languageLabel = user.locale === 'en' ? t('languageEn') : t('languageAr');
  const joined = formatJoined(user.createdAt, locale);

  return (
    <div data-testid="account-home">
      <AccountSubnav />
      <h1 className="text-2xl font-bold text-navy">{t('title')}</h1>
      <p className="mt-1 text-sm text-muted">{t('subtitle', { name: greetingName })}</p>

      <section
        className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
        data-testid="account-profile"
        aria-labelledby="account-profile-heading"
      >
        <h2 id="account-profile-heading" className="text-base font-semibold text-navy">
          {t('profileTitle')}
        </h2>
        <p className="mt-1 text-sm text-muted">{t('readOnlyHint')}</p>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-muted">{t('name')}</dt>
            <dd data-testid="account-profile-name" className="mt-0.5 text-sm font-medium text-navy">
              {user.name?.trim() || t('empty')}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{t('email')}</dt>
            <dd data-testid="account-profile-email" className="mt-0.5 text-sm font-medium text-navy">
              {user.email}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{t('role')}</dt>
            <dd data-testid="account-profile-role" className="mt-0.5 text-sm font-medium text-navy">
              {t(`roles.${roleKey}`)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{t('status')}</dt>
            <dd data-testid="account-profile-status" className="mt-0.5 text-sm font-medium text-navy">
              {t(`statuses.${statusKey}`)}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-muted">{t('language')}</dt>
            <dd data-testid="account-profile-locale" className="mt-0.5 text-sm font-medium text-navy">
              {languageLabel}
            </dd>
          </div>
          {joined ? (
            <div>
              <dt className="text-xs font-medium text-muted">{t('joined')}</dt>
              <dd data-testid="account-profile-joined" className="mt-0.5 text-sm font-medium text-navy">
                {joined}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {SECTIONS.map((item) => {
          const Icon = item.icon;
          const label = item.key === 'notifications' ? tN('title') : tNav(item.key);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                data-testid={item.testId}
                className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-navy shadow-card transition-colors hover:border-primary/30"
              >
                <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
