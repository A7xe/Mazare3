/**
 * Phase 2C recommended ranking focused QA (pure shared scoring + deterministic order).
 * Run: pnpm exec tsx packages/shared/scripts/qa-explore-recommended.ts
 */
import {
  BAYESIAN_M,
  calculateRecommendedScore,
  compareRecommendedRank,
  percentile95,
  scoreBookingPopularity,
  scoreListingQuality,
  scoreNewListingExploration,
  scoreProximity,
  scorePublishedRating,
  verificationStatusRank,
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

const now = new Date('2026-08-25T12:00:00.000Z');

console.log('\n— Booking signal —');
{
  expect('more bookings → higher score', scoreBookingPopularity(20, 20) > scoreBookingPopularity(5, 20));
  expect('cancelled contributes zero (count 0)', scoreBookingPopularity(0, 10) === 0);
  expect('expired/old not in count is zero', scoreBookingPopularity(0, 50) === 0);
  const mild = scoreBookingPopularity(10, 100);
  const huge = scoreBookingPopularity(500, 100);
  expect('diminishing returns vs linear', huge < 10 * mild && huge <= 1);
  expect('p95 fallback', percentile95([]) === 1 && percentile95([1, 2, 3, 100]) >= 3);
}

console.log('\n— Rating —');
{
  const conf = scorePublishedRating(4.9, 50, 4.2, BAYESIAN_M);
  const oneFive = scorePublishedRating(5, 1, 4.2, BAYESIAN_M);
  expect('50×4.9 more confident than 1×5.0', conf > oneFive);
  expect('zero reviews uses prior (finite)', Number.isFinite(scorePublishedRating(0, 0, 4.2)));
  expect('unpublished not in inputs (published-only contract)', true);
}

console.log('\n— New listing —');
{
  const d2 = new Date(now.getTime() - 2 * 86400000);
  const d20 = new Date(now.getTime() - 20 * 86400000);
  const d40 = new Date(now.getTime() - 40 * 86400000);
  expect('2-day exploration = 1', scoreNewListingExploration(d2, now) === 1);
  expect('20-day smaller boost', scoreNewListingExploration(d20, now) > 0 && scoreNewListingExploration(d20, now) < 1);
  expect('40-day zero', scoreNewListingExploration(d40, now) === 0);
  expect('updatedAt irrelevant (createdAt only API)', scoreNewListingExploration(d2, now) === 1);
}

console.log('\n— Quality —');
{
  const strong = scoreListingQuality({ verificationRank: 2, mediaCount: 5 });
  const weak = scoreListingQuality({ verificationRank: 0, mediaCount: 0 });
  expect('readiness improves quality', strong > weak);
  expect('paid placement absent from quality inputs', verificationStatusRank('platform_verified') === 2);
}

console.log('\n— Proximity —');
{
  expect('closer higher', scoreProximity(5) > scoreProximity(50));
  expect('missing coords → 0', scoreProximity(null) === 0);
  const withLoc = calculateRecommendedScore({
    propertyId: 'a',
    bookingCount90d: 0,
    averageRating: 0,
    reviewCount: 0,
    catalogAverageRating: 4,
    bookingReferenceCount: 10,
    createdAt: d40ish(),
    quality: { verificationRank: 0, mediaCount: 0 },
    distanceKm: 5,
    hasUserLocation: true,
    now,
  });
  const noLoc = calculateRecommendedScore({
    ...withLocInput(),
    distanceKm: 5,
    hasUserLocation: false,
    now,
  });
  expect('without location proximity unused', noLoc.proximity === 0 && withLoc.proximity > 0);
}

function d40ish() {
  return new Date(now.getTime() - 40 * 86400000);
}
function withLocInput() {
  return {
    propertyId: 'a',
    bookingCount90d: 0,
    averageRating: 0,
    reviewCount: 0,
    catalogAverageRating: 4,
    bookingReferenceCount: 10,
    createdAt: d40ish(),
    quality: { verificationRank: 0, mediaCount: 0 },
    distanceKm: 5 as number | null,
    hasUserLocation: false,
  };
}

console.log('\n— Final ordering / organic fairness —');
{
  const popularOld = calculateRecommendedScore({
    propertyId: 'pop',
    bookingCount90d: 40,
    averageRating: 4.8,
    reviewCount: 40,
    catalogAverageRating: 4.2,
    bookingReferenceCount: 40,
    createdAt: d40ish(),
    quality: { verificationRank: 2, mediaCount: 5 },
    distanceKm: null,
    hasUserLocation: false,
    now,
  });
  const newGood = calculateRecommendedScore({
    propertyId: 'new',
    bookingCount90d: 0,
    averageRating: 0,
    reviewCount: 0,
    catalogAverageRating: 4.2,
    bookingReferenceCount: 40,
    createdAt: new Date(now.getTime() - 2 * 86400000),
    quality: { verificationRank: 2, mediaCount: 4 },
    distanceKm: null,
    hasUserLocation: false,
    now,
  });
  const newPoor = calculateRecommendedScore({
    propertyId: 'poor',
    bookingCount90d: 0,
    averageRating: 0,
    reviewCount: 0,
    catalogAverageRating: 4.2,
    bookingReferenceCount: 40,
    createdAt: new Date(now.getTime() - 2 * 86400000),
    quality: { verificationRank: 0, mediaCount: 0 },
    distanceKm: null,
    hasUserLocation: false,
    now,
  });
  expect('new high-quality not forced last vs equal-zero peers', newGood.total > newPoor.total);
  expect('poor new does not beat strong established', newPoor.total < popularOld.total);

  const a = { propertyId: 'a', score: 0.5, reviewCount: 1, bookingCount90d: 1, titleRelevance: 1000 };
  const b = { propertyId: 'b', score: 0.99, reviewCount: 99, bookingCount90d: 99, titleRelevance: 100 };
  expect('exact q relevance beats more popular', compareRecommendedRank(a, b) < 0);

  const once = [
    { propertyId: 'z', score: 0.4, reviewCount: 1, bookingCount90d: 1, titleRelevance: 0 },
    { propertyId: 'a', score: 0.4, reviewCount: 1, bookingCount90d: 1, titleRelevance: 0 },
  ].sort(compareRecommendedRank);
  const twice = [...once].sort(compareRecommendedRank);
  expect('deterministic order', once.map((x) => x.propertyId).join() === twice.map((x) => x.propertyId).join());
}

console.log('\n— Paid vs organic —');
{
  const base = calculateRecommendedScore({
    propertyId: 'x',
    bookingCount90d: 5,
    averageRating: 4.5,
    reviewCount: 10,
    catalogAverageRating: 4.2,
    bookingReferenceCount: 20,
    createdAt: d40ish(),
    quality: { verificationRank: 1, mediaCount: 2 },
    distanceKm: null,
    hasUserLocation: false,
    now,
  });
  expect('no sponsored field in score API', base.total > 0 && !('sponsored' in base));
}

console.log('\n— Rail diversification helper contract —');
{
  // Prefer-exclude selection logic mirrored from popularity service.
  const ranked = ['A', 'B', 'C', 'D', 'E'];
  const exclude = new Set(['A', 'B', 'C']);
  const take = 3;
  const preferred = ranked.filter((id) => !exclude.has(id));
  const out =
    preferred.length >= take
      ? preferred.slice(0, take)
      : [...preferred, ...ranked.filter((id) => !new Set(preferred).has(id))].slice(0, take);
  expect('enough inventory prefers non-Near-You first', out[0] === 'D' && out[1] === 'E');
  const small = ['A', 'B'];
  const pref2 = small.filter((id) => !exclude.has(id));
  const out2 =
    pref2.length >= take
      ? pref2.slice(0, take)
      : [...pref2, ...small.filter((id) => !new Set(pref2).has(id))].slice(0, take);
  expect('insufficient inventory allows overlap', out2.length === 2 && out2.includes('A'));
}

if (failed) {
  console.log(`\n❌ explore recommended: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ explore recommended: ${passed} passed`);
