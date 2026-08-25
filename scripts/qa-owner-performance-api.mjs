/**
 * Phase 10C.2D — Owner-approval performance API
 * Prefer: pnpm qa:owner-approval
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

let cookieJar = '';
let passed = 0;
let failed = 0;
let propertyId = null;
let ownerProfileId = null;

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
    body: body ? JSON.stringify(body) : undefined,
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
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

async function ensureSlot() {
  const r = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  return r.status === 200 ? r.json.data : null;
}

async function setInstant(enabled) {
  await login(OWNER1);
  const r = await api('PATCH', `/owner/properties/${propertyId}`, { instantBookingEnabled: enabled });
  return r.status === 200;
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

async function perf(who, range = 'all') {
  await login(who);
  return api('GET', `/owner/performance?range=${range}`);
}

function close(a, b) {
  return Math.abs(a - b) < 1e-9;
}

async function main() {
  console.log('\n📊 Phase 10C.2D Owner performance QA\n');

  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const owned = (props.json.data ?? []).find((p) => p.slug === SLUG);
  propertyId = owned?.id ?? null;
  if (!propertyId) {
    fail('property', 'missing');
    process.exit(1);
  }

  await login(ADMIN);
  const partners = await api('GET', '/admin/partners?q=owner1');
  ownerProfileId = (partners.json.data ?? []).find((p) => p.email === OWNER1.email)?.id ?? null;
  if (ownerProfileId) pass('resolved owner1 partner id');
  else fail('partner id', 'missing');

  const searchBefore = await api('GET', '/properties', null, false);
  const firstSlug = searchBefore.json.data?.[0]?.slug;

  await login(CUSTOMER);
  const custPerf = await api('GET', '/owner/performance?range=30d');
  if (custPerf.status === 401 || custPerf.status === 403) pass('customer cannot read owner performance');
  else fail('customer performance', custPerf.status);

  const before = (await perf(OWNER1, 'all')).json.data;
  const owner2Before = (await perf(OWNER2, 'all')).json.data;

  await setInstant(true);
  const instantSlot = await ensureSlot();
  const instant = await createBooking(instantSlot);
  const afterInstant = (await perf(OWNER1, 'all')).json.data;
  if (instant.status === 201 && afterInstant.totalRequests === before.totalRequests) {
    pass('instant bookings are excluded');
  } else {
    fail('instant exclude', `${instant.status} ${before.totalRequests} -> ${afterInstant.totalRequests}`);
  }

  await setInstant(false);
  const snap = (await perf(OWNER1, 'all')).json.data;

  const pendingSlot = await ensureSlot();
  const pending = await createBooking(pendingSlot);
  const afterPending = (await perf(OWNER1, 'all')).json.data;
  if (
    pending.json.data?.status === 'pending_owner_approval' &&
    afterPending.awaitingDecision === snap.awaitingDecision + 1 &&
    afterPending.responseRate === snap.responseRate &&
    afterPending.acceptanceRate === snap.acceptanceRate &&
    afterPending.timeoutRate === snap.timeoutRate
  ) {
    pass('pending request does not change resolved-rate denominators');
  } else {
    fail(
      'pending rates',
      `await ${snap.awaitingDecision}->${afterPending.awaitingDecision} resp ${snap.responseRate}->${afterPending.responseRate}`,
    );
  }

  const acceptSlot = await ensureSlot();
  const acceptCreate = await createBooking(acceptSlot);
  const acceptId = acceptCreate.json.data?.id;
  await login(OWNER1);
  await api('POST', `/owner/bookings/${acceptId}/accept`, {});
  await api('POST', `/internal/bookings/${acceptId}/backdate-hold`, {}, false);
  await api('POST', '/internal/payments/expire-stale', {}, false);
  const afterAcceptExpire = (await perf(OWNER1, 'all')).json.data;
  if (
    afterAcceptExpire.accepted === snap.accepted + 1 &&
    afterAcceptExpire.timedOut === snap.timedOut
  ) {
    pass('accepted then payment-expired still counts as accepted, not timeout');
  } else {
    fail(
      'accepted later expired',
      `accepted ${snap.accepted}->${afterAcceptExpire.accepted} timeout ${snap.timedOut}->${afterAcceptExpire.timedOut}`,
    );
  }

  const rejectSlot = await ensureSlot();
  const rejectCreate = await createBooking(rejectSlot);
  const rejectId = rejectCreate.json.data?.id;
  await login(OWNER1);
  await api('POST', `/owner/bookings/${rejectId}/reject`, { reason: 'Closed that day' });
  const afterReject = (await perf(OWNER1, 'all')).json.data;
  if (afterReject.rejected === afterAcceptExpire.rejected + 1) pass('rejected request counted');
  else fail('rejected', `${afterAcceptExpire.rejected} -> ${afterReject.rejected}`);

  const expSlot = await ensureSlot();
  const expCreate = await createBooking(expSlot);
  const expId = expCreate.json.data?.id;
  await api('POST', `/internal/bookings/${expId}/backdate-owner-approval`, {}, false);
  await api('POST', '/internal/bookings/expire-owner-approvals', {}, false);
  const afterTimeout = (await perf(OWNER1, 'all')).json.data;
  if (afterTimeout.timedOut === afterReject.timedOut + 1) pass('owner-approval timeout counted');
  else fail('timeout', `${afterReject.timedOut} -> ${afterTimeout.timedOut}`);

  const m = afterTimeout;
  const responded = m.accepted + m.rejected;
  const resolved = m.accepted + m.rejected + m.timedOut;
  if (m.responded === responded && m.resolved === resolved) pass('responded/resolved fields');
  else fail('responded fields', `${m.responded} ${m.resolved}`);

  if (resolved === 0 ? m.responseRate == null : close(m.responseRate, responded / resolved)) {
    pass('response-rate formula');
  } else fail('responseRate', m.responseRate);

  if (responded === 0 ? m.acceptanceRate == null : close(m.acceptanceRate, m.accepted / responded)) {
    pass('acceptance-rate formula');
  } else fail('acceptanceRate', m.acceptanceRate);

  if (responded === 0 ? m.rejectionRate == null : close(m.rejectionRate, m.rejected / responded)) {
    pass('rejection-rate formula');
  } else fail('rejectionRate', m.rejectionRate);

  if (resolved === 0 ? m.timeoutRate == null : close(m.timeoutRate, m.timedOut / resolved)) {
    pass('timeout-rate formula');
  } else fail('timeoutRate', m.timeoutRate);

  if (m.averageResponseMinutes == null || m.averageResponseMinutes >= 0) {
    pass('average response time is null or non-negative');
  } else fail('avg minutes', m.averageResponseMinutes);

  const confirmSlot = await ensureSlot();
  const confirmCreate = await createBooking(confirmSlot);
  const confirmId = confirmCreate.json.data?.id;
  await login(OWNER1);
  await api('POST', `/owner/bookings/${confirmId}/accept`, {});
  await login(CUSTOMER);
  const pay = await api('POST', '/payments/create-intent', {
    bookingId: confirmId,
    method: 'card',
    purpose: 'deposit',
  });
  if (pay.json.data?.id) {
    await api('POST', `/payments/${pay.json.data.id}/simulate-success`, {});
  }
  const afterConfirm = (await perf(OWNER1, 'all')).json.data;
  if (afterConfirm.acceptedThenConfirmed >= m.acceptedThenConfirmed + 1) {
    pass('accepted then deposit-paid counted as confirmed');
  } else {
    fail('acceptedThenConfirmed', `${m.acceptedThenConfirmed} -> ${afterConfirm.acceptedThenConfirmed}`);
  }

  const oldSlot = await ensureSlot();
  const oldCreate = await createBooking(oldSlot);
  const oldId = oldCreate.json.data?.id;
  await login(OWNER1);
  await api('POST', `/owner/bookings/${oldId}/reject`, { reason: 'Too far out' });
  const allBeforeBackdate = (await perf(OWNER1, 'all')).json.data;
  const thirtyBefore = (await perf(OWNER1, '30d')).json.data;
  await api('POST', `/internal/bookings/${oldId}/backdate-created-at`, { daysAgo: 40 }, false);
  const thirtyAfter = (await perf(OWNER1, '30d')).json.data;
  const allAfter = (await perf(OWNER1, 'all')).json.data;
  if (thirtyAfter.rejected === thirtyBefore.rejected - 1 && allAfter.rejected === allBeforeBackdate.rejected) {
    pass('30-day range excludes older requests; all still includes them');
  } else {
    fail(
      '30d filter',
      `30d ${thirtyBefore.rejected}->${thirtyAfter.rejected} all ${allBeforeBackdate.rejected}->${allAfter.rejected}`,
    );
  }

  const owner2After = (await perf(OWNER2, 'all')).json.data;
  if (
    owner2After.totalRequests === owner2Before.totalRequests &&
    owner2After.accepted === owner2Before.accepted &&
    owner2After.rejected === owner2Before.rejected
  ) {
    pass('owner isolation');
  } else fail('isolation', JSON.stringify({ owner2Before, owner2After }));

  await login(ADMIN);
  const adminPerf = await api('GET', `/admin/partners/${ownerProfileId}/performance?range=all`);
  if (
    adminPerf.status === 200 &&
    adminPerf.json.data?.accepted === allAfter.accepted &&
    adminPerf.json.data?.rejected === allAfter.rejected
  ) {
    pass('admin can inspect partner metrics');
  } else {
    fail('admin access', `${adminPerf.status} ${JSON.stringify(adminPerf.json.data)}`);
  }

  await login(OWNER1);
  const ownerCannotAdmin = await api('GET', `/admin/partners/${ownerProfileId}/performance?range=all`);
  if (ownerCannotAdmin.status === 401 || ownerCannotAdmin.status === 403) {
    pass('non-admin cannot use admin performance endpoint');
  } else fail('owner admin endpoint', ownerCannotAdmin.status);

  const searchAfter = await api('GET', '/properties', null, false);
  if (searchAfter.json.data?.[0]?.slug === firstSlug) {
    pass('metrics do not change search ranking');
  } else fail('search ranking', `${firstSlug} -> ${searchAfter.json.data?.[0]?.slug}`);

  await setInstant(true);

  console.log(`\n10C.2D api: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
