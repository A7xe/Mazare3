'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Navigation, Star, Tag } from 'lucide-react';
import { searchHref } from '@mazare3/shared';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { PropertySearchParams } from '@/lib/api-properties';
import { requestExploreUserLocation } from '@/lib/explore-location';

type Props = { filters: PropertySearchParams };

export function ExploreSortPills({ filters }: Props) {
  const t = useTranslations('explore');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const currentSort = searchParams.get('sort') || filters.sort || 'recommended';
  const hasUserLocation =
    typeof filters.lat === 'number' &&
    typeof filters.lng === 'number' &&
    Number.isFinite(filters.lat) &&
    Number.isFinite(filters.lng);

  function pushFilters(next: PropertySearchParams) {
    startTransition(() => {
      router.push(searchHref(pathname, next));
    });
  }

  function pushSort(sort: PropertySearchParams['sort']) {
    setGeoHint(null);
    pushFilters({
      ...filters,
      sort,
      // Keep coarse location for Near You when switching non-distance sorts.
      lat: filters.lat,
      lng: filters.lng,
    });
  }

  async function activateNearest() {
    setGeoHint(null);
    if (hasUserLocation) {
      pushFilters({
        ...filters,
        sort: 'distance_asc',
        lat: filters.lat,
        lng: filters.lng,
      });
      return;
    }

    setLocating(true);
    const result = await requestExploreUserLocation();
    setLocating(false);

    if (!result.ok) {
      setGeoHint(t('geoDenied'));
      return;
    }

    pushFilters({
      ...filters,
      sort: 'distance_asc',
      lat: result.lat,
      lng: result.lng,
    });
  }

  const pills = [
    {
      id: 'distance_asc',
      label: t('sortNearest'),
      icon: Navigation,
      active: currentSort === 'distance_asc',
      onClick: () => void activateNearest(),
      disabled: locating,
    },
    {
      id: 'rating_desc',
      label: t('sortTopRated'),
      icon: Star,
      active: currentSort === 'rating_desc',
      onClick: () => pushSort('rating_desc'),
      disabled: false,
    },
    {
      id: 'price_asc',
      label: t('sortPrice'),
      icon: Tag,
      active: currentSort === 'price_asc',
      onClick: () => pushSort('price_asc'),
      disabled: false,
    },
  ] as const;

  return (
    <div className="space-y-2" data-testid="explore-sort-pills">
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {pills.map((pill) => {
          const Icon = pill.icon;
          return (
            <button
              key={pill.id}
              type="button"
              disabled={pill.disabled}
              onClick={pill.onClick}
              className={cn(
                'inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold shadow-[0_4px_12px_rgba(31,70,120,.04)] transition',
                pill.active
                  ? 'border-[#C5D8FF] bg-[#EAF2FF] text-[#2F6EF6]'
                  : 'border-[#E6EDF6] bg-white text-[#6B7A90] hover:border-[#C5D8FF]',
                pill.disabled && 'opacity-70',
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {pill.label}
            </button>
          );
        })}
      </div>
      {geoHint ? (
        <p
          role="status"
          aria-live="polite"
          className="text-center text-[12px] font-medium text-[#6B7A90]"
          data-testid="explore-geo-hint"
        >
          {geoHint}
        </p>
      ) : null}
    </div>
  );
}
