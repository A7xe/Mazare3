'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { LocaleSwitcher } from './locale-switcher';

export function SiteHeader() {
  const t = useTranslations('common');
  const tNav = useTranslations('nav');
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-sm font-bold text-primary-foreground">
            م
          </span>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold leading-tight">{t('brand')}</p>
            <p className="text-xs text-muted">{t('tagline')}</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link href="/search" className="text-sm text-muted transition-colors hover:text-foreground">
            {tNav('search')}
          </Link>
          <Link
            href="/become-owner"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {tNav('becomeOwner')}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/login">{t('login')}</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">{t('signup')}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
