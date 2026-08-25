'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { AVAILABILITY_PERIODS, JORDAN_CITIES, searchHref } from '@mazare3/shared';
import { parseSearchParams } from '@/lib/search-params';

export function ActiveFilterChips() {
  const t = useTranslations('search');
  const tProperty = useTranslations('property');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = parseSearchParams(Object.fromEntries(sp.entries()));

  const chips: { key: string; label: string; clear: Partial<typeof filters> }[] = [];
  if (filters.city) {
    const city = JORDAN_CITIES.find((c) => c.key === filters.city);
    chips.push({
      key: 'city',
      label: city ? (locale === 'ar' ? city.labelAr : city.labelEn) : filters.city,
      clear: { city: undefined },
    });
  }
  if (filters.date) chips.push({ key: 'date', label: filters.date, clear: { date: undefined, period: undefined } });
  if (filters.period && (AVAILABILITY_PERIODS as readonly string[]).includes(filters.period)) {
    chips.push({
      key: 'period',
      label: tProperty(`period.${filters.period}`),
      clear: { period: undefined },
    });
  }
  if (filters.guests) {
    chips.push({ key: 'guests', label: `${filters.guests}`, clear: { guests: undefined } });
  }
  if (filters.hasPool) chips.push({ key: 'hasPool', label: t('filterPoolYes'), clear: { hasPool: undefined } });
  if (filters.verifiedOnly) {
    chips.push({ key: 'verified', label: t('filterVerifiedOnly'), clear: { verifiedOnly: undefined } });
  }
  if (filters.featured) chips.push({ key: 'featured', label: t('filterFeatured'), clear: { featured: undefined } });
  if (filters.allowsOvernight) {
    chips.push({ key: 'overnight', label: t('filterOvernight'), clear: { allowsOvernight: undefined } });
  }
  if (filters.allowsEvents) {
    chips.push({ key: 'events', label: t('filterEvents'), clear: { allowsEvents: undefined } });
  }

  if (!chips.length) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="active-filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          className="inline-flex min-h-9 items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-3 text-sm text-navy"
          onClick={() => router.push(searchHref(pathname, { ...filters, ...chip.clear, page: 1 }))}
        >
          {chip.label}
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ))}
    </div>
  );
}
