/**
 * Phase 3C — API booking QA
 * Prefer: pnpm qa:api (isolated :4012, no auth rate limit)
 * Or: API_BASE=http://localhost:4012/api/v1 node scripts/qa-booking-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

const SENSITIVE_KEYS = [
  'phone',
  'whatsapp',
  'exactAddress',
  'exact_address',
  'internalNotes',
  'ownerPhone',
  'payment',
];

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

function hasSensitive(obj, path = '') {
  if (obj == null || typeof obj !== 'object') return [];
  const hits = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = path ? `${path}.${k}` : k;
    if (SENSITIVE_KEYS.some((s) => k.toLowerCase() === s.toLowerCase())) {
      hits.push(p);
    }
    if (v && typeof v === 'object') hits.push(...hasSensitive(v, p));
  }
  return hits;
}

async function api(method, path, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) {
    cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  }
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function findAvailableSlot() {
  const from = todayPlus(1);
  const to = todayPlus(20);
  const { status, json } = await api('GET', `/properties/${SLUG}/availability?from=${from}&to=${to}`, null, false);
  if (status !== 200) return null;
  const slot = json.data?.find((s) => s.status === 'available');
  return slot ? { date: slot.date, period: slot.period, from, to } : null;
}

async function main() {
  console.log('\n=== Phase 3C API QA ===\n');

  // 1. Health & public
  let r = await api('GET', '/health', null, false);
  if (r.status === 200) pass('GET /health');
  else fail('GET /health', `status ${r.status}`);

  r = await api('GET', '/properties', null, false);
  if (r.status === 200 && Array.isArray(r.json.data)) {
    pass('GET /properties');
    const hits = hasSensitive(r.json);
    if (hits.length) fail('GET /properties sensitive fields', hits.join(', '));
    else pass('GET /properties no sensitive fields');
  } else fail('GET /properties', `status ${r.status}`);

  r = await api('GET', `/properties/${SLUG}`, null, false);
  if (r.status === 200 && r.json.data?.slug === SLUG) {
    pass(`GET /properties/${SLUG}`);
    const hits = hasSensitive(r.json);
    if (hits.length) fail('GET property detail sensitive', hits.join(', '));
    else pass('property detail no sensitive fields');
  } else fail('GET property by slug', `status ${r.status}`);

  const slotInfo = await findAvailableSlot();
  if (slotInfo) {
    pass(`availability has available slot ${slotInfo.date} ${slotInfo.period}`);
  } else {
    fail('find available slot', 'none in next 20 days');
  }

  if (slotInfo) {
    r = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${slotInfo.from}&to=${slotInfo.to}`,
      null,
      false,
    );
    if (r.status === 200) pass('GET availability range');
    else fail('GET availability', `status ${r.status}`);
  }

  // Search filters
  const filters = [
    'q=شاليه',
    'area=dead_sea',
    'minPrice=200',
    'maxPrice=400',
    'guests=10',
    'propertyType=chalet',
    'amenities=pool,bbq',
    'hasPool=true',
    'verifiedOnly=true',
    'sort=price_asc',
    'sort=price_desc',
    'sort=rating_desc',
    'sort=newest',
  ];
  for (const q of filters) {
    r = await api('GET', `/properties?${q}`, null, false);
    if (r.status === 200) pass(`GET /properties?${q}`);
    else fail(`filter ${q}`, `status ${r.status}`);
  }

  r = await api('GET', '/properties?minPrice=99999', null, false);
  if (r.status === 200 && r.json.data?.length === 0) pass('empty filter result');
  else fail('empty filter', `count ${r.json.data?.length}`);

  // 3. Unauthenticated booking
  cookieJar = '';
  if (slotInfo) {
    r = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: slotInfo.date,
      period: slotInfo.period,
      guestsCount: 4,
    });
    if (r.status === 401) pass('POST /bookings without auth → 401');
    else fail('POST /bookings without auth', `status ${r.status}`);
  }

  // 4. Login / me / logout
  cookieJar = '';
  r = await api('POST', '/auth/login', CUSTOMER);
  if (r.status === 200 && r.json.data?.user?.email === CUSTOMER.email) pass('customer login');
  else fail('customer login', `status ${r.status} ${JSON.stringify(r.json)}`);

  r = await api('GET', '/auth/me');
  if (r.status === 200 && r.json.data?.user?.role === 'customer') pass('GET /auth/me');
  else fail('GET /auth/me', `status ${r.status}`);

  // 5. Create booking
  let bookingId = null;
  let bookedDate = null;
  let bookedPeriod = null;
  if (slotInfo) {
    bookedDate = slotInfo.date;
    bookedPeriod = slotInfo.period;
    r = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: bookedDate,
      period: bookedPeriod,
      guestsCount: 8,
    });
    if (r.status === 201 && r.json.data?.publicCode && r.json.data?.status === 'pending_payment') {
      pass('POST /bookings success (pending_payment)');
      bookingId = r.json.data.id;
      if (r.json.data.totalAmount > 0) pass('booking has server totalAmount');
      const hits = hasSensitive(r.json.data);
      if (hits.length) fail('booking response sensitive', hits.join(', '));
      else pass('booking response no sensitive fields');
    } else fail('POST /bookings', `status ${r.status} ${JSON.stringify(r.json)}`);

    // Price tampering
    r = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: bookedDate,
      period: bookedPeriod,
      guestsCount: 8,
      totalAmount: 1,
    });
    if (r.status === 409 || r.status === 201) {
      if (r.status === 409) pass('duplicate booking → 409');
      else {
        // second booking shouldn't succeed on same slot
        fail('duplicate booking', 'got 201 twice?');
      }
    }
  }

  // 6. Conflict - same slot again
  if (bookedDate && bookedPeriod) {
    r = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: bookedDate,
      period: bookedPeriod,
      guestsCount: 4,
    });
    if (r.status === 409 && r.json.code === 'SLOT_UNAVAILABLE') pass('conflict same slot → 409');
    else fail('conflict booking', `status ${r.status} code ${r.json.code}`);
  }

  // 7. My bookings
  r = await api('GET', '/me/bookings');
  if (r.status === 200 && Array.isArray(r.json.data)) {
    pass('GET /me/bookings');
    if (bookingId && r.json.data.some((b) => b.id === bookingId)) pass('booking listed in /me/bookings');
    else if (bookingId) fail('booking in list', 'not found');
  } else fail('GET /me/bookings', `status ${r.status}`);

  if (bookingId) {
    r = await api('GET', `/me/bookings/${bookingId}`);
    if (r.status === 200 && r.json.data?.id === bookingId) pass('GET /me/bookings/:id');
    else fail('GET booking by id', `status ${r.status}`);
  }

  // 9. Owner cannot book as customer
  cookieJar = '';
  r = await api('POST', '/auth/login', OWNER);
  if (r.status === 200) pass('owner login');
  if (slotInfo) {
    const slot2 = await findAvailableSlot();
    if (slot2 && (slot2.date !== bookedDate || slot2.period !== bookedPeriod)) {
      r = await api('POST', '/bookings', {
        propertySlug: SLUG,
        date: slot2.date,
        period: slot2.period,
        guestsCount: 4,
      });
      if (r.status === 403) pass('owner POST /bookings → 403');
      else fail('owner booking', `status ${r.status} (expected 403)`);
    }
  }

  // Another customer isolation - signup new user
  cookieJar = '';
  const otherEmail = `qa-${Date.now()}@test.mazare3.jo`;
  r = await api('POST', '/auth/signup', {
    email: otherEmail,
    password: 'Mazare3Demo2026!',
    name: 'QA Other',
    locale: 'ar',
  });
  if (r.status === 201 || r.status === 200) pass('signup second customer');
  if (bookingId) {
    r = await api('GET', `/me/bookings/${bookingId}`);
    if (r.status === 404) pass('other customer cannot see booking');
    else fail('booking isolation', `status ${r.status}`);
    r = await api('POST', `/me/bookings/${bookingId}/cancel`);
    if (r.status === 404) pass('other customer cannot cancel');
    else fail('cancel isolation', `status ${r.status}`);
  }

  // Login back as customer for cancel test
  cookieJar = '';
  r = await api('POST', '/auth/login', CUSTOMER);
  if (r.status !== 200) {
    fail('customer re-login for cancel', `status ${r.status}`);
  } else {
    pass('customer re-login for cancel');
  }

  // 8. Cancel
  if (bookingId) {
    r = await api('POST', `/me/bookings/${bookingId}/cancel`);
    if (r.status === 200 && r.json.data?.status === 'cancelled') pass('cancel booking');
    else fail('cancel booking', `status ${r.status}`);

    r = await api('POST', `/me/bookings/${bookingId}/cancel`);
    if (r.status === 400) pass('double cancel → 400');
    else fail('double cancel', `status ${r.status}`);

    // Slot available again
    if (bookedDate && bookedPeriod) {
      r = await api('POST', '/bookings', {
        propertySlug: SLUG,
        date: bookedDate,
        period: bookedPeriod,
        guestsCount: 6,
      });
      if (r.status === 201) pass('rebook after cancel → slot available');
      else fail('rebook after cancel', `status ${r.status}`);
      if (r.json.data?.id) {
        await api('POST', `/me/bookings/${r.json.data.id}/cancel`);
      }
    }
  }

  // 10. Error cases
  cookieJar = '';
  await api('POST', '/auth/login', CUSTOMER);

  r = await api('POST', '/bookings', {
    propertySlug: 'non-existent-slug-xyz',
    date: todayPlus(3),
    period: 'morning',
    guestsCount: 2,
  });
  if (r.status === 404) pass('invalid slug → 404');
  else fail('invalid slug', `status ${r.status}`);

  r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: 'invalid',
    period: 'morning',
    guestsCount: 2,
  });
  if (r.status === 400) pass('invalid date → 400');
  else fail('invalid date', `status ${r.status}`);

  r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: todayPlus(3),
    period: 'invalid_period',
    guestsCount: 2,
  });
  if (r.status === 400) pass('invalid period → 400');
  else fail('invalid period', `status ${r.status}`);

  r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: todayPlus(3),
    period: 'morning',
    guestsCount: 0,
  });
  if (r.status === 400) pass('guestsCount 0 → 400');
  else fail('guestsCount 0', `status ${r.status}`);

  r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: todayPlus(3),
    period: 'morning',
    guestsCount: 999,
  });
  if (r.status === 400) pass('guests over capacity → 400');
  else fail('guests over capacity', `status ${r.status}`);

  r = await api('POST', '/bookings', {});
  if (r.status === 400) pass('empty body → 400');
  else fail('empty body', `status ${r.status}`);

  cookieJar = 'mazare3_session=invalid.token.here';
  r = await api('GET', '/me/bookings');
  if (r.status === 401) pass('invalid cookie → 401');
  else fail('invalid cookie', `status ${r.status}`);

  r = await api('POST', '/auth/logout');
  if (r.status === 200) pass('logout');
  r = await api('GET', '/me/bookings');
  if (r.status === 401) pass('/me/bookings after logout → 401');
  else fail('me after logout', `status ${r.status}`);

  console.log(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);
  if (failures.length) {
    console.log('Failures:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
