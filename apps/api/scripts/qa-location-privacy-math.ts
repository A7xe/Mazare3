import {
  approximateCoordsFromExact,
  buildGoogleMapsDirectionsUrl,
  canRevealExactLocation,
  collectExactLocationLeaks,
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

expect(
  'pending_payment cannot reveal exact location',
  canRevealExactLocation({ status: 'pending_payment', paymentState: 'unpaid', hasSucceededPayment: false }) === false,
);
expect(
  'pending_owner_approval cannot reveal',
  canRevealExactLocation({
    status: 'pending_owner_approval',
    paymentState: 'unpaid',
    hasSucceededPayment: false,
  }) === false,
);
expect(
  'cancelled cannot reveal',
  canRevealExactLocation({ status: 'cancelled', paymentState: 'unpaid' }) === false,
);
expect(
  'expired cannot reveal',
  canRevealExactLocation({ status: 'expired', paymentState: 'unpaid' }) === false,
);
expect(
  'confirmed + deposit_paid can reveal',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'deposit_paid', hasSucceededPayment: true }) === true,
);
expect(
  'confirmed + fully_paid can reveal',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'fully_paid', hasSucceededPayment: true }) === true,
);
expect(
  'confirmed + partially_refunded still reveals',
  canRevealExactLocation({
    status: 'confirmed',
    paymentState: 'partially_refunded',
    hasSucceededPayment: true,
  }) === true,
);
expect(
  'confirmed + refunded hides',
  canRevealExactLocation({ status: 'confirmed', paymentState: 'refunded', hasSucceededPayment: true }) === false,
);
expect(
  'maps URL uses exact coords',
  buildGoogleMapsDirectionsUrl(31.5482, 35.4731) ===
    'https://www.google.com/maps/dir/?api=1&destination=31.5482,35.4731',
);
expect('missing lat hides maps URL', buildGoogleMapsDirectionsUrl(null, 35.47) === null);
expect('missing lng hides maps URL', buildGoogleMapsDirectionsUrl(31.55, null) === null);
expect('invalid lat hides maps URL', buildGoogleMapsDirectionsUrl(91, 35) === null);

const pub = toPublicLocation({
  city: 'amman',
  area: 'Airport Road',
  approximateAddress: 'Airport Road — Amman',
  latitudeApprox: 31.9,
  longitudeApprox: 35.9,
});
expect('public location keeps approx coords', pub.latitudeApprox === 31.9 && pub.longitudeApprox === 35.9);
expect(
  'public helper has no exact keys',
  collectExactLocationLeaks(pub).length === 0,
);
expect(
  'leak walker finds exactAddress',
  collectExactLocationLeaks({ data: { exactAddress: 'secret' } }).includes('data.exactAddress'),
);

const coarse = approximateCoordsFromExact(31.5482, 35.4731);
expect('approx helper returns coords', coarse != null);
expect(
  'approx helper does not copy exact coords',
  coarse != null && (coarse.latitudeApprox !== 31.5482 || coarse.longitudeApprox !== 35.4731),
);
expect('approx helper is deterministic', JSON.stringify(coarse) === JSON.stringify(approximateCoordsFromExact(31.5482, 35.4731)));
expect('approx helper rejects invalid lat', approximateCoordsFromExact(91, 35) === null);

if (failed) {
  console.log(`\n❌ location privacy math: ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`\n✅ location privacy math: ${passed} passed`);
