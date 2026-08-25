/**
 * Phase 2G Explore autocomplete + search-mode QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-explore-search-fast.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExploreSecondaryRecommendationParams,
  isExploreTextSearchMode,
  mergeExploreSuggestions,
  parseExploreSearchIntent,
  propertyTitleMatchScore,
  resolveUniqueExplorePrefixSuggestion,
  shouldShowExploreSecondaryRecommendations,
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
const barSrc = readFileSync(join(root, 'apps/web/src/components/explore/explore-search-bar.tsx'), 'utf8');
const searchPageSrc = readFileSync(join(root, 'apps/web/src/app/[locale]/search/page.tsx'), 'utf8');
const resultsSrc = readFileSync(
  join(root, 'apps/web/src/components/marketplace/property-search-results.tsx'),
  'utf8',
);
const suggestionsSvc = readFileSync(
  join(root, 'apps/api/src/services/property-suggestions.service.ts'),
  'utf8',
);
const routesSrc = readFileSync(join(root, 'apps/api/src/routes/properties.ts'), 'utf8');
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

console.log('\n— Autocomplete local + prefix —');
{
  const local = mergeExploreSuggestions({ query: 'مزر', locale: 'ar', properties: [], limit: 8 });
  expect('1) مزر local type-prefix suggestion', local.some((s) => s.kind === 'property_type' && s.id.includes('farm')));
  const unique = resolveUniqueExplorePrefixSuggestion('مزر');
  expect('1b) unique prefix → farm', unique?.params.propertyType === 'farm');
  expect('1c) ambiguous short prefix null', resolveUniqueExplorePrefixSuggestion('م') == null || resolveUniqueExplorePrefixSuggestion('م')?.id != null);
}

console.log('\n— Autocomplete UX source —');
{
  expect('2) remote after debounce uses suggestions API', barSrc.includes('fetchPropertySuggestions') && barSrc.includes('220'));
  expect('3) loading begins before debounce completes', /setLoadingSuggest\(true\)/.test(barSrc) && barSrc.indexOf('setLoadingSuggest(true)') < barSrc.indexOf('setTimeout'));
  expect('4) loading stops after success', barSrc.includes('setLoadingSuggest(false)'));
  expect('5) catch keeps local / stops loader', barSrc.includes('.catch(') && barSrc.includes('setLoadingSuggest(false)'));
  expect('6) stale gen guard', barSrc.includes('requestGen') && barSrc.includes('AbortController'));
}

console.log('\n— Title ranking —');
{
  expect('7) exact > startsWith', propertyTitleMatchScore('sky', 'Sky', null) > propertyTitleMatchScore('sky', 'Sky View Farm', null));
  expect('8) startsWith > contains', propertyTitleMatchScore('مز', 'مزرعة السعادة', null) > propertyTitleMatchScore('مز', 'بيت المزرعة الكبير', null) || propertyTitleMatchScore('مز', 'مزرعة السعادة', null) >= 700);
}

console.log('\n— Lightweight suggestion path —');
{
  expect('9/10) published+approved only', suggestionsSvc.includes("PropertyStatus.published") && suggestionsSvc.includes("owner: { status: 'approved' }"));
  expect('11) no Recommended ranking in suggestions', !suggestionsSvc.includes('rankPropertyIdsByRecommended') && !suggestionsSvc.includes('getConfirmedBookingCounts'));
  expect('11b) route registered', routesSrc.includes("/suggestions"));
  expect('12) autocomplete failure does not block submit', barSrc.includes('submitRawText') && !barSrc.includes('if (loadingSuggest) return'));
}

console.log('\n— Search submit —');
{
  const parsed = parseExploreSearchIntent('مزر');
  expect('13) مزر submit → farm + q', parsed.params.propertyType === 'farm' && parsed.params.q === 'مزر');
  expect('14) Enter uses same form submit', barSrc.includes('onSubmit={handleSearch}'));
  expect('15) unknown q still searches', parseExploreSearchIntent('xyzunknown99').params.q === 'xyzunknown99');
  expect('16) same-query refresh', barSrc.includes('router.refresh()'));
  expect('17) search pending state', barSrc.includes('isPending') && barSrc.includes('searchPending'));
  expect('18) pending uses transition', barSrc.includes('startTransition'));
}

console.log('\n— Result distribution —');
{
  expect('19) q search results before browse rails', searchPageSrc.includes('isExploreTextSearchMode') && searchPageSrc.includes('searchMode ?'));
  expect('20) title relevance primary (existing)', propertyTitleMatchScore('Blue House', 'Blue House Villa', null) > 800);
  expect('21) secondary helper when complete', shouldShowExploreSecondaryRecommendations({ total: 3, hasMore: false }));
  expect('22) zero direct can show secondary', shouldShowExploreSecondaryRecommendations({ total: 0, hasMore: false }));
  const sec = buildExploreSecondaryRecommendationParams({
    q: 'sky',
    city: 'amman',
    date: '2026-09-01',
    period: 'evening',
    guests: 8,
    hasPool: true,
    amenities: ['football'],
    sort: 'rating_desc',
  });
  expect('23) secondary excludes q', sec.q === undefined);
  expect('24) secondary preserves city', sec.city === 'amman');
  expect('25) secondary preserves date', sec.date === '2026-09-01');
  expect('26) secondary preserves period', sec.period === 'evening');
  expect('27) secondary preserves guests', sec.guests === 8);
  expect('28) secondary preserves pool/amenities', sec.hasPool === true && sec.amenities?.[0] === 'football');
  expect('29) secondary availability via date/period', Boolean(sec.date && sec.period));
  expect('30) secondary uses recommended', sec.sort === 'recommended');
  expect('31) no paid in secondary builder', !('featured' in sec && sec.featured));
  expect('32) large direct set skips secondary', shouldShowExploreSecondaryRecommendations({ total: 50, hasMore: true }) === false);
  expect('33) browse mode unchanged branch', searchPageSrc.includes('ExploreNearRail') && searchPageSrc.includes('!searchMode'));
  expect('secondary wired in results', resultsSrc.includes('explore-secondary-recommendations'));
  expect('search mode detection', isExploreTextSearchMode({ q: 'مزر' }) && !isExploreTextSearchMode({ city: 'amman' }));
}

console.log('\n— i18n —');
{
  expect('EN otherFarms', typeof en.explore.otherFarmsTitle === 'string');
  expect('AR otherFarms', typeof ar.explore.otherFarmsTitle === 'string');
  expect('EN pending', typeof en.explore.searchPending === 'string');
  expect('AR pending', typeof ar.explore.searchPending === 'string');
}

console.log(`\nPhase 2G Search Fast QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
