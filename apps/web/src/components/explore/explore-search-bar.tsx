'use client';

import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Building2,
  Clock3,
  Loader2,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Waves,
  X,
} from 'lucide-react';
import {
  applyExploreSuggestionParams,
  applyParsedExploreSearchIntent,
  listExploreQuickIntents,
  mergeExploreSuggestions,
  parseExploreSearchIntent,
  searchHref,
  type ExploreMergedSuggestion,
} from '@mazare3/shared';
import { usePathname, useRouter } from '@/i18n/navigation';
import { SearchFilters } from '@/components/marketplace/search-filters';
import { fetchPropertySuggestions, type PropertySearchParams } from '@/lib/api-properties';
import {
  clearExploreRecentSearches,
  listExploreRecentSearches,
  recordExploreFilterSearch,
  recordExplorePropertySearch,
  type ExploreRecentSearch,
} from '@/lib/explore-recent-searches';
import { cn } from '@/lib/utils';

type ExploreSearchBarProps = {
  initial?: PropertySearchParams;
};

type PanelMode = 'closed' | 'discovery' | 'suggestions';

function suggestionIcon(kind: ExploreMergedSuggestion['kind']) {
  switch (kind) {
    case 'city':
      return MapPin;
    case 'property_type':
      return Building2;
    case 'amenity':
    case 'intent':
      return Waves;
    default:
      return Search;
  }
}

