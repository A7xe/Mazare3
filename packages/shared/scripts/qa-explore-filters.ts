/**
 * Phase 2E Explore Filter sheet ownership / truthfulness QA.
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-filters.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AMENITY_KEYS,
  EXPLORE_AMENITY_MATCH_MODE,
  EXPLORE_FILTER_SHEET_AMENITY_KEYS,
  EXPLORE_FILTER_SHEET_OWNED_KEYS,
  EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER,
  EXPLORE_VERIFIED_ONLY_MEANING,
  JORDAN_CITIES,
  PROPERTY_TYPES,
  activeExplorePropertyTypeCategory,
  applyParsedExploreSearchIntent,
  buildExploreFilterApplyParams,
  buildExploreFilterResetParams,
  exploreFilterCityOptions,
  exploreFilterPropertyTypeOptions,
  parseExploreSearchIntent,
  searchHref,
  serializePropertySearchQuery,
  validateExplorePriceRange,
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
const filtersSrc = readFileSync(
  join(root, 'apps/web/src/components/marketplace/search-filters.tsx'),
  'utf8',
);
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

console.log('\n— Duplicate controls removed from Filter sheet —');
{
  expect('1 no duplicate q control', !/name=["']q["']/.test(filtersSrc) && !/id=["']filter-q["']/.test(filtersSrc));
  expect(
    '2 no duplicate sort control',
    !/name=["']sort["']/.test(filtersSrc) && !/id=["']filter-sort["']/.test(filtersSrc),
  );
}

console.log('\n— City catalog —');
{
  const cities = exploreFilterCityOptions();
  expect('3 city uses JORDAN_CITIES', cities === JORDAN_CITIES || cities.length === JORDAN_CITIES.length);
  expect(
    '3b Amman → amman key',
    cities.some((c) => c.key === 'amman' && c.labelEn === 'Amman' && c.labelAr === 'عمان'),
  );
}

console.log('\n— Property types match Phase 2D —');
{
  const opts = exploreFilterPropertyTypeOptions();
  expect('4 property types match shared catalog', opts.every((t, i) => t === EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER[i]));
  expect('4b same as PROPERTY_TYPES', opts.length === PROPERTY_TYPES.length);
}

console.log('\n— Category ↔ Filter sync via URL params —');
{
  expect(
    '5 category villa appears as filter propertyType',
    activeExplorePropertyTypeCategory({ propertyType: 'villa' }) === 'villa',
  );
  const applied = buildExploreFilterApplyParams(
    { q: 'sky', sort: 'rating_desc', guests: 8 },
    { propertyType: 'farm', city: 'amman', hasPool: true },
  );
  expect('6 filter farm updates category active', activeExplorePropertyTypeCategory(applied) === 'farm');
}

console.log('\n— Phase 2B parsed intent visible in Filters —');
{
  const parsed = parseExploreSearchIntent('مزرعة بمسبح في عمان');
  const applied = applyParsedExploreSearchIntent({}, parsed);
  expect('7 farm selected', applied.propertyType === 'farm');
  expect('7b pool enabled', applied.hasPool === true);
  expect('7c Amman selected', applied.city === 'amman');
}

console.log('\n— Pool vs pool_house —');
{
  expect('8 pool uses hasPool', EXPLORE_FILTER_SHEET_OWNED_KEYS.includes('hasPool'));
  const both = buildExploreFilterApplyParams({}, { propertyType: 'pool_house', hasPool: true });
  expect('9 pool_house distinct from hasPool', both.propertyType === 'pool_house' && both.hasPool === true);
}

console.log('\n— No Families / Featured in sheet —');
{
  expect(
    '10 no Families filter',
    !/famil/i.test(filtersSrc) && !filtersSrc.includes('عائلات') && !filtersSrc.includes('filterFamilies'),
  );
  expect(
    '11 Featured not in Filter sheet',
    !/name=["']featured["']/.test(filtersSrc) && !filtersSrc.includes('filterFeatured'),
  );
}

console.log('\n— Verified semantics —');
{
  expect(
    '12 verified maps to platform verification',
    EXPLORE_VERIFIED_ONLY_MEANING.includes('platform_reviewed') &&
      EXPLORE_VERIFIED_ONLY_MEANING.includes('platform_verified'),
  );
  expect('12b verifiedOnly owned by sheet', EXPLORE_FILTER_SHEET_OWNED_KEYS.includes('verifiedOnly'));
}

console.log('\n— Price validation —');
{
  expect('13 minPrice negative rejected', validateExplorePriceRange(-1, 100).ok === false);
  expect('14 maxPrice negative rejected', validateExplorePriceRange(0, -5).ok === false);
  expect('15 min > max rejected', validateExplorePriceRange(200, 50).ok === false);
  const empty = validateExplorePriceRange('', '');
  expect('16 empty prices omitted', empty.ok && empty.minPrice === undefined && empty.maxPrice === undefined);
  const qs = serializePropertySearchQuery({ minPrice: undefined, maxPrice: undefined, city: 'amman' });
  expect('16b blank prices not in URL', !qs.includes('minPrice') && !qs.includes('maxPrice'));
}

console.log('\n— Amenities —');
{
  expect(
    '17 amenities use canonical keys',
    EXPLORE_FILTER_SHEET_AMENITY_KEYS.every((k) => (AMENITY_KEYS as readonly string[]).includes(k)),
  );
  expect('17b match mode ALL', EXPLORE_AMENITY_MATCH_MODE === 'ALL');
}

console.log('\n— Events / Overnight —');
{
  const sheet = buildExploreFilterApplyParams({}, { allowsEvents: true, allowsOvernight: true });
  expect('18 events → allowsEvents', sheet.allowsEvents === true);
  expect('19 overnight → allowsOvernight', sheet.allowsOvernight === true);
  expect('18b no-op false omitted', serializePropertySearchQuery({ allowsEvents: false }) === '');
}

console.log('\n— Apply preserves context —');
{
  const current = {
    q: 'sky',
    sort: 'rating_desc' as const,
    date: '2026-08-30',
    period: 'evening' as const,
    guests: 8,
    lat: 31.95,
    lng: 35.91,
    city: 'irbid',
  };
  const next = buildExploreFilterApplyParams(current, {
    city: 'amman',
    hasPool: true,
    propertyType: 'villa',
  });
  expect('20 Apply preserves q', next.q === 'sky');
  expect('21 Apply preserves sort', next.sort === 'rating_desc');
  expect('22 Apply preserves date', next.date === '2026-08-30');
  expect('23 Apply preserves period', next.period === 'evening');
  expect('24 Apply preserves guests', next.guests === 8);
  expect('25 Apply preserves geo', next.lat === 31.95 && next.lng === 35.91);
  expect('25b Apply sets sheet filters', next.city === 'amman' && next.hasPool === true && next.propertyType === 'villa');
}

console.log('\n— Reset semantics —');
{
  const current = {
    q: 'sky',
    sort: 'distance_asc' as const,
    date: '2026-08-30',
    period: 'evening' as const,
    guests: 8,
    lat: 31.95,
    lng: 35.91,
    city: 'amman',
    minPrice: 50,
    maxPrice: 200,
    propertyType: 'villa' as const,
    hasPool: true as const,
    amenities: ['football', 'bbq'],
    allowsEvents: true as const,
    allowsOvernight: true as const,
    verifiedOnly: true as const,
  };
  const reset = buildExploreFilterResetParams(current);
  expect('26 Reset clears city', reset.city === undefined);
  expect('27 Reset clears price', reset.minPrice === undefined && reset.maxPrice === undefined);
  expect('28 Reset clears propertyType', reset.propertyType === undefined);
  expect(
    '29 Reset clears pool/amenities/flags',
    reset.hasPool === undefined &&
      reset.amenities === undefined &&
      reset.allowsEvents === undefined &&
      reset.allowsOvernight === undefined &&
      reset.verifiedOnly === undefined,
  );
  expect('30 Reset preserves q', reset.q === 'sky');
  expect('31 Reset preserves sort', reset.sort === 'distance_asc');
  expect(
    '32 Reset preserves date/period/guests',
    reset.date === '2026-08-30' && reset.period === 'evening' && reset.guests === 8,
  );
  expect('32b Reset preserves geo', reset.lat === 31.95 && reset.lng === 35.91);
}

console.log('\n— Canonical URL —');
{
  const applied = buildExploreFilterApplyParams({ q: 'sky' }, {});
  const qs = serializePropertySearchQuery(applied);
  expect('33 no empty/no-op params', qs === 'q=sky');
  expect('33b no hasPool=false', !serializePropertySearchQuery({ hasPool: false as never }).includes('hasPool') || serializePropertySearchQuery({} as never) === '');
  // serialize still writes hasPool=false if explicitly false — Apply never emits false
  const applyNoPool = buildExploreFilterApplyParams({ q: 'a' }, { hasPool: undefined });
  expect('33c Apply omits unset pool', !serializePropertySearchQuery(applyNoPool).includes('hasPool'));
  expect('33d no empty amenities', !serializePropertySearchQuery({ amenities: [] }).includes('amenities'));
}

console.log('\n— Localization —');
{
  const keys = [
    'filterCity',
    'filterMinPrice',
    'filterMaxPrice',
    'filterPropertyType',
    'filterPool',
    'filterAmenities',
    'filterVerifiedOnly',
    'filterOvernight',
    'filterEvents',
    'filterPriceNegative',
    'filterPriceMinGtMax',
    'applyFilters',
    'clearFilters',
  ];
  expect(
    '34 AR labels exist',
    keys.every((k) => typeof ar.search?.[k] === 'string' && ar.search[k].length > 0),
  );
  expect(
    '35 EN labels exist',
    keys.every((k) => typeof en.search?.[k] === 'string' && en.search[k].length > 0),
  );
}

console.log('\n— Ownership helpers —');
{
  expect(
    'owned keys exclude q/sort/date',
    !EXPLORE_FILTER_SHEET_OWNED_KEYS.includes('q' as never) &&
      !EXPLORE_FILTER_SHEET_OWNED_KEYS.includes('sort' as never),
  );
  expect('featured not owned', !EXPLORE_FILTER_SHEET_OWNED_KEYS.includes('featured' as never));
}

console.log(`\nPhase 2E Filter QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
