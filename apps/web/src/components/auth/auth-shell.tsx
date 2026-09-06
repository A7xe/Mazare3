import type { ReactNode } from 'react';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { Heart, CalendarCheck, UserRound } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { LocaleSwitcher } from '@/components/layout/locale-switcher';

export type AuthShellMode = 'unified' | 'login' | 'signup' | 'forgot' | 'reset';

interface AuthShellProps {
  children: ReactNode;
  mode: AuthShellMode;
}

export async function AuthShell({ children, mode }: AuthShellProps) {
  const t = await getTranslations('common');
  const tAuth = await getTranslations('auth');

  const showModeSwitch = mode === 'login' || mode === 'signup';
  const switchHref = mode === 'login' ? '/auth?mode=email&emailMode=signup' : '/auth?mode=email&emailMode=login';
  const switchLabel = mode === 'login' ? tAuth('signupCtaLink') : tAuth('loginCtaLink');

  return (
    <div
      data-testid="auth-shell"
      className="relative flex min-h-[100dvh] flex-col bg-[#F5F8FC]"
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -end-24 -top-16 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-24 -start-16 h-64 w-64 rounded-full bg-[#0D2046]/6 blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-[#E4ECF5]/80 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
          <Link href="/" className="flex min-w-0 items-center gap-2.5" data-testid="auth-shell-brand">
            <Image
              src="/logo/logo-main.png"
              alt={t('brand')}
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl object-contain"
              priority
            />
            <span className="truncate text-sm font-bold text-[#0D2046] sm:text-base">
              {t('brand')}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <LocaleSwitcher />
            {showModeSwitch ? (
              <Link
                href={switchHref}
                data-testid="auth-shell-switch"
                className="hidden rounded-full border border-[#D8E3F0] bg-white px-3.5 py-1.5 text-sm font-semibold text-[#0D2046] transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex"
              >
                {switchLabel}
              </Link>
            ) : null}
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 items-center px-4 py-8 sm:px-6 sm:py-12 lg:py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16">
          <div className="mx-auto w-full max-w-[400px] lg:mx-0 lg:max-w-none">{children}</div>

          <aside className="hidden text-start lg:block">
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-primary">
              {t('brand')}
            </p>
            <h1 className="mt-3 max-w-md text-3xl font-heading leading-tight text-[#0D2046] xl:text-4xl">
              {tAuth('shellTitle')}
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-[#5B6B7F]">
              {tAuth('shellSubtitle')}
            </p>
            <ul className="mt-8 space-y-3.5 text-sm text-[#445468]">
              {[
                { icon: Heart, text: tAuth('shellPoint1') },
                { icon: CalendarCheck, text: tAuth('shellPoint2') },
                { icon: UserRound, text: tAuth('shellPoint3') },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="leading-snug">{text}</span>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
