'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowUpDown,
  BedDouble,
  ChevronDown,
  Heart,
  Home,
  Leaf,
  Loader2,
  MapPin,
  Search,
  Sparkles,
  Star,
  Trees,
  Waves,
} from 'lucide-react';
import type { PropertyType, PublicPropertySummary } from '@mazare3/shared';
import { JORDAN_CITIES, searchHref } from '@mazare3/shared';
import { Link, useRouter } from '@/i18n/navigation';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import { useFavorites } from '@/components/favorites/favorites-context';
import { fetchBookableFavorites } from '@/lib/api-favorites';
import { getMe } from '@/lib/api-auth';
import { fetchDiscovery } from '@/lib/api-properties';
import { formatPrice, getApproxLocation, getPropertyTitle } from '@/lib/property-helpers';
import { cn } from '@/lib/utils';

type FilterId = 'all' | 'chalet' | 'villa' | 'farm';
type SortId = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'rating';

const FILTERS: {
  id: FilterId;
  icon?: typeof Home;
}[] = [
  { id: 'all' },
  { id: 'chalet', icon: Home },
  { id: 'villa', icon: Home },
  { id: 'farm', icon: Leaf },
];

function cityLabel(cityKey: string, locale: string) {
  const meta = JORDAN_CITIES.find((c) => c.key === cityKey);
  if (!meta) return cityKey;
  return locale === 'ar' ? meta.labelAr : meta.labelEn;
}

function featureBits(
  property: PublicPropertySummary,
  labels: { guests: string; pool: string; garden: string },
) {
  const bits: { icon: typeof BedDouble; label: string }[] = [
    { icon: BedDouble, label: labels.guests },
  ];
  if (property.hasPool || property.hasIndoorPool || property.hasHeatedPool) {
    bits.push({ icon: Waves, label: labels.pool });
  }
  if (property.amenityKeys?.includes('garden')) {
    bits.push({ icon: Trees, label: labels.garden });
  }
  return bits.slice(0, 3);
}

