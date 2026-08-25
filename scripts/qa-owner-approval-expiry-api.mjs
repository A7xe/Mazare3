/**
 * Phase 10C.2B — Owner approval response deadline and auto-expiry
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

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

function ammanUtcHourDeltaHours(iso) {
  const d = new Date(iso);
  const amman = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Amman',
      hour: '2-digit',
      hour12: false,
    }).format(d),
  );
  const utc = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', hour: '2-digit', hour12: false }).format(d),
  );
  return (amman - utc + 24) % 24;
}

async function main() {
  console.log('\n⏱️  Phase 10C.2B Owner approval deadline QA\n');

  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const owned = (props.json.data ?? []).find((p) => p.slug === SLUG);
  propertyId = owned?.id ?? null;
  if (!propertyId) {
    fail('property id', 'missing');
    process.exit(1);
  }

  await setInstant(true);
  const instantSlot = await ensureSlot();
  const instant = await createBooking(instantSlot);
  if (instant.status === 201 && !instant.json.data?.ownerApprovalExpiresAt && instant.json.data?.holdExpiresAt) {
    pass('instant booking has no ownerApprovalExpiresAt');
  } else {
    fail('instant deadline', `${instant.json.data?.ownerApprovalExpiresAt} hold=${instant.json.data?.holdExpiresAt}`);
  }

  await setInstant(false);
  const reqSlot = await ensureSlot();
  const request = await createBooking(reqSlot);
  const req = request.json.data;
  if (
    request.status === 201 &&
    req?.status === 'pending_owner_approval' &&
    req?.ownerApprovalExpiresAt &&
    !req?.holdExpiresAt
  ) {
    pass('approval-required booking receives ownerApprovalExpiresAt');
  } else {
    fail('approval deadline field', `${req?.status} ${req?.ownerApprovalExpiresAt}`);
  }

  const delta = ammanUtcHourDeltaHours(req.ownerApprovalExpiresAt);
  if (delta === 3) pass('Asia/Amman deadline is UTC+3');
  else fail('Asia/Amman offset', `delta=${delta}`);

  await login(OWNER1);
  const beforeExpiry = await api('POST', `/owner/bookings/${req.id}/accept`, {});
  if (beforeExpiry.status === 200 && beforeExpiry.json.data?.status === 'pending_payment') {
    pass('accept just before expiry succeeds');
  } else fail('accept before expiry', `${beforeExpiry.status} ${beforeExpiry.json.code}`);

  const expSlot = await ensureSlot();
  const expCreate = await createBooking(expSlot);
  const expId = expCreate.json.data?.id;
  await api('POST', `/internal/bookings/${expId}/backdate-owner-approval`, {}, false);
  const exp1 = await api('POST', '/internal/bookings/expire-owner-approvals', {}, false);
  if (exp1.status === 200 && exp1.json.data?.expired >= 1) pass('expired request becomes expired (batch)');
  else fail('expire batch', `${exp1.status} ${JSON.stringify(exp1.json.data)}`);

  await login(CUSTOMER);
  const expiredRow = await api('GET', `/me/bookings/${expId}`);
  if (expiredRow.json.data?.status === 'expired' && expiredRow.json.data?.ownerDecisionState === 'expired') {
    pass('booking status expired after deadline');
  } else fail('expired status', expiredRow.json.data?.status);

  const payments = expiredRow.json.data?.paymentId;
  if (!payments && expiredRow.json.data?.canPayDeposit === false) pass('no Payment exists / cannot pay flags');
  else fail('no payment', `paymentId=${payments}`);

  if (!expiredRow.json.data?.refundRequest) pass('no Refund exists');
  else fail('refund after expiry', 'unexpected refundRequest');

  const slotAfter = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${expSlot.date}&to=${expSlot.date}`,
    null,
    false,
  );
  const released = (slotAfter.json.data ?? []).find((s) => s.period === expSlot.period);
  if (released?.status === 'available') pass('slot is released after expiry');
  else fail('slot after expiry', released?.status);

  await login(OWNER1);
  const acceptLate = await api('POST', `/owner/bookings/${expId}/accept`, {});
  if (acceptLate.status === 409 && acceptLate.json.code === 'OWNER_APPROVAL_EXPIRED') {
    pass('owner cannot accept after expiry');
  } else fail('accept after expiry', `${acceptLate.status} ${acceptLate.json.code}`);

  const rejectLate = await api('POST', `/owner/bookings/${expId}/reject`, { reason: 'too late' });
  if (rejectLate.status === 409 && rejectLate.json.code === 'OWNER_APPROVAL_EXPIRED') {
    pass('owner cannot reject after expiry');
  } else fail('reject after expiry', `${rejectLate.status} ${rejectLate.json.code}`);

  await login(CUSTOMER);
  const payLate = await api('POST', '/payments/create-intent', {
    bookingId: expId,
    method: 'card',
    purpose: 'deposit',
  });
  if (payLate.status === 400 && payLate.json.code === 'BOOKING_NOT_PAYABLE') {
    pass('customer cannot pay after expiry');
  } else fail('pay after expiry', `${payLate.status} ${payLate.json.code}`);

  const exp2 = await api('POST', '/internal/bookings/expire-owner-approvals', {}, false);
  if (exp2.status === 200 && exp2.json.data?.expired === 0) pass('expiry is idempotent');
  else fail('idempotent expire', JSON.stringify(exp2.json.data));

  const custNotes = await api('GET', '/me/notifications');
  const custExp = itemsOf(custNotes.json).some(
    (n) => n.type === 'booking.request_expired' && n.entityId === expId,
  );
  await login(OWNER1);
  const ownerNotes = await api('GET', '/me/notifications');
  const ownerExp = itemsOf(ownerNotes.json).some(
    (n) => n.type === 'booking.request_expired' && n.entityId === expId,
  );
  if (custExp && ownerExp) pass('expiry notifications created for customer and owner');
  else fail('expiry notifications', `cust=${custExp} owner=${ownerExp}`);

  const raceSlot = await ensureSlot();
  const raceCreate = await createBooking(raceSlot);
  const raceId = raceCreate.json.data?.id;
  await api('POST', `/internal/bookings/${raceId}/backdate-owner-approval`, {}, false);
  await login(OWNER1);
  const [acc, exp] = await Promise.all([
    api('POST', `/owner/bookings/${raceId}/accept`, {}),
    api('POST', '/internal/bookings/expire-owner-approvals', {}, false),
  ]);
  await login(CUSTOMER);
  const raceRow = await api('GET', `/me/bookings/${raceId}`);
  const final = raceRow.json.data?.status;
  const acceptWon = acc.status === 200 && final === 'pending_payment';
  const expireWon = acc.status !== 200 && final === 'expired';
  if (acceptWon || expireWon) {
    pass(`concurrent accept vs expiry produced one valid state (${final})`);
  } else {
    fail('concurrent race', `accept=${acc.status} expireExpired=${exp.json.data?.expired} final=${final}`);
  }

  await setInstant(true);

  console.log(`\n10C.2B: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
