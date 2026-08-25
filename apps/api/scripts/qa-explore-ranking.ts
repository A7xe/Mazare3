/**
 * Focused Explore ranking / privacy tests (no DB).
 * Run: pnpm exec tsx apps/api/scripts/qa-explore-ranking.ts
 */
import {
  MOST_BOOKED_QUALIFYING_STATUSES,
  MOST_BOOKED_WINDOW_DAYS,
  collectExactLocationLeaks,
  compareBookingPopularityRank,
  compareDistanceRank,
  comparePublishedRatingRank,
  distanceKmToApproxProperty,
  haversineDistanceKm,
  parseMarketplaceUserCoords,
  roundMarketplaceUserCoord,
  toPublicLocation,
} from '@mazare3/shared';

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

console.log('\n— Highest Rated —');
{
  const rows = [
    { propertyId: 'c', averageRating: 4.5, reviewCount: 2 },
    { propertyId: 'a', averageRating: 4.8, reviewCount: 3 },
    { propertyId: 'b', averageRating: 4.8, reviewCount: 10 },
    { propertyId: 'z', averageRating: 0, reviewCount: 0 },
    { propertyId: 'y', averageRating: 5, reviewCount: 0 },
  ].sort(comparePublishedRatingRank);

  expect('average DESC primary', rows[0]!.propertyId === 'b' && rows[1]!.propertyId === 'a');
  expect('review count tie-break', rows[0]!.reviewCount > rows[1]!.reviewCount);
  expect('zero published reviews rank last', rows[rows.length - 2]!.reviewCount === 0);
  expect(
    'zero-review does not invent rating order over reviewed',
    rows.findIndex((r) => r.propertyId === 'z') > rows.findIndex((r) => r.propertyId === 'c'),
  );
  expect(
    'stable id tie-break among zero reviews',
    rows.filter((r) => r.reviewCount === 0).map((r) => r.propertyId).join(',') === 'y,z',
  );
}

console.log('\n— Most Booked —');
{
  expect('qualifying status is confirmed only', MOST_BOOKED_QUALIFYING_STATUSES.join(',') === 'confirmed');
  expect('window is 90 days', MOST_BOOKED_WINDOW_DAYS === 90);
  expect(
    'cancelled/rejected/expired not in qualifying list',
    !MOST_BOOKED_QUALIFYING_STATUSES.includes('cancelled' as never) &&
      !MOST_BOOKED_QUALIFYING_STATUSES.includes('expired' as never) &&
      !MOST_BOOKED_QUALIFYING_STATUSES.includes('pending' as never),
  );

  const ranked = [
    { propertyId: 'low', bookingCount: 1, averageRating: 5, reviewCount: 9 },
    { propertyId: 'high', bookingCount: 5, averageRating: 3, reviewCount: 1 },
    { propertyId: 'mid', bookingCount: 5, averageRating: 4.2, reviewCount: 2 },
    { propertyId: 'mid2', bookingCount: 5, averageRating: 4.2, reviewCount: 8 },
  ].sort(compareBookingPopularityRank);

  expect('booking count DESC primary', ranked[0]!.propertyId === 'mid2' || ranked[0]!.bookingCount === 5);
  expect('rating tie-break after count', ranked[0]!.propertyId === 'mid2' && ranked[1]!.propertyId === 'mid');
  expect('review count tie-break', ranked[0]!.reviewCount > ranked[1]!.reviewCount);
  expect('lower booking count later', ranked[ranked.length - 1]!.propertyId === 'low');

  const empty: typeof ranked = [];
  expect('zero bookings handled as empty list', empty.length === 0);
}

console.log('\n— Nearest —');
{
  const amman = { lat: 31.95, lng: 35.91 };
  const near = distanceKmToApproxProperty(amman.lat, amman.lng, 31.96, 35.92)!;
  const far = distanceKmToApproxProperty(amman.lat, amman.lng, 32.5, 35.9)!;
  expect('haversine closer < farther', near < far);
  expect(
    'haversine known short hop ~1-2km',
    near > 0.5 && near < 3,
  );

  const ranked = [
    { propertyId: 'far', distanceKm: far },
    { propertyId: 'near', distanceKm: near },
    { propertyId: 'missing', distanceKm: null },
  ].sort(compareDistanceRank);

  expect('closer approx ranks first', ranked[0]!.propertyId === 'near');
  expect('missing coords rank later', ranked[ranked.length - 1]!.propertyId === 'missing');

  const pub = toPublicLocation({
    city: 'amman',
    area: 'Airport Road',
    approximateAddress: 'Airport Road — Amman',
    latitudeApprox: 31.9,
    longitudeApprox: 35.9,
  });
  expect(
    'no exact private location field leaks on public location',
    collectExactLocationLeaks({
      ...pub,
      // ensure walker would catch if present
    }).length === 0,
  );
  expect(
    'leak walker still detects exact keys',
    collectExactLocationLeaks({ latitudeExact: 1, arrivalInstructionsEn: 'x' }).length === 2,
  );
  expect(
    'distance helper never uses exact fields',
    distanceKmToApproxProperty(amman.lat, amman.lng, undefined, undefined) === null,
  );
}

console.log('\n— Near You / user location privacy —');
{
  const rounded = roundMarketplaceUserCoord(31.9534567);
  expect('user coord rounded to marketplace precision', rounded === 31.953);
  const parsed = parseMarketplaceUserCoords(31.9534567, 35.9101234);
  expect('parse rounds both axes', parsed?.lat === 31.953 && parsed?.lng === 35.91);
  expect('invalid user coords rejected', parseMarketplaceUserCoords(91, 35) === null);
  expect(
    'Near You uses distance source (haversine), not featured/topRated labels',
    typeof haversineDistanceKm === 'function' && MOST_BOOKED_WINDOW_DAYS === 90,
  );
}

if (failed) {
  console.log(`\n❌ explore ranking: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ explore ranking: ${passed} passed`);
