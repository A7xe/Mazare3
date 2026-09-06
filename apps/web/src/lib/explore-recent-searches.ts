import type { PropertySearchQuery } from '@mazare3/shared';
import { serializePropertySearchQuery } from '@mazare3/shared';

export const EXPLORE_RECENT_SEARCHES_KEY = 'mazare3.explore.recentSearches.v1';
export const EXPLORE_RECENT_SEARCHES_MAX = 5;

export type ExploreRecentSearch =
  | {
      kind: 'filters';
      id: string;
      label: string;
      params: Partial<PropertySearchQuery>;
      at: number;
    }
  | {
      kind: 'property';
      id: string;
      label: string;
      slug: string;
      at: number;
    };

type StoredShape = {
  version: 1;
  items: ExploreRecentSearch[];
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

/** Strip precise geo and anything not needed to reconstruct Explore search. */
export function sanitizeRecentSearchParams(
  params: Partial<PropertySearchQuery>,
): Partial<PropertySearchQuery> {
  return {
    q: params.q,
    city: params.city,
    area: params.area,
    date: params.date,
    period: params.period,
    guests: params.guests,
    propertyType: params.propertyType,
    amenities: params.amenities,
    hasPool: params.hasPool,
    allowsOvernight: params.allowsOvernight,
    allowsEvents: params.allowsEvents,
    featured: params.featured,
    offersOnly: params.offersOnly,
    newlyAdded: params.newlyAdded,
    verifiedOnly: params.verifiedOnly,
    sort: params.sort === 'distance_asc' ? 'recommended' : params.sort,
    // Intentionally omit lat/lng — never persist precise user location.
  };
}

function filtersId(params: Partial<PropertySearchQuery>): string {
  return `filters:${serializePropertySearchQuery(sanitizeRecentSearchParams(params))}`;
}

function readStore(): ExploreRecentSearch[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(EXPLORE_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredShape;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) return [];
    return parsed.items
      .filter((item) => item && (item.kind === 'filters' || item.kind === 'property'))
      .map((item) => {
        if (item.kind === 'property') {
          return {
            kind: 'property' as const,
            id: `property:${item.slug}`,
            label: String(item.label ?? ''),
            slug: String(item.slug ?? ''),
            at: Number(item.at) || 0,
          };
        }
        const params = sanitizeRecentSearchParams(item.params ?? {});
        return {
          kind: 'filters' as const,
          id: filtersId(params),
          label: String(item.label ?? ''),
          params,
          at: Number(item.at) || 0,
        };
      })
      .filter((item) => item.label && (item.kind === 'property' ? item.slug : true))
      .slice(0, EXPLORE_RECENT_SEARCHES_MAX);
  } catch {
    return [];
  }
}

function writeStore(items: ExploreRecentSearch[]) {
  if (!canUseStorage()) return;
  const payload: StoredShape = {
    version: 1,
    items: items.slice(0, EXPLORE_RECENT_SEARCHES_MAX),
  };
  window.localStorage.setItem(EXPLORE_RECENT_SEARCHES_KEY, JSON.stringify(payload));
}

export function listExploreRecentSearches(): ExploreRecentSearch[] {
  return readStore().sort((a, b) => b.at - a.at).slice(0, EXPLORE_RECENT_SEARCHES_MAX);
}

function upsert(item: ExploreRecentSearch): ExploreRecentSearch[] {
  const existing = readStore().filter((x) => x.id !== item.id);
  const next = [item, ...existing].slice(0, EXPLORE_RECENT_SEARCHES_MAX);
  writeStore(next);
  return next;
}

/** Record only after executed search intent (submit / suggestion select). */
export function recordExploreFilterSearch(
  label: string,
  params: Partial<PropertySearchQuery>,
): ExploreRecentSearch[] {
  const cleaned = sanitizeRecentSearchParams(params);
  const hasSignal =
    Boolean(cleaned.q?.trim()) ||
    Boolean(cleaned.city) ||
    Boolean(cleaned.area) ||
    Boolean(cleaned.propertyType) ||
    cleaned.hasPool === true ||
    Boolean(cleaned.amenities?.length) ||
    cleaned.allowsEvents === true ||
    cleaned.allowsOvernight === true;
  if (!hasSignal) return listExploreRecentSearches();

  return upsert({
    kind: 'filters',
    id: filtersId(cleaned),
    label: label.trim() || cleaned.q?.trim() || 'Search',
    params: cleaned,
    at: Date.now(),
  });
}

export function recordExplorePropertySearch(label: string, slug: string): ExploreRecentSearch[] {
  const s = slug.trim();
  if (!s) return listExploreRecentSearches();
  return upsert({
    kind: 'property',
    id: `property:${s}`,
    label: label.trim() || s,
    slug: s,
    at: Date.now(),
  });
}

export function clearExploreRecentSearches(): void {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(EXPLORE_RECENT_SEARCHES_KEY);
}

/** Test helper: assert stored JSON never contains precise geo keys. */
export function recentSearchStoreContainsPreciseGeo(rawJson: string): boolean {
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    const blob = JSON.stringify(parsed);
    return (
      /"lat"\s*:/.test(blob) ||
      /"lng"\s*:/.test(blob) ||
      /latitudeExact/.test(blob) ||
      /longitudeExact/.test(blob)
    );
  } catch {
    return false;
  }
}
