'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuthSession } from '@/components/auth/auth-session';
import { NotificationBell } from '@/components/layout/notification-bell';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';

export function MarketplaceTopHeader() {
  const t = useTranslations('common');
  const { user, ready } = useAuthSession();

  return (
    <header data-testid="marketplace-top-header" className="relative z-40">
      <div className="relative mx-auto flex h-[64px] w-full max-w-[1360px] items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-5 lg:px-6">
        <div className="relative z-[1] flex min-w-0 items-center gap-2">
          {!ready ? (
            <Loader2 className="h-4 w-4 animate-spin text-[#8A9BB2]" aria-hidden />
          ) : user ? (
            <Link
              href="/account"
              data-testid="nav-account-top"
              className="truncate text-[12.5px] font-semibold text-[#2F6EF6] hover:text-[#1D5FE8]"
            >
              {user.name?.trim() || user.email}
            </Link>
          ) : null}
        </div>

        <Link
          href="/"
          data-testid="nav-logo"
          aria-label={t('brand')}
          className="absolute left-1/2 top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2"
        >
          <Image
            src="/logo/mazare3.png"
            alt={t('brand')}
            width={320}
            height={88}
            priority
            className="h-11 w-auto origin-center object-contain scale-[1.85] sm:h-12 sm:scale-[2.1]"
          />
        </Link>

        <div className="relative z-[1] flex shrink-0 items-center gap-2">
          <LocaleSwitcher />
          {user ? (
            <div className="relative flex h-10 w-10 items-center justify-center rounded-[12px] border border-[#E7EEF8] bg-white/90 shadow-[0_4px_12px_rgba(31,70,120,.08)]">
              <NotificationBell />
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