export function ExploreSearchBar({ initial }: ExploreSearchBarProps) {
  const t = useTranslations('explore');
  const locale = useLocale() as 'ar' | 'en';
  const router = useRouter();
  const pathname = usePathname();
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const requestGen = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState(initial?.q ?? '');
  const [suggestions, setSuggestions] = useState<ExploreMergedSuggestion[]>([]);
  const [recent, setRecent] = useState<ExploreRecentSearch[]>([]);
  const [panel, setPanel] = useState<PanelMode>('closed');
  const [loadingSuggest, setLoadingSuggest] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [isPending, startTransition] = useTransition();

  const quickIntents = listExploreQuickIntents();
  const trimmed = query.trim();
  const isTyping = trimmed.length >= 1;
  const remoteEligible = trimmed.length >= 2;

  useEffect(() => {
    setQuery(initial?.q ?? '');
  }, [initial?.q]);

  useEffect(() => {
    setRecent(listExploreRecentSearches());
  }, []);

  useEffect(() => {
    if (!isTyping) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSuggestions([]);
      setLoadingSuggest(false);
      return;
    }

    const gen = ++requestGen.current;
    const localOnly = mergeExploreSuggestions({
      query: trimmed,
      locale,
      properties: [],
      limit: 8,
    });
    setSuggestions(localOnly);
    setActiveIndex(-1);

    if (!remoteEligible) {
      setLoadingSuggest(false);
      return;
    }

    // Cover debounce wait + network — user must never see a silent gap.
    setLoadingSuggest(true);

    let cancelled = false;
    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      void fetchPropertySuggestions(trimmed, { limit: 8, signal: controller.signal })
        .then((rows) => {
          if (cancelled || gen !== requestGen.current) return;
          setSuggestions(
            mergeExploreSuggestions({
              query: trimmed,
              locale,
              properties: rows.map((p) => ({
                id: p.id,
                slug: p.slug,
                titleAr: p.titleAr,
                titleEn: p.titleEn,
              })),
              limit: 8,
            }),
          );
          setPanel('suggestions');
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          // Keep local structured suggestions; do not block Search submit.
          if (cancelled || gen !== requestGen.current) return;
          void err;
        })
        .finally(() => {
          if (!cancelled && gen === requestGen.current) setLoadingSuggest(false);
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [trimmed, isTyping, locale, remoteEligible]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setPanel('closed');
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function compatibleBase(): PropertySearchParams {
    return {
      city: initial?.city,
      area: initial?.area,
      date: initial?.date,
      period: initial?.period,
      guests: initial?.guests,
      sort: initial?.sort,
      lat: initial?.lat,
      lng: initial?.lng,
    };
  }

  function navigateFilters(params: PropertySearchParams, recentLabel: string) {
    recordExploreFilterSearch(recentLabel, params);
    setRecent(listExploreRecentSearches());
    setPanel('closed');
    const next = searchHref('/search', params);
    startTransition(() => {
      router.push(next);
      // Same-query soft navigation can no-op — refresh ensures results remount.
      if (pathname === '/search') {
        router.refresh();
      }
    });
  }

  function navigateProperty(slug: string, label: string) {
    recordExplorePropertySearch(label, slug);
    setRecent(listExploreRecentSearches());
    setPanel('closed');
    startTransition(() => {
      router.push(`/properties/${slug}`);
    });
  }

  function submitRawText(qRaw: string) {
    const q = qRaw.trim();
    if (!q) {
      const params: PropertySearchParams = {
        ...compatibleBase(),
        propertyType: initial?.propertyType,
        amenities: initial?.amenities,
        hasPool: initial?.hasPool,
        allowsOvernight: initial?.allowsOvernight,
        allowsEvents: initial?.allowsEvents,
        featured: initial?.featured,
        verifiedOnly: initial?.verifiedOnly,
        sort: initial?.sort ?? 'recommended',
      };
      setPanel('closed');
      startTransition(() => {
        router.push(searchHref('/search', params));
        if (pathname === '/search') router.refresh();
      });
      return;
    }

    const parsed = parseExploreSearchIntent(q);
    const params = applyParsedExploreSearchIntent(
      {
        ...compatibleBase(),
        propertyType: initial?.propertyType,
        amenities: initial?.amenities,
        hasPool: initial?.hasPool,
        allowsOvernight: initial?.allowsOvernight,
        allowsEvents: initial?.allowsEvents,
        featured: initial?.featured,
        verifiedOnly: initial?.verifiedOnly,
      },
      parsed,
    ) as PropertySearchParams;

    navigateFilters(params, q);
  }

  function pickMerged(s: ExploreMergedSuggestion) {
    if (s.kind === 'property') {
      setQuery(s.label);
      navigateProperty(s.slug, s.label);
      return;
    }
    const params = applyExploreSuggestionParams(compatibleBase(), s.params);
    setQuery('');
    navigateFilters(params, s.label);
  }

  function pickRecent(item: ExploreRecentSearch) {
    if (item.kind === 'property') {
      navigateProperty(item.slug, item.label);
      return;
    }
    navigateFilters({ ...compatibleBase(), ...item.params }, item.label);
  }

  function pickQuick(intentId: string) {
    const intent = quickIntents.find((i) => i.id === intentId);
    if (!intent) return;
    const label = locale === 'ar' ? intent.labelAr : intent.labelEn;
    const params = applyExploreSuggestionParams(compatibleBase(), intent.params);
    setQuery('');
    navigateFilters(params, label);
  }

  function handleSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (activeIndex >= 0 && suggestions[activeIndex] && panel === 'suggestions') {
      pickMerged(suggestions[activeIndex]!);
      return;
    }
    submitRawText(query);
  }

  function onClearRecent() {
    clearExploreRecentSearches();
    setRecent([]);
  }

  const showDiscovery = panel === 'discovery' && !isTyping;
  const showSuggestions = panel === 'suggestions' && isTyping;
  const panelOpen = showDiscovery || showSuggestions;
  const discoveryHasContent = recent.length > 0 || quickIntents.length > 0;

  return (
    <>
      <form onSubmit={handleSearch} data-testid="explore-search-bar" className="flex items-center gap-2">
        <div ref={wrapRef} className="relative min-w-0 flex-1">
          <label
            className="flex min-w-0 items-center gap-2.5 rounded-full border border-[#B8CBE6] bg-white px-3.5 py-2 shadow-[0_6px_20px_rgba(47,90,150,.06)] sm:px-4 sm:py-2.5"
            aria-busy={loadingSuggest || undefined}
          >
            {loadingSuggest ? (
              <Loader2
                className="h-5 w-5 shrink-0 animate-spin text-[#2F6EF6]"
                aria-hidden
                data-testid="explore-suggest-spinner"
              />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-[#2F6EF6]" aria-hidden />
            )}
            <span className="min-w-0 flex-1 text-start">
              <span className="block text-[10px] font-medium leading-none text-[#98A4B8]">{t('barName')}</span>
              <input
                name="q"
                type="search"
                role="combobox"
                aria-expanded={panelOpen}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-busy={loadingSuggest || undefined}
                aria-activedescendant={
                  activeIndex >= 0 && suggestions[activeIndex]
                    ? `${listId}-opt-${activeIndex}`
                    : undefined
                }
                data-testid="search-q"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPanel(e.target.value.trim() ? 'suggestions' : 'discovery');
                  setActiveIndex(-1);
                }}
                onFocus={() => {
                  setPanel(trimmed ? 'suggestions' : 'discovery');
                  setRecent(listExploreRecentSearches());
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setPanel('closed');
                    setActiveIndex(-1);
                    return;
                  }
                  if (!showSuggestions || !suggestions.length) return;
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((i) => (i + 1) % suggestions.length);
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
                  }
                }}
                placeholder={t('barNamePlaceholder')}
                autoComplete="off"
                className="mt-0.5 w-full appearance-none border-0 bg-transparent p-0 text-start text-[13.5px] font-semibold leading-tight text-[#0D2046] outline-none ring-0 placeholder:font-medium placeholder:text-[#9AA8BC] focus:outline-none focus:ring-0"
                aria-label={t('barName')}
              />
            </span>
          </label>

          {showDiscovery && discoveryHasContent ? (
            <div
              id={listId}
              role="listbox"
              data-testid="explore-search-discovery"
              className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#E1EAF6] bg-white py-2 shadow-[0_16px_40px_rgba(31,70,120,.14)]"
            >
              {recent.length > 0 ? (
                <div className="px-2 pb-1" data-testid="explore-recent-searches">
                  <div className="mb-1 flex items-center justify-between gap-2 px-2 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8A96A8]">
                      {t('recentSearches')}
                    </p>
                    <button
                      type="button"
                      data-testid="explore-clear-recent"
                      className="text-[11px] font-semibold text-[#2F6EF6] hover:underline"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={onClearRecent}
                    >
                      {t('clearRecent')}
                    </button>
                  </div>
                  <ul>
                    {recent.map((item) => (
                      <li key={item.id} role="option">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-[13.5px] font-medium text-[#0D2046] transition hover:bg-[#F3F7FF]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickRecent(item)}
                        >
                          <Clock3 className="h-3.5 w-3.5 shrink-0 text-[#8A96A8]" aria-hidden />
                          <span className="line-clamp-1">{item.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="px-2 pt-1" data-testid="explore-quick-intents">
                <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[#8A96A8]">
                  {t('quickSearches')}
                </p>
                <ul>
                  {quickIntents.map((intent) => {
                    const label = locale === 'ar' ? intent.labelAr : intent.labelEn;
                    return (
                      <li key={intent.id} role="option">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-start text-[13.5px] font-medium text-[#0D2046] transition hover:bg-[#F3F7FF]"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickQuick(intent.id)}
                        >
                          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#2F6EF6]" aria-hidden />
                          <span className="line-clamp-1">{label}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          ) : null}

          {showSuggestions ? (
            <ul
              id={listId}
              role="listbox"
              data-testid="explore-search-suggestions"
              className="absolute inset-x-0 top-[calc(100%+6px)] z-40 max-h-[min(70vh,420px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#E1EAF6] bg-white py-1.5 shadow-[0_16px_40px_rgba(31,70,120,.14)]"
            >
              {suggestions.map((s, index) => {
                const Icon = suggestionIcon(s.kind);
                return (
                  <li
                    key={s.id}
                    role="option"
                    id={`${listId}-opt-${index}`}
                    aria-selected={activeIndex === index}
                  >
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-2 px-4 py-2.5 text-start text-[13.5px] font-medium text-[#0D2046] transition hover:bg-[#F3F7FF]',
                        activeIndex === index && 'bg-[#F3F7FF]',
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pickMerged(s)}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#2F6EF6]" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1">{s.label}</span>
                        <span className="mt-0.5 block text-[11px] font-medium text-[#8A96A8]">
                          {s.kind === 'property'
                            ? t('suggestKindProperty')
                            : s.kind === 'city'
                              ? t('suggestKindCity')
                              : s.kind === 'property_type'
                                ? t('suggestKindType')
                                : t('suggestKindIntent')}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
              {loadingSuggest ? (
                <li
                  className="flex items-center gap-2 px-4 py-2.5 text-[12.5px] font-medium text-[#8A96A8]"
                  data-testid="explore-suggest-loading-row"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2F6EF6]" aria-hidden />
                  {t('suggestLoading')}
                </li>
              ) : null}
              {!loadingSuggest && !suggestions.length ? (
                <li className="px-4 py-3 text-[13px] text-[#8A96A8]">{t('suggestEmpty')}</li>
              ) : null}
            </ul>
          ) : null}
        </div>

        <button
          type="submit"
          data-testid="search-submit"
          disabled={isPending}
          aria-busy={isPending || undefined}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full border border-[#C5D8FF] bg-[#EAF2FF] px-4 text-[13px] font-semibold text-[#2F6EF6] transition hover:bg-[#DFEBFF] disabled:opacity-80 sm:h-11 sm:min-w-[96px]"
        >
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Search className="h-3.5 w-3.5" aria-hidden />
          )}
          {isPending ? t('searchPending') : t('searchNow')}
        </button>

        <button
          type="button"
          data-testid="explore-open-filters"
          onClick={() => setFilterOpen(true)}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[linear-gradient(180deg,#4B8CFF_0%,#2F6EF6_100%)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.28)] transition hover:brightness-[1.03] sm:h-11 sm:min-w-[104px] sm:px-5"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
          {t('filterButton')}
        </button>
      </form>

      {filterOpen ? (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="explore-filters-title"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#0D2046]/35 backdrop-blur-[3px] transition"
            aria-label={t('closeFilters')}
            onClick={() => setFilterOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-[28px] border border-[#E4ECF7] bg-[linear-gradient(180deg,#FFFFFF_0%,#F7FAFF_100%)] shadow-[0_28px_80px_rgba(31,70,120,.22)] sm:inset-y-10 sm:start-auto sm:end-6 sm:max-w-[400px] sm:rounded-[28px]">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E8EEF6]/90 px-5 pb-3.5 pt-5">
              <div>
                <p className="text-[11px] font-medium text-[#8A96A8]">{t('filterButton')}</p>
                <h2 id="explore-filters-title" className="text-[18px] font-bold text-[#0D2046]">
                  {t('filterSheetTitle')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#E1EAF6] bg-white text-[#4E5D73] shadow-sm transition hover:bg-[#F7FAFF]"
                aria-label={t('closeFilters')}
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 scrollbar-soft">
              <SearchFilters variant="sheet" onApplied={() => setFilterOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
