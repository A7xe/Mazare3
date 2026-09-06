'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Link } from '@/i18n/navigation';
import {
  BriefcaseBusiness,
  Compass,
  Heart,
  LogOut,
  MoreHorizontal,
  UserRound,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logout } from '@/lib/api-auth';
import { useAuthSession } from '@/components/auth/auth-session';
import { useAddFarmEntry } from '@/lib/use-add-farm-entry';
import { LocaleSwitcher } from './locale-switcher';
import { Button } from '@/components/ui/button';

const LEGAL_LINKS = [
  { href: '/about', key: 'about' as const, testId: 'nav-more-about' },
  { href: '/contact', key: 'contact' as const, testId: 'nav-more-contact' },
  { href: '/booking-payment', key: 'booking-payment' as const, testId: 'nav-more-booking-payment' },
  { href: '/cancellation-refund', key: 'cancellation-refund' as const, testId: 'nav-more-cancellation' },
  { href: '/terms', key: 'terms' as const, testId: 'nav-more-terms' },
  { href: '/privacy', key: 'privacy' as const, testId: 'nav-more-privacy' },
] as const;

function DockItem({
  href,
  label,
  icon: Icon,
  testId,
  active,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  testId: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className={cn(
        'group relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0 py-1 transition sm:min-w-16 sm:justify-end sm:gap-1 sm:px-0.5 sm:py-0 sm:pb-0 md:min-w-20',
        active ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600',
      )}
    >
      <Icon className="h-5 w-5 shrink-0 sm:h-[23px] sm:w-[23px]" strokeWidth={1.8} aria-hidden />
      <span
        className={cn(
          // Mobile: full label, up to 2 tight lines — no ellipsis truncation.
          'w-full text-center text-[9px] font-semibold leading-[1.15] line-clamp-2 break-words [overflow-wrap:anywhere]',
          // Desktop/tablet: restore approved single-line look.
          'sm:line-clamp-none sm:whitespace-nowrap sm:text-xs sm:leading-tight sm:overflow-visible',
          active ? 'font-bold' : 'font-semibold',
        )}
      >
        {label}
      </span>
    </Link>
  );
}

