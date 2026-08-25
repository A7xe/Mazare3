import { getTranslations } from 'next-intl/server';
import {
  EXPLORE_MAIN_PAGE_SIZE,
  buildExploreSecondaryRecommendationParams,
  isExploreTextSearchMode,
  shouldShowExploreSecondaryRecommendations,
  type PublicPropertySummary,
} from '@mazare3/shared';
import { fetchPropertySearch, type PropertySearchParams } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { ExploreProgressiveResults } from '@/components/explore/explore-progressive-results';
import { ExplorePropertyCard } from '@/components/explore/explore-property-card';
import { ErrorState } from './error-state';
import { SearchEmptyState } from './search-empty-state';

interface PropertySearchResultsProps {
  filters: PropertySearchParams;
  /** When false, hide result count / browse mode line (explore browse grid). */
  showMeta?: boolean;
}

async function loadSecondaryRecommendations(
  filters: PropertySearchParams,
  excludeIds: Set<string>,
): Promise<PublicPropertySummary[]> {
  const params = buildExploreSecondaryRecommendationParams(filters);
  try {
    const secondary = await fetchPropertySearch(params);
    return secondary.data.filter((p) => !excludeIds.has(p.id)).slice(0, 8);
  } catch {
    return [];
  }
}

export async function PropertySearchResults({ filters, showMeta = true }: PropertySearchResultsProps) {
  const t = await getTranslations('search');
  const tExplore = await getTranslations('explore');
  const searchMode = isExploreTextSearchMode(filters);

  try {
    const result = await fetchPropertySearch({
      ...filters,
      page: 1,
      pageSize: filters.pageSize ?? EXPLORE_MAIN_PAGE_SIZE,
    });

    const excludeIds = new Set(result.data.map((p) => p.id));
    const showSecondary =
      searchMode && shouldShowExploreSecondaryRecommendations(result.meta);
    const secondary = showSecondary
      ? await loadSecondaryRecommendations(filters, excludeIds)
      : [];

    if (result.data.length === 0) {
      return (
        <div className="space-y-7" data-testid="explore-search-primary">
          <SearchEmptyState
            filters={filters}
            otherPeriods={result.meta.suggestions?.otherBookablePeriods ?? []}
          />
          {secondary.length > 0 ? (
            <section data-testid="explore-secondary-recommendations">
              <h2 className="mb-3 text-[18px] font-bold text-[#0D2046] sm:text-[20px]">
                {tExplore('otherFarmsTitle')}
              </h2>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {secondary.map((property) => (
                  <ExplorePropertyCard key={property.id} property={property} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-7" data-testid="explore-search-primary">
        <ExploreProgressiveResults
          filters={{
            ...filters,
            page: 1,
            pageSize: filters.pageSize ?? EXPLORE_MAIN_PAGE_SIZE,
          }}
          initialProperties={result.data}
          initialMeta={result.meta}
          showMeta={showMeta}
        />
        {secondary.length > 0 ? (
          <section data-testid="explore-secondary-recommendations">
            <h2 className="mb-3 text-[18px] font-bold text-[#0D2046] sm:text-[20px]">
              {tExplore('otherFarmsTitle')}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {secondary.map((property) => (
                <ExplorePropertyCard key={property.id} property={property} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    );
  } catch (err) {
    const isApi = err instanceof ApiError;
    return (
      <ErrorState
        title={t('errorTitle')}
        description={isApi ? err.message : t('errorGeneric')}
      />
    );
  }
}
