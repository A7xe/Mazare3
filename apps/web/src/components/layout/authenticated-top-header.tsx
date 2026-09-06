'use client';

import Image from 'next/image';
import { ChevronRight, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { isExploreTextSearchMode } from '@mazare3/shared';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthSession } from '@/components/auth/auth-session';
import { AuthHeaderNotifications } from '@/components/layout/auth-header-notifications';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';
import { useAuthBreadcrumbExtras } from '@/components/layout/auth-breadcrumb-extras';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { Button } from '@/components/ui/button';
import { logout, type AuthUser } from '@/lib/api-auth';
import {
  resolveAuthBreadcrumbs,
  isOwnerAppPath,
  type AuthBreadcrumbItem,
} from '@/lib/auth-breadcrumbs';
import { cn } from '@/lib/utils';

/** Default Mazare3 profile photo when the user has not set an avatar. */
export const DEFAULT_PROFILE_AVATAR = '/avatars/default-profile.png';

type Props = {
  sticky?: boolean;
  showOwnerUtilities?: boolean;
};

function crumbLabel(item: AuthBreadcrumbItem, t: (key: string) => string): string {
  if (item.literal) return item.literal;
  return t(`crumbs.${item.key}`);
}

function resolveUserAvatarUrl(user: AuthUser): string | null {
  const candidate = (user as AuthUser & { avatarUrl?: string | null; imageUrl?: string | null })
    .avatarUrl;
  const imageUrl = (user as AuthUser & { imageUrl?: string | null }).imageUrl;
  const raw = (candidate ?? imageUrl)?.trim();
  return raw || null;
}

export function AuthenticatedTopHeader({ sticky = false, showOwnerUtilities = false }: Props) {
  const t = useTranslations('authHeader');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, ready, refresh } = useAuthSession();
  const { propertyTitle } = useAuthBreadcrumbExtras();
  const ownerUtilities = showOwnerUtilities || isOwnerAppPath(pathname);

  if (!ready || !user) return null;

  const searchMode = isExploreTextSearchMode({ q: searchParams.get('q') ?? undefined });
  const crumbs = resolveAuthBreadcrumbs(pathname, { propertyTitle, searchMode });
  const displayName = user.name?.trim() || user.email || '—';
  const current = crumbs[crumbs.length - 1];
  const identityLabel = `${t('greeting')} ${displayName}`;
  const avatarSrc = resolveUserAvatarUrl(user) ?? DEFAULT_PROFILE_AVATAR;
  const usingDefaultAvatar = avatarSrc === DEFAULT_PROFILE_AVATAR;

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
    <header
      data-testid="authenticated-top-header"
      className={cn('z-40 bg-transparent', sticky && 'sticky top-0')}
    >
      <MarketplacePageShell className="flex h-[60px] items-center justify-between gap-3 overflow-x-auto px-4 py-1 sm:h-[68px] sm:px-6 lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-4 md:gap-8 lg:gap-10">
          <Link
            href="/account"
            data-testid="auth-header-identity"
            aria-label={identityLabel}
            className="relative z-[1] flex min-w-0 shrink-0 items-center gap-3 rounded-xl py-0.5 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <span
              className="relative h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-[#E8F0FE] sm:h-14 sm:w-14"
              aria-hidden
            >
              <Image
                src={avatarSrc}
                alt=""
                width={56}
                height={56}
                className="h-full w-full object-cover"
                data-testid={usingDefaultAvatar ? 'auth-header-avatar-default' : 'auth-header-avatar'}
                priority={false}
              />
            </span>
            <span className="hidden min-w-0 text-start md:block">
              <span
                dir="auto"
                className="block truncate text-[15px] font-bold leading-snug tracking-[-0.01em] text-[#0D2046]"
              >
                {t('greeting')} {displayName}
              </span>
              <span className="mt-0.5 block truncate text-[12px] font-medium leading-snug text-[#8A96A8]">
                {t('subtitle')}
              </span>
            </span>
          </Link>

          <nav
            aria-label={t('breadcrumbLabel')}
            data-testid="auth-header-breadcrumb"
            className="hidden min-w-0 md:block"
          >
            <ol className="flex max-w-full items-center gap-1.5 overflow-x-auto overflow-y-visible text-[12px] leading-normal [scrollbar-width:none] md:[&>li:not(:nth-last-child(-n+3))]:hidden lg:[&>li]:flex [&::-webkit-scrollbar]:hidden">
              {crumbs.map((item, index) => {
                const last = index === crumbs.length - 1;
                const label = crumbLabel(item, t);
                return (
                  <li key={`${item.key}-${index}`} className="flex min-w-0 items-center gap-2">
                    {index > 0 ? (
                      <ChevronRight
                        className="h-3 w-3 shrink-0 text-[#C5CDD8] rtl:rotate-180"
                        aria-hidden
                      />
                    ) : null}
                    {last || !item.href ? (
                      <span
                        className="truncate py-0.5 font-semibold leading-normal text-[#0D2046]"
                        aria-current={last ? 'page' : undefined}
                      >
                        {label}
                      </span>
                    ) : (
                      <Link
                        href={item.href}
                        className="truncate py-0.5 font-medium leading-normal text-[#8A96A8] transition-colors hover:text-[#0D2046] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <p
          data-testid="auth-header-mobile-context"
          className="min-w-0 flex-1 truncate px-1 py-0.5 text-center text-[15px] font-bold leading-normal tracking-[-0.01em] text-[#0D2046] md:hidden"
        >
          {current ? crumbLabel(current, t) : tNav('account')}
        </p>

        <div className="relative z-[1] flex shrink-0 items-center gap-1.5 sm:gap-2">
          {ownerUtilities ? (
            <>
              <span className="hidden sm:inline-flex">
                <LocaleSwitcher />
              </span>
              <Button
                variant="ghost"
                size="icon"
                data-testid="nav-logout-mobile"
                className="h-10 w-10 sm:hidden"
                aria-label={tCommon('logout')}
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4 text-[#53637A]" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                data-testid="auth-header-logout"
                className="hidden h-10 w-10 sm:inline-flex"
                aria-label={tCommon('logout')}
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4 text-[#53637A]" />
              </Button>
            </>
          ) : null}
          <AuthHeaderNotifications />
        </div>
      </MarketplacePageShell>
    </header>
  );
}
