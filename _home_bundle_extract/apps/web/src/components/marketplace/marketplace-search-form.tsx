'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Clock, MapPin, Search, Users } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import {
  AVAILABILITY_PERIODS,
  JORDAN_CITIES,
  searchHref,
  type AvailabilityPeriod,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { todayIsoInPlatformZone } from '@/lib/format-platform-time';
import type { PropertySearchParams } from '@/lib/api-properties';

interface MarketplaceSearchFormProps {
  initial?: PropertySearchParams;
  compact?: boolean;
  idPrefix?: string;
  variant?: 'default' | 'stacked';
}

export function MarketplaceSearchForm({
  initial,
  compact = false,
  idPrefix = 'hero',
  variant = 'default',
}: MarketplaceSearchFormProps) {
  const t = useTranslations('home');
  const tSearch = useTranslations('search');
  const tProperty = useTranslations('property');
  const tCommon = useTranslations('common');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const minDate = todayIsoInPlatformZone();

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);
    const city = String(fd.get('city') || '').trim();
    const date = String(fd.get('date') || '').trim();
    const period = String(fd.get('period') || '').trim();
    const guestsRaw = String(fd.get('guests') || '').trim();
    const guests = guestsRaw ? Number(guestsRaw) : undefined;

    router.push(
      searchHref('/search', {
        city: city || undefined,
        date: date || undefined,
        period: period ? (period as AvailabilityPeriod) : undefined,
        guests: guests && Number.isFinite(guests) ? guests : undefined,
        q: initial?.q,
        area: initial?.area,
        propertyType: initial?.propertyType,
        amenities: initial?.amenities,
        hasPool: initial?.hasPool,
        allowsOvernight: initial?.allowsOvernight,
        allowsEvents: initial?.allowsEvents,
        featured: initial?.featured,
        verifiedOnly: initial?.verifiedOnly,
        sort: initial?.sort,
      }),
    );
  }

  const stacked = variant === 'stacked';

  const fieldClass = stacked
    ? 'flex h-[56px] w-full rounded-[12px] border border-[#E6EDF6] bg-white px-3 text-[12px] font-medium text-[#263A5B] placeholder:text-[#A1ACBB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6EF6]/25'
    : 'flex h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';

  const fieldLabelClass = stacked ? 'text-[10px] font-medium text-[#7F8B9D]' : 'text-xs text-navy';

  return (
    <form
      onSubmit={handleSearch}
      data-testid="marketplace-search-form"
      className={
        stacked
          ? 'w-full'
          : `w-full rounded-3xl border border-primary/12 bg-surface p-3 shadow-card sm:p-4 ${
              compact ? '' : 'sm:p-5'
            }`
      }
    >
      <div
        className={
          stacked
            ? 'flex flex-col gap-2'
            : `grid gap-3 ${compact ? 'md:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5'}`
        }
      >
        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-city`} className={fieldLabelClass}>
            {tSearch('filterCity')}
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <select
              id={`${idPrefix}-city`}
              name="city"
              data-testid="search-city"
              defaultValue={initial?.city ?? initial?.area ?? ''}
              className={`${fieldClass} ps-10`}
            >
              <option value="">{tSearch('filterAnyCity')}</option>
              {JORDAN_CITIES.map((city) => (
                <option key={city.key} value={city.key}>
                  {locale === 'ar' ? city.labelAr : city.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-date`} className={fieldLabelClass}>
            {t('dateLabel')}
          </Label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <input
              id={`${idPrefix}-date`}
              name="date"
              type="date"
              data-testid="search-date"
              min={minDate}
              defaultValue={initial?.date ?? ''}
              aria-label={t('dateLabel')}
              className={`${fieldClass} ps-10`}
            />
          </div>
        </div>

        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-period`} className={fieldLabelClass}>
            {tSearch('filterPeriod')}
          </Label>
          <div className="relative">
            <Clock className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <select
              id={`${idPrefix}-period`}
              name="period"
              data-testid="search-period"
              defaultValue={initial?.period ?? ''}
              className={`${fieldClass} ps-10`}
            >
              <option value="">{tSearch('filterAnyPeriod')}</option>
              {AVAILABILITY_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {tProperty(`period.${period}`)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-guests`} className={fieldLabelClass}>
            {t('guestsLabel')}
          </Label>
          <div className="relative">
            <Users className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <input
              id={`${idPrefix}-guests`}
              name="guests"
              type="number"
              min={1}
              max={100}
              data-testid="search-guests"
              defaultValue={initial?.guests ?? ''}
              placeholder="10"
              aria-label={t('guestsLabel')}
              className={`${fieldClass} ps-10`}
            />
          </div>
        </div>

        <div className={`flex items-end ${stacked ? 'pt-1' : compact ? '' : 'sm:col-span-2 lg:col-span-1'}`}>
          <Button
            type="submit"
            size="lg"
            data-testid="search-submit"
            className={
              stacked
                ? 'h-[50px] w-full rounded-[11px] bg-[linear-gradient(135deg,#2F6EF6,#4588FF)] text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.20)] transition hover:-translate-y-0.5 hover:bg-[#2F6EF6]'
                : 'h-12 w-full shadow-soft'
            }
          >
            <Search className="h-4 w-4" />
            {stacked ? t('startSearch') : tCommon('search')}
          </Button>
        </div>
      </div>
    </form>
  );
}
