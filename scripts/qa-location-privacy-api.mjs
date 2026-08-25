/**
 * Phase 10H.2A — location privacy + arrival API QA.
 * Prefer: node scripts/qa-run-location-privacy.mjs
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };

const EXACT_KEYS = [
  'exactAddress',
  'latitudeExact',
  'longitudeExact',
  'arrivalInstructionsAr',
  'arrivalInstructionsEn',
];

const LAT = 31.5482;
const LNG = 35.4731;
const MAPS = `https://www.google.com/maps/dir/?api=1&destination=${LAT},${LNG}`;

let cookieJar = '';
let passed = 0;
let failed = 0;
const failures = [];

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  failures.push({ name, detail });
  console.log(`  ❌ ${name}: ${detail}`);
}

function collectExactKeys(value, path = '', hits = []) {
  if (value == null || typeof value !== 'object') return hits;
  if (Array.isArray(value)) {
    value.forEach((item, i) => collectExactKeys(item, `${path}[${i}]`, hits));
    return hits;
  }
  for (const [key, nested] of Object.entries(value)) {
    const next = path ? `${path}.${key}` : key;
    if (EXACT_KEYS.includes(key)) hits.push(next);
    collectExactKeys(nested, next, hits);
  }
  return hits;
}

function assertNoExact(label, payload) {
  const hits = collectExactKeys(payload);
  if (hits.length) fail(label, hits.join(', '));
  else pass(label);
}

async function api(method, pathName, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

async function login(creds) {
  cookieJar = '';
  return (await api('POST', '/auth/login', creds, false)).status === 200;
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureSlot() {
  const from = todayPlus(2);
  const to = todayPlus(80);
  const avail = await api('GET', `/properties/${SLUG}/availability?from=${from}&to=${to}`, undefined, false);
  const slot = avail.json.data?.find((s) => s.status === 'available');
  if (slot) return { date: slot.date, period: slot.period };
  const ensured = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (ensured.status === 200 && ensured.json.data?.date) {
    return { date: ensured.json.data.date, period: ensured.json.data.period };
  }
  return null;
}

async function main() {
  console.log('\n📍 Phase 10H.2A Location privacy QA\n');

  const anonDetail = await api('GET', `/properties/${SLUG}`, undefined, false);
  if (anonDetail.status !== 200 || !anonDetail.json.data?.id) {
    fail('anonymous property detail', `status ${anonDetail.status}`);
    process.exit(1);
  }
  pass('anonymous property detail 200');
  const propertyId = anonDetail.json.data.id;
  if (
    anonDetail.json.data.city &&
    anonDetail.json.data.area &&
    anonDetail.json.data.approximateLocation
  ) {
    pass('public property has city / area / approximate location');
  } else {
    fail('public approximate fields', JSON.stringify({
      city: anonDetail.json.data.city,
      area: anonDetail.json.data.area,
      approximateLocation: anonDetail.json.data.approximateLocation,
    }));
  }
  assertNoExact('public property payload has no exact location', anonDetail.json);

  const search = await api('GET', '/properties', undefined, false);
  if (search.status === 200) {
    assertNoExact('search payload has no exact location', search.json);
    if (Array.isArray(search.json.data) && search.json.data.length > 0) pass('search still returns properties');
    else fail('search still returns properties', 'empty data');
  } else fail('search 200', search.status);

  const discovery = await api('GET', '/properties/discovery', undefined, false);
  if (discovery.status === 200) assertNoExact('discovery payload has no exact location', discovery.json);
  else fail('discovery 200', discovery.status);

  await login(CUSTOMER);
  await api('POST', `/me/favorites/${propertyId}`);
  const favs = await api('GET', '/me/favorites');
  if (favs.status === 200) assertNoExact('favorites payload has no exact location', favs.json);
  else fail('favorites 200', favs.status);

  const home = await api('GET', '/me/home-personalization');
  if (home.status === 200) assertNoExact('home personalization has no exact location', home.json);
  else fail('home personalization 200', home.status);

  await login(OWNER1);
  const list = await api('GET', '/owner/properties');
  const owned = list.json.data?.find((p) => p.slug === SLUG);
  if (!owned?.id) {
    fail('owner1 owns seeded property', 'missing');
    process.exit(1);
  }
  const edit = await api('GET', `/owner/properties/${owned.id}/edit`);
  if (
    edit.status === 200 &&
    Object.prototype.hasOwnProperty.call(edit.json.data ?? {}, 'exactAddress') &&
    Object.prototype.hasOwnProperty.call(edit.json.data ?? {}, 'arrivalInstructionsAr')
  ) {
    pass('owner can read own exact location + arrival fields');
  } else {
    fail('owner edit includes exact fields', `${edit.status}`);
  }

  const patch = await api('PATCH', `/owner/properties/${owned.id}`, {
    city: edit.json.data.city,
    area: edit.json.data.area,
    approximateAddress: edit.json.data.approximateAddress,
    exactAddress: edit.json.data.exactAddress || 'طريق البحر الميت — بوابة الشاليه',
    latitudeApprox: 31.55,
    longitudeApprox: 35.47,
    latitudeExact: LAT,
    longitudeExact: LNG,
    arrivalInstructionsAr: 'الدخول من البوابة الغربية بجانب موقف السيارات.',
    arrivalInstructionsEn: 'Enter from the west gate next to the parking area.',
  });
  if (patch.status === 200 && patch.json.data?.latitudeExact === LAT) {
    pass('owner can edit own location on published property');
  } else {
    fail('owner location patch', `${patch.status} ${JSON.stringify(patch.json).slice(0, 300)}`);
  }

  await login(OWNER2);
  const crossGet = await api('GET', `/owner/properties/${owned.id}/edit`);
  if (crossGet.status === 404 || crossGet.status === 403) pass('owner B cannot read owner A property');
  else fail('cross-owner get denied', crossGet.status);
  const crossPatch = await api('PATCH', `/owner/properties/${owned.id}`, {
    exactAddress: 'should not save',
  });
  if (crossPatch.status === 404 || crossPatch.status === 403) pass('owner B cannot edit owner A location');
  else fail('cross-owner patch denied', crossPatch.status);

  const publicAfter = await api('GET', `/properties/${SLUG}`, undefined, false);
  assertNoExact('public detail still has no exact location after owner edit', publicAfter.json);
  if (publicAfter.json.data?.latitudeApprox != null) pass('public may include approximate coordinates');
  else pass('public approximate coordinates optional');

  await login(CUSTOMER);
  const slot = await ensureSlot();
  if (!slot) {
    fail('ensure available slot', 'none');
    process.exit(1);
  }
  const pending = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
  if (pending.status !== 201 || !pending.json.data?.id) {
    fail('create pending booking', `${pending.status}`);
    process.exit(1);
  }
  const pendingId = pending.json.data.id;
  if (pending.json.data.arrival == null && pending.json.data.status !== 'confirmed') {
    pass('pending booking has no arrival payload');
  } else {
    fail('pending booking hides arrival', `status=${pending.json.data.status} arrival=${JSON.stringify(pending.json.data.arrival)}`);
  }
  assertNoExact('pending booking payload has no exact keys', pending.json);

  const intent = await api('POST', '/payments/create-intent', { bookingId: pendingId, method: 'card' });
  const paymentId = intent.json.data?.id;
  if (intent.status !== 201 || !paymentId) {
    fail('create payment intent', `${intent.status} ${JSON.stringify(intent.json).slice(0, 200)}`);
    process.exit(1);
  }
  const sim = await api('POST', `/payments/${paymentId}/simulate-success`);
  if (sim.status !== 200) {
    fail('simulate deposit success', `${sim.status}`);
    process.exit(1);
  }

  const confirmed = await api('GET', `/me/bookings/${pendingId}`);
  const arrival = confirmed.json.data?.arrival;
  if (confirmed.status === 200 && confirmed.json.data?.status === 'confirmed' && arrival) {
    pass('confirmed booking owner can access exact location');
    if (arrival.exactAddress) pass('confirmed arrival includes exact address');
    else fail('confirmed exact address', 'missing');
    if (
      arrival.arrivalInstructionsAr?.includes('البوابة') &&
      arrival.arrivalInstructionsEn?.includes('west gate')
    ) {
      pass('arrival instructions localized in payload');
    } else {
      fail('localized arrival instructions', JSON.stringify(arrival).slice(0, 200));
    }
    if (arrival.googleMapsDirectionsUrl === MAPS) pass('Google Maps URL uses exact coordinates');
    else fail('Google Maps URL', arrival.googleMapsDirectionsUrl);
  } else {
    fail('confirmed booking arrival', `${confirmed.status} ${JSON.stringify(confirmed.json.data).slice(0, 300)}`);
  }

  const otherEmail = `loc-qa-${Date.now()}@test.mazare3.jo`;
  cookieJar = '';
  const signup = await api('POST', '/auth/signup', {
    email: otherEmail,
    password: 'Mazare3Demo2026!',
    name: 'Location QA',
    locale: 'ar',
  }, false);
  if (signup.status === 201 || signup.status === 200) pass('second customer signup');
  else fail('second customer signup', signup.status);
  const otherGet = await api('GET', `/me/bookings/${pendingId}`);
  if (otherGet.status === 404) pass('another customer cannot access the booking');
  else fail('other customer booking', otherGet.status);
  assertNoExact('other customer 404 body has no exact location', otherGet.json);

  await login(CUSTOMER);
  const slot2 = await ensureSlot();
  const pending2 = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot2.date,
    period: slot2.period,
    guestsCount: 2,
  });
  const pending2Id = pending2.json.data?.id;
  const cancel = await api('POST', `/me/bookings/${pending2Id}/cancel`);
  const cancelledGet = await api('GET', `/me/bookings/${pending2Id}`);
  if (
    (cancel.status === 200 || cancelledGet.json.data?.status === 'cancelled') &&
    cancelledGet.json.data?.arrival == null
  ) {
    pass('cancelled booking cannot access exact location');
  } else {
    fail('cancelled booking hides arrival', `${cancel.status} ${cancelledGet.json.data?.status}`);
  }

  await login(OWNER1);
  await api('PATCH', `/owner/properties/${owned.id}`, {
    instantBookingEnabled: false,
  });
  await login(CUSTOMER);
  const slot3 = await ensureSlot();
  const approval = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot3.date,
    period: slot3.period,
    guestsCount: 2,
  });
  if (approval.json.data?.status === 'pending_owner_approval' && approval.json.data?.arrival == null) {
    pass('pending owner-approval booking cannot access exact location');
  } else {
    fail(
      'pending approval hides arrival',
      `${approval.status} ${approval.json.data?.status}`,
    );
  }
  await login(OWNER1);
  if (approval.json.data?.id) {
    await api('POST', `/owner/bookings/${approval.json.data.id}/reject`, { reason: 'QA location reject' });
  }
  await login(CUSTOMER);
  if (approval.json.data?.id) {
    const rejected = await api('GET', `/me/bookings/${approval.json.data.id}`);
    if (rejected.json.data?.arrival == null) pass('rejected booking cannot access exact location');
    else fail('rejected booking hides arrival', rejected.json.data?.status);
  }
  await login(OWNER1);
  await api('PATCH', `/owner/properties/${owned.id}`, { instantBookingEnabled: true });

  await login(CUSTOMER);
  const slot4 = await ensureSlot();
  const expBook = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot4.date,
    period: slot4.period,
    guestsCount: 2,
  });
  const expId = expBook.json.data?.id;
  await api('POST', `/internal/bookings/${expId}/backdate-hold`, {}, false);
  await api('POST', '/internal/payments/expire-stale', {}, false);
  const expired = await api('GET', `/me/bookings/${expId}`);
  if (expired.json.data?.status === 'expired' && expired.json.data?.arrival == null) {
    pass('expired booking cannot access exact location');
  } else {
    fail('expired booking hides arrival', `${expired.json.data?.status}`);
  }

  await login(OWNER1);
  const hideMaps = await api('PATCH', `/owner/properties/${owned.id}`, {
    latitudeExact: null,
    longitudeExact: null,
  });
  if (hideMaps.status === 200 && hideMaps.json.data?.latitudeExact == null) {
    pass('owner can clear exact coordinates');
  } else {
    fail('clear exact coordinates', `${hideMaps.status}`);
  }
  await login(CUSTOMER);
  const slot5 = await ensureSlot();
  const noPin = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot5.date,
    period: slot5.period,
    guestsCount: 2,
  });
  const noPinId = noPin.json.data?.id;
  const noPinIntent = await api('POST', '/payments/create-intent', { bookingId: noPinId, method: 'card' });
  await api('POST', `/payments/${noPinIntent.json.data.id}/simulate-success`);
  const noPinGet = await api('GET', `/me/bookings/${noPinId}`);
  if (noPinGet.json.data?.arrival && !noPinGet.json.data.arrival.googleMapsDirectionsUrl) {
    pass('missing exact coordinates hides directions CTA');
  } else {
    fail(
      'missing coords hides maps URL',
      JSON.stringify(noPinGet.json.data?.arrival)?.slice(0, 200),
    );
  }

  await login(OWNER1);
  await api('PATCH', `/owner/properties/${owned.id}`, {
    latitudeExact: LAT,
    longitudeExact: LNG,
  });

  console.log(`\n${failed ? '❌' : '✅'} location privacy API: ${passed} passed, ${failed} failed`);
  if (failed) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
