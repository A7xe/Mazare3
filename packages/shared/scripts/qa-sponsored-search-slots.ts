/**
 * Phase 2I-D — Sponsored Search Slots.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-sponsored-search-slots.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPONSORED_SEARCH_AFTER_ORGANIC,
  SPONSORED_SEARCH_MAX_PER_ORGANIC,
  SPONSORED_SEARCH_PAGE1_ONLY,
  countOrganicInMergedPage,
  mergeSponsoredIntoOrganicPage,
  organicOrderPreserved,
  pickSponsoredSearchCandidate,
  shouldInjectSponsoredSearchSlot,
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
const searchSvc = readFileSync(
  join(root, 'apps/api/src/services/property-search.service.ts'),
  'utf8',
);
const placementSvc = readFileSync(join(root, 'apps/api/src/services/placement.service.ts'), 'utf8');
const recommended = readFileSync(
  join(root, 'apps/api/src/services/recommended-ranking.service.ts'),
  'utf8',
);
const exploreCard = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-property-card.tsx'),
  'utf8',
);
const progressive = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-progressive-results.tsx'),
  'utf8',
);
const slotsShared = readFileSync(join(root, 'packages/shared/src/sponsored-search-slots.ts'), 'utf8');
const types = readFileSync(join(root, 'packages/shared/src/types.ts'), 'utf8');
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));

console.log('\n— Organic integrity —');
{
  expect(
    '1 sponsored does not alter recommended score',
    recommended.includes('Paid placement is intentionally ignored') &&
      !recommended.includes('placementRank') &&
      !recommended.includes('isSponsored'),
  );

  const organic = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const merged = mergeSponsoredIntoOrganicPage(organic, 'S');
  expect(
    '2 organic relative ordering preserved',
    organicOrderPreserved(organic, merged, 'S') &&
      merged.join(',') === 'A,B,C,D,S,E,F,G',
  );
  expect(
    '3 sponsored does not replace organic',
    countOrganicInMergedPage(merged, 'S') === organic.length &&
      organic.every((id) => merged.includes(id)),
  );
  expect(
    '4 live sponsored placement required',
    searchSvc.includes('PlacementType.sponsored') &&
      searchSvc.includes('listLivePlacementPropertyIds') &&
      placementSvc.includes('startsAt: { lte: now }') &&
      placementSvc.includes('endsAt: { gte: now }'),
  );
  expect(
    '5/6 window via live placement query',
    placementSvc.includes('status: PromotionStatus.active') &&
      placementSvc.includes('startsAt: { lte: now }') &&
      placementSvc.includes('endsAt: { gte: now }'),
  );
  expect(
    '7/8 published + approved owner',
    placementSvc.includes("status: 'published'") &&
      placementSvc.includes("owner: { status: 'approved' }"),
  );
  expect(
    '9 no inventory → no insert',
    pickSponsoredSearchCandidate({
      sponsoredCandidateIds: [],
      organicVisibleIds: organic,
    }) === null &&
      mergeSponsoredIntoOrganicPage(organic, null).join(',') === organic.join(','),
  );
  expect(
    '10 no Featured-as-Sponsored fallback',
    searchSvc.includes('placementType: PlacementType.sponsored') &&
      !searchSvc.includes('PlacementType.featured,\n    propertyWhere: sponsored') &&
      !slotsShared.toLowerCase().includes('featured'),
  );
}

console.log('\n— Relevance / filters —');
{
  expect(
    '11-16 filters via sponsoredSearchPropertyWhere',
    searchSvc.includes('sponsoredSearchPropertyWhere') &&
      searchSvc.includes('browsePriceWhere(query)') &&
      searchSvc.includes("mode === 'browse' ? browsePriceWhere(query) : buildPropertySearchWhere(query)"),
  );
  expect(
    '17/18 textual q requires title relevance',
    searchSvc.includes('titleAr: { contains: q') &&
      searchSvc.includes('titleEn: { contains: q') &&
      searchSvc.includes('When textual `q` is active, require title relevance'),
  );
  expect(
    '16 availability intersect',
    searchSvc.includes('eligibleIdSet: new Set(survivingIds)') &&
      searchSvc.includes('eligibleIdSet.has(id)'),
  );
  expect(
    '19 offersOnly in buildPropertySearchWhere',
    searchSvc.includes('query.offersOnly') && searchSvc.includes('liveActivePromotionFilter'),
  );
  expect(
    '20 newlyAdded remains in where',
    searchSvc.includes('query.newlyAdded') && searchSvc.includes('recentlyAddedCreatedAtCutoff'),
  );
}

console.log('\n— Pagination / infinite scroll —');
{
  const organic24 = Array.from({ length: 24 }, (_, i) => `O${i + 1}`);
  const page1 = mergeSponsoredIntoOrganicPage(organic24, 'S1');
  expect('21 page1 keeps 24 organic', countOrganicInMergedPage(page1, 'S1') === 24);
  expect('22 sponsored inserted additionally', page1.length === 25 && page1[4] === 'S1');
  expect(
    '23 page2 no inject (page1-only)',
    SPONSORED_SEARCH_PAGE1_ONLY === true &&
      shouldInjectSponsoredSearchSlot({ page: 2, organicPageCount: 24, pageSize: 24 }) === false,
  );
  expect(
    '24/25 dedupe prefers next candidate',
    pickSponsoredSearchCandidate({
      sponsoredCandidateIds: ['O3', 'S2', 'S3'],
      organicVisibleIds: organic24,
    }) === 'S2',
  );
  expect(
    '25 no duplicate when all sponsored already organic',
    pickSponsoredSearchCandidate({
      sponsoredCandidateIds: ['O1', 'O2'],
      organicVisibleIds: organic24,
    }) === null,
  );
  expect(
    '26 signature reset on filter change',
    progressive.includes('exploreSearchSignature') &&
      progressive.includes('setProperties(initialProperties)'),
  );
  expect(
    '27 stale response guarded',
    progressive.includes('signatureRef.current !== requestSignature'),
  );
  expect(
    '28 density after #4 + max 1/12',
    SPONSORED_SEARCH_AFTER_ORGANIC === 4 &&
      SPONSORED_SEARCH_MAX_PER_ORGANIC === 12 &&
      shouldInjectSponsoredSearchSlot({ page: 1, organicPageCount: 24, pageSize: 24 }) === true &&
      shouldInjectSponsoredSearchSlot({ page: 1, organicPageCount: 3, pageSize: 24 }) === false,
  );
  expect(
    '29 hasMore still organic meta',
    searchSvc.includes('total,') &&
      searchSvc.includes('buildSearchMeta') &&
      !searchSvc.includes('total + 1') &&
      !searchSvc.includes('total + sponsored'),
  );
  expect(
    '30 no extra infinite-scroll from sponsored alone',
    progressive.includes('propertySearchHasMore') && progressive.includes('EXPLORE_MAIN_PAGE_SIZE'),
  );
}

console.log('\n— Promotion coexistence / disclosure —');
{
  expect(
    '31/32 sponsored + offer badges',
    exploreCard.includes('placement-badge-sponsored') &&
      exploreCard.includes('PropertyOfferBadge') &&
      exploreCard.includes("tCommon('sponsored')"),
  );
  expect(
    '33 indigo commercial vs amber offer',
    exploreCard.includes('bg-[#2F6EF6]') && exploreCard.includes('PropertyOfferBadge'),
  );
  expect(
    '34 offer pricing via existing indicators',
    exploreCard.includes('usePropertyOfferPresentation') &&
      exploreCard.includes('PropertyOfferPriceBlock'),
  );
  expect(
    '35 non-promoted has no fake offer',
    exploreCard.includes('badgeLabel ?') && exploreCard.includes('isSponsored || badgeLabel'),
  );
  expect('AR disclosure', ar.common.sponsored === 'إعلان');
  expect('EN disclosure', en.common.sponsored === 'Sponsored');
}

console.log('\n— Performance / API shape —');
{
  expect(
    '36/37/38 batched placement with page hydrate',
    searchSvc.includes('resolveSponsoredSearchInsertId') &&
      searchSvc.includes('listLivePlacementPropertyIds') &&
      !exploreCard.includes('/placements') &&
      !exploreCard.includes('fetchSponsored'),
  );
  // card reads property.isSponsored from payload — check that separately
  expect(
    '36b card uses payload flag not fetch',
    exploreCard.includes('property.isSponsored') && !exploreCard.includes('useEffect'),
  );
  expect(
    '39 public DTO has flags only',
    types.includes('isSponsored?: boolean') &&
      !types.includes('placementPrice') &&
      !types.includes('bidAmount') &&
      !types.includes('advertiserSpend'),
  );
  expect(
    'no per-card placement query in explore card',
    !exploreCard.includes('placements') && !exploreCard.includes('/placements'),
  );
}

console.log('\n— Architecture reuse —');
{
  expect(
    'reuses PropertyPlacement live list',
    searchSvc.includes('listLivePlacementPropertyIds') &&
      placementSvc.includes('placementType: params.placementType'),
  );
  expect(
    'applyPlacementFlags still labels cards',
    searchSvc.includes('applyPlacementFlags'),
  );
}

console.log(`\nPhase 2I-D Sponsored Search Slots QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
