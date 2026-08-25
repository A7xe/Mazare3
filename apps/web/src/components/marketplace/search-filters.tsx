'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, X } from 'lucide-react';
import {
  buildExploreFilterApplyParams,
  buildExploreFilterResetParams,
  exploreFilterCityOptions,
  exploreFilterPropertyTypeOptions,
  EXPLORE_FILTER_SHEET_AMENITY_KEYS,
  searchHref,
  validateExplorePriceRange,
  type PropertySearchQuery,
  type PropertyType,
} from '@mazare3/shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  variant?: 'sidebar' | 'sheet';
  onApplied?: () => void;
}

function readCurrentFromParams(searchParams: URLSearchParams): Partial<PropertySearchQuery> {
  const amenities = (searchParams.get('amenities') ?? '').split(',').filter(Boolean);
  const trueOnly = (key: string): true | undefined =>
    searchParams.get(key) === 'true' ? true : undefined;
  return {
    q: searchParams.get('q') || undefined,
    city: searchParams.get('city') || undefined,
    area: searchParams.get('area') || undefined,
    date: searchParams.get('date') || undefined,
    period: (searchParams.get('period') as PropertySearchQuery['period']) || undefined,
    guests: searchParams.get('guests') ? Number(searchParams.get('guests')) : undefined,
    minPrice: searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
    maxPrice: searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
    propertyType: (searchParams.get('propertyType') || undefined) as PropertyType | undefined,
    sort: (searchParams.get('sort') as PropertySearchQuery['sort']) || undefined,
    verifiedOnly: trueOnly('verifiedOnly'),
    hasPool: trueOnly('hasPool'),
    allowsOvernight: trueOnly('allowsOvernight'),
    allowsEvents: trueOnly('allowsEvents'),
    amenities: amenities.length ? amenities : undefined,
    lat: searchParams.get('lat') ? Number(searchParams.get('lat')) : undefined,
    lng: searchParams.get('lng') ? Number(searchParams.get('lng')) : undefined,
  };
}

