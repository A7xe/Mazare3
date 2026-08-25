/**
 * Phase 2D Explore category taxonomy QA.
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-categories.ts
 */
import {
  EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER,
  EXPLORE_REMOVED_MIXED_CATEGORY_IDS,
  PROPERTY_TYPES,
  activeExplorePropertyTypeCategory,
  exploreCategoryAllParams,
  exploreCategoryHref,
  exploreCategoryTypeParams,
  isExploreCategoryAllActive,
  listExploreQuickIntents,
  parseExploreSearchIntent,
} from '../src/index.ts';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

const base = {
  city: 'amman',
  date: '2026-09-10',
  period: 'overnight' as const,
  guests: 8,
  hasPool: true as const,
  amenities: ['football'],
  allowsEvents: true as const,
  propertyType: 'farm' as const,
  sort: 'recommended' as const,
  lat: 31.95,
  lng: 35.91,
};

console.log('\n— All clears only propertyType —');
{
  const all = exploreCategoryAllParams(base);
  expect('1 clears propertyType', all.propertyType === undefined);
  expect('2 preserves city', all.city === 'amman');
  expect('3 preserves date', all.date === '2026-09-10');
  expect('4 preserves period', all.period === 'overnight');
  expect('5 preserves guests', all.guests === 8);
  expect('6 preserves hasPool', all.hasPool === true);
  expect('7 preserves amenities', all.amenities?.includes('football') === true);
  expect('8 preserves allowsEvents', all.allowsEvents === true);
}

console.log('\n— Type selection —');
{
  const villa = exploreCategoryTypeParams(base, 'villa');
  expect('9 replaces Farm with Villa', villa.propertyType === 'villa');
  expect('10 preserves pool', villa.hasPool === true);
  expect('11 preserves city', villa.city === 'amman');
}

console.log('\n— Active state —');
{
  expect('12 all active only without type', isExploreCategoryAllActive({ city: 'amman', hasPool: true }));
  expect('12b type active', activeExplorePropertyTypeCategory({ propertyType: 'chalet' }) === 'chalet');
  expect(
    '12c hasPool alone does not select pool chip',
    activeExplorePropertyTypeCategory({ hasPool: true }) === 'all',
  );
}

console.log('\n— Removed mixed concepts —');
{
  expect('13 Families removed', EXPLORE_REMOVED_MIXED_CATEGORY_IDS.includes('families'));
  expect('14 Playground/football not in type row', !EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER.includes('football' as never));
  expect(
    '15 pool_house is real type; hasPool amenity not a category key',
    EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER.includes('pool_house') &&
      EXPLORE_REMOVED_MIXED_CATEGORY_IDS.includes('pool'),
  );
  expect('lounges removed from primary', EXPLORE_REMOVED_MIXED_CATEGORY_IDS.includes('lounges'));
}

console.log('\n— Canonical types match filter sheet source —');
{
  expect(
    '16 category order === PROPERTY_TYPES',
    EXPLORE_PROPERTY_TYPE_CATEGORY_ORDER.join() === PROPERTY_TYPES.join(),
  );
}

console.log('\n— AR/EN labels —');
{
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../../apps/web/messages');
  const en = JSON.parse(readFileSync(join(root, 'en.json'), 'utf8')) as {
    explore: { chip: Record<string, string> };
  };
  const ar = JSON.parse(readFileSync(join(root, 'ar.json'), 'utf8')) as {
    explore: { chip: Record<string, string> };
  };
  expect('17 EN all + types', Boolean(en.explore.chip.all) && PROPERTY_TYPES.every((pt) => en.explore.chip[pt]));
  expect('18 AR all + types', Boolean(ar.explore.chip.all) && PROPERTY_TYPES.every((pt) => ar.explore.chip[pt]));
  expect('no Families chip key', en.explore.chip.families == null && ar.explore.chip.families == null);
}

console.log('\n— URL —');
{
  const href = exploreCategoryHref('/search', base, 'villa');
  expect('19 URL has propertyType=villa', href.includes('propertyType=villa') && href.includes('city=amman'));
  const allHref = exploreCategoryHref('/search', base, null);
  expect('19b All drops propertyType', !allHref.includes('propertyType=') && allHref.includes('hasPool=true'));
}

console.log('\n— Phase 2A/2B compatibility —');
{
  const quick = listExploreQuickIntents();
  expect(
    '2A still has pool/football/events intents',
    quick.some((i) => i.id === 'intent:hasPool') &&
      quick.some((i) => i.id === 'intent:football') &&
      quick.some((i) => i.id === 'intent:allowsEvents'),
  );
  const parsed = parseExploreSearchIntent('شاليه بمسبح وملعب');
  expect(
    '20 Phase 2B type+pool+amenity',
    parsed.params.propertyType === 'chalet' &&
      parsed.params.hasPool === true &&
      parsed.params.amenities?.includes('football') === true,
  );
}

if (failed) {
  console.log(`\n❌ explore categories: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ explore categories: ${passed} passed`);
