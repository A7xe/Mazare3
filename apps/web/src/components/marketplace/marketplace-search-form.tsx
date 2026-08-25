'use client';

import type { ReactNode } from 'react';
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
import { cn } from '@/lib/utils';

interface MarketplaceSearchFormProps {
  initial?: PropertySearchParams;
  compact?: boolean;
  idPrefix?: string;
  variant?: 'default' | 'stacked';
}

function StackedField({
  icon,
  label,
  htmlFor,
  children,
}: {
  icon: ReactNode;
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-[14px] border border-[#E7EEF8] bg-white px-2.5 py-2 shadow-[0_4px_12px_rgba(47,110,246,.04)]">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F3F8FF] text-[#2F6EF6]">
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-start">
        <Label htmlFor={htmlFor} className="mb-0 block text-[10px] font-medium leading-none text-[#8794A7]">
          {label}
        </Label>
        {children}
      </div>
    </div>
  );
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
  const defaultFieldClass =
    'flex h-12 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40';
  const stackedControlClass =
    'w-full appearance-none border-0 bg-transparent p-0 text-start text-[12px] font-semibold leading-tight text-[#0D2046] outline-none ring-0 placeholder:font-medium placeholder:text-[#8794A7] focus:outline-none focus:ring-0';

  if (stacked) {
    return (
      <form onSubmit={handleSearch} data-testid="marketplace-search-form" className="w-full">
        <div className="flex flex-col gap-1.5">
          <StackedField
            icon={<MapPin className="h-4 w-4" aria-hidden />}
            label={tSearch('filterCity')}
            htmlFor={`${idPrefix}-city`}
          >
            <select
              id={`${idPrefix}-city`}
              name="city"
              data-testid="search-city"
              defaultValue={initial?.city ?? initial?.area ?? ''}
              className={stackedControlClass}
            >
              <option value="">{tSearch('filterAnyCity')}</option>
              {JORDAN_CITIES.map((city) => (
                <option key={city.key} value={city.key}>
                  {locale === 'ar' ? city.labelAr : city.labelEn}
                </option>
              ))}
            </select>
          </StackedField>

          <StackedField
            icon={<Calendar className="h-4 w-4" aria-hidden />}
            label={t('dateLabel')}
            htmlFor={`${idPrefix}-date`}
          >
            <input
              id={`${idPrefix}-date`}
              name="date"
              type="date"
              data-testid="search-date"
              min={minDate}
              defaultValue={initial?.date ?? ''}
              aria-label={t('dateLabel')}
              className={stackedControlClass}
            />
          </StackedField>

          <StackedField
            icon={<Clock className="h-4 w-4" aria-hidden />}
            label={tSearch('filterPeriod')}
            htmlFor={`${idPrefix}-period`}
          >
            <select
              id={`${idPrefix}-period`}
              name="period"
              data-testid="search-period"
              defaultValue={initial?.period ?? ''}
              className={stackedControlClass}
            >
              <option value="">{tSearch('filterAnyPeriod')}</option>
              {AVAILABILITY_PERIODS.map((period) => (
                <option key={period} value={period}>
                  {tProperty(`period.${period}`)}
                </option>
              ))}
            </select>
          </StackedField>

          <StackedField
            icon={<Users className="h-4 w-4" aria-hidden />}
            label={t('guestsLabel')}
            htmlFor={`${idPrefix}-guests`}
          >
            <input
              id={`${idPrefix}-guests`}
              name="guests"
              type="number"
              min={1}
              max={100}
              data-testid="search-guests"
              defaultValue={initial?.guests ?? ''}
              placeholder="2"
              aria-label={t('guestsLabel')}
              className={stackedControlClass}
            />
          </StackedField>

          <Button
            type="submit"
            size="lg"
            data-testid="search-submit"
            className="mt-0.5 h-[42px] w-full rounded-[12px] bg-[linear-gradient(90deg,#2F6EF6_0%,#4B8CFF_100%)] text-[13px] font-semibold text-white shadow-[0_8px_16px_rgba(47,110,246,.22)] transition hover:-translate-y-0.5 hover:bg-[#2F6EF6]"
          >
            <Search className="h-3.5 w-3.5" />
            {t('startSearch')}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSearch}
      data-testid="marketplace-search-form"
      className={cn(
        'w-full rounded-3xl border border-primary/12 bg-surface p-3 shadow-card sm:p-4',
        compact ? '' : 'sm:p-5',
      )}
    >
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-5'}`}>
        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-city`} className="text-xs text-navy">
            {tSearch('filterCity')}
          </Label>
          <div className="relative">
            <MapPin className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <select
              id={`${idPrefix}-city`}
              name="city"
              data-testid="search-city"
              defaultValue={initial?.city ?? initial?.area ?? ''}
              className={`${defaultFieldClass} ps-10`}
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
          <Label htmlFor={`${idPrefix}-date`} className="text-xs text-navy">
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
              className={`${defaultFieldClass} ps-10`}
            />
          </div>
        </div>

        <div className="space-y-1 text-start">
          <Label htmlFor={`${idPrefix}-period`} className="text-xs text-navy">
            {tSearch('filterPeriod')}
          </Label>
          <div className="relative">
            <Clock className="pointer-events-none absolute start-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-[#7F8B9D]" />
            <select
              id={`${idPrefix}-period`}
              name="period"
              data-testid="search-period"
              defaultValue={initial?.period ?? ''}
              className={`${defaultFieldClass} ps-10`}
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
          <Label htmlFor={`${idPrefix}-guests`} className="text-xs text-navy">
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
              className={`${defaultFieldClass} ps-10`}
            />
          </div>
        </div>

        <div className={`flex items-end ${compact ? '' : 'sm:col-span-2 lg:col-span-1'}`}>
          <Button type="submit" size="lg" data-testid="search-submit" className="h-12 w-full shadow-soft">
            <Search className="h-4 w-4" />
            {tCommon('search')}
          </Button>
        </div>
      </div>
    </form>
  );
}
