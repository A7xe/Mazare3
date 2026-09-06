/**
 * Phase 2I-B — Universal promotion state on customer-facing property cards.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-universal-promotion-cards.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getOfferUrgencyKey,
  hasTruthfulPriceAnchor,
  resolveCardOfferPricing,
  resolveOfferBadgeKind,
  type PublicPropertySummary,
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
const exploreCard = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-property-card.tsx'),
  'utf8',
);
const homeCard = readFileSync(join(root, 'apps/web/src/components/home/home-property-card.tsx'), 'utf8');
const marketCard = readFileSync(
  join(root, 'apps/web/src/components/marketplace/property-card.tsx'),
  'utf8',
);
const offerIndicators = readFileSync(
  join(root, 'apps/web/src/components/marketplace/property-offer-indicators.tsx'),
  'utf8',
);
const searchService = readFileSync(
  join(root, 'apps/api/src/services/property-search.service.ts'),
  'utf8',
);
const promotionService = readFileSync(
  join(root, 'apps/api/src/services/promotion.service.ts'),
  'utf8',
);
const favoriteService = readFileSync(join(root, 'apps/api/src/services/favorite.service.ts'), 'utf8');
const propertyService = readFileSync(join(root, 'apps/api/src/services/property.service.ts'), 'utf8');
const recommended = readFileSync(
  join(root, 'apps/api/src/services/recommended-ranking.service.ts'),
  'utf8',
);
const nearRail = readFileSync(join(root, 'apps/web/src/components/explore/explore-near-rail.tsx'), 'utf8');
const mostBooked = readFileSync(
  join(root, 'apps/web/src/components/explore/explore-most-booked.tsx'),
  'utf8',
);
const en = JSON.parse(readFileSync(join(root, 'apps/web/messages/en.json'), 'utf8'));
const ar = JSON.parse(readFileSync(join(root, 'apps/web/messages/ar.json'), 'utf8'));

function baseProperty(overrides: Partial<PublicPropertySummary> = {}): PublicPropertySummary {
  return {
    id: 'p1',
    slug: 'farm-1',
    type: 'farm',
    titleAr: 'مزرعة',
    titleEn: 'Farm',
    city: 'amman',
    area: 'a',
    approximateLocation: 'a',
    capacity: 10,
    rating: 4.5,
    reviewCount: 2,
    basePrice: 420,
    currency: 'JOD',
    verificationStatus: 'platform_verified',
    hasPlatformDeal: false,
    allowsFamilies: true,
    allowsYouth: true,
    hasPool: true,
    hasIndoorPool: false,
    hasHeatedPool: false,
    hasFootballField: false,
    allowsOvernight: true,
    allowsEvents: false,
    amenityKeys: [],
    pricingMode: 'browse_from',
    ...overrides,
  };
}

console.log('\n— Badge + pricing helpers —');
{
  const percent = baseProperty({
    hasActivePromotion: true,
    activePromotionSummary: {
      discountType: 'percentage',
      discountValue: 10,
      endsAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
      originalFromPrice: 420,
      promotionalFromPrice: 378,
      savingsAmount: 42,
    },
  });
  expect('1 percentage badge', resolveOfferBadgeKind(percent)?.kind === 'percent');
  const pct = resolveOfferBadgeKind(percent);
  expect('1b percent value', pct?.kind === 'percent' && pct.percent === 10);

  const fixed = baseProperty({
    hasActivePromotion: true,
    activePromotionSummary: {
      discountType: 'fixed_amount',
      discountValue: 20,
      endsAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
      originalFromPrice: 420,
      promotionalFromPrice: 400,
      savingsAmount: 20,
    },
  });
  expect('2 fixed badge', resolveOfferBadgeKind(fixed)?.kind === 'save');

  const expiredFlag = baseProperty({ hasActivePromotion: false, activePromotionSummary: null });
  expect('3 expired/inactive not shown', resolveOfferBadgeKind(expiredFlag) === null);

  const inactive = baseProperty({ hasActivePromotion: false });
  expect('4 inactive not shown', resolveOfferBadgeKind(inactive) === null);

  const plain = baseProperty();
  expect('5 non-promoted unchanged pricing', resolveCardOfferPricing(plain).displayPrice === 420);
  expect('5b no anchor', resolveCardOfferPricing(plain).hasAnchor === false);

  const priced = resolveCardOfferPricing(percent);
  expect('6 original truthful', priced.originalPrice === 420);
  expect('7 promotional correct', priced.displayPrice === 378);
  expect('8 savings correct', priced.savingsAmount === 42);
  expect('8b hasTruthfulPriceAnchor', hasTruthfulPriceAnchor(percent.activePromotionSummary) === true);
}

console.log('\n— Exact slot / no double discount —');
{
  const exact = baseProperty({
    pricingMode: 'exact_slot',
    basePrice: 420,
    hasActivePromotion: true,
    searchMatch: {
      matchedDate: '2026-09-01',
      matchedPeriod: 'morning',
      matchedSlotId: 's1',
      startAt: null,
      endAt: null,
      startAtLocal: null,
      endAtLocal: null,
      usesLegacyTiming: false,
      slotPrice: 378,
      originalSlotPrice: 420,
      discountAmount: 42,
      depositAmount: 100,
      remainingAmount: 278,
      matchingPeriodsCount: 1,
      matchingPeriods: [],
      bookable: true,
      availabilityReason: null,
      timeZone: 'Asia/Amman',
    },
    activePromotionSummary: {
      discountType: 'percentage',
      discountValue: 10,
      originalFromPrice: 420,
      promotionalFromPrice: 378,
      savingsAmount: 42,
    },
  });
  const p = resolveCardOfferPricing(exact);
  expect('9 exact uses slotPrice as display', p.displayPrice === 378);
  expect('9b priceAlreadyDiscounted', p.priceAlreadyDiscounted === true);
  expect('10 no double discount (not 378*0.9)', p.displayPrice !== 340.2);
  expect(
    '10b searchMatch authoritative comment',
    searchService.includes('never re-apply') || searchService.includes('post-discount'),
  );
}

console.log('\n— Surfaces use ExplorePropertyCard / HomePropertyCard —');
{
  expect('11 explore card uses offer indicators', exploreCard.includes('PropertyOfferBadge'));
  expect('12 near you uses ExplorePropertyCard', nearRail.includes('ExplorePropertyCard'));
  expect('13 most booked uses ExplorePropertyCard', mostBooked.includes('ExplorePropertyCard'));
  expect('14 home feature uses PropertyOfferBadge', homeCard.includes('PropertyOfferBadge'));
  expect('15 marketplace PropertyCard uses PropertyOfferBadge', marketCard.includes('PropertyOfferBadge'));
  expect('16 offer variant still offerCardChromeClass', homeCard.includes('offerCardChromeClass'));
}

console.log('\n— Ranking integrity —');
{
  expect('17 recommended file has no promotion score', !/promotion|discountAmount|hasActivePromotion/.test(recommended));
  expect('18 near rail unchanged import', nearRail.includes('ExplorePropertyCard'));
  expect('19 most booked unchanged import', mostBooked.includes('ExplorePropertyCard'));
}

console.log('\n— Urgency + batching —');
{
  const soon = new Date(Date.now() + 12 * 3600_000).toISOString();
  expect('20 ends today', getOfferUrgencyKey(soon) === 'offerEndsToday');
  const later = new Date(Date.now() + 36 * 3600_000).toISOString();
  expect('20b ending soon', getOfferUrgencyKey(later) === 'offerEndingSoon');
  const far = new Date(Date.now() + 5 * 24 * 3600_000).toISOString();
  expect('20c no fake urgency', getOfferUrgencyKey(far) === null);

  expect('21 batched loadLivePromotionsByProperty', searchService.includes('loadLivePromotionsByProperty'));
  expect('21b no per-card fetch in indicators', !offerIndicators.includes('fetch('));
  expect('21c favorites reuse loadPublicPropertyCardsByIds', favoriteService.includes('loadPublicPropertyCardsByIds'));
  expect('21d similar reuse loadPublicPropertyCardsByIds', propertyService.includes('loadPublicPropertyCardsByIds'));
  expect('22 buildActivePromotionSummary public fields only', promotionService.includes('buildActivePromotionSummary'));
  const builderSlice = promotionService.slice(
    promotionService.indexOf('buildActivePromotionSummary'),
    promotionService.indexOf('buildActivePromotionSummary') + 1200,
  );
  expect('22b no commission in summary builder', !/commission|settlement|adminNote/.test(builderSlice));
}

console.log('\n— i18n —');
{
  expect('23 AR percent', ar.home.offerDiscountPercent.includes('{percent}'));
  expect('23b AR save', ar.home.offerSaveAmount.includes('{amount}'));
  expect('24 EN percent', en.home.offerDiscountPercent.includes('{percent}'));
  expect('24b EN save', en.home.offerSaveAmount.includes('{amount}'));
}

console.log('\n— Compact layout safety —');
{
  expect('25 compact skips urgency crowding', offerIndicators.includes('showUrgency') && offerIndicators.includes('!compact'));
  expect('25b explore favorite end / badge start', exploreCard.includes('end-3') && exploreCard.includes('start-3'));
}

console.log(`\nPhase 2I-B Universal Promotion Cards QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
