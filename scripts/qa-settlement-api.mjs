/**
 * Phase 10D.1 — Partner settlement batch QA
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
let ownerId = null;
const today = new Date().toISOString().slice(0, 10);

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
  return (await api('POST', '/auth/login', creds, false)).status === 200;
}

async function createPaidBooking() {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount: 4,
  });
  if (book.status !== 201) return null;
  const bookingId = book.json.data.id;
  const dep = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'deposit' });
  if (dep.status !== 201) return null;
  await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  const bal = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'balance' });
  if (bal.status !== 201) return { bookingId, paymentId: null, depositOnly: true, publicCode: book.json.data.publicCode };
  await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});
  return {
    bookingId,
    paymentId: bal.json.data.id,
    depositOnly: false,
    publicCode: book.json.data.publicCode,
    commission: bal.json.data.platformCommissionAmount,
    net: bal.json.data.ownerNetPayoutAmount,
  };
}

async function makeEligible() {
  const paid = await createPaidBooking();
  if (!paid?.paymentId) return null;
  await api('POST', `/internal/bookings/${paid.bookingId}/backdate-slot`, {}, false);
  await api('POST', `/internal/payments/${paid.paymentId}/backdate-payout-eligible`, {}, false);
  return paid;
}

async function preview() {
  await login(ADMIN);
  return api('GET', `/admin/partners/${ownerId}/settlement-preview?through=${today}`);
}

function inEligible(p, paymentId) {
  return (p.json.data?.items ?? []).some((i) => i.paymentId === paymentId);
}
function excludedReason(p, paymentId) {
  return (p.json.data?.excluded ?? []).find((i) => i.paymentId === paymentId)?.reason;
}

async function main() {
  console.log('\n📦 Phase 10D.1 Settlement QA\n');
  await login(ADMIN);
  const partners = await api('GET', '/admin/partners?q=owner1');
  ownerId = (partners.json.data ?? []).find((p) => p.email === OWNER1.email)?.id;
  if (!ownerId) {
    fail('ownerId', 'missing');
    process.exit(1);
  }
  pass('resolved owner1');

  await login(CUSTOMER);
  const slotU = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  const bookU = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slotU.json.data.date,
    period: slotU.json.data.period,
    guestsCount: 4,
  });
  const depU = await api('POST', '/payments/create-intent', {
    bookingId: bookU.json.data.id,
    method: 'card',
    purpose: 'deposit',
  });
  await api('POST', `/payments/${depU.json.data.id}/simulate-success`, {});
  const pUnpaid = await preview();
  if (!inEligible(pUnpaid, depU.json.data.id) && !inEligible(pUnpaid, bookU.json.data.id)) {
    pass('not-fully-paid booking excluded from eligible');
  } else fail('unpaid excluded', 'deposit appeared eligible');

  const future = await createPaidBooking();
  const pFuture = await preview();
  if (future?.paymentId && !inEligible(pFuture, future.paymentId)) {
    pass('future visits are excluded');
  } else fail('future visit', excludedReason(pFuture, future?.paymentId) ?? 'was eligible');

  const delayPaid = await createPaidBooking();
  if (delayPaid?.paymentId) {
    await api('POST', `/internal/bookings/${delayPaid.bookingId}/backdate-slot`, {}, false);
    await api('POST', `/internal/payments/${delayPaid.paymentId}/set-payout-available-at`, { hoursFromNow: 72 }, false);
    const pDelay = await preview();
    if (excludedReason(pDelay, delayPaid.paymentId) === 'payout_delay') pass('payout-delay items are excluded');
    else fail('payout delay', excludedReason(pDelay, delayPaid.paymentId));
  }

  const refundPaid = await createPaidBooking();
  await login(CUSTOMER);
  await api('POST', `/me/bookings/${refundPaid.bookingId}/refund-request`, {
    reason: 'طلب استرداد لاختبار استبعاد التسوية — سبب واضح',
  });
  await api('POST', `/internal/bookings/${refundPaid.bookingId}/backdate-slot`, {}, false);
  await api('POST', `/internal/payments/${refundPaid.paymentId}/backdate-payout-eligible`, {}, false);
  const pRefund = await preview();
  if (excludedReason(pRefund, refundPaid.paymentId) === 'refund_blocked') pass('refund-blocked payout is excluded');
  else fail('refund blocked', excludedReason(pRefund, refundPaid.paymentId));

  const disputePaid = await makeEligible();
  await login(CUSTOMER);
  await api('POST', `/me/bookings/${disputePaid.bookingId}/disputes`, {
    type: 'property_mismatch',
    description: 'نزاع لاختبار استبعاد التسوية — وصف كافٍ للاختبار',
  });
  const pDisp = await preview();
  if (excludedReason(pDisp, disputePaid.paymentId) === 'dispute_blocked') pass('dispute-blocked payout is excluded');
  else fail('dispute blocked', excludedReason(pDisp, disputePaid.paymentId));

  const paidOut = await makeEligible();
  await login(ADMIN);
  await api('POST', `/admin/payouts/${paidOut.paymentId}/mark-paid`, { manualReference: 'QA-SOLO-PAY' });
  const pPaid = await preview();
  if (excludedReason(pPaid, paidOut.paymentId) === 'already_paid') pass('already-paid payout is excluded');
  else fail('already paid', excludedReason(pPaid, paidOut.paymentId));

  const elig = await makeEligible();
  const prev = await preview();
  if (prev.status !== 200) {
    fail('eligible preview', `${prev.status} ${prev.json.code}`);
  } else if (inEligible(prev, elig.paymentId)) pass('only eligible payouts appear in preview');
  else fail('eligible preview', 'missing eligible item');

  const snapCommission = prev.json.data?.items?.find((i) => i.paymentId === elig.paymentId)?.platformCommissionAmount;

  await login(ADMIN);
  const created = await api('POST', `/admin/partners/${ownerId}/settlements`, { through: today });
  if (created.status === 201 && created.json.data?.status === 'draft') pass('draft settlement created from snapshots');
  else fail('create draft', `${created.status} ${created.json.code}`);
  const settlementId = created.json.data?.id;
  const itemCommission = created.json.data?.items?.find((i) => i.paymentId === elig.paymentId)?.platformCommissionAmount;
  if (itemCommission === snapCommission) pass('draft uses stored snapshots');
  else fail('snapshot commission', `${snapCommission} vs ${itemCommission}`);

  const pReserved = await preview();
  if (excludedReason(pReserved, elig.paymentId) === 'already_in_settlement') {
    pass('payout reserved in another settlement is excluded');
  } else fail('reserved', excludedReason(pReserved, elig.paymentId));

  const dup = await api('POST', `/admin/partners/${ownerId}/settlements`, { through: today });
  const dupHas = (dup.json.data?.items ?? []).some((i) => i.paymentId === elig.paymentId);
  if (dup.status === 400 || dup.status === 409 || !dupHas) pass('same payout cannot be included twice');
  else fail('duplicate include', dup.status);

  if (dup.status === 201) {
    await api('POST', `/admin/settlements/${dup.json.data.id}/cancel`, {});
  }

  await login(ADMIN);
  const terms = await api('POST', `/admin/partners/${ownerId}/commercial-terms`, {
    commissionPercent: 40,
    effectiveFrom: new Date().toISOString(),
  });
  if (terms.status === 201) {
    await api('POST', `/admin/partners/${ownerId}/commercial-terms/${terms.json.data.id}/activate`, {});
  }
  const afterTerms = await api('GET', `/admin/settlements/${settlementId}`);
  const still = afterTerms.json.data?.items?.find((i) => i.paymentId === elig.paymentId)?.platformCommissionAmount;
  if (still === snapCommission) pass('current commission changes do not change old settlement values');
  else fail('commission freeze', `${still} vs ${snapCommission}`);

  const blockedFinalize = await makeEligible();
  await login(ADMIN);
  const draft2 = await api('POST', `/admin/partners/${ownerId}/settlements`, { through: today });
  if (!blockedFinalize?.bookingId || draft2.status !== 201) {
    fail('finalize blocked setup', `${draft2.status} ${draft2.json.code}`);
  } else {
    await login(CUSTOMER);
    await api('POST', `/me/bookings/${blockedFinalize.bookingId}/disputes`, {
      type: 'property_mismatch',
      description: 'نزاع قبل الاعتماد — يجب أن يمنع إنهاء التسوية',
    });
    await login(ADMIN);
    const finBlocked = await api('POST', `/admin/settlements/${draft2.json.data.id}/finalize`, {});
    if (finBlocked.status === 409) pass('new dispute before finalize blocks finalization');
    else fail('finalize blocked', `${finBlocked.status} ${finBlocked.json.code}`);
    await api('POST', `/admin/settlements/${draft2.json.data.id}/cancel`, {});
  }

  await login(ADMIN);
  const finOk = await api('POST', `/admin/settlements/${settlementId}/finalize`, {});
  if (finOk.status === 200 && finOk.json.data?.status === 'ready') pass('finalize revalidates and moves draft → ready');
  else fail('finalize', `${finOk.status} ${finOk.json.code}`);

  await login(OWNER1);
  const notesReady = await api('GET', '/me/notifications?limit=100');
  const readyNotif = (notesReady.json.data?.items ?? notesReady.json.data ?? []).some(
    (n) => n.type === 'settlement.ready' && n.entityId === settlementId,
  );
  if (readyNotif) pass('ready notification created');
  else fail('ready notif', 'missing');

  const afterReady = await makeEligible();
  const draft3 = (await (async () => {
    await login(ADMIN);
    return api('POST', `/admin/partners/${ownerId}/settlements`, { through: today });
  })()).json.data;
  if (!draft3?.id) {
    fail('draft after ready', 'create failed');
  } else {
    await login(ADMIN);
    await api('POST', `/admin/settlements/${draft3.id}/finalize`, {});
    await login(CUSTOMER);
    await api('POST', `/me/bookings/${afterReady.bookingId}/disputes`, {
      type: 'property_mismatch',
      description: 'نزاع بعد الاعتماد — يجب أن يمنع تسجيل الدفع',
    });
    await login(ADMIN);
    const payBlocked = await api('POST', `/admin/settlements/${draft3.id}/mark-paid`, {
      paymentReference: 'SHOULD-FAIL',
    });
    if (payBlocked.status === 409) pass('new dispute after finalize blocks mark-paid');
    else fail('mark-paid blocked', `${payBlocked.status} ${payBlocked.json.code}`);
    await api('POST', `/admin/settlements/${draft3.id}/cancel`, {});
  }

  await login(ADMIN);
  const paidMark = await api('POST', `/admin/settlements/${settlementId}/mark-paid`, {
    paymentReference: 'QA-SETTLE-001',
    paidAt: new Date().toISOString(),
  });
  if (paidMark.status === 200 && paidMark.json.data?.status === 'paid') {
    pass('mark-paid updates settlement');
  } else fail('mark-paid', `${paidMark.status} ${paidMark.json.code}`);

  const payouts = await api('GET', '/admin/payouts');
  const underlying = (payouts.json.data ?? []).find((r) => r.paymentId === elig.paymentId);
  if (underlying?.payoutStatus === 'paid' && underlying?.manualReference === 'QA-SETTLE-001') {
    pass('mark-paid updates underlying OwnerPayout records');
  } else fail('underlying payout', JSON.stringify(underlying));

  const secondPay = await api('POST', `/admin/settlements/${settlementId}/mark-paid`, {
    paymentReference: 'QA-SETTLE-002',
  });
  if (secondPay.status === 409) pass('second mark-paid is rejected');
  else fail('second mark-paid', secondPay.status);

  const cancelPaid = await api('POST', `/admin/settlements/${settlementId}/cancel`, {});
  if (cancelPaid.status === 409) pass('paid settlement cannot be cancelled');
  else fail('cancel paid', cancelPaid.status);

  const toCancel = await makeEligible();
  await login(ADMIN);
  const draftC = await api('POST', `/admin/partners/${ownerId}/settlements`, { through: today });
  if (draftC.status !== 201 || !draftC.json.data?.id) {
    fail('cancel setup', `${draftC.status} ${draftC.json.code}`);
  } else {
    const cancel = await api('POST', `/admin/settlements/${draftC.json.data.id}/cancel`, {});
    const afterCancel = await preview();
    if (cancel.json.data?.status === 'cancelled' && inEligible(afterCancel, toCancel.paymentId)) {
      pass('cancelling unpaid settlement releases items');
    } else fail('cancel release', excludedReason(afterCancel, toCancel.paymentId));
  }

  await login(OWNER1);
  const mine = await api('GET', '/owner/settlements');
  const sees = (mine.json.data ?? []).some((s) => s.id === settlementId);
  const hasAdminNote = (mine.json.data ?? []).some((s) => s.adminNote);
  if (sees && !hasAdminNote) pass('owner sees only their settlements without admin notes');
  else fail('owner list', `sees=${sees} note=${hasAdminNote}`);

  await login(OWNER2);
  const other = await api('GET', `/owner/settlements/${settlementId}`);
  if (other.status === 404) pass('owner isolation');
  else fail('owner2 isolation', other.status);

  await login(ADMIN);
  const adminGet = await api('GET', `/admin/settlements/${settlementId}`);
  if (
    adminGet.json.data?.ownerNetAmount === created.json.data.ownerNetAmount &&
    adminGet.json.data?.platformCommissionTotal === created.json.data.platformCommissionTotal
  ) {
    pass('admin sees correct totals');
  } else fail('admin totals', JSON.stringify(adminGet.json.data));

  await login(OWNER1);
  const notesPaid = await api('GET', '/me/notifications?limit=100');
  const paidNotif = (notesPaid.json.data?.items ?? notesPaid.json.data ?? []).some(
    (n) => n.type === 'settlement.paid' && n.entityId === settlementId,
  );
  if (paidNotif) pass('paid notification created');
  else fail('paid notif', 'missing');

  await login(CUSTOMER);
  const cust = await api('GET', `/admin/partners/${ownerId}/settlement-preview?through=${today}`);
  if (cust.status === 401 || cust.status === 403) pass('customer cannot preview settlements');
  else fail('customer preview', cust.status);

  console.log(`\n10D.1: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
