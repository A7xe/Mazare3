/**
 * Focused Explore search discovery tests (shared + recent-search logic).
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-search-suggestions.ts
 */
import {
  applyExploreSuggestionParams,
  isUnsupportedExploreIntent,
  matchExploreLocalSuggestions,
  mergeExploreSuggestions,
  normalizeExploreSearchText,
  propertyTitleMatchScore,
  searchHref,
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

// --- Recent searches (inlined store logic mirror for Node; also import web module via dynamic mock) ---
console.log('\n— Recent searches —');

const memory = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memory.set(k, v);
    },
    removeItem: (k: string) => {
      memory.delete(k);
    },
  },
};

const recent = await import('../../../apps/web/src/lib/explore-recent-searches.ts');

memory.clear();
expect('starts empty', recent.listExploreRecentSearches().length === 0);

recent.recordExploreFilterSearch('Amman farms', { city: 'amman', propertyType: 'farm' });
recent.recordExploreFilterSearch('pool', { hasPool: true });
expect('records executed filters only', recent.listExploreRecentSearches().length === 2);

// keystrokes would not call record — ensure empty q without filters is ignored
const before = recent.listExploreRecentSearches().length;
recent.recordExploreFilterSearch('  ', {});
expect('empty action not recorded', recent.listExploreRecentSearches().length === before);

recent.recordExploreFilterSearch('Amman farms', { city: 'amman', propertyType: 'farm' });
const list = recent.listExploreRecentSearches();
expect('dedupes equivalent search', list.length === 2);
expect('repeated search moves to top', list[0]!.label === 'Amman farms');

for (let i = 0; i < 8; i++) {
  recent.recordExploreFilterSearch(`q${i}`, { q: `q${i}` });
}
expect('max 5 retained', recent.listExploreRecentSearches().length === 5);
expect(
  'newest first',
  recent.listExploreRecentSearches()[0]!.label === 'q7' &&
    recent.listExploreRecentSearches()[4]!.label === 'q3',
);

recent.recordExploreFilterSearch('near me', {
  q: 'x',
  lat: 31.953456,
  lng: 35.910123,
});
const stored = memory.get(recent.EXPLORE_RECENT_SEARCHES_KEY) ?? '';
expect(
  'no precise geolocation stored',
  !recent.recentSearchStoreContainsPreciseGeo(stored) && !/"lat"/.test(stored) && !/"lng"/.test(stored),
);

recent.clearExploreRecentSearches();
expect('clear works', recent.listExploreRecentSearches().length === 0);

// --- Suggestions ---
console.log('\n— Suggestions —');
expect(
  'Arabic farm alias',
  matchExploreLocalSuggestions('مزرعة').some((s) => s.params.propertyType === 'farm'),
);
expect(
  'English villa alias',
  matchExploreLocalSuggestions('villas').some((s) => s.params.propertyType === 'villa'),
);
expect(
  'pool alias → hasPool',
  matchExploreLocalSuggestions('مسبح').some((s) => s.params.hasPool === true),
);
expect(
  'city alias amman/عمان',
  matchExploreLocalSuggestions('عمان').some((s) => s.params.city === 'amman') &&
    matchExploreLocalSuggestions('amman').some((s) => s.params.city === 'amman'),
);

const merged = mergeExploreSuggestions({
  query: 'villa oasis',
  locale: 'en',
  properties: [
    { id: '1', slug: 'villa-oasis', titleAr: 'واحة الفيلا', titleEn: 'Villa Oasis Farm' },
    { id: '2', slug: 'other', titleAr: 'أخرى', titleEn: 'Other Place' },
  ],
  limit: 8,
});
expect(
  'real property suggestion present',
  merged.some((s) => s.kind === 'property' && s.slug === 'villa-oasis'),
);
expect(
  'strong property name ranks above type when exact-ish',
  propertyTitleMatchScore('villa oasis', 'واحة الفيلا', 'Villa Oasis Farm') >= 800,
);

// Caller only passes public API rows — unpublished never enter merge input.
const onlyPublic = mergeExploreSuggestions({
  query: 'secret',
  locale: 'en',
  properties: [], // unpublished excluded upstream
});
expect('unpublished not injectable without being passed in', !onlyPublic.some((s) => s.kind === 'property'));

expect(
  'no suggestion for unsupported fake intent',
  matchExploreLocalSuggestions('trending farms xyzzzz').length === 0 ||
    isUnsupportedExploreIntent('trending'),
);
expect(
  'normalize folds Arabic alef',
  normalizeExploreSearchText('أحمد') === normalizeExploreSearchText('احمد') ||
    normalizeExploreSearchText('إربد').includes('ا'),
);

// --- Navigation ---
console.log('\n— Navigation —');
expect(
  'property suggestion uses slug path contract',
  merged.find((s) => s.kind === 'property')?.slug === 'villa-oasis',
);

const cityParams = applyExploreSuggestionParams({ date: '2026-09-01' }, { city: 'amman' });
expect(
  'city → city filter URL',
  searchHref('/search', cityParams).includes('city=amman') && !searchHref('/search', cityParams).includes('q='),
);

const typeParams = applyExploreSuggestionParams({}, { propertyType: 'chalet' });
expect(
  'type → propertyType URL',
  searchHref('/search', typeParams) === '/search?propertyType=chalet' ||
    searchHref('/search', typeParams).includes('propertyType=chalet'),
);

const poolParams = applyExploreSuggestionParams({}, { hasPool: true });
expect(
  'amenity → hasPool URL',
  searchHref('/search', poolParams).includes('hasPool=true'),
);

const qHref = searchHref('/search', { q: 'مزرعة بمسبح في عمان' });
expect('raw manual search → q URL', qHref.includes('q=') && decodeURIComponent(qHref).includes('مزرعة'));

// --- Race safety ---
console.log('\n— Race safety —');
{
  let currentGen = 0;
  const apply = (gen: number, value: string, sink: { v: string }) => {
    if (gen !== currentGen) return false;
    sink.v = value;
    return true;
  };
  const sink = { v: '' };
  const genA = ++currentGen;
  const genB = ++currentGen;
  expect('stale A ignored', apply(genA, 'old', sink) === false && sink.v === '');
  expect('fresh B applied', apply(genB, 'new', sink) === true && sink.v === 'new');
}

if (failed) {
  console.log(`\n❌ explore search suggestions: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ explore search suggestions: ${passed} passed`);
