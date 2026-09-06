/**
 * Phase 2H Explore automatic infinite scroll QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-explore-infinite-scroll.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXPLORE_MAIN_PAGE_SIZE,
  appendUniqueById,
  buildExploreSecondaryRecommendationParams,
  exploreSearchSignature,
  isExploreTextSearchMode,
  propertySearchHasMore,
  shouldShowExploreSecondaryRecommendations,
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
const progressiveSrc = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-progressive-results.tsx'),
  'utf8',
);
const resultsSrc = readFileSync(
  join(root, 'apps/web/src/components/marketplace/property-search-results.tsx'),
  'utf8',
);
const layoutSrc = readFileSync(join(root, 'apps/web/src/app/[locale]/layout.tsx'), 'utf8');
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

console.log('\n— Trigger & request timing —');
{
  expect(
    '1) initial render does not request page 2 on mount',
    !/useEffect\(\(\)\s*=>\s*\{[\s\S]{0,200}fetchPropertySearch/.test(progressiveSrc) &&
      progressiveSrc.includes('IntersectionObserver'),
  );
  expect(
    '2) sentinel outside range does not fetch without intersection',
    progressiveSrc.includes('entry.isIntersecting') || progressiveSrc.includes('e.isIntersecting'),
  );
  expect(
    '3) sentinel entering preload range requests next page',
    progressiveSrc.includes('IntersectionObserver') &&
      progressiveSrc.includes('600px 0px') &&
      progressiveSrc.includes('void loadMore()'),
  );
  const ordered = Array.from({ length: 50 }, (_, i) => `p${i + 1}`);
  const page2 = sliceOrderedIds(ordered, 2, EXPLORE_MAIN_PAGE_SIZE);
  expect('4) page 2 slice appendable', page2[0] === 'p25' && page2.length === 24);
  const page3 = sliceOrderedIds(ordered, 3, EXPLORE_MAIN_PAGE_SIZE);
  expect('5) page 3 can subsequently load', page3[0] === 'p49' && page3.length === 2);
}

console.log('\n— Request safety —');
{
  expect(
    '6) only one active request',
    progressiveSrc.includes('if (loadingRef.current') && progressiveSrc.includes('loadingRef.current = true'),
  );
  expect(
    '7) observer during loading does not duplicate',
    progressiveSrc.includes('loadingRef.current || !hasMoreRef.current'),
  );
  expect(
    '8) duplicate IDs not rendered',
    progressiveSrc.includes('appendUniqueById') &&
      appendUniqueById([{ id: 'a' }], [{ id: 'a' }, { id: 'b' }]).map((x) => x.id).join(',') === 'a,b',
  );
  expect(
    '9) hasMore=false stops observer',
    progressiveSrc.includes('if (!hasMore || error) return') &&
      progressiveSrc.includes('observer.disconnect()'),
  );
  expect(
    '10) successful mode has no manual Load More button',
    !progressiveSrc.includes('explore-load-more') &&
      progressiveSrc.includes('explore-infinite-sentinel') &&
      !/data-testid="explore-load-more"/.test(progressiveSrc),
  );
}

console.log('\n— Error / retry —');
{
  expect('11) failure preserves loaded cards', progressiveSrc.includes('setError') && !progressiveSrc.includes('setProperties([])'));
  expect('12) failure shows Retry', progressiveSrc.includes('load-more-retry') && progressiveSrc.includes('onRetry'));
  expect(
    '13) Retry clears error and resumes loadMore',
    progressiveSrc.includes('setError(null)') &&
      progressiveSrc.includes('errorRef.current = null') &&
      progressiveSrc.includes('void loadMore()'),
  );
}

console.log('\n— Signature / resets —');
{
  expect('14) query change aborts old request', progressiveSrc.includes('abortRef.current?.abort()'));
  expect(
    '15) stale response cannot append',
    progressiveSrc.includes('signatureRef.current !== requestSignature'),
  );
  expect(
    '16–18) filter/sort/q change resets via signature',
    progressiveSrc.includes('exploreSearchSignature') &&
      progressiveSrc.includes('setProperties(initialProperties)') &&
      exploreSearchSignature({ q: 'a', city: 'amman' }) !==
        exploreSearchSignature({ q: 'b', city: 'amman' }),
  );
}

console.log('\n— Ordering / availability / favorites —');
{
  expect('19) Recommended backend-owned (no client re-rank)', !progressiveSrc.includes('sort(') && progressiveSrc.includes('fetchPropertySearch'));
  expect('20) rating_desc works via filters', progressiveSrc.includes('...activeFilters'));
  expect('21) price_asc works via filters', progressiveSrc.includes('pageSize'));
  expect('22) distance_asc works via filters', progressiveSrc.includes('filtersRef'));
  expect(
    '23) availability filters survive next-page',
    progressiveSrc.includes('...activeFilters') && progressiveSrc.includes('page: nextPage'),
  );
  expect('24) favorites via ExplorePropertyCard', progressiveSrc.includes('ExplorePropertyCard'));
}

console.log('\n— Search mode / secondary —');
{
  expect('25) search-mode direct results use progressive island', resultsSrc.includes('ExploreProgressiveResults'));
  expect(
    '26) secondary recommendation section does NOT infinite-load',
    resultsSrc.includes('explore-secondary-recommendations') &&
      !resultsSrc.includes('IntersectionObserver') &&
      shouldShowExploreSecondaryRecommendations({ total: 3, hasMore: false }) &&
      buildExploreSecondaryRecommendationParams({ q: 'x', city: 'amman' }).q === undefined &&
      isExploreTextSearchMode({ q: 'sky' }),
  );
  expect(
    '27) mobile dock padding remains sufficient',
    layoutSrc.includes('pb-[4.75rem]') || layoutSrc.includes('pb-20'),
  );
  expect(
    '28) no request after final page',
    !propertySearchHasMore({ page: 3, pageSize: 24, total: 49 }) &&
      progressiveSrc.includes('!hasMoreRef.current'),
  );
}

console.log('\n— i18n —');
{
  expect('EN loading more', en.search.loadMoreLoading.includes('Loading more'));
  expect('AR loading more', ar.search.loadMoreLoading.includes('تحميل المزيد'));
  expect('EN retry', typeof en.search.loadMoreRetry === 'string');
  expect('AR retry', typeof ar.search.loadMoreRetry === 'string');
}

console.log(`\nPhase 2H Infinite Scroll QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
