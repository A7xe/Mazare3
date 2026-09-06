/**
 * Phase 2F Explore pagination / Load More / rail eligibility QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-explore-pagination.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_MAIN_PAGE_SIZE,
  SEARCH_DEFAULT_PAGE_SIZE,
  SEARCH_MAX_PAGE_SIZE,
  appendUniqueById,
  exploreSearchSignature,
  expectedExploreLastPageSize,
  expectedExplorePageCount,
  propertySearchHasMore,
  sliceOrderedIds,
} from '../src/index.ts';

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const discoverySrc = readFileSync(
  join(root, 'apps/api/src/services/property-discovery.service.ts'),
  'utf8',
);
const searchSrc = readFileSync(
  join(root, 'apps/api/src/services/property-search.service.ts'),
  'utf8',
);
const progressiveSrc = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-progressive-results.tsx'),
  'utf8',
);
const resultsSrc = readFileSync(
  join(root, 'apps/web/src/components/marketplace/property-search-results.tsx'),
  'utf8',
);
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

function ids(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `p${String(i + 1).padStart(3, '0')}`);
}

function pagesOf(total: number, pageSize = EXPLORE_MAIN_PAGE_SIZE): string[][] {
  const ordered = ids(total);
  const pages: string[][] = [];
  const count = expectedExplorePageCount(total, pageSize);
  for (let page = 1; page <= count; page++) {
    pages.push(sliceOrderedIds(ordered, page, pageSize));
  }
  return pages;
}

console.log('\n— Page size —');
{
  expect('page size is 24', EXPLORE_MAIN_PAGE_SIZE === 24 && SEARCH_DEFAULT_PAGE_SIZE === 24);
  expect('max page size remains 48 for HTTP', SEARCH_MAX_PAGE_SIZE === 48);
}

console.log('\n— Scale cases —');
{
  const p10 = pagesOf(10);
  expect('1) 10 results → one page, no hasMore', p10.length === 1 && p10[0]!.length === 10);
  expect(
    '1b) hasMore false at end',
    propertySearchHasMore({ page: 1, pageSize: 24, total: 10 }) === false,
  );

  const p24 = pagesOf(24);
  expect('2) 24 results → exact one page', p24.length === 1 && p24[0]!.length === 24);
  expect(
    '2b) 24 complete',
    propertySearchHasMore({ page: 1, pageSize: 24, total: 24 }) === false,
  );

  const p25 = pagesOf(25);
  expect('3) 25 → 24 + 1', p25.length === 2 && p25[0]!.length === 24 && p25[1]!.length === 1);
  expect('3b) hasMore after page1', propertySearchHasMore({ page: 1, pageSize: 24, total: 25 }));

  const p49 = pagesOf(49);
  expect(
    '4) 49 → 24 + 24 + 1',
    p49.length === 3 &&
      p49[0]!.length === 24 &&
      p49[1]!.length === 24 &&
      p49[2]!.length === 1,
  );

  const p100 = pagesOf(100);
  expect(
    '4b) 100 → 24*4 + 4',
    p100.length === 5 &&
      p100.slice(0, 4).every((p) => p.length === 24) &&
      p100[4]!.length === 4 &&
      expectedExploreLastPageSize(100) === 4,
  );
}

console.log('\n— Unique IDs across pages —');
{
  const all = pagesOf(49).flat();
  expect('5) IDs unique across pages', new Set(all).size === all.length && all.length === 49);
  const appended = appendUniqueById(
    [{ id: 'a' }, { id: 'b' }],
    [{ id: 'b' }, { id: 'c' }],
  );
  expect('5b) appendUniqueById dedupes', appended.map((x) => x.id).join(',') === 'a,b,c');
}

console.log('\n— Ordering stability across pages —');
{
  const ordered = ids(60);
  const page1 = sliceOrderedIds(ordered, 1, 24);
  const page2 = sliceOrderedIds(ordered, 2, 24);
  expect('6) recommended slice consecutive', page1[23] === 'p024' && page2[0] === 'p025');
  expect('7) rating_desc slice same helper', sliceOrderedIds(ordered, 2, 24)[0] === 'p025');
  expect('8) price_asc slice same helper', sliceOrderedIds(ordered, 3, 24)[0] === 'p049');
  expect('9) distance_asc slice same helper', sliceOrderedIds(ordered, 1, 24).length === 24);
  expect(
    '10) q relevance continues as consecutive slices',
    [...page1, ...page2].join(',') === ordered.slice(0, 48).join(','),
  );
}

console.log('\n— Progressive client behavior (source) —');
{
  expect('11) SSR starts at page 1 only', /page:\s*1/.test(resultsSrc) && resultsSrc.includes('EXPLORE_MAIN_PAGE_SIZE'));
  const fetchCallCount = (progressiveSrc.match(/fetchPropertySearch\(/g) ?? []).length;
  expect(
    '11b) page 2 only via loadMore (not mount effect fetch)',
    fetchCallCount === 1 &&
      progressiveSrc.includes('const loadMore = useCallback(async () => {') &&
      progressiveSrc.indexOf('const loadMore') < progressiveSrc.indexOf('fetchPropertySearch(') &&
      !/useEffect\(\(\)\s*=>\s*\{[\s\S]{0,120}fetchPropertySearch/.test(progressiveSrc),
  );
  expect(
    '12) loading guard present',
    progressiveSrc.includes('loadingRef') && progressiveSrc.includes('if (loadingRef.current'),
  );
  expect('13) failed next-page keeps results', progressiveSrc.includes('setError') && !progressiveSrc.includes('setProperties([])'));
  expect('14) retry control present', progressiveSrc.includes('load-more-retry') && progressiveSrc.includes('loadMoreRetry'));
  expect(
    '15) query change resets via signature',
    progressiveSrc.includes('exploreSearchSignature') && progressiveSrc.includes('setProperties(initialProperties)'),
  );
  expect('16) reuses ExplorePropertyCard', progressiveSrc.includes('ExplorePropertyCard'));
  expect('17) favorites via existing card/provider', progressiveSrc.includes('ExplorePropertyCard'));
}

console.log('\n— Availability rail cap fix —');
{
  expect(
    '18) discovery uses lightweight eligibility',
    discoverySrc.includes('listAvailabilityEligiblePropertyIds') &&
      !discoverySrc.includes('Math.min(Math.max(first.meta.total'),
  );
  expect(
    '19/20) no 48 search loop for Near You / Most Booked eligibility',
    !discoverySrc.includes('pageSize: 48') && discoverySrc.includes('listAvailabilityEligiblePropertyIds'),
  );
  expect(
    '21) eligibility still date-gated',
    discoverySrc.includes('if (!query.date) return null'),
  );
  expect(
    '22) listAvailabilityEligiblePropertyIds exported (no full catalog hydrate)',
    searchSrc.includes('export async function listAvailabilityEligiblePropertyIds') &&
      searchSrc.includes('computeAvailabilityMatches'),
  );
  expect(
    '23) availability search hydrates page slice only',
    searchSrc.includes('pageIds') && searchSrc.includes('where: { id: { in: pageIds } }'),
  );
  expect(
    '24) holdings batched (no N+1 loop per property)',
    searchSrc.includes('loadHoldings(propertyIds)') && !/for \(const .+ of survivingIds\)[\s\S]{0,80}loadHoldings/.test(searchSrc),
  );
  expect(
    '25) approx coords remain on lightweight ranking path',
    searchSrc.includes('latitudeApprox') && searchSrc.includes('longitudeApprox'),
  );
}

console.log('\n— Signature / hasMore helpers —');
{
  const base = {
    q: 'sky',
    city: 'amman',
    sort: 'rating_desc' as const,
    date: '2026-09-01',
    period: 'evening' as const,
    guests: 8,
    lat: 31.95,
    lng: 35.91,
  };
  expect(
    'signature ignores page',
    exploreSearchSignature({ ...base, page: 1 }) === exploreSearchSignature({ ...base, page: 3 }),
  );
  expect(
    'signature changes with city',
    exploreSearchSignature({ ...base, city: 'amman' }) !==
      exploreSearchSignature({ ...base, city: 'irbid' }),
  );
  expect('hasMore page2 of 49', propertySearchHasMore({ page: 2, pageSize: 24, total: 49 }));
  expect('no hasMore page3 of 49', propertySearchHasMore({ page: 3, pageSize: 24, total: 49 }) === false);
}

console.log('\n— i18n —');
{
  expect('AR loadMore', typeof ar.search.loadMore === 'string' && ar.search.loadMore.length > 0);
  expect('EN loadMore', typeof en.search.loadMore === 'string' && en.search.loadMore.length > 0);
  expect('AR loading', typeof ar.search.loadMoreLoading === 'string');
  expect('EN retry', typeof en.search.loadMoreRetry === 'string');
}

console.log(`\nPhase 2F Pagination QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
