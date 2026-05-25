'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function SiteFooter() {
  const t = useTranslations('common');
  const year = new Date().getFullYear();

  return (
    <footer className="gradient-premium mt-auto border-t border-night/20 text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-semibold">{t('brand')}</p>
            <p className="mt-2 max-w-sm text-sm text-primary-foreground/75">{t('tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-primary-foreground/80">
            <Link href="/search" className="transition-colors hover:text-primary-foreground">
              {t('explore')}
            </Link>
            <Link href="/become-owner" className="transition-colors hover:text-primary-foreground">
              {t('listProperty')}
            </Link>
            <span className="text-primary-foreground/40">|</span>
            <span>© {year}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
