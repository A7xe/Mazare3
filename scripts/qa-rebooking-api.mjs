/**
 * Phase 10E.3 — Fast rebooking QA
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

let cookieJar = '';
let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

async function api(method, path, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
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

async function payFully(bookingId) {
  for (const purpose of ['deposit', 'balance']) {
    const dep = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose });
    if (dep.status !== 201 || !dep.json.data?.id) return false;
    await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  }
  return true;
}

async function createPaidPastBooking(guestsCount = 4) {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount,
  });
  if (book.status !== 201) return null;
  const booking = book.json.data;
  if (!(await payFully(booking.id))) return null;
  await api('POST', `/internal/bookings/${booking.id}/backdate-slot`, {}, false);
  const fresh = await api('GET', `/me/bookings/${booking.id}`);
  return {
    booking: fresh.json.data,
    originalSlotDate: slot.json.data.date,
    originalPeriod: slot.json.data.period,
    originalPrice: slot.json.data.price,
    originalSlotId: slot.json.data.id ?? slot.json.data.slotId ?? null,
  };
}

async function main() {
  console.log('\n📦 Phase 10E.3 Rebooking QA\n');

  const pendingSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  await login(CUSTOMER);
  const pending = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: pendingSlot.json.data.date,
    period: pendingSlot.json.data.period,
    guestsCount: 3,
  });
  if (pending.status === 201 && pending.json.data?.canRebook !== true) {
    pass('unbookable pending booking does not expose Book Again');
  } else fail('unbookable pending booking does not expose Book Again', JSON.stringify(pending.json.data?.canRebook));
  if (pending.status === 201) {
    const pendingIntent = await api('GET', `/me/bookings/${pending.json.data.id}/rebook-intent`);
    if (pendingIntent.status === 400) pass('unbookable property does not expose a misleading action');
    else fail('unbookable property does not expose a misleading action', pendingIntent.status);
    await api('POST', `/me/bookings/${pending.json.data.id}/cancel`);
  }

  const created = await createPaidPastBooking(4);
  if (!created?.booking) {
    fail('create past booking', 'failed');
    process.exit(1);
  }
  const old = created.booking;
  if (old.canRebook === true && old.propertySlug === SLUG) pass('customer can rebook their own previous booking');
  else fail('customer can rebook their own previous booking', `canRebook=${old.canRebook}`);

  const intent = await api('GET', `/me/bookings/${old.id}/rebook-intent`);
  const d = intent.json.data ?? {};
  const leaked = JSON.stringify(d);
  if (
    intent.status === 200 &&
    d.propertySlug === SLUG &&
    d.guestsToApply === 4 &&
    d.preferredPeriod &&
    !leaked.includes(old.date) &&
    !('date' in d) &&
    !('slotId' in d) &&
    !('availabilitySlotId' in d) &&
    !('depositAmount' in d) &&
    !('totalAmount' in d)
  ) {
    pass('intent preserves guests, not old date/slot/price');
  } else fail('intent preserves guests, not old date/slot/price', leaked);

  if (d.guestsToApply === 4) pass('previous guest count is preserved when valid');
  else fail('previous guest count is preserved when valid', d.guestsToApply);

  const signup = await api(
    'POST',
    '/auth/signup',
    {
      name: 'Rebook Other',
      email: `rebook2-${Date.now()}@mazare3.jo`,
      password: 'Mazare3Demo2026!',
      locale: 'en',
    },
    false,
  );
  const otherIntent = await api('GET', `/me/bookings/${old.id}/rebook-intent`);
  if ((signup.status === 200 || signup.status === 201) && otherIntent.status === 404) {
    pass('customer cannot rebook another customer booking');
  } else fail('customer cannot rebook another customer booking', otherIntent.status);

  const property = await api('GET', `/properties/${SLUG}`, undefined, false);
  const instant = property.json.data?.instantBookingEnabled;
  const from = new Date();
  from.setUTCDate(from.getUTCDate() + 2);
  const to = new Date();
  to.setUTCDate(to.getUTCDate() + 90);
  const avail = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${from.toISOString().slice(0, 10)}&to=${to.toISOString().slice(0, 10)}`,
    undefined,
    false,
  );
  const nextSlot = (avail.json.data ?? []).find(
    (s) => s.status === 'available' && s.date !== old.date && s.bookable !== false,
  );
  let slotToUse = nextSlot;
  if (!slotToUse) {
    const ensured = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    slotToUse = {
      date: ensured.json.data.date,
      period: ensured.json.data.period,
      price: ensured.json.data.price,
      depositAmount: ensured.json.data.depositAmount,
    };
  }

  await login(CUSTOMER);
  const rebook = await api('POST', '/bookings', {
    propertySlug: d.propertySlug,
    date: slotToUse.date,
    period: slotToUse.period,
    guestsCount: d.guestsToApply,
  });
  const neu = rebook.json.data;
  if (rebook.status === 201 && neu?.id && neu.id !== old.id && neu.publicCode !== old.publicCode) {
    pass('new booking gets a new id and financial snapshot');
  } else fail('new booking gets a new id and financial snapshot', rebook.status);

  if (neu && neu.date !== old.date) pass('old date is not automatically reused');
  else fail('old date is not automatically reused', `${neu?.date} vs ${old.date}`);

  if (neu && neu.totalAmount === slotToUse.price) pass('current slot price is used');
  else fail('current slot price is used', `${neu?.totalAmount} vs ${slotToUse.price}`);

  if (slotToUse.depositAmount != null) {
    if (neu.depositAmount === slotToUse.depositAmount) pass('current deposit policy is used');
    else fail('current deposit policy is used', `${neu.depositAmount} vs ${slotToUse.depositAmount}`);
  } else if (neu.depositPercent != null) {
    pass('current deposit policy is used');
  } else fail('current deposit policy is used', 'missing deposit');

  const expectedMode = instant === false ? 'owner_approval' : 'instant';
  if (neu.bookingMode === expectedMode) pass('current owner approval mode is used');
  else fail('current owner approval mode is used', `${neu.bookingMode} vs ${expectedMode}`);

  if (neu.date && neu.period) pass('current availability is required');
  else fail('current availability is required', 'missing date/period');

  await login(CUSTOMER);
  const emerald = await api('GET', `/properties/${SLUG}`, undefined, false);
  if (emerald.status !== 200) fail('emerald still public after QA', emerald.status);

  if (neu && neu.id !== old.id) pass('same property is opened via intent slug');
  else fail('same property is opened via intent slug', d.propertySlug);

  console.log(`\nRebooking QA: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
