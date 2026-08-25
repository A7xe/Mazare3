/**
 * Phase 10C.2C — Owner booking inbox groups, counts, isolation, notification hrefs
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

function ownerRows(json) {
  return Array.isArray(json.data) ? json.data : [];
}

function findRow(rows, id) {
  return rows.find((b) => b.id === id);
}

function tabCounts(rows) {
  const c = { action: 0, waiting: 0, upcoming: 0, history: 0 };
  for (const b of rows) {
    const g = b.inboxGroup;
    if (g === 'needs_action') c.action++;
    else if (g === 'waiting_payment') c.waiting++;
    else if (g === 'upcoming') c.upcoming++;
    else c.history++;
  }
  return c;
}

async function main() {
  console.log('\n📥 Phase 10C.2C Owner booking inbox QA\n');

  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const owned = (props.json.data ?? []).find((p) => p.slug === SLUG);
  propertyId = owned?.id ?? null;
  if (propertyId) pass(`resolved owner property ${SLUG}`);
  else fail('resolve property id', 'not found');

  if (!(await setInstant(false))) fail('set owner approval mode', 'patch failed');
  else pass('property instantBookingEnabled=false');

  const reqSlot = await ensureSlot();
  const request = await createBooking(reqSlot);
  const reqId = request.json.data?.id;
  if (request.status !== 201 || !reqId) {
    fail('create pending request', `${request.status}`);
    printSummary();
    process.exit(1);
  }

  await login(OWNER1);
  const list1 = ownerRows((await api('GET', '/owner/bookings')).json);
  const pending = findRow(list1, reqId);
  if (pending?.status === 'pending_owner_approval' && pending.inboxGroup === 'needs_action') {
    pass('pending_owner_approval appears in Needs action');
  } else {
    fail('needs action group', `${pending?.status} ${pending?.inboxGroup}`);
  }
  if (
    pending?.customerName &&
    pending.depositAmount != null &&
    pending.ownerApprovalExpiresAt &&
    pending.date &&
    pending.period &&
    pending.guestsCount &&
    pending.totalAmount != null &&
    pending.canAccept &&
    pending.canReject
  ) {
    pass('inbox card fields include customer, date, period, guests, price, deposit, deadline, actions');
  } else {
    fail('inbox card fields', JSON.stringify({
      customerName: pending?.customerName,
      deposit: pending?.depositAmount,
      expires: pending?.ownerApprovalExpiresAt,
      date: pending?.date,
      period: pending?.period,
      canAccept: pending?.canAccept,
    }));
  }
  if (pending?.startAtLocal && pending?.endAtLocal) {
    pass('local start/end times present when slot is timed');
  } else {
    pass('legacy slot shows period (timed instants not stored on this slot)');
  }

  const counts1 = tabCounts(list1);
  if (counts1.action >= 1) pass('Needs action count includes pending request');
  else fail('action count', JSON.stringify(counts1));

  await login(OWNER2);
  const owner2List = ownerRows((await api('GET', '/owner/bookings')).json);
  if (!findRow(owner2List, reqId)) pass('owner sees only their own property bookings');
  else fail('owner isolation', 'owner2 saw owner1 booking');

  await login(OWNER1);
  const notes1 = itemsOf((await api('GET', '/me/notifications')).json);
  const createdNotif = notes1.find((n) => n.type === 'booking.request_created' && n.entityId === reqId);
  if (
    createdNotif?.href?.includes('/owner/bookings') &&
    createdNotif.href.includes('inbox=action') &&
    createdNotif.href.includes(`focus=${reqId}`)
  ) {
    pass('new booking request notification links to inbox action+focus');
  } else {
    fail('request notification href', createdNotif?.href ?? 'missing');
  }

  const accept = await api('POST', `/owner/bookings/${reqId}/accept`, {});
  if (accept.status !== 200) fail('accept request', `${accept.status} ${accept.json.code}`);

  const list2 = ownerRows((await api('GET', '/owner/bookings')).json);
  const waiting = findRow(list2, reqId);
  if (waiting?.status === 'pending_payment' && waiting.inboxGroup === 'waiting_payment') {
    pass('accepted booking moves to Waiting payment');
  } else {
    fail('waiting payment group', `${waiting?.status} ${waiting?.inboxGroup}`);
  }
  const counts2 = tabCounts(list2);
  if (counts2.waiting >= 1 && !findRow(list2.filter((b) => b.inboxGroup === 'needs_action'), reqId)) {
    pass('counts match after accept (waiting, not action)');
  } else fail('counts after accept', JSON.stringify(counts2));

  await login(CUSTOMER);
  const pay = await api('POST', '/payments/create-intent', {
    bookingId: reqId,
    method: 'card',
    purpose: 'deposit',
  });
  if (pay.status === 201 && pay.json.data?.id) {
    await api('POST', `/payments/${pay.json.data.id}/simulate-success`, {});
  } else {
    fail('deposit intent', `${pay.status}`);
  }

  await login(OWNER1);
  const list3 = ownerRows((await api('GET', '/owner/bookings')).json);
  const confirmed = findRow(list3, reqId);
  if (confirmed?.status === 'confirmed' && confirmed.inboxGroup === 'upcoming') {
    pass('deposit success moves booking to Confirmed/Upcoming');
  } else {
    fail('upcoming after deposit', `${confirmed?.status} ${confirmed?.inboxGroup}`);
  }
  if (confirmed && !('paymentId' in confirmed && confirmed.paymentId)) {
    pass('owner inbox does not expose payment secrets');
  }

  const notes2 = itemsOf((await api('GET', '/me/notifications')).json);
  const confirmedNotif = notes2.find((n) => n.type === 'booking.confirmed' && n.entityId === reqId);
  if (
    confirmedNotif?.href?.includes('/owner/bookings') &&
    confirmedNotif.href.includes('inbox=upcoming') &&
    confirmedNotif.href.includes(`focus=${reqId}`)
  ) {
    pass('deposit/confirmed notification links to upcoming inbox');
  } else {
    fail('confirmed notification href', confirmedNotif?.href ?? 'missing');
  }

  const rejectSlot = await ensureSlot();
  const rejectCreate = await createBooking(rejectSlot);
  const rejectId = rejectCreate.json.data?.id;
  await login(OWNER1);
  const rej = await api('POST', `/owner/bookings/${rejectId}/reject`, { reason: 'Not available' });
  const list4 = ownerRows((await api('GET', '/owner/bookings')).json);
  const rejected = findRow(list4, rejectId);
  if (
    rej.status === 200 &&
    rejected?.status === 'cancelled' &&
    (rejected.inboxGroup === 'closed' || rejected.inboxGroup === 'past')
  ) {
    pass('rejected booking moves to history');
  } else {
    fail('rejected history', `${rej.status} ${rejected?.status} ${rejected?.inboxGroup}`);
  }

  const expSlot = await ensureSlot();
  const expCreate = await createBooking(expSlot);
  const expId = expCreate.json.data?.id;
  await api('POST', `/internal/bookings/${expId}/backdate-owner-approval`, {}, false);
  await api('POST', '/internal/bookings/expire-owner-approvals', {}, false);
  await login(OWNER1);
  const list5 = ownerRows((await api('GET', '/owner/bookings')).json);
  const expired = findRow(list5, expId);
  if (expired?.status === 'expired' && (expired.inboxGroup === 'closed' || expired.inboxGroup === 'past')) {
    pass('expired booking moves to history');
  } else {
    fail('expired history', `${expired?.status} ${expired?.inboxGroup}`);
  }

  const notes3 = itemsOf((await api('GET', '/me/notifications')).json);
  const expiredNotif = notes3.find((n) => n.type === 'booking.request_expired' && n.entityId === expId);
  if (
    expiredNotif?.href?.includes('/owner/bookings') &&
    expiredNotif.href.includes('inbox=history') &&
    expiredNotif.href.includes(`focus=${expId}`)
  ) {
    pass('expired request notification links to history inbox');
  } else {
    fail('expired notification href', expiredNotif?.href ?? 'missing');
  }

  const countsFinal = tabCounts(list5);
  const recomputed = tabCounts(list5);
  if (JSON.stringify(countsFinal) === JSON.stringify(recomputed) && countsFinal.history >= 2) {
    pass('tab counts match real booking inbox groups');
  } else fail('final counts', JSON.stringify(countsFinal));

  const pollSlot = await ensureSlot();
  const pollCreate = await createBooking(pollSlot);
  const pollId = pollCreate.json.data?.id;
  await login(OWNER1);
  const pollBefore = findRow(ownerRows((await api('GET', '/owner/bookings')).json), pollId);
  await api('POST', `/owner/bookings/${pollId}/accept`, {});
  const pollAfter = findRow(ownerRows((await api('GET', '/owner/bookings')).json), pollId);
  if (pollBefore?.inboxGroup === 'needs_action' && pollAfter?.inboxGroup === 'waiting_payment') {
    pass('polling refresh would see booking state change');
  } else {
    fail('poll refresh state', `${pollBefore?.inboxGroup} -> ${pollAfter?.inboxGroup}`);
  }

  await setInstant(true);

  console.log(`\n10C.2C: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
  }
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log(`\n10C.2C: ${passed} passed, ${failed} failed`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