export function SearchFilters({ variant = 'sidebar', onApplied }: SearchFiltersProps) {
  const t = useTranslations('search');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [priceError, setPriceError] = useState<string | null>(null);
  const soft = variant === 'sheet';
  const formKey = searchParams.toString();
  const cities = exploreFilterCityOptions();
  const propertyTypes = exploreFilterPropertyTypeOptions();

  const selectedAmenities = useMemo(
    () => (searchParams.get('amenities') ?? '').split(',').filter(Boolean),
    [searchParams],
  );

  const applyForm = useCallback(
    (form: HTMLFormElement) => {
      const fd = new FormData(form);
      const amenities = fd.getAll('amenities').map(String).filter(Boolean);
      const priceCheck = validateExplorePriceRange(fd.get('minPrice'), fd.get('maxPrice'));
      if (!priceCheck.ok) {
        setPriceError(
          priceCheck.reason === 'min_gt_max'
            ? t('filterPriceMinGtMax')
            : t('filterPriceNegative'),
        );
        return;
      }
      setPriceError(null);

      const current = readCurrentFromParams(searchParams);
      const nextParams = buildExploreFilterApplyParams(current, {
        city: String(fd.get('city') || '') || undefined,
        minPrice: priceCheck.minPrice,
        maxPrice: priceCheck.maxPrice,
        propertyType: (String(fd.get('propertyType') || '') || undefined) as PropertyType | undefined,
        hasPool: String(fd.get('hasPool') || '') === 'true' ? true : undefined,
        amenities,
        allowsOvernight: fd.get('allowsOvernight') === 'on' ? true : undefined,
        allowsEvents: fd.get('allowsEvents') === 'on' ? true : undefined,
        verifiedOnly: fd.get('verifiedOnly') === 'on' ? true : undefined,
      });

      const next = searchHref(pathname, nextParams);
      startTransition(() => {
        router.push(next);
        onApplied?.();
      });
    },
    [onApplied, pathname, router, searchParams, t],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    applyForm(e.currentTarget);
  }

  function clearFilters() {
    const current = readCurrentFromParams(searchParams);
    const next = searchHref(pathname, buildExploreFilterResetParams(current));
    setPriceError(null);
    startTransition(() => {
      router.push(next);
      onApplied?.();
    });
  }

  const selectClass = soft
    ? 'flex h-11 w-full appearance-none rounded-2xl border border-[#E1EAF6] bg-[#F7FAFF] px-3.5 text-sm font-medium text-[#0D2046] outline-none transition focus:border-[#2F6EF6]/50 focus:bg-white focus:ring-4 focus:ring-[#2F6EF6]/10'
    : 'flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy';
  const inputClass = soft
    ? 'h-11 rounded-2xl border-[#E1EAF6] bg-[#F7FAFF] text-[#0D2046] shadow-none focus-visible:border-[#2F6EF6]/50 focus-visible:ring-[#2F6EF6]/15'
    : undefined;
  const labelClass = soft ? 'text-[12px] font-semibold text-[#6B7A90]' : undefined;

  return (
    <form
      key={formKey}
      className={cn(soft ? 'flex min-h-0 flex-1 flex-col' : 'space-y-5')}
      onSubmit={handleSubmit}
      data-testid={variant === 'sheet' ? 'search-filters-sheet' : 'search-filters'}
    >
      <div className={cn(soft ? 'space-y-5 px-1 pb-4' : 'contents')}>
        {/* q and sort are owned by the main search bar / sort pills — not duplicated here */}

        <div className="space-y-2">
          <Label htmlFor="filter-city" className={labelClass}>
            {t('filterCity')}
          </Label>
          <select
            id="filter-city"
            name="city"
            defaultValue={searchParams.get('city') ?? ''}
            className={selectClass}
            data-testid="filter-city"
          >
            <option value="">{t('filterAny')}</option>
            {cities.map((c) => (
              <option key={c.key} value={c.key}>
                {locale === 'ar' ? c.labelAr : c.labelEn}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="minPrice" className={labelClass}>
              {t('filterMinPrice')}
            </Label>
            <Input
              id="minPrice"
              name="minPrice"
              type="number"
              min={0}
              step="1"
              defaultValue={searchParams.get('minPrice') ?? ''}
              className={inputClass}
              aria-invalid={priceError ? true : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="maxPrice" className={labelClass}>
              {t('filterMaxPrice')}
            </Label>
            <Input
              id="maxPrice"
              name="maxPrice"
              type="number"
              min={0}
              step="1"
              defaultValue={searchParams.get('maxPrice') ?? ''}
              className={inputClass}
              aria-invalid={priceError ? true : undefined}
            />
          </div>
        </div>
        {priceError ? (
          <p role="alert" className="text-[12px] font-medium text-red-600" data-testid="filter-price-error">
            {priceError}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="propertyType" className={labelClass}>
            {t('filterPropertyType')}
          </Label>
          <select
            id="propertyType"
            name="propertyType"
            defaultValue={searchParams.get('propertyType') ?? ''}
            className={selectClass}
            data-testid="filter-property-type"
          >
            <option value="">{t('filterAny')}</option>
            {propertyTypes.map((pt) => (
              <option key={pt} value={pt}>
                {t(`propertyType.${pt}`)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="hasPool" className={labelClass}>
            {t('filterPool')}
          </Label>
          <select
            id="hasPool"
            name="hasPool"
            defaultValue={searchParams.get('hasPool') ?? ''}
            className={selectClass}
            data-testid="filter-has-pool"
          >
            <option value="">{t('filterAny')}</option>
            <option value="true">{t('filterPoolYes')}</option>
          </select>
        </div>

        <fieldset className="space-y-2.5">
          <legend className={cn(soft ? 'text-[12px] font-semibold text-[#6B7A90]' : 'text-sm font-medium text-navy')}>
            {t('filterAmenities')}
          </legend>
          <div className="flex flex-wrap gap-2">
            {EXPLORE_FILTER_SHEET_AMENITY_KEYS.map((key) => (
              <label
                key={key}
                className={cn(
                  'flex min-h-10 cursor-pointer items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                  soft
                    ? 'border-[#E1EAF6] bg-white text-[#4E5D73] has-[:checked]:border-[#2F6EF6]/35 has-[:checked]:bg-[#EAF2FF] has-[:checked]:text-[#2F6EF6]'
                    : 'border-border has-[:checked]:border-primary has-[:checked]:bg-primary-soft',
                )}
              >
                <input
                  type="checkbox"
                  name="amenities"
                  value={key}
                  defaultChecked={selectedAmenities.includes(key)}
                  className={cn(soft ? 'accent-[#2F6EF6]' : 'accent-primary')}
                />
                {t(`amenity.${key}`)}
              </label>
            ))}
          </div>
        </fieldset>

        <div className={cn(soft ? 'space-y-2 rounded-2xl border border-[#E8EEF6] bg-[#F7FAFF] p-3' : 'contents')}>
          {(
            [
              ['verifiedOnly', 'filterVerifiedOnly'],
              ['allowsOvernight', 'filterOvernight'],
              ['allowsEvents', 'filterEvents'],
            ] as const
          ).map(([name, labelKey]) => (
            <label
              key={name}
              className={cn(
                'flex min-h-10 cursor-pointer items-center gap-2.5 text-sm text-navy',
                soft && 'rounded-xl px-2 py-1.5 hover:bg-white/80',
              )}
            >
              <input
                type="checkbox"
                name={name}
                defaultChecked={searchParams.get(name) === 'true'}
                className={cn('h-4 w-4 rounded', soft ? 'accent-[#2F6EF6]' : 'accent-primary')}
                data-testid={`filter-${name}`}
              />
              <span className={soft ? 'text-[13px] font-medium text-[#0D2046]' : undefined}>{t(labelKey)}</span>
            </label>
          ))}
        </div>
      </div>

      <div
        className={cn(
          soft
            ? 'sticky bottom-0 z-10 -mx-1 mt-auto flex gap-2.5 border-t border-[#E8EEF6] bg-white/95 px-1 pb-1 pt-3 backdrop-blur-md'
            : 'flex flex-wrap gap-3 pt-2',
        )}
      >
        <Button
          type="submit"
          className={cn(
            soft &&
              'h-11 flex-1 rounded-full bg-[linear-gradient(180deg,#4B8CFF_0%,#2F6EF6_100%)] text-[13px] font-semibold shadow-[0_8px_18px_rgba(47,110,246,.28)]',
            !soft && 'shadow-soft',
          )}
          disabled={isPending}
          data-testid="apply-filters"
        >
          {isPending ? t('applying') : t('applyFilters')}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={clearFilters}
          disabled={isPending}
          data-testid="reset-filters"
          className={cn(soft && 'h-11 flex-1 rounded-full border-[#D5E2F4] bg-white text-[13px] font-semibold text-[#4E5D73]')}
        >
          {t('clearFilters')}
        </Button>
      </div>
    </form>
  );
}

export function MobileFilterButton() {
  const t = useTranslations('search');
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="lg:hidden"
        data-testid="open-mobile-filters"
        onClick={() => setOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        {t('filters')}
      </Button>
      {open ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-filters-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#0D2046]/40 backdrop-blur-[2px]"
            aria-label={t('closeFilters')}
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[90vh] flex-col overflow-hidden rounded-t-[28px] border border-[#E8EEF6] bg-white p-5 shadow-[0_24px_60px_rgba(31,70,120,.18)]">
            <div className="mb-3 flex shrink-0 items-center justify-between">
              <h2 id="mobile-filters-title" className="text-lg font-bold text-[#0D2046]">
                {t('filters')}
              </h2>
              <Button type="button" variant="ghost" size="icon" className="rounded-full" onClick={() => setOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-soft">
              <SearchFilters variant="sheet" onApplied={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
