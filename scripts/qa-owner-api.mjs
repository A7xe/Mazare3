/**
 * Phase 4A — Owner API QA (run with API on :4000)
 * Prefer: pnpm qa:api
 * Or: API_BASE=http://localhost:4012/api/v1 node scripts/qa-owner-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };

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

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function ensureQaSlot(slug) {
  const r = await api('POST', `/internal/properties/${slug}/ensure-available-slot`, {}, false);
  if (r.status === 200 && r.json.data?.date) return r.json.data;
  return null;
}

async function main() {
  console.log('\n🔐 Phase 4A Owner API QA\n');

  cookieJar = '';
  const guest = await api('GET', '/owner/summary', null, false);
  if (guest.status === 401) pass('guest GET /owner/summary → 401');
  else fail('guest GET /owner/summary → 401', `got ${guest.status}`);

  await login(CUSTOMER);
  const cust = await api('GET', '/owner/summary');
  if (cust.status === 403) pass('customer GET /owner/summary → 403');
  else fail('customer GET /owner/summary → 403', `got ${cust.status}`);

  await login(OWNER1);
  const props1 = await api('GET', '/owner/properties');
  if (props1.status !== 200 || !props1.json.data?.length) {
    fail('owner1 GET /owner/properties', `status ${props1.status}`);
  } else {
    pass(`owner1 sees ${props1.json.data.length} properties`);
    const mine = props1.json.data;
    const emerald = mine.find((p) => p.slug === 'chalet-emerald-dead-sea');
    if (emerald) pass('owner1 includes chalet-emerald-dead-sea');
    else fail('owner1 includes chalet-emerald', 'missing');

    const qaSlot = await ensureQaSlot('chalet-emerald-dead-sea');
    const from = qaSlot?.date ?? todayPlus(1);
    const to = qaSlot?.date ?? todayPlus(80);
    const avail = await api(
      'GET',
      `/owner/availability?propertyId=${emerald.id}&from=${from}&to=${to}`,
    );
    if (avail.status === 200 && avail.json.data?.length) {
      pass('owner1 GET availability for own property');
      const free = avail.json.data.find((s) => s.status === 'available' && !s.hasActiveBooking);
      if (free) {
        const blocked = await api('PATCH', `/owner/availability/${free.id}`, {
          status: 'blocked',
        });
        if (blocked.status === 200) pass('owner1 PATCH slot → blocked');
        else fail('owner1 PATCH slot → blocked', `status ${blocked.status}`);

        const unblocked = await api('PATCH', `/owner/availability/${free.id}`, {
          status: 'available',
        });
        if (unblocked.status === 200) pass('owner1 PATCH slot → available');
        else fail('owner1 PATCH slot → available', `status ${unblocked.status}`);

        const priced = await api('PATCH', `/owner/availability/${free.id}`, { price: 199 });
        if (priced.status === 200 && priced.json.data?.price === 199) {
          pass('owner1 PATCH slot price');
        } else {
          fail('owner1 PATCH slot price', `status ${priced.status}`);
        }
      } else {
        fail('find available slot for PATCH', 'none in range');
      }
    } else {
      fail('owner1 GET availability', `status ${avail.status}`);
    }

    await login(OWNER2);
    const cross = await api('GET', `/owner/properties/${emerald.id}`);
    if (cross.status === 404) pass('owner2 GET owner1 property → 404');
    else fail('owner2 GET owner1 property → 404', `got ${cross.status}`);

    await login(OWNER2);
    const o2props = await api('GET', '/owner/properties');
    const jerash = o2props.json.data?.find((p) => p.slug === 'istiraha-jerash-olive');
    let otherSlotId = null;
    if (jerash) {
      const jerashSlot = await ensureQaSlot('istiraha-jerash-olive');
      const jFrom = jerashSlot?.date ?? todayPlus(1);
      const jTo = jerashSlot?.date ?? todayPlus(80);
      const crossAvail = await api(
        'GET',
        `/owner/availability?propertyId=${jerash.id}&from=${jFrom}&to=${jTo}`,
      );
      otherSlotId = crossAvail.json.data?.[0]?.id;
    }
    await login(OWNER1);
    if (otherSlotId) {
      const patchOther = await api('PATCH', `/owner/availability/${otherSlotId}`, {
        status: 'blocked',
      });
      if (patchOther.status === 403) pass('owner1 PATCH other owner slot → 403');
      else fail('owner1 PATCH other owner slot → 403', `got ${patchOther.status}`);
    } else {
      fail('owner1 PATCH other owner slot → 403', 'no owner2 slot id');
    }

    await login(CUSTOMER);
    cookieJar = '';
    const pubAvail = await api(
      'GET',
      `/properties/chalet-emerald-dead-sea/availability?from=${from}&to=${to}`,
      null,
      false,
    );
    const bookable = pubAvail.json.data?.find((s) => s.status === 'available');
    if (bookable) {
    const bookBody = {
      propertySlug: 'chalet-emerald-dead-sea',
      date: bookable.date,
      period: bookable.period,
      guestsCount: 4,
    };
    await login(CUSTOMER);
    const created = await api('POST', '/bookings', bookBody);
    if (created.status === 201 || created.status === 200) {
      pass('customer books slot for booked-slot test');
      await login(OWNER1);
      const avail2 = await api(
        'GET',
        `/owner/availability?propertyId=${emerald.id}&from=${from}&to=${to}`,
      );
      const bookedSlot = avail2.json.data?.find(
        (s) =>
          s.period === bookable.period &&
          s.date === bookable.date &&
          (s.hasActiveBooking || s.status === 'booked'),
      );
      if (bookedSlot) {
        const patchBooked = await api('PATCH', `/owner/availability/${bookedSlot.id}`, {
          price: 50,
        });
        if (patchBooked.status === 409 && patchBooked.json.code === 'SLOT_HAS_ACTIVE_BOOKING') {
          pass('owner1 PATCH booked slot → 409 SLOT_HAS_ACTIVE_BOOKING');
        } else {
          fail('owner1 PATCH booked slot → 409', `status ${patchBooked.status} code ${patchBooked.json?.code}`);
        }
      } else {
        fail('find booked slot after customer booking', 'not found');
      }
    } else {
      fail('customer books slot', `status ${created.status}`);
    }
    } else {
      fail('customer books slot', 'no public available slot');
    }
    }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
