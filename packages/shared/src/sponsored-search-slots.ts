/**
 * Sponsored search slot helpers — paid placement as a disclosed insert,
 * never as a rewrite of organic ranking.
 */

/** Insert after the 4th organic result (1-based). */
export const SPONSORED_SEARCH_AFTER_ORGANIC = 4;

/** Hard density: at most one sponsored card per this many organic results. */
export const SPONSORED_SEARCH_MAX_PER_ORGANIC = 12;

/** Page-1-only injection keeps infinite-scroll append deterministic. */
export const SPONSORED_SEARCH_PAGE1_ONLY = true;

/**
 * Whether this organic page may receive a sponsored insert.
 * Requires enough organic results to place after slot #4.
 */
export function shouldInjectSponsoredSearchSlot(params: {
  page: number;
  organicPageCount: number;
  pageSize?: number;
}): boolean {
  if (SPONSORED_SEARCH_PAGE1_ONLY && params.page !== 1) return false;
  if (params.page < 1) return false;
  if (params.organicPageCount < SPONSORED_SEARCH_AFTER_ORGANIC) return false;
  // Density: page 1 with 24 organic ⇒ 1 sponsored is within 1/12.
  const pageSize = Math.max(1, params.pageSize ?? params.organicPageCount);
  const maxSponsoredOnPage = Math.max(
    1,
    Math.floor(pageSize / SPONSORED_SEARCH_MAX_PER_ORGANIC),
  );
  return maxSponsoredOnPage >= 1;
}

/**
 * Pick the first commercially ordered sponsored candidate not already
 * visible among organic IDs on this page (prefer next paid candidate
 * over duplicating a property that already has an organic seat).
 */
export function pickSponsoredSearchCandidate(params: {
  sponsoredCandidateIds: readonly string[];
  organicVisibleIds: ReadonlySet<string> | readonly string[];
}): string | null {
  const visible =
    params.organicVisibleIds instanceof Set
      ? params.organicVisibleIds
      : new Set(params.organicVisibleIds);
  for (const id of params.sponsoredCandidateIds) {
    if (visible.has(id)) continue;
    return id;
  }
  return null;
}

/**
 * Insert sponsored id after N organic results without removing any organic id.
 * Relative organic order is preserved.
 */
export function mergeSponsoredIntoOrganicPage(
  organicPageIds: readonly string[],
  sponsoredId: string | null | undefined,
  afterOrganicIndex: number = SPONSORED_SEARCH_AFTER_ORGANIC,
): string[] {
  const organic = [...organicPageIds];
  if (!sponsoredId) return organic;
  if (organic.includes(sponsoredId)) return organic;
  const insertAt = Math.min(Math.max(0, afterOrganicIndex), organic.length);
  organic.splice(insertAt, 0, sponsoredId);
  return organic;
}

/** Count organic ids in a merged page (excludes the inserted sponsored id). */
export function countOrganicInMergedPage(
  mergedIds: readonly string[],
  sponsoredId: string | null | undefined,
): number {
  if (!sponsoredId) return mergedIds.length;
  return mergedIds.filter((id) => id !== sponsoredId).length;
}

/**
 * Assert organic relative order is unchanged around a sponsored insert.
 * Returns false if any organic pair inverted or an organic id was dropped.
 */
export function organicOrderPreserved(
  organicBefore: readonly string[],
  mergedAfter: readonly string[],
  sponsoredId: string | null | undefined,
): boolean {
  const organicAfter = sponsoredId
    ? mergedAfter.filter((id) => id !== sponsoredId)
    : [...mergedAfter];
  if (organicAfter.length !== organicBefore.length) return false;
  for (let i = 0; i < organicBefore.length; i++) {
    if (organicAfter[i] !== organicBefore[i]) return false;
  }
  if (!sponsoredId) return true;
  const idx = mergedAfter.indexOf(sponsoredId);
  if (idx < 0) return false;
  return idx === Math.min(SPONSORED_SEARCH_AFTER_ORGANIC, organicBefore.length);
}