export function MarketplaceBottomNav() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const tLegal = useTranslations('legal');
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useAuthSession();
  const [moreOpen, setMoreOpen] = useState(false);
  const { href: addFarmHref, label: addFarmLabel } = useAddFarmEntry();

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const role = user?.role;
  const isCustomer = role === 'customer';
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin';
  const showOwnerPanel = isOwner && user?.ownerProfileStatus === 'approved';

  const moreActive =
    moreOpen ||
    pathname.startsWith('/about') ||
    pathname.startsWith('/contact') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/cancellation-refund') ||
    pathname.startsWith('/booking-payment');

  async function handleLogout() {
    try {
      await logout();
    } finally {
      await refresh();
      setMoreOpen(false);
      router.push('/');
      router.refresh();
    }
  }

  function pathActive(href: string) {
    if (href === '/') return pathname === '/';
    if (href === '/search') return pathname.startsWith('/search') || pathname.startsWith('/properties');
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const pos2 = isCustomer
    ? {
        href: '/account/bookings',
        label: t('myBookings'),
        icon: BriefcaseBusiness,
        testId: 'nav-bookings',
      }
    : {
        href: addFarmHref,
        label: addFarmLabel,
        icon: BriefcaseBusiness,
        testId: 'nav-list-property',
      };

  const pos4 = isCustomer
    ? {
        href: '/account/favorites',
        label: t('favorites'),
        icon: Heart,
        testId: 'nav-favorites',
      }
    : isAdmin
      ? {
          href: '/admin',
          label: t('adminDashboard'),
          icon: UserRound,
          testId: 'nav-login',
        }
      : showOwnerPanel
        ? {
            href: '/owner',
            label: t('ownerDashboard'),
            icon: UserRound,
            testId: 'nav-login',
          }
        : user
          ? {
              href: addFarmHref,
              label: addFarmLabel,
              icon: UserRound,
              testId: 'nav-login',
            }
          : { href: '/auth', label: tCommon('login'), icon: UserRound, testId: 'nav-login' };

  const customerAccount = isCustomer;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-2 z-50 flex justify-center px-2 pb-[env(safe-area-inset-bottom)] sm:bottom-5 sm:px-4">
        <nav
          className="pointer-events-auto relative grid h-[74px] w-full max-w-[700px] grid-cols-[minmax(0,1fr)_minmax(0,1fr)_5.75rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-0.5 rounded-[24px] border border-blue-200/70 bg-white/92 px-1 shadow-[0_12px_36px_rgba(30,64,175,.16)] backdrop-blur-xl sm:flex sm:h-[82px] sm:items-center sm:justify-between sm:gap-2 sm:rounded-[32px] sm:px-4 sm:shadow-[0_25px_80px_rgba(30,64,175,.22)] sm:backdrop-blur-2xl"
          data-testid="marketplace-bottom-nav"
          aria-label={t('primary')}
        >
          <DockItem
            href="/search"
            label={t('search')}
            icon={Compass}
            testId="nav-search"
            active={pathActive('/search')}
          />
          <DockItem
            href={pos2.href}
            label={pos2.label}
            icon={pos2.icon}
            testId={pos2.testId}
            active={pathActive(pos2.href)}
          />

          <div className="relative z-0 flex h-full w-[5.75rem] shrink-0 items-center justify-center justify-self-center sm:w-auto sm:min-w-[11rem] md:min-w-[12rem]">
            <Link
              href="/"
              data-testid="nav-home"
              aria-label={t('home')}
              className="absolute -top-2.5 left-1/2 z-10 flex h-[48px] w-[6.5rem] -translate-x-1/2 items-center justify-center sm:-top-5 sm:h-[86px] sm:w-[11rem] md:h-[96px] md:w-[12rem]"
            >
              <Image
                src="/logo/logo-main.png"
                alt={tCommon('brand')}
                width={320}
                height={120}
                priority
                className="h-full w-auto max-w-full object-contain drop-shadow-[0_8px_18px_rgba(37,99,235,.32)]"
              />
            </Link>
          </div>

          <DockItem
            href={pos4.href}
            label={pos4.label}
            icon={pos4.icon}
            testId={pos4.testId}
            active={pathActive(pos4.href)}
          />

          {customerAccount ? (
            <DockItem
              href="/account"
              label={t('account')}
              icon={UserRound}
              testId="nav-account"
              active={
                pathname === '/account' ||
                (pathname.startsWith('/account/') &&
                  !pathname.startsWith('/account/bookings') &&
                  !pathname.startsWith('/account/favorites'))
              }
            />
          ) : (
            <button
              type="button"
              data-testid="nav-account"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((open) => !open)}
              className={cn(
                'group relative z-[1] flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0 py-1 transition sm:min-w-16 sm:justify-end sm:gap-1 sm:px-0.5 sm:py-0 sm:pb-0 md:min-w-20',
                moreActive ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600',
              )}
            >
              <MoreHorizontal className="h-5 w-5 shrink-0 sm:h-[23px] sm:w-[23px]" strokeWidth={1.8} aria-hidden />
              <span
                className={cn(
                  'w-full text-center text-[9px] font-semibold leading-[1.15] line-clamp-2 break-words [overflow-wrap:anywhere] sm:line-clamp-none sm:whitespace-nowrap sm:text-xs sm:leading-tight sm:overflow-visible',
                  moreActive ? 'font-bold' : 'font-semibold',
                )}
              >
                {t('more')}
              </span>
            </button>
          )}
        </nav>
      </div>

      {moreOpen && !customerAccount ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            className="absolute inset-0 bg-navy/30"
            aria-label={tCommon('back')}
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[700px] rounded-t-3xl bg-white px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-premium"
            data-testid="nav-more-sheet"
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            <div className="mb-3 flex items-center justify-between">
              <p className="text-base font-semibold text-navy">{t('more')}</p>
              <Button variant="ghost" size="icon" onClick={() => setMoreOpen(false)} aria-label={tCommon('back')}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-1">
              {!user ? (
                <Link
                  href="/auth?mode=email&emailMode=signup"
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-navy hover:bg-blue-50"
                  onClick={() => setMoreOpen(false)}
                >
                  {tCommon('signup')}
                </Link>
              ) : null}
              {LEGAL_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={item.testId}
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-navy hover:bg-blue-50"
                  onClick={() => setMoreOpen(false)}
                >
                  {tLegal(`nav.${item.key}`)}
                </Link>
              ))}
              {showOwnerPanel ? (
                <Link
                  href="/owner"
                  data-testid="nav-owner-dashboard"
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-navy hover:bg-blue-50"
                  onClick={() => setMoreOpen(false)}
                >
                  {t('ownerDashboard')}
                </Link>
              ) : null}
              {isAdmin ? (
                <Link
                  href="/admin"
                  data-testid="nav-admin-dashboard"
                  className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-navy hover:bg-blue-50"
                  onClick={() => setMoreOpen(false)}
                >
                  {t('adminDashboard')}
                </Link>
              ) : null}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
              <LocaleSwitcher />
              {user ? (
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
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
