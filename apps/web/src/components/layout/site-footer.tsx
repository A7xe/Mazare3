'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

const HELP_LINKS = [
  { href: '/about', key: 'about', testId: 'footer-legal-about' },
  { href: '/contact', key: 'contact', testId: 'footer-legal-contact' },
  { href: '/terms', key: 'terms', testId: 'footer-legal-terms' },
  { href: '/privacy', key: 'privacy', testId: 'footer-legal-privacy' },
  { href: '/cancellation-refund', key: 'cancellation-refund', testId: 'footer-legal-cancellation' },
  { href: '/booking-payment', key: 'booking-payment', testId: 'footer-legal-booking-payment' },
] as const;

export function SiteFooter() {
  const t = useTranslations('common');
  const tLegal = useTranslations('legal');
  const year = new Date().getFullYear();

  return (
    <footer className="gradient-premium mt-auto border-t border-night/20 text-primary-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-lg font-semibold">{t('brand')}</p>
            <p className="mt-2 max-w-sm text-sm text-primary-foreground/75">{t('tagline')}</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-primary-foreground/80">
              <Link href="/search" className="transition-colors hover:text-primary-foreground">
                {t('explore')}
              </Link>
              <Link href="/become-owner" className="transition-colors hover:text-primary-foreground">
                {t('listProperty')}
              </Link>
            </div>
          </div>
          <nav aria-label={tLegal('helpNav')} data-testid="footer-legal-nav">
            <p className="text-sm font-semibold text-primary-foreground">{tLegal('helpNav')}</p>
            <ul className="mt-3 grid gap-2 text-sm text-primary-foreground/80 sm:grid-cols-2">
              {HELP_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    data-testid={item.testId}
                    className="transition-colors hover:text-primary-foreground"
                  >
                    {tLegal(`nav.${item.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <p className="mt-10 text-xs text-primary-foreground/50">© {year}</p>
      </div>
    </footer>
  );
}
