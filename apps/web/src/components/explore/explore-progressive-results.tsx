'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  EXPLORE_MAIN_PAGE_SIZE,
  appendUniqueById,
  exploreSearchSignature,
  propertySearchHasMore,
  type PropertySearchMeta,
  type PublicPropertySummary,
} from '@mazare3/shared';
import { ExplorePropertyCard } from '@/components/explore/explore-property-card';
import { fetchPropertySearch, type PropertySearchParams } from '@/lib/api-properties';
import { cn } from '@/lib/utils';

type Props = {
  filters: PropertySearchParams;
  initialProperties: PublicPropertySummary[];
  initialMeta: PropertySearchMeta;
  showMeta?: boolean;
};

export function ExploreProgressiveResults({
  filters,
  initialProperties,
  initialMeta,
  showMeta = true,
}: Props) {
  const t = useTranslations('search');
  const signature = exploreSearchSignature(filters);
  const [properties, setProperties] = useState(initialProperties);
  const [meta, setMeta] = useState(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const signatureRef = useRef(signature);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    signatureRef.current = signature;
    abortRef.current?.abort();
    abortRef.current = null;
    loadingRef.current = false;
    setProperties(initialProperties);
    setMeta(initialMeta);
    setLoading(false);
    setError(null);
  }, [signature, initialProperties, initialMeta]);

  const hasMore = meta.hasMore ?? propertySearchHasMore(meta);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMore) return;
    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const requestSignature = signatureRef.current;
    const nextPage = meta.page + 1;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await fetchPropertySearch(
        {
          ...filters,
          page: nextPage,
          pageSize: filters.pageSize ?? EXPLORE_MAIN_PAGE_SIZE,
        },
        { signal: controller.signal },
      );
      if (signatureRef.current !== requestSignature) return;

      setProperties((prev) => appendUniqueById(prev, result.data));
      setMeta(result.meta);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (signatureRef.current !== requestSignature) return;
      const message = err instanceof Error ? err.message : t('errorGeneric');
      setError(message);
    } finally {
      if (signatureRef.current === requestSignature) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [filters, hasMore, meta.page, t]);

  return (
    <>
      {showMeta ? (
        <p className="text-sm text-muted" data-testid="search-result-count">
          {t('results', { count: meta.total })}
          {meta.mode === 'availability' ? ` · ${t('availabilityMode')}` : ` · ${t('browseMode')}`}
        </p>
      ) : null}

      <div
        className={showMeta ? 'mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3' : 'grid gap-5 sm:grid-cols-2 xl:grid-cols-3'}
        data-testid="search-results-grid"
      >
        {properties.map((property) => (
          <ExplorePropertyCard key={property.id} property={property} />
        ))}
      </div>

      {error ? (
        <div
          className="mt-4 flex flex-col items-center gap-2 text-center"
          role="alert"
          data-testid="load-more-error"
        >
          <p className="text-sm text-[#8A4B4B]">{error}</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#D5E2F4] bg-white px-5 text-[13px] font-semibold text-[#4E5D73] transition hover:bg-[#F7FAFF]"
            data-testid="load-more-retry"
          >
            {t('loadMoreRetry')}
          </button>
        </div>
      ) : null}

      {hasMore ? (
        <div className="mt-6 flex justify-center pb-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            aria-busy={loading || undefined}
            data-testid="explore-load-more"
            className={cn(
              'inline-flex h-11 min-w-[148px] items-center justify-center rounded-full bg-[linear-gradient(180deg,#4B8CFF_0%,#2F6EF6_100%)] px-6 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.28)] transition hover:brightness-[1.03]',
              loading && 'opacity-80',
            )}
          >
            {loading ? t('loadMoreLoading') : t('loadMore')}
          </button>
        </div>
      ) : null}
    </>
  );
}
