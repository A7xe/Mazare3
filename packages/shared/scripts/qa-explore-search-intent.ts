/**
 * Phase 2B closure verification suite (extends focused parser QA).
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-search-intent.ts
 */
import {
  applyParsedExploreSearchIntent,
  normalizeExploreSearchText,
  parseExploreSearchIntent,
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

function applied(input: string, base: Record<string, unknown> = {}) {
  const parsed = parseExploreSearchIntent(input);
  return {
    parsed,
    result: applyParsedExploreSearchIntent(base as never, parsed),
  };
}

console.log('\n— 1 Arabic farm + pool + Amman —');
{
  const { result, parsed } = applied('مزرعة بمسبح في عمان');
  expect('AR A farm', result.propertyType === 'farm');
  expect('AR A pool', result.hasPool === true);
  expect('AR A amman', result.city === 'amman');
  expect('AR A no q', result.q === undefined && parsed.residualQuery === undefined);
}

console.log('\n— 2 Arabic residual property name —');
{
  const { result } = applied('مزرعة سكاي فيو بمسبح في عمان');
  expect('AR B farm+pool+amman', result.propertyType === 'farm' && result.hasPool === true && result.city === 'amman');
  expect('AR B residual سكاي فيو', result.q === 'سكاي فيو');
}

console.log('\n— 3 chalet + cheap + Dead Sea —');
{
  const { result } = applied('شاليه رخيص في البحر الميت');
  expect('AR C chalet', result.propertyType === 'chalet');
  expect('AR C dead_sea', result.city === 'dead_sea');
  expect('AR C price_asc', result.sort === 'price_asc');
  expect('AR C no residual q', result.q === undefined);
}

console.log('\n— 4 villa + football —');
{
  const { result } = applied('فيلا فيها ملعب');
  expect('AR D villa', result.propertyType === 'villa');
  expect('AR D football', result.amenities?.includes('football') === true);
  expect('AR D no meaningless q', result.q === undefined);
}

console.log('\n— 5 unsupported family retained —');
{
  const { result } = applied('فيلا للعائلة فيها ملعب');
  expect('AR E villa+football', result.propertyType === 'villa' && result.amenities?.includes('football') === true);
  expect(
    'AR E keeps للعائلة',
    normalizeExploreSearchText(result.q ?? '').includes(normalizeExploreSearchText('للعائلة')),
  );
  expect('AR E strips orphan فيها', !normalizeExploreSearchText(result.q ?? '').includes(normalizeExploreSearchText('فيها')));
}

console.log('\n— 6 multiple compatible intents —');
{
  const { result } = applied('شاليه بمسبح وملعب في عمان');
  expect(
    'AR F all four',
    result.propertyType === 'chalet' &&
      result.hasPool === true &&
      result.amenities?.includes('football') === true &&
      result.city === 'amman',
  );
}

console.log('\n— 7 unknown Arabic q fallback —');
{
  const { result, parsed } = applied('سكاي فيو الأزرق');
  expect('AR unknown matched none', parsed.matched.length === 0);
  expect('AR unknown full q', result.q === 'سكاي فيو الأزرق');
}

console.log('\n— 8 English farm + pool + Amman —');
{
  const { result } = applied('farm with pool in amman');
  expect(
    'EN A',
    result.propertyType === 'farm' && result.hasPool === true && result.city === 'amman' && result.q === undefined,
  );
}

console.log('\n— 9 English residual property name —');
{
  const { result } = applied('Blue House villa in Amman');
  expect('EN B villa+amman', result.propertyType === 'villa' && result.city === 'amman');
  expect('EN B q Blue House', result.q === 'Blue House');
}

console.log('\n— 10 English cheap + Dead Sea —');
{
  const { result } = applied('chalet cheapest dead sea');
  expect(
    'EN C',
    result.propertyType === 'chalet' && result.city === 'dead_sea' && result.sort === 'price_asc' && result.q === undefined,
  );
}

console.log('\n— 11 unknown English q fallback —');
{
  const { result, parsed } = applied('Sky View');
  expect('EN D no structure', parsed.matched.length === 0 && result.q === 'Sky View');
}

console.log('\n— 12 mixed Arabic/English —');
{
  const { result } = applied('villa بمسبح عمان');
  expect(
    'mixed',
    result.propertyType === 'villa' && result.hasPool === true && result.city === 'amman' && result.q === undefined,
  );
}

console.log('\n— 13 conflicting property types —');
{
  const { result, parsed } = applied('مزرعة فيلا في عمان');
  expect('conflict no propertyType', result.propertyType === undefined);
  expect('conflict keeps city', result.city === 'amman');
  expect(
    'conflict residual both types',
    normalizeExploreSearchText(result.q ?? '').includes(normalizeExploreSearchText('مزرعة')) &&
      normalizeExploreSearchText(result.q ?? '').includes(normalizeExploreSearchText('فيلا')),
  );
  expect('conflict matched has no property_type', !parsed.matched.some((m) => m.kind === 'property_type'));
}

console.log('\n— 14 conflicting sorts —');
{
  const { result, parsed } = applied('الأرخص الأعلى تقييماً');
  expect('sort conflict no sort override', result.sort === 'recommended' || result.sort === undefined || !parsed.params.sort);
  expect('sort conflict stays in q', (result.q ?? '').length > 0);
  expect('sort conflict no single sort match applied', !parsed.matched.some((m) => m.kind === 'sort'));
}

console.log('\n— 15/16 longest location phrases —');
{
  const ar = parseExploreSearchIntent('شاليه في البحر الميت');
  expect('longest AR dead_sea', ar.params.city === 'dead_sea');
  expect('no partial البحر alone as city', ar.matched.some((m) => m.id === 'city:dead_sea'));
  const en = parseExploreSearchIntent('chalet at Dead Sea');
  expect('longest EN dead_sea', en.params.city === 'dead_sea');
}

console.log('\n— 17–20 existing filter precedence —');
{
  const { result } = applied('شاليه في جرش', {
    city: 'amman',
    guests: 8,
    date: '2026-09-10',
    period: 'overnight',
  });
  expect('city overridden to jerash', result.city === 'jerash');
  expect('propertyType chalet', result.propertyType === 'chalet');
  expect('guests preserved', result.guests === 8);
  expect('date preserved', result.date === '2026-09-10');
  expect('period preserved', result.period === 'overnight');
}

console.log('\n— 21–22 recent search canonical (no lat/lng) —');
{
  const memory = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => memory.get(k) ?? null,
      setItem: (k: string, v: string) => memory.set(k, v),
      removeItem: (k: string) => memory.delete(k),
    },
  };
  const recent = await import('../../../apps/web/src/lib/explore-recent-searches.ts');
  memory.clear();
  const { result } = applied('مزرعة بمسبح في عمان');
  const label = 'مزرعة بمسبح في عمان';
  recent.recordExploreFilterSearch(label, { ...result, lat: 31.95, lng: 35.91 });
  recent.recordExploreFilterSearch(label, result);
  const items = recent.listExploreRecentSearches();
  expect('one recent entry', items.length === 1);
  expect('recent label human phrase', items[0]!.kind === 'filters' && items[0]!.label === label);
  if (items[0]!.kind === 'filters') {
    expect(
      'recent stores parsed filters',
      items[0]!.params.propertyType === 'farm' &&
        items[0]!.params.hasPool === true &&
        items[0]!.params.city === 'amman',
    );
  }
  const raw = memory.get(recent.EXPLORE_RECENT_SEARCHES_KEY) ?? '';
  expect('recent no lat/lng', !recent.recentSearchStoreContainsPreciseGeo(raw) && !/"lat"/.test(raw));
}

console.log('\n— 23 conservative filler cleanup —');
{
  const { result } = applied('Blue House villa with pool');
  expect('keeps Blue House phrase', result.q === 'Blue House');
  expect('does not destroy House', (result.q ?? '').includes('House'));
}

console.log('\n— 24 raw fallback never empty —');
{
  const { result } = applied('xyzzy plugh');
  expect('non-empty q fallback', result.q === 'xyzzy plugh');
  const emptySubmit = parseExploreSearchIntent('   ');
  expect('whitespace does not invent q', !emptySubmit.params.q);
}

console.log('\n— href smoke —');
{
  const href = searchHref('/search', applyParsedExploreSearchIntent({}, parseExploreSearchIntent('مزرعة بمسبح في عمان')));
  expect(
    'canonical href',
    href.includes('propertyType=farm') && href.includes('hasPool=true') && href.includes('city=amman') && !href.includes('q='),
  );
}

if (failed) {
  console.log(`\n❌ explore search intent: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ explore search intent: ${passed} passed`);
