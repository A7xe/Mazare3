import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import {
  isExploreTextSearchMode,
  type MarketplaceDiscoveryResponse,
  type PublicPropertySummary,
} from '@mazare3/shared';
import { ExploreSearchBar } from '@/components/explore/explore-search-bar';
import { ExploreCategoryChips } from '@/components/explore/explore-category-chips';
import { ExploreSortPills } from '@/components/explore/explore-sort-pills';
import { ExploreNearRail } from '@/components/explore/explore-near-rail';
import { ExploreMostBooked } from '@/components/explore/explore-most-booked';
import { ExploreMapTeaser } from '@/components/explore/explore-map-teaser';
import { DiscoveryRail } from '@/components/marketplace/discovery-rail';
import { PropertySearchResults } from '@/components/marketplace/property-search-results';
import { PropertyGridSkeleton } from '@/components/marketplace/property-grid-skeleton';
import { fetchDiscovery } from '@/lib/api-properties';
import { parseSearchParams } from '@/lib/search-params';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function sectionOf(discovery: MarketplaceDiscoveryResponse | null, id: string): PublicPropertySummary[] {
  return discovery?.sections.find((section) => section.id === id)?.properties ?? [];
}

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('explore');
  const raw = await searchParams;
  const filters = parseSearchParams(raw);
  const suspenseKey = JSON.stringify(filters);
  const searchMode = isExploreTextSearchMode(filters);
  const contentDir = locale === 'ar' ? 'rtl' : 'ltr';

  // Browse mode keeps discovery rails; textual search prioritizes results first.
  let discovery: MarketplaceDiscoveryResponse | null = null;
  if (!searchMode) {
    try {
      discovery = await fetchDiscovery({
        city: filters.city,
        area: filters.area,
        date: filters.date,
        period: filters.period,
        guests: filters.guests,
        lat: filters.lat,
        lng: filters.lng,
      });
    } catch {
      discovery = null;
    }
  }

  const offers = sectionOf(discovery, 'offers');
  const nearProperties = sectionOf(discovery, 'nearby').slice(0, 3);
  const mostBooked = sectionOf(discovery, 'mostBooked').slice(0, 3);

  const resultsSection = (
    <section data-testid="explore-search-results">
      <Suspense key={suspenseKey} fallback={<PropertyGridSkeleton count={6} />}>
        <PropertySearchResults filters={filters} showMeta={false} />
      </Suspense>
    </section>
  );

  return (
    <div className="mx-auto w-full max-w-[1360px] px-2 pb-8 pt-4 sm:px-3 lg:px-4 lg:pt-5">
      <ExploreSearchBar initial={filters} />

      <div className="mt-5 space-y-3.5">
        <Suspense fallback={<div className="h-11 animate-pulse rounded-full bg-[#EEF4FF]" />}>
          <ExploreCategoryChips filters={filters} />
        </Suspense>

        <Suspense fallback={<div className="h-10 animate-pulse rounded-full bg-[#EEF4FF]" />}>
          <ExploreSortPills filters={filters} />
        </Suspense>
      </div>

      <div className="mt-7 space-y-7">
        {searchMode ? (
          resultsSection
        ) : (
          <>
            <ExploreNearRail title={t('nearTitle')} properties={nearProperties} />

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <ExploreMapTeaser
                title={t('mapTitle')}
                subtitle={t('mapSubtitle')}
                ctaLabel={t('mapCta')}
                filters={filters}
              />
              <ExploreMostBooked title={t('mostBookedTitle')} properties={mostBooked} />
            </div>

            <DiscoveryRail
              title={t('offersTitle')}
              subtitle={t('offersSubtitle')}
              seeAllHref=""
              seeAllLabel={t('seeAll')}
              properties={offers}
              sectionId="explore-offers"
              layout="carousel"
              contentDir={contentDir}
            />

            {resultsSection}
          </>
        )}
      </div>
    </div>
  );
}
