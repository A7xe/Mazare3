import { getTranslations } from 'next-intl/server';
import { fetchProperties } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { PropertyCard } from './property-card';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';

export async function PropertySearchResults() {
  const t = await getTranslations('search');
  const tCommon = await getTranslations('common');

  try {
    const properties = await fetchProperties();

    if (properties.length === 0) {
      return (
        <EmptyState
          title={tCommon('noResults')}
          description={t('emptyHint')}
          actionLabel={tCommon('back')}
          actionHref="/"
        />
      );
    }

    return (
      <>
        <p className="mt-6 text-sm text-muted">{t('results', { count: properties.length })}</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
