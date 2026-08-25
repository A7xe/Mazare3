'use client';

import { useTranslations } from 'next-intl';
import { MarketplaceSearchForm } from './marketplace-search-form';
import { TrustBadges } from './trust-badges';

export function HeroSection() {
  const t = useTranslations('home');

  return (
    <section className="border-b border-border bg-background px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl text-start">
          <p className="text-sm font-semibold text-primary">{t('eyebrow')}</p>
          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight text-navy sm:text-4xl lg:text-[2.5rem] lg:leading-tight">
            {t('headline')}
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
            {t('subheadline')}
          </p>
        </div>
        <div className="mt-6">
          <MarketplaceSearchForm />
        </div>
        <div className="mt-5">
          <TrustBadges compact />
        </div>
      </div>
    </section>
  );
}
