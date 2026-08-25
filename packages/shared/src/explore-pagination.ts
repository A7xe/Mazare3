import { SEARCH_DEFAULT_PAGE_SIZE } from './constants';
import type { PropertySearchQuery } from './schemas/property-search';
import type { PropertySearchMeta } from './types';
import { serializePropertySearchQuery } from './search-query';

export const EXPLORE_MAIN_PAGE_SIZE = SEARCH_DEFAULT_PAGE_SIZE;

/** Truthful hasMore from authoritative search meta. */
export function propertySearchHasMore(
  meta: Pick<PropertySearchMeta, 'page' | 'pageSize' | 'total'> | {
    page: number;
    pageSize: number;
    total: number;
  },
): boolean {
  if (meta.total <= 0 || meta.pageSize <= 0) return false;
  return meta.page * meta.pageSize < meta.total;
}

/** Stable Explore query signature — ignores progressive page accumulation. */
export function exploreSearchSignature(query: Partial<PropertySearchQuery>): string {
  return serializePropertySearchQuery({
    ...query,
    page: undefined,
    pageSize: undefined,
  });
}

/** Deterministic page slice of an already-ordered id list. */
export function sliceOrderedIds(
  orderedIds: readonly string[],
  page: number,
  pageSize: number = EXPLORE_MAIN_PAGE_SIZE,
): string[] {
  const safePage = Math.max(1, page);
  const safeSize = Math.max(1, pageSize);
  const start = (safePage - 1) * safeSize;
  return orderedIds.slice(start, start + safeSize);
}

/** Append next page while preserving order and rejecting duplicate ids. */
export function appendUniqueById<T extends { id: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): T[] {
  const seen = new Set(existing.map((item) => item.id));
  const next = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    next.push(item);
  }
  return next;
}

export function expectedExplorePageCount(total: number, pageSize = EXPLORE_MAIN_PAGE_SIZE): number {
  if (total <= 0) return 0;
  return Math.ceil(total / Math.max(1, pageSize));
}

export function expectedExploreLastPageSize(total: number, pageSize = EXPLORE_MAIN_PAGE_SIZE): number {
  if (total <= 0) return 0;
  const rem = total % Math.max(1, pageSize);
  return rem === 0 ? Math.min(total, pageSize) : rem;
}
