'use client';

import { useCallback, useTransition } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Search } from 'lucide-react';
import { JORDAN_CITIES, PROPERTY_TYPES, PROPERTY_SORT_OPTIONS } from '@mazare3/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { SEARCH_AMENITY_KEYS } from '@/lib/search-params';

export function SearchFilters() {
  const t = useTranslations('search');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (!value) next.delete(key);
        else next.set(key, value);
      }
      startTransition(() => {
        router.push(`${pathname}?${next.toString()}`);
      });
    },
    [pathname, router, searchParams],
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amenities = fd.getAll('amenities').map(String).filter(Boolean);
    updateParams({
      q: String(fd.get('q') || '') || undefined,
      area: String(fd.get('area') || '') || undefined,
      guests: String(fd.get('guests') || '') || undefined,
      minPrice: String(fd.get('minPrice') || '') || undefined,
      maxPrice: String(fd.get('maxPrice') || '') || undefined,
      propertyType: String(fd.get('propertyType') || '') || undefined,
      sort: String(fd.get('sort') || 'recommended'),
      verifiedOnly: fd.get('verifiedOnly') === 'on' ? 'true' : undefined,
      hasPool: String(fd.get('hasPool') || '') || undefined,
      amenities: amenities.length ? amenities.join(',') : undefined,
    });
  }

  function clearFilters() {
    startTransition(() => router.push(pathname));
  }

  const selectedAmenities = (searchParams.get('amenities') ?? '').split(',').filter(Boolean);

  return (
    <Card className="glass-panel overflow-hidden rounded-3xl border-primary/12">
      <div className="gradient-primary h-1" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <SlidersHorizontal className="h-5 w-5 text-primary" />
          {t('filters')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="q">{t('filterQuery')}</Label>
            <div className="relative">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="q"
                name="q"
                defaultValue={searchParams.get('q') ?? ''}
                className="ps-10"
                placeholder={t('filterQueryPlaceholder')}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="area">{t('filterArea')}</Label>
              <select
                id="area"
                name="area"
                defaultValue={searchParams.get('area') ?? ''}
                className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy"
              >
                <option value="">{t('filterAny')}</option>
                {JORDAN_CITIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {locale === 'ar' ? c.labelAr : c.labelEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="guests">{t('filterGuests')}</Label>
              <Input
                id="guests"
                name="guests"
                type="number"
                min={1}
                defaultValue={searchParams.get('guests') ?? ''}
                placeholder="10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="minPrice">{t('filterMinPrice')}</Label>
              <Input
                id="minPrice"
                name="minPrice"
                type="number"
                min={0}
                defaultValue={searchParams.get('minPrice') ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxPrice">{t('filterMaxPrice')}</Label>
              <Input
                id="maxPrice"
                name="maxPrice"
                type="number"
                min={0}
                defaultValue={searchParams.get('maxPrice') ?? ''}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="propertyType">{t('filterPropertyType')}</Label>
              <select
                id="propertyType"
                name="propertyType"
                defaultValue={searchParams.get('propertyType') ?? ''}
                className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy"
              >
                <option value="">{t('filterAny')}</option>
                {PROPERTY_TYPES.map((pt) => (
                  <option key={pt} value={pt}>
                    {t(`propertyType.${pt}`)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort">{t('filterSort')}</Label>
              <select
                id="sort"
                name="sort"
                defaultValue={searchParams.get('sort') ?? 'recommended'}
                className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy"
              >
                {PROPERTY_SORT_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {t(`sort.${s}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="hasPool">{t('filterPool')}</Label>
            <select
              id="hasPool"
              name="hasPool"
              defaultValue={searchParams.get('hasPool') ?? ''}
              className="flex h-11 w-full rounded-xl border border-border bg-surface px-3 text-sm text-navy"
            >
              <option value="">{t('filterAny')}</option>
              <option value="true">{t('filterPoolYes')}</option>
              <option value="false">{t('filterPoolNo')}</option>
            </select>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-navy">{t('filterAmenities')}</legend>
            <div className="flex flex-wrap gap-2">
              {SEARCH_AMENITY_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs has-[:checked]:border-primary has-[:checked]:bg-primary-soft"
                >
                  <input
                    type="checkbox"
                    name="amenities"
                    value={key}
                    defaultChecked={selectedAmenities.includes(key)}
                    className="accent-primary"
                  />
                  {t(`amenity.${key}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
            <input
              type="checkbox"
              name="verifiedOnly"
              defaultChecked={searchParams.get('verifiedOnly') === 'true'}
              className="accent-primary"
            />
            {t('filterVerifiedOnly')}
          </label>

          <div className="flex flex-wrap gap-3 pt-2">
            <Button type="submit" className="shadow-soft" disabled={isPending}>
              {isPending ? t('applying') : t('applyFilters')}
            </Button>
            <Button type="button" variant="outline" onClick={clearFilters} disabled={isPending}>
              {t('clearFilters')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
