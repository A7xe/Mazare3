'use client';

import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { searchHref, type AvailabilityPeriod } from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import type { PropertySearchParams } from '@/lib/api-properties';

interface SearchEmptyStateProps {
  filters: PropertySearchParams;
  otherPeriods: AvailabilityPeriod[];
}

export function SearchEmptyState({ filters, otherPeriods }: SearchEmptyStateProps) {
  const t = useTranslations('search');
  const tProperty = useTranslations('property');
  const tCommon = useTranslations('common');

  return (
    <div
      className="flex flex-col items-center rounded-3xl border border-dashed border-primary/20 bg-primary-soft/40 px-6 py-14 text-center"
      data-testid="search-empty"
    >
      <SearchX className="mb-3 h-8 w-8 text-primary" aria-hidden />
      <h3 className="text-lg font-semibold text-navy">{tCommon('noResults')}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{t('emptyHint')}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {otherPeriods.map((period) => (
          <Button key={period} variant="secondary" size="sm" asChild>
            <Link href={searchHref('/search', { ...filters, period, page: 1 })}>
              {t('tryPeriod', { period: tProperty(`period.${period}`) })}
            </Link>
          </Button>
        ))}
        {filters.period ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={searchHref('/search', { ...filters, period: undefined, page: 1 })}>
              {t('tryAnyPeriod')}
            </Link>
          </Button>
        ) : null}
        {filters.date ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={searchHref('/search', { ...filters, date: undefined, period: undefined, page: 1 })}>
              {t('browseWithoutDate')}
            </Link>
          </Button>
        ) : null}
        <Button variant="outline" size="sm" asChild>
          <Link href="/search">{t('clearFilters')}</Link>
        </Button>
      </div>
    </div>
  );
}
