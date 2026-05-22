'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

export function SiteFooter() {
  const t = useTranslations('common');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-semibold">{t('brand')}</p>
            <p className="mt-2 max-w-sm text-sm text-muted">{t('tagline')}</p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-muted">
            <Link href="/search" className="hover:text-foreground">
              {t('explore')}
            </Link>
            <Link href="/become-owner" className="hover:text-foreground">
              {t('listProperty')}
            </Link>
            <span className="text-border">|</span>
            <span>© {year}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
