'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Bell,
  Building2,
  CalendarCheck,
  CreditCard,
  FileText,
  Headphones,
  Heart,
  HelpCircle,
  Home,
  Languages,
  LifeBuoy,
  Loader2,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Settings,
  UserRound,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { fetchAuthIdentities, getMe, logout, type AuthUser } from '@/lib/api-auth';
import { useAuthSession } from '@/components/auth/auth-session';
import { fetchPartnerOnboarding } from '@/lib/api-partner';
import {
  ADD_FARM_PARTNER_HREF,
  ADD_FARM_WIZARD_HREF,
  OWNER_PROPERTIES_HREF,
  rememberPartnerVerificationStatus,
  resolveAccountPartnerSurface,
  shouldFetchPartnerStatusForAccount,
  type AccountPartnerSurfaceKind,
} from '@/lib/add-farm-entry';
import { cn } from '@/lib/utils';

function firstName(full: string) {
  const trimmed = full.trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

function avatarLetter(name: string | null | undefined, email: string | null | undefined) {
  const source = name?.trim() || email?.trim() || '?';
  return source.charAt(0).toLocaleUpperCase();
}

type HubItem = {
  href?: string;
  hash?: string;
  label: string;
  testId?: string;
  icon: ReactNode;
  tone: string;
  onClick?: () => void;
};

function DiscoverDestinationsCard({ className }: { className?: string }) {
  const t = useTranslations('accountHome');
  return (
    <Link
      href="/search"
      className={cn(
        'group relative block overflow-hidden rounded-[22px] border border-[#E4EAF3] bg-white shadow-[0_14px_32px_-20px_rgba(13,32,70,.45)]',
        className,
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src="/account/discover-destinations.jpg"
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {/* Soft white wave into the footer panel */}
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-[42%] w-full"
          viewBox="0 0 320 110"
          preserveAspectRatio="none"
        >
          <path
            d="M0 55 C55 95 95 18 160 48 C225 78 265 20 320 52 L320 110 L0 110 Z"
            fill="white"
          />
        </svg>
      </div>
      <div className="relative -mt-1 flex items-end justify-between gap-3 bg-white px-4 pb-4 pt-1">
        <div className="min-w-0 flex-1 text-start">
          <p className="text-[15px] font-bold leading-snug text-[#0D2046]">{t('discoverTitle')}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-[#7A879B]">{t('discoverSubtitle')}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2F6EF6] shadow-[0_8px_18px_-6px_rgba(47,110,246,.55)] ring-1 ring-[#E8EEF8]">
          <Home className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function HubCard({
  title,
  titleIcon,
  items,
}: {
  title: string;
  titleIcon: ReactNode;
  items: HubItem[];
}) {
  return (
    <section className="rounded-[22px] border border-[#E4EAF3] bg-white p-4 shadow-[0_10px_28px_-18px_rgba(13,32,70,.35)] sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-[#0D2046]">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
          {titleIcon}
        </span>
        <h2 className="text-[15px] font-bold">{title}</h2>
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => {
          const content = (
            <>
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                  item.tone,
                )}
              >
                {item.icon}
              </span>
              <span className="min-w-0 flex-1 text-start text-[13px] font-semibold text-[#0D2046]">
                {item.label}
              </span>
              <span
                aria-hidden
                className="text-[#F06A4D]"
                style={{
                  width: 0,
                  height: 0,
                  borderTop: '5px solid transparent',
                  borderBottom: '5px solid transparent',
                  borderInlineStart: '7px solid currentColor',
                }}
              />
            </>
          );
          const className =
            'flex w-full items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-[#F7FAFF]';
          if (item.onClick) {
            return (
              <li key={item.testId ?? item.label}>
                <button
                  type="button"
                  data-testid={item.testId}
                  onClick={item.onClick}
                  className={className}
                >
                  {content}
                </button>
              </li>
            );
          }
          if (item.hash) {
            return (
              <li key={item.label}>
                <a href={item.hash} data-testid={item.testId} className={className}>
                  {content}
                </a>
              </li>
            );
          }
          return (
            <li key={item.testId ?? item.href ?? item.hash ?? item.label}>
              <Link href={item.href ?? '/account'} data-testid={item.testId} className={className}>
                {content}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function AccountHomeView() {
  const t = useTranslations('accountHome');
  const tPartner = useTranslations('accountHome.partnership');
  const tNav = useTranslations('nav');
  const tN = useTranslations('notifications');
  const tCommon = useTranslations('common');
  const tPay = useTranslations('paymentMethods');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { refresh } = useAuthSession();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [phoneMasked, setPhoneMasked] = useState<string | null>(null);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [partnerSurface, setPartnerSurface] = useState<AccountPartnerSurfaceKind | null>('join');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMe();
      const me = res.data.user;
      setUser(me);

      void fetchAuthIdentities()
        .then((idRes) => {
          setPhoneMasked(idRes.data.phone.linked ? idRes.data.phone.masked : null);
        })
        .catch(() => {
          setPhoneMasked(null);
        });

      const base = resolveAccountPartnerSurface({ user: me });
      if (base === null) {
        setPartnerSurface(null);
        setPartnerLoading(false);
        return;
      }

      if (base === 'approved' || !shouldFetchPartnerStatusForAccount(me)) {
        setPartnerSurface(base);
        setPartnerLoading(false);
        return;
      }

      setPartnerLoading(true);
      try {
        const onboard = await fetchPartnerOnboarding();
        rememberPartnerVerificationStatus(onboard.data.verificationStatus);
        setPartnerSurface(
          resolveAccountPartnerSurface({
            user: me,
            verificationStatus: onboard.data.verificationStatus,
          }),
        );
      } catch {
        setPartnerSurface(base);
      } finally {
        setPartnerLoading(false);
      }
    } catch {
      router.push('/auth?returnUrl=' + encodeURIComponent('/account'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      await refresh();
      router.push('/');
      router.refresh();
    }
  }

  function switchLocale() {
    const nextLocale = locale === 'ar' ? 'en' : 'ar';
    router.replace(pathname, { locale: nextLocale });
  }

  if (loading || !user) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const greetingName = user.name?.trim() || user.email || t('empty');
  const shortName = firstName(greetingName) || greetingName;
  const roleKey = user.role === 'owner' || user.role === 'admin' ? user.role : 'customer';
  const languageLabel = user.locale === 'en' ? t('languageEn') : t('languageAr');
  const letter = avatarLetter(user.name, user.email);

  const accountItems: HubItem[] = [
    {
      href: '/account/profile',
      label: t('editProfile'),
      testId: 'account-home-profile',
      tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
      icon: <UserRound className="h-4 w-4" aria-hidden />,
    },
    {
      href: '/account/notifications',
      label: tN('title'),
      testId: 'account-home-notifications',
      tone: 'bg-[#F1E9FF] text-[#7C3AED]',
      icon: <Bell className="h-4 w-4" aria-hidden />,
    },
  ];

  if (!partnerLoading && partnerSurface === 'join') {
    accountItems.push({
      href: ADD_FARM_PARTNER_HREF,
      label: t('becomePartner'),
      testId: 'account-home-partner-join',
      tone: 'bg-[#E8F8EF] text-[#16A34A]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
  } else if (!partnerLoading && partnerSurface === 'draft') {
    accountItems.push({
      href: ADD_FARM_PARTNER_HREF,
      label: tPartner('draft.cta'),
      testId: 'account-home-partner-continue',
      tone: 'bg-[#FFF1E8] text-[#EA580C]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
  } else if (
    !partnerLoading &&
    (partnerSurface === 'submitted' || partnerSurface === 'under_review')
  ) {
    accountItems.push({
      href: ADD_FARM_PARTNER_HREF,
      label: tPartner('submitted.cta'),
      testId: 'account-home-partner-track',
      tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
  } else if (!partnerLoading && partnerSurface === 'changes_requested') {
    accountItems.push({
      href: ADD_FARM_PARTNER_HREF,
      label: tPartner('changes_requested.cta'),
      testId: 'account-home-partner-update',
      tone: 'bg-[#FFF7ED] text-[#C2410C]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
  } else if (
    !partnerLoading &&
    (partnerSurface === 'rejected' || partnerSurface === 'suspended')
  ) {
    accountItems.push({
      href: ADD_FARM_PARTNER_HREF,
      label: tPartner(`${partnerSurface}.cta`),
      testId: 'account-home-partner-view',
      tone: 'bg-[#FEE8EC] text-[#E11D48]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
  } else if (!partnerLoading && partnerSurface === 'approved') {
    accountItems.push({
      href: OWNER_PROPERTIES_HREF,
      label: tPartner('approved.title'),
      testId: 'account-home-partner-properties',
      tone: 'bg-[#E8F8EF] text-[#16A34A]',
      icon: <Building2 className="h-4 w-4" aria-hidden />,
    });
    accountItems.push({
      href: ADD_FARM_WIZARD_HREF,
      label: tPartner('approved.addCta'),
      testId: 'account-home-partner-add-property',
      tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
      icon: <Plus className="h-4 w-4" aria-hidden />,
    });
  }

  return (
    <div data-testid="account-home" className="pb-8">
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-5">
        {/* Right rail (RTL): title + discover + support */}
        <aside className="flex flex-col gap-4">
          <header>
            <h1 className="text-[28px] font-bold tracking-tight text-[#0D2046] sm:text-[32px]">
              {t('hubTitle')}
            </h1>
            <p className="mt-1 text-[13px] leading-relaxed text-[#7A879B]">
              {t('hubSubtitle')}
            </p>
          </header>

          <DiscoverDestinationsCard className="hidden lg:block" />

          <div className="hidden flex-col items-center rounded-[22px] border border-[#E4EAF3] bg-white px-5 py-6 text-center shadow-[0_10px_28px_-18px_rgba(13,32,70,.35)] lg:flex">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
              <LifeBuoy className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 text-[16px] font-bold text-[#0D2046]">{t('supportCardTitle')}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#7A879B]">{t('supportCardBody')}</p>
            <Link
              href="/contact"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#2F6EF6] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(47,110,246,.9)] transition hover:bg-[#255FE0]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('contactUs')}
            </Link>
          </div>
        </aside>

        {/* Main column: blue banner + hub cards */}
        <div className="flex min-w-0 flex-col gap-4">
          <section
            data-testid="account-profile"
            className="relative isolate overflow-hidden rounded-[28px] bg-[linear-gradient(105deg,#0A2458_0%,#123A78_42%,#1B4F9A_100%)] px-5 py-7 text-white shadow-[0_18px_40px_-24px_rgba(11,42,91,.7)] sm:px-8 sm:py-8"
            aria-label={t('hubWelcomeAria')}
          >
            {/* Soft vignette + dots */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.12]"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 20% 30%, #fff 1.2px, transparent 1.8px), radial-gradient(circle at 70% 60%, #fff 1px, transparent 1.6px)',
                backgroundSize: '42px 42px, 28px 28px',
              }}
            />
            {/* Palm + houses silhouette (welcome side / physical left) */}
            <svg
              aria-hidden
              className="pointer-events-none absolute bottom-0 left-0 h-[92%] w-[min(58%,420px)] text-[#071B42] opacity-[0.45]"
              viewBox="0 0 420 220"
              fill="currentColor"
              preserveAspectRatio="xMinYMax meet"
            >
              {/* ground */}
              <path d="M0 200 H420 V220 H0 Z" opacity="0.35" />
              {/* small houses left */}
              <path d="M18 200 V148 L42 128 L66 148 V200 Z" />
              <rect x="34" y="162" width="12" height="18" rx="1" className="fill-[#0A2458]" />
              <path d="M72 200 V156 L92 138 L112 156 V200 Z" />
              <rect x="86" y="168" width="10" height="14" rx="1" className="fill-[#0A2458]" />
              <path d="M118 200 V168 H148 V200 Z" />
              <path d="M118 168 L133 150 L148 168 Z" />
              <rect x="128" y="176" width="8" height="12" rx="1" className="fill-[#0A2458]" />
              {/* bush / round tree */}
              <circle cx="168" cy="178" r="18" />
              <rect x="164" y="178" width="8" height="22" />
              {/* large palm */}
              <rect x="228" y="118" width="8" height="82" rx="3" />
              <path d="M232 118 C190 95 168 70 158 48 C198 68 220 92 232 118 Z" />
              <path d="M232 112 C205 78 188 48 182 22 C214 48 226 82 232 112 Z" />
              <path d="M232 110 C255 76 278 48 298 24 C268 52 246 82 232 110 Z" />
              <path d="M232 118 C270 98 300 88 328 82 C292 98 258 110 232 118 Z" />
              <path d="M232 120 C205 108 172 108 142 112 C178 112 208 116 232 120 Z" />
              <path d="M232 116 C250 100 268 72 276 48 C262 76 246 100 232 116 Z" />
              {/* distant hut */}
              <path d="M330 200 V170 L348 154 L366 170 V200 Z" />
              <rect x="342" y="178" width="10" height="14" rx="1" className="fill-[#0A2458]" />
            </svg>
            {/* soft diagonal light */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.06)_58%,transparent_78%)]"
            />

            <div className="relative z-[1] flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
              {/* Profile block — sits on the inline-start side (right in RTL) */}
              <div className="flex items-center gap-4">
                <div className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border-[3px] border-white bg-[#3B6FD6] text-[32px] font-bold shadow-[0_10px_24px_-10px_rgba(0,0,0,.45)]">
                  {letter}
                </div>
                <div className="min-w-0">
                  <p
                    data-testid="account-profile-name"
                    className="truncate text-[20px] font-bold sm:text-[22px]"
                  >
                    {greetingName}
                  </p>
                  <div className="mt-2 space-y-1.5 text-[12px] text-white/90 sm:text-[13px]">
                    {user.email ? (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                        <span data-testid="account-profile-email" className="truncate">
                          {user.email}
                        </span>
                      </p>
                    ) : (
                      <span data-testid="account-profile-email" className="sr-only">
                        {t('empty')}
                      </span>
                    )}
                    {phoneMasked ? (
                      <p className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                        <span dir="ltr">{phoneMasked}</span>
                      </p>
                    ) : null}
                  </div>
                  <Link
                    href="/account/profile"
                    data-testid="account-edit-profile"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/70 bg-transparent px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/10"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    {t('editProfile')}
                  </Link>
                  <span data-testid="account-profile-role" className="sr-only">
                    {t(`roles.${roleKey}`)}
                  </span>
                </div>
              </div>

              {/* Welcome block — sits on the inline-end side (left in RTL) */}
              <div className="max-w-sm text-start">
                <p className="text-[22px] font-bold leading-snug sm:text-[26px]">
                  {t('welcomeBackLine')} <span aria-hidden>👋</span>
                </p>
                <p className="mt-1 text-[18px] font-semibold text-white/95 sm:text-[20px]">
                  {shortName}
                </p>
                <p className="mt-2 text-[13px] text-white/75">{t('welcomeWish')}</p>
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <HubCard
              title={tNav('myBookings')}
              titleIcon={<CalendarCheck className="h-4 w-4" aria-hidden />}
              items={[
                {
                  href: '/account/bookings',
                  label: tNav('myBookings'),
                  testId: 'account-home-bookings',
                  tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
                  icon: <CalendarCheck className="h-4 w-4" aria-hidden />,
                },
                {
                  href: '/account/favorites',
                  label: tNav('favorites'),
                  testId: 'account-home-favorites',
                  tone: 'bg-[#FEE8EC] text-[#E11D48]',
                  icon: <Heart className="h-4 w-4" aria-hidden />,
                },
                {
                  href: '/account/payment-methods',
                  label: tPay('title'),
                  testId: 'account-home-payment-methods',
                  tone: 'bg-[#E8F8EF] text-[#16A34A]',
                  icon: <CreditCard className="h-4 w-4" aria-hidden />,
                },
              ]}
            />

            <HubCard
              title={tNav('account')}
              titleIcon={<UserRound className="h-4 w-4" aria-hidden />}
              items={accountItems}
            />

            <HubCard
              title={t('supportHelpTitle')}
              titleIcon={<Headphones className="h-4 w-4" aria-hidden />}
              items={[
                {
                  href: '/account/support',
                  label: t('helpCenter'),
                  testId: 'account-home-support',
                  tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
                  icon: <HelpCircle className="h-4 w-4" aria-hidden />,
                },
                {
                  href: '/contact',
                  label: t('contactUs'),
                  testId: 'account-home-contact',
                  tone: 'bg-[#E8F8EF] text-[#16A34A]',
                  icon: <MessageCircle className="h-4 w-4" aria-hidden />,
                },
                {
                  href: '/terms',
                  label: t('termsPolicies'),
                  testId: 'account-home-terms',
                  tone: 'bg-[#F1E9FF] text-[#7C3AED]',
                  icon: <FileText className="h-4 w-4" aria-hidden />,
                },
              ]}
            />

            <HubCard
              title={t('generalSettings')}
              titleIcon={<Settings className="h-4 w-4" aria-hidden />}
              items={[
                {
                  label: `${t('language')}: ${languageLabel}`,
                  tone: 'bg-[#EAF2FF] text-[#2F6EF6]',
                  icon: <Languages className="h-4 w-4" aria-hidden />,
                  onClick: switchLocale,
                },
                {
                  label: tCommon('logout'),
                  testId: 'nav-logout',
                  tone: 'bg-[#FEE8EC] text-[#E11D48]',
                  icon: <LogOut className="h-4 w-4" aria-hidden />,
                  onClick: () => void handleLogout(),
                },
              ]}
            />
          </div>

          {/* Mobile: discover + support after hub cards */}
          <DiscoverDestinationsCard className="lg:hidden" />

          <div className="flex flex-col items-center rounded-[22px] border border-[#E4EAF3] bg-white px-5 py-6 text-center shadow-[0_10px_28px_-18px_rgba(13,32,70,.35)] lg:hidden">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
              <LifeBuoy className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 text-[16px] font-bold text-[#0D2046]">{t('supportCardTitle')}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-[#7A879B]">{t('supportCardBody')}</p>
            <Link
              href="/contact"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-[#2F6EF6] px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_20px_-12px_rgba(47,110,246,.9)] transition hover:bg-[#255FE0]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('contactUs')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
