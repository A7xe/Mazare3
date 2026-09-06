/**
 * Phase 2I-C — Explore Book Again.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-explore-book-again.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BOOK_AGAIN_EXCLUDED_STATUSES,
  BOOK_AGAIN_RAIL_LIMIT,
  BOOK_AGAIN_REQUIRED_STATUS,
  bookAgainVisitHasEnded,
  bookAgainVisitSortMs,
  dedupeBookAgainByPropertyId,
  isBookAgainHistoryEligible,
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
const searchPage = readFileSync(join(root, 'apps/web/src/app/[locale]/search/page.tsx'), 'utf8');
const rail = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-book-again-rail.tsx'),
  'utf8',
);
const card = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-property-card.tsx'),
  'utf8',
);
const personalization = readFileSync(
  join(root, 'apps/api/src/services/home-personalization.service.ts'),
  'utf8',
);
const meRoutes = readFileSync(join(root, 'apps/api/src/routes/me.ts'), 'utf8');
const apiClient = readFileSync(join(root, 'apps/web/src/lib/api-home-personalization.ts'), 'utf8');
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

const pastDate = new Date('2020-01-01T12:00:00.000Z');
const futureDate = new Date(Date.now() + 7 * 24 * 3600_000);

function baseEligible(over: Partial<Parameters<typeof isBookAgainHistoryEligible>[0]> = {}) {
  return isBookAgainHistoryEligible({
    status: 'confirmed',
    paymentState: 'fully_paid',
    bookingEndAt: pastDate,
    slotDate: pastDate,
    slotEndAt: pastDate,
    propertyStatus: 'published',
    ownerStatus: 'approved',
    now: new Date('2026-08-30T12:00:00.000Z'),
    ...over,
  });
}

console.log('\n— Guest / empty / status exclusions —');
{
  expect('1 guest gate in rail', rail.includes("user?.role !== 'customer'"));
  expect('1b no fetch when not customer', rail.includes('setItems(null)'));
  expect('2 empty omitted', rail.includes('if (!items?.length) return null'));

  for (const status of BOOK_AGAIN_EXCLUDED_STATUSES) {
    expect(`exclude ${status}`, baseEligible({ status }) === false);
  }
  expect('8 confirmed required', BOOK_AGAIN_REQUIRED_STATUS === 'confirmed');
  expect('9 past confirmed included', baseEligible() === true);
}

console.log('\n— Past stay determination —');
{
  expect(
    '8b future end excluded',
    baseEligible({ bookingEndAt: futureDate, slotDate: futureDate, slotEndAt: futureDate }) === false,
  );
  expect(
    '8c visitHasEnded past slot date',
    bookAgainVisitHasEnded({
      bookingEndAt: null,
      slotEndAt: null,
      slotDate: pastDate,
    }, new Date('2026-08-30T12:00:00.000Z')) === true,
  );
  expect(
    '8d future visit not ended',
    bookAgainVisitHasEnded({
      bookingEndAt: futureDate,
      slotEndAt: futureDate,
      slotDate: futureDate,
    }, new Date('2026-08-30T12:00:00.000Z')) === false,
  );
}

console.log('\n— Dedup + ordering —');
{
  const rows = [
    { propertyId: 'a', bookingId: '1', t: 100 },
    { propertyId: 'a', bookingId: '2', t: 50 },
    { propertyId: 'b', bookingId: '3', t: 80 },
  ];
  const sorted = [...rows].sort((x, y) => y.t - x.t);
  const deduped = dedupeBookAgainByPropertyId(sorted, BOOK_AGAIN_RAIL_LIMIT);
  expect('10 same property once', deduped.length === 2 && deduped[0]!.propertyId === 'a');
  expect('11 most recent visit first', deduped[0]!.bookingId === '1');
  expect(
    '11b sort ms prefers bookingEndAt',
    bookAgainVisitSortMs({ bookingEndAt: new Date(200), slotEndAt: new Date(100), slotDate: pastDate }) ===
      200,
  );
  expect('18 max limit 6', BOOK_AGAIN_RAIL_LIMIT === 6);
}

console.log('\n— Public eligibility —');
{
  expect('12 unpublished excluded', baseEligible({ propertyStatus: 'draft' }) === false);
  expect('13 unapproved owner excluded', baseEligible({ ownerStatus: 'pending' }) === false);
  expect('13b refunded excluded', baseEligible({ paymentState: 'refunded' }) === false);
}

console.log('\n— Data / privacy / cards —');
{
  expect('14 current cards via loadPublicPropertyCardsByIds', personalization.includes('loadPublicPropertyCardsByIds'));
  expect('15 no old booking price in explore rail', !rail.includes('totalAmount') && !rail.includes('rebook='));
  expect('16 promotions via property card', card.includes('usePropertyOfferPresentation'));
  expect('19 click uses property detail href', card.includes("searchHref(`/properties/${property.slug}`"));
  expect('20 no auto booking CTA in explore rail', !rail.includes('bookAgainCta') && !rail.includes('rebook='));
  expect('21 cache no-store', apiClient.includes("cache: 'no-store'") && apiClient.includes('credentials'));
  expect('22 me route requires customer', meRoutes.includes("requireRole('customer')") && meRoutes.includes('home-personalization'));
  expect('23 batched hydrate', personalization.includes('loadPublicPropertyCardsByIds') && !personalization.includes('for (const id of'));
}

console.log('\n— Placement / Search Mode —');
{
  expect('24 search mode results first', searchPage.includes('searchMode ? (') && searchPage.includes('resultsSection'));
  expect(
    '24b book again only in browse branch',
    searchPage.includes('<ExploreBookAgainRail') &&
      searchPage.indexOf('searchMode ?') < searchPage.indexOf('<ExploreBookAgainRail'),
  );
  expect(
    '25 after campaign tiles',
    searchPage.indexOf('<ExploreCampaignTiles') < searchPage.indexOf('<ExploreBookAgainRail') &&
      searchPage.indexOf('<ExploreBookAgainRail') < searchPage.indexOf('<ExploreNearRail'),
  );
}

console.log('\n— i18n —');
{
  expect('26 AR title', ar.explore.bookAgainTitle === 'احجز مرة أخرى');
  expect('26b AR subtitle', ar.explore.bookAgainSubtitle === 'مزارع سبق أن حجزتها');
  expect('27 EN title', en.explore.bookAgainTitle === 'Book again');
  expect('27b EN subtitle', en.explore.bookAgainSubtitle === "Places you've booked before");
}

console.log(`\nPhase 2I-C Explore Book Again QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
