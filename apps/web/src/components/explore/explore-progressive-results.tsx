'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
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

/** Preload ~1–2 card rows before the viewport end so page N+1 arrives before a blank bottom. */
const INFINITE_SCROLL_ROOT_MARGIN = '600px 0px';

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
  const metaRef = useRef(meta);
  const hasMoreRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const filtersRef = useRef(filters);

  metaRef.current = meta;
  filtersRef.current = filters;
  errorRef.current = error;

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
  hasMoreRef.current = hasMore;

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasMoreRef.current || errorRef.current) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    const requestSignature = signatureRef.current;
    const nextPage = metaRef.current.page + 1;
    const activeFilters = filtersRef.current;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await fetchPropertySearch(
        {
          ...activeFilters,
          page: nextPage,
          pageSize: activeFilters.pageSize ?? EXPLORE_MAIN_PAGE_SIZE,
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
  }, [t]);

  // Automatic near-end fetch — one active request; disconnected when exhausted or errored.
  useEffect(() => {
    if (!hasMore || error) return;
    const node = sentinelRef.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void loadMore();
      },
      { root: null, rootMargin: INFINITE_SCROLL_ROOT_MARGIN, threshold: 0 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, error, signature, loadMore]);

  function onRetry() {
    setError(null);
    errorRef.current = null;
    void loadMore();
  }

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
          className="mt-4 flex flex-col items-center gap-2 pb-2 text-center"
          role="alert"
          data-testid="load-more-error"
        >
          <p className="text-sm text-[#8A4B4B]">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            disabled={loading}
            className="inline-flex h-10 items-center justify-center rounded-full border border-[#D5E2F4] bg-white px-5 text-[13px] font-semibold text-[#4E5D73] transition hover:bg-[#F7FAFF]"
            data-testid="load-more-retry"
          >
            {t('loadMoreRetry')}
          </button>
        </div>
      ) : null}

      {hasMore && !error ? (
        <div
          ref={sentinelRef}
          className="mt-6 flex justify-center pb-2"
          data-testid="explore-infinite-sentinel"
          aria-hidden={!loading}
        >
          {loading ? (
            <div
              className="inline-flex items-center gap-2 text-[13px] font-medium text-[#8A96A8]"
              role="status"
              aria-live="polite"
              aria-busy="true"
              data-testid="explore-infinite-loading"
            >
              <Loader2 className="h-4 w-4 animate-spin text-[#2F6EF6]" aria-hidden />
              {t('loadMoreLoading')}
            </div>
          ) : (
            <div className="h-1 w-1" aria-hidden />
          )}
        </div>
      ) : null}
    </>
  );
}