function FavoritesPropertyCard({
  property,
  compact = false,
}: {
  property: PublicPropertySummary;
  compact?: boolean;
}) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('favorites');
  const tSearch = useTranslations('search');
  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const city = cityLabel(property.city, locale);
  const href = searchHref(`/properties/${property.slug}`, {});
  const features = featureBits(property, {
    guests: t('guestsFeature', { count: property.capacity }),
    pool: tSearch('amenity.pool'),
    garden: tSearch('amenity.garden'),
  });
  const priceLabel = formatPrice(property.basePrice, property.currency || 'JOD', locale);

  return (
    <article
      data-testid="property-card"
      className={cn(
        'flex h-full flex-col overflow-hidden rounded-2xl border border-[#E4EAF3] bg-white shadow-[0_2px_14px_rgba(35,72,120,.05)]',
        compact && 'shadow-none',
      )}
    >
      <div className={cn('relative overflow-hidden bg-[#EAF2FF]', compact ? 'aspect-[4/3]' : 'aspect-[16/10]')}>
        <Link href={href} data-testid={`property-card-${property.slug}`} className="absolute inset-0 block">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={title}
              fill
              className="object-cover"
              sizes={compact ? '(max-width: 768px) 50vw, 220px' : '(max-width: 768px) 100vw, 25vw'}
            />
          ) : (
            <span className="flex h-full items-center justify-center p-4 text-center text-sm font-semibold text-[#0D2046]">
              {title}
            </span>
          )}
        </Link>
        <div className="absolute start-3 top-3 z-10">
          <FavoriteButton propertyId={property.id} variant="favorites" />
        </div>
        {property.reviewCount > 0 ? (
          <span
            className="absolute bottom-3 end-3 z-10 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm"
            data-testid="property-card-rating"
          >
            <Star className="h-3 w-3 fill-[#F5B301] text-[#F5B301]" aria-hidden />
            {property.rating.toFixed(1)}
          </span>
        ) : null}
      </div>

      <div className={cn('flex flex-1 flex-col', compact ? 'p-3' : 'p-4')}>
        <Link href={href} className="min-w-0">
          <h3
            className={cn(
              'line-clamp-1 font-bold text-[#2F6EF6]',
              compact ? 'text-[13px]' : 'text-[15px]',
            )}
          >
            {title}
          </h3>
          <p className="mt-1 flex items-center gap-1 text-[12px] text-[#7A879B]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#2F6EF6]" aria-hidden />
            <span className="line-clamp-1">{city}{location ? ` · ${location}` : ''}</span>
          </p>
        </Link>

        {!compact ? (
          <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11.5px] text-[#7A879B]">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <li key={f.label} className="inline-flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5 text-[#9AA6B8]" aria-hidden />
                  {f.label}
                </li>
              );
            })}
          </ul>
        ) : null}

        <p className={cn('mt-auto font-bold text-[#0D2046]', compact ? 'mt-2 text-[12px]' : 'mt-3 text-[14px]')}>
          {priceLabel}
          <span className="ms-1 text-[11px] font-medium text-[#7A879B]">{t('perNight')}</span>
        </p>

        {!compact ? (
          <Link
            href={href}
            className="mt-3 flex h-10 w-full items-center justify-center rounded-xl bg-[#EAF2FF] text-[13px] font-semibold text-[#2F6EF6] transition hover:bg-[#DCE9FF]"
          >
            {t('viewDetails')}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function FavoritesView() {
  const t = useTranslations('favorites');
  const locale = useLocale();
  const router = useRouter();
  const { ids, ready } = useFavorites();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PublicPropertySummary[]>([]);
  const [suggested, setSuggested] = useState<PublicPropertySummary[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [sort, setSort] = useState<SortId>('newest');
  const [sortOpen, setSortOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const me = await getMe();
      if (me.data.user.role !== 'customer') {
        router.push('/');
        return;
      }
      const [favRes, discovery] = await Promise.all([
        fetchBookableFavorites(),
        fetchDiscovery().catch(() => null),
      ]);
      setItems(favRes.data);
      const favIds = new Set(favRes.data.map((p) => p.id));
      const fromDiscovery =
        discovery?.sections
          .flatMap((s) => s.properties)
          .filter((p) => !favIds.has(p.id)) ?? [];
      const unique = new Map<string, PublicPropertySummary>();
      for (const p of fromDiscovery) {
        if (!unique.has(p.id)) unique.set(p.id, p);
      }
      setSuggested(Array.from(unique.values()).slice(0, 6));
    } catch {
      router.push('/auth?returnUrl=' + encodeURIComponent('/account/favorites'));
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load, ids, ready]);

  const visible = useMemo(() => {
    let list = items;
    if (filter !== 'all') {
      list = list.filter((p) => p.type === (filter as PropertyType));
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === 'oldest') {
        return String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''));
      }
      if (sort === 'price_asc') return a.basePrice - b.basePrice;
      if (sort === 'price_desc') return b.basePrice - a.basePrice;
      if (sort === 'rating') return b.rating - a.rating || b.reviewCount - a.reviewCount;
      return String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''));
    });
    return sorted;
  }, [items, filter, sort]);

  const sortOptions: { id: SortId; label: string }[] = [
    { id: 'newest', label: t('sortNewest') },
    { id: 'oldest', label: t('sortOldest') },
    { id: 'price_asc', label: t('sortPriceAsc') },
    { id: 'price_desc', label: t('sortPriceDesc') },
    { id: 'rating', label: t('sortRating') },
  ];
  const activeSortLabel = sortOptions.find((o) => o.id === sort)?.label ?? t('sortNewest');

  return (
    <div data-testid="favorites-page" className="pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <header className="mb-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#FEE8EC]">
            <Heart className="h-5 w-5 fill-[#E11D48] text-[#E11D48]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]">{t('title')}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-[#7A879B]">{t('subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label={t('filterAria')}
          data-testid="favorites-filters"
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            const Icon = f.icon;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={active}
                data-testid={`favorites-filter-${f.id}`}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition',
                  active
                    ? 'border-[#2F6EF6] bg-[#2F6EF6] text-white shadow-[0_6px_16px_-8px_rgba(47,110,246,.9)]'
                    : 'border-[#E4EAF3] bg-white text-[#0D2046] hover:border-[#2F6EF6]/35',
                )}
              >
                {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
                {t(`filter.${f.id}`)}
              </button>
            );
          })}
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            data-testid="favorites-sort"
            aria-expanded={sortOpen}
            aria-haspopup="listbox"
            onClick={() => setSortOpen((v) => !v)}
            className="inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-[#E4EAF3] bg-white px-3 text-[13px] font-semibold text-[#0D2046] sm:min-w-[220px]"
          >
            <span className="inline-flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
              {t('sortPrefix')}: {activeSortLabel}
            </span>
            <ChevronDown className={cn('h-4 w-4 text-[#7A879B] transition', sortOpen && 'rotate-180')} aria-hidden />
          </button>
          {sortOpen ? (
            <ul
              role="listbox"
              className="absolute inset-e-0 z-20 mt-1 min-w-full overflow-hidden rounded-xl border border-[#E4EAF3] bg-white py-1 shadow-[0_12px_28px_-16px_rgba(13,32,70,.45)] sm:inset-e-auto sm:inset-s-0"
            >
              {sortOptions.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={sort === opt.id}
                    className={cn(
                      'flex w-full px-3 py-2.5 text-start text-[13px] transition hover:bg-[#F5F8FC]',
                      sort === opt.id ? 'font-semibold text-[#2F6EF6]' : 'text-[#0D2046]',
                    )}
                    onClick={() => {
                      setSort(opt.id);
                      setSortOpen(false);
                    }}
                  >
                    {opt.label}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16" data-testid="favorites-loading">
          <Loader2 className="h-8 w-8 animate-spin text-[#2F6EF6]" aria-hidden />
        </div>
      ) : items.length === 0 ? (
        <div
          className="mx-auto max-w-md rounded-2xl border border-[#E4EAF3] bg-white px-6 py-12 text-center shadow-[0_2px_14px_rgba(35,72,120,.05)]"
          data-testid="favorites-empty"
        >
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EAF2FF]">
            <Heart className="h-8 w-8 text-[#2F6EF6]" strokeWidth={1.75} aria-hidden />
          </span>
          <p className="mt-5 text-[16px] font-bold text-[#0D2046]">{t('empty')}</p>
          <p className="mt-2 text-[13px] leading-relaxed text-[#7A879B]">{t('emptyHint')}</p>
          <Link
            href="/search"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] px-5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,110,246,.28)] transition hover:bg-[#255FE0]"
          >
            <Search className="h-4 w-4" aria-hidden />
            {t('exploreNow')}
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-[#D5DCE8] bg-[#F8FAFC] px-4 py-12 text-center"
          data-testid="favorites-filter-empty"
        >
          <p className="text-[15px] font-semibold text-[#0D2046]">{t('filterEmpty')}</p>
          <button
            type="button"
            className="mt-3 text-[13px] font-semibold text-[#2F6EF6] hover:underline"
            onClick={() => setFilter('all')}
          >
            {t('showAll')}
          </button>
        </div>
      ) : (
        <div
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          data-testid="favorites-grid"
        >
          {visible.map((property) => (
            <FavoritesPropertyCard key={property.id} property={property} />
          ))}
        </div>
      )}

      {suggested.length > 0 ? (
        <section className="mt-10" data-testid="favorites-suggestions">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold text-[#0D2046]">
              <Sparkles className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
              {t('suggestionsTitle')}
            </h2>
            <Link
              href="/search"
              className="text-[13px] font-semibold text-[#2F6EF6] hover:underline"
            >
              {t('viewAll')}
            </Link>
          </div>
          <p className="mb-4 text-[13px] text-[#7A879B]">{t('suggestionsSubtitle')}</p>
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {suggested.map((property) => (
              <FavoritesPropertyCard key={`sug-${property.id}`} property={property} compact />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
