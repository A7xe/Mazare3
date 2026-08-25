/**
 * Phase 10C.2A — Instant booking vs owner approval
 * Prefer: pnpm qa:owner-approval
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };

let cookieJar = '';
let passed = 0;
let failed = 0;
const failures = [];
let propertyId = null;

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

async function ensureSlot() {
  const r = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (r.status === 200 && r.json.data?.date) return r.json.data;
  return null;
}

async function setInstant(enabled) {
  if (!propertyId) return false;
  await login(OWNER1);
  const r = await api('PATCH', `/owner/properties/${propertyId}`, {
    instantBookingEnabled: enabled,
  });
  return r.status === 200 && r.json.data?.instantBookingEnabled === enabled;
}

async function createBooking(slot) {
  await login(CUSTOMER);
  return api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
}

function itemsOf(json) {
  return json.data?.items ?? json.data ?? [];
}

async function main() {
  console.log('\n🏡 Phase 10C.2A Instant vs Owner Approval QA\n');

  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const owned = (props.json.data ?? []).find((p) => p.slug === SLUG);
  propertyId = owned?.id ?? null;
  if (propertyId) pass(`resolved owner property ${SLUG}`);
  else fail('resolve property id', 'not found');

  if (!(await setInstant(true))) {
    fail('set instant booking true', 'patch failed');
  } else pass('property instantBookingEnabled=true');

  const instantSlot = await ensureSlot();
  if (!instantSlot) {
    fail('instant slot', 'none');
    printSummary();
    process.exit(1);
  }
  const instant = await createBooking(instantSlot);
  if (
    instant.status === 201 &&
    instant.json.data?.status === 'pending_payment' &&
    instant.json.data?.canPayDeposit === true &&
    instant.json.data?.bookingMode === 'instant'
  ) {
    pass('instant property keeps deposit flow');
  } else {
    fail('instant create', `${instant.status} ${instant.json.data?.status} ${instant.json.code}`);
  }

  if (instant.json.data?.id) {
    const pay = await api('POST', '/payments/create-intent', {
      bookingId: instant.json.data.id,
      method: 'card',
      purpose: 'deposit',
    });
    if (pay.status === 201) pass('instant booking can create deposit intent');
    else fail('instant deposit intent', `${pay.status} ${pay.json.code}`);
  }

  if (!(await setInstant(false))) fail('set owner approval mode', 'patch failed');
  else pass('property instantBookingEnabled=false');

  const reqSlot = await ensureSlot();
  const request = await createBooking(reqSlot);
  const reqBooking = request.json.data;
  if (
    request.status === 201 &&
    reqBooking?.status === 'pending_owner_approval' &&
    reqBooking?.canPayDeposit === false &&
    reqBooking?.ownerApprovalRequired === true &&
    reqBooking?.ownerDecisionState === 'pending'
  ) {
    pass('approval-required creates pending_owner_approval');
  } else {
    fail('approval create', `${request.status} ${reqBooking?.status} ${request.json.code}`);
  }

  const blockedPay = await api('POST', '/payments/create-intent', {
    bookingId: reqBooking.id,
    method: 'card',
    purpose: 'deposit',
  });
  if (blockedPay.status === 409 && blockedPay.json.code === 'OWNER_APPROVAL_REQUIRED') {
    pass('payment blocked before owner approval');
  } else {
    fail('payment before approval', `${blockedPay.status} ${blockedPay.json.code}`);
  }

  const held = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${reqSlot.date}&to=${reqSlot.date}`,
    null,
    false,
  );
  const slotRow = (held.json.data ?? []).find((s) => s.period === reqSlot.period);
  if (slotRow?.status === 'booked' || slotRow?.status === 'unavailable') {
    pass('slot remains occupied while request pending');
  } else {
    fail('slot hold', slotRow?.status ?? 'missing');
  }

  await login(CUSTOMER);
  const custAccept = await api('POST', `/owner/bookings/${reqBooking.id}/accept`, {});
  if (custAccept.status === 401 || custAccept.status === 403) {
    pass('customer cannot accept');
  } else fail('customer accept', `got ${custAccept.status}`);

  await login(OWNER2);
  const wrong = await api('POST', `/owner/bookings/${reqBooking.id}/accept`, {});
  if (wrong.status === 403 || wrong.status === 404) pass('wrong owner cannot accept');
  else fail('wrong owner accept', `got ${wrong.status}`);

  await login(OWNER1);
  const [a1, a2] = await Promise.all([
    api('POST', `/owner/bookings/${reqBooking.id}/accept`, {}),
    api('POST', `/owner/bookings/${reqBooking.id}/accept`, {}),
  ]);
  const okCount = [a1, a2].filter((r) => r.status === 200).length;
  const conflictCount = [a1, a2].filter(
    (r) => r.status === 409 && r.json.code === 'OWNER_DECISION_ALREADY_MADE',
  ).length;
  if (okCount === 1 && conflictCount === 1) pass('concurrent owner decisions cannot both succeed');
  else fail('concurrent accept', `ok=${okCount} conflict=${conflictCount} ${a1.status}/${a2.status}`);

  const accepted = a1.status === 200 ? a1.json.data : a2.json.data;
  if (accepted?.status === 'pending_payment' && accepted?.canPayDeposit === true) {
    pass('accept moves booking to pending_payment');
  } else fail('accept result', accepted?.status);

  await login(OWNER1);
  const ownerNotes = await api('GET', '/me/notifications');
  const ownerHasRequest = itemsOf(ownerNotes.json).some(
    (n) => n.type === 'booking.request_created' && n.entityId === reqBooking.id,
  );
  if (ownerHasRequest) pass('owner notified of booking request');
  else fail('owner request notification', 'missing');

  await login(CUSTOMER);
  const custNotes = await api('GET', '/me/notifications');
  const custAccepted = itemsOf(custNotes.json).some(
    (n) => n.type === 'booking.accepted' && n.entityId === reqBooking.id,
  );
  if (custAccepted) pass('customer notified of acceptance');
  else fail('customer accepted notification', 'missing');

  const afterPay = await api('POST', '/payments/create-intent', {
    bookingId: reqBooking.id,
    method: 'card',
    purpose: 'deposit',
  });
  if (afterPay.status === 201) pass('deposit can be paid after acceptance');
  else fail('deposit after accept', `${afterPay.status} ${afterPay.json.code}`);

  if (afterPay.json.data?.id) {
    const sim = await api('POST', `/payments/${afterPay.json.data.id}/simulate-success`, {});
    const b = await api('GET', `/me/bookings/${reqBooking.id}`);
    if (sim.status === 200 && b.json.data?.status === 'confirmed') {
      pass('deposit success confirms booking');
    } else {
      fail('confirm after deposit', `${sim.status} ${b.json.data?.status}`);
    }
  }

  const rejectSlot = await ensureSlot();
  const rejectCreate = await createBooking(rejectSlot);
  const rejectBooking = rejectCreate.json.data;
  if (rejectCreate.status !== 201) fail('second request', rejectCreate.status);

  await login(OWNER1);
  const rej = await api('POST', `/owner/bookings/${rejectBooking.id}/reject`, {
    reason: 'Not available that day',
  });
  if (rej.status === 200 && rej.json.data?.status === 'cancelled') {
    pass('correct owner can reject');
  } else fail('reject', `${rej.status} ${rej.json.data?.status}`);

  const afterRejectSlot = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${rejectSlot.date}&to=${rejectSlot.date}`,
    null,
    false,
  );
  const released = (afterRejectSlot.json.data ?? []).find((s) => s.period === rejectSlot.period);
  if (released?.status === 'available') pass('reject releases the slot');
  else fail('slot after reject', released?.status);

  await login(CUSTOMER);
  const payRejected = await api('POST', '/payments/create-intent', {
    bookingId: rejectBooking.id,
    method: 'card',
    purpose: 'deposit',
  });
  if (
    payRejected.status === 400 &&
    (payRejected.json.code === 'BOOKING_NOT_PAYABLE' || payRejected.json.code === 'OWNER_APPROVAL_REQUIRED')
  ) {
    pass('payment impossible after rejection');
  } else fail('pay after reject', `${payRejected.status} ${payRejected.json.code}`);

  const afterRejNotes = await api('GET', '/me/notifications');
  const custRejected = itemsOf(afterRejNotes.json).some(
    (n) => n.type === 'booking.rejected' && n.entityId === rejectBooking.id,
  );
  if (custRejected) pass('customer notified of rejection');
  else fail('customer rejected notification', 'missing');

  const listed = await api('GET', '/me/bookings');
  const listedInstant = (listed.json.data ?? []).find((b) => b.id === instant.json.data?.id);
  if (listedInstant && listedInstant.status !== 'pending_owner_approval') {
    pass('existing instant bookings remain compatible');
  } else fail('instant compatibility', listedInstant?.status);

  await setInstant(true);

  console.log(`\n10C.2A: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
  }
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log(`\n10C.2A: ${passed} passed, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
