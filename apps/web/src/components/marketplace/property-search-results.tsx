import { getTranslations } from 'next-intl/server';
import { fetchProperties, type PropertySearchParams } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { PropertyCard } from './property-card';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

interface PropertySearchResultsProps {
  filters: PropertySearchParams;
}

export async function PropertySearchResults({ filters }: PropertySearchResultsProps) {
  const t = await getTranslations('search');
  const tCommon = await getTranslations('common');

  try {
    const properties = await fetchProperties(filters);

    if (properties.length === 0) {
      return (
        <EmptyState
          title={tCommon('noResults')}
          description={t('emptyHint')}
          actionLabel={t('clearFilters')}
          actionHref="/search"
        />
      );
    }

    return (
      <>
        <p className="mt-6 text-sm text-muted">{t('results', { count: properties.length })}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-2">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      </>
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
