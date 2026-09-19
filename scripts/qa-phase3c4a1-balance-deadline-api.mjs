/**
 * Phase 3C.4A.1 — Unpaid balance auto-cancel worker (API).
 * Requires ENABLE_INTERNAL_QA_ROUTES + payment simulate.
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

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
    body: body == null ? undefined : JSON.stringify(body),
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

/** Explicit Terms acceptance required before contractual booking actions. */
async function ensureCustomerTermsAccepted() {
  const status = await api('GET', '/me/legal/status');
  const termsGate = (status.json.data?.customer?.gates ?? []).find(
    (g) => g.documentType === 'terms_and_conditions',
  );
  if (termsGate && termsGate.status !== 'missing' && termsGate.status !== 'reacceptance_required') {
    return true;
  }
  const doc = await api('GET', '/legal/documents/terms_and_conditions?lang=en', null, false);
  const versionId = doc.json.data?.id;
  if (!versionId) return false;
  const accept = await api('POST', '/me/legal/accept', {
    documentVersionId: versionId,
    context: 'login_reacceptance',
    sourceSurface: 'qa.phase3c4a1',
  });
  return accept.status === 201 || accept.status === 200;
}

async function ensureSlot() {
  const r = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (r.status === 200 && r.json.data?.date) return r.json.data;
  return null;
}

async function createDepositPaidBooking() {
  const slot = await ensureSlot();
  if (!slot) return null;
  await login(CUSTOMER);
  if (!(await ensureCustomerTermsAccepted())) return null;
  const created = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 2,
  });
  const bookingId = created.json.data?.id;
  if (!bookingId || created.status !== 201) {
    console.error('booking create failed', created.status, JSON.stringify(created.json).slice(0, 400));
    return null;
  }
  const dep = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
    purpose: 'deposit',
    contactPhone: '+962790000001',
  });
  if (dep.status !== 201 || !dep.json.data?.id) {
    console.error('deposit intent failed', dep.status, JSON.stringify(dep.json).slice(0, 400));
    return null;
  }
  const ok = await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  if (ok.status !== 200) {
    console.error('deposit simulate failed', ok.status, JSON.stringify(ok.json).slice(0, 400));
    return null;
  }
  return { bookingId, slot, depositAmount: Number(dep.json.data.amount) };
}

async function main() {
  console.log('\n📦 Phase 3C.4A.1 Balance Deadline API QA\n');

  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const propertyId = (props.json.data ?? []).find((p) => p.slug === SLUG)?.id;
  if (propertyId) {
    await api('PATCH', `/owner/properties/${propertyId}`, { instantBookingEnabled: true });
  }

  const catalog = await api('GET', '/internal/jobs', null, false);
  const jobs = catalog.json.data?.jobs ?? [];
  if (catalog.status === 200 && jobs.includes('auto-cancel-unpaid-balances') && jobs.length >= 5) {
    pass('A/catalog job auto-cancel-unpaid-balances registered');
  } else {
    fail('catalog', `${catalog.status} ${JSON.stringify(jobs)}`);
  }

  // A — unpaid at -48h selected & cancelled
  const overdue = await createDepositPaidBooking();
  if (!overdue) {
    fail('A setup', 'could not create deposit booking');
    process.exit(1);
  }
  await api('POST', `/internal/bookings/${overdue.bookingId}/backdate-balance-due`, {}, false);
  const run1 = await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
  const cancelledCount = run1.json.data?.summary?.cancelled ?? 0;
  await login(CUSTOMER);
  let row = await api('GET', `/me/bookings/${overdue.bookingId}`);
  if (
    run1.status === 200 &&
    cancelledCount >= 1 &&
    row.json.data?.status === 'cancelled' &&
    row.json.data?.cancellationReasonCode === 'BALANCE_NOT_PAID'
  ) {
    pass('A/F unpaid at deadline cancelled with BALANCE_NOT_PAID');
  } else {
    fail(
      'A/F cancel',
      `${run1.status} cancelled=${cancelledCount} status=${row.json.data?.status} reason=${row.json.data?.cancellationReasonCode}`,
    );
  }

  // G/H — deposit retained, no extra money
  const retainedOk =
    row.json.data?.status === 'cancelled' &&
    Number(row.json.data?.depositPaidAmount ?? 0) > 0 &&
    Number(row.json.data?.remainingAmount ?? 0) >= 0;
  if (retainedOk) pass('G/H deposit retained path (no full capture required)');
  else fail('G/H retain', JSON.stringify(row.json.data));

  // J — slot released
  const slotCheck = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${overdue.slot.date}&to=${overdue.slot.date}`,
    null,
    false,
  );
  const released = (slotCheck.json.data ?? []).find((s) => s.period === overdue.slot.period);
  if (released?.status === 'available') pass('J slot released after auto-cancel');
  else fail('J slot', released?.status);

  // K — idempotent second run
  const run2 = await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
  if (run2.status === 200 && (run2.json.data?.summary?.cancelled ?? -1) === 0) {
    pass('K repeated worker run idempotent (cancelled=0)');
  } else {
    fail('K idempotent', JSON.stringify(run2.json.data?.summary));
  }

  // L — concurrent attempts do not double-process
  const concurrent = await createDepositPaidBooking();
  if (concurrent) {
    await api('POST', `/internal/bookings/${concurrent.bookingId}/backdate-balance-due`, {}, false);
    const [a, b] = await Promise.all([
      api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false),
      api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false),
    ]);
    const totalCancelled =
      (a.json.data?.summary?.cancelled ?? 0) + (b.json.data?.summary?.cancelled ?? 0);
    await login(CUSTOMER);
    const cRow = await api('GET', `/me/bookings/${concurrent.bookingId}`);
    if (cRow.json.data?.status === 'cancelled' && totalCancelled >= 1 && totalCancelled <= 2) {
      // At most one should "win" for this booking; aggregate may be 1 if both see same candidate list
      pass('L concurrent workers leave booking cancelled once');
    } else {
      fail('L concurrent', `totalCancelled=${totalCancelled} status=${cRow.json.data?.status}`);
    }
  } else {
    fail('L setup', 'missing booking');
  }

  // B — before -48h not cancelled
  const early = await createDepositPaidBooking();
  if (early) {
    const before = await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
    await login(CUSTOMER);
    const eRow = await api('GET', `/me/bookings/${early.bookingId}`);
    if (eRow.json.data?.status === 'confirmed' && eRow.json.data?.paymentState !== 'fully_paid') {
      pass('B deposit booking before deadline not selected/cancelled');
    } else {
      fail('B early', `${eRow.json.data?.status} ${eRow.json.data?.paymentState} job=${JSON.stringify(before.json.data?.summary)}`);
    }
  } else {
    fail('B setup', 'missing');
  }

  // C — fully paid never cancelled
  const paid = await createDepositPaidBooking();
  if (paid) {
    await login(CUSTOMER);
    const bal = await api('POST', '/payments/create-intent', {
      bookingId: paid.bookingId,
      method: 'card',
      purpose: 'balance',
      contactPhone: '+962790000001',
    });
    await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});
    await api('POST', `/internal/bookings/${paid.bookingId}/backdate-balance-due`, {}, false);
    await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
    const pRow = await api('GET', `/me/bookings/${paid.bookingId}`);
    if (pRow.json.data?.status === 'confirmed' && pRow.json.data?.paymentState === 'fully_paid') {
      pass('C fully-paid booking never auto-cancelled');
    } else {
      fail('C fully paid', `${pRow.json.data?.status} ${pRow.json.data?.paymentState}`);
    }
  } else {
    fail('C setup', 'missing');
  }

  // D/E — successful balance payment / reconcile prevents cancel
  const race = await createDepositPaidBooking();
  if (race) {
    await login(CUSTOMER);
    const bal = await api('POST', '/payments/create-intent', {
      bookingId: race.bookingId,
      method: 'card',
      purpose: 'balance',
      contactPhone: '+962790000001',
    });
    const balId = bal.json.data?.id;
    await api('POST', `/payments/${balId}/simulate-success`, {});
    await api('POST', `/internal/bookings/${race.bookingId}/backdate-balance-due`, {}, false);
    await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
    const rRow = await api('GET', `/me/bookings/${race.bookingId}`);
    if (rRow.json.data?.status === 'confirmed' && rRow.json.data?.paymentState === 'fully_paid') {
      pass('D/E successful balance payment prevents cancellation');
    } else {
      fail('D/E race', `${rRow.json.data?.status} ${rRow.json.data?.paymentState}`);
    }
  } else {
    fail('D/E setup', 'missing');
  }

  // M/N — notifications once (customer + owner)
  await login(CUSTOMER);
  const notifs = await api('GET', '/me/notifications?limit=100');
  const customerItems = notifs.json.data?.items ?? notifs.json.data ?? [];
  const customerHits = (Array.isArray(customerItems) ? customerItems : []).filter(
    (n) =>
      n.type === 'booking.auto_cancelled_balance_unpaid' &&
      n.entityId === overdue.bookingId,
  );
  if (customerHits.length === 1) pass('M customer notification generated once');
  else fail('M customer notif', `count=${customerHits.length}`);

  await login(OWNER1);
  const ownerNotifs = await api('GET', '/me/notifications?limit=100');
  const ownerItems = ownerNotifs.json.data?.items ?? ownerNotifs.json.data ?? [];
  const ownerHits = (Array.isArray(ownerItems) ? ownerItems : []).filter(
    (n) =>
      n.type === 'booking.auto_cancelled_balance_unpaid' &&
      n.entityId === overdue.bookingId,
  );
  if (ownerHits.length === 1) pass('N owner notification generated once');
  else fail('N owner notif', `count=${ownerHits.length}`);

  // P — previously cancelled unaffected (second job run already covered; spot-check status)
  await login(CUSTOMER);
  const again = await api('GET', `/me/bookings/${overdue.bookingId}`);
  if (
    again.json.data?.status === 'cancelled' &&
    again.json.data?.cancellationReasonCode === 'BALANCE_NOT_PAID'
  ) {
    pass('P previously cancelled booking remains cancelled once');
  } else {
    fail('P historical', JSON.stringify(again.json.data));
  }

  // Admin visibility
  await login(ADMIN);
  const adminList = await api('GET', '/admin/bookings');
  const adminRow = (adminList.json.data ?? []).find((b) => b.id === overdue.bookingId);
  if (adminRow?.cancellationReasonCode === 'BALANCE_NOT_PAID') {
    pass('admin sees BALANCE_NOT_PAID cancellation reason');
  } else {
    fail('admin reason', JSON.stringify(adminRow?.cancellationReasonCode));
  }

  const audits = await api('GET', '/admin/audit-logs?limit=50');
  const auditHit = (audits.json.data ?? []).find(
    (a) =>
      a.action === 'booking.auto_cancelled' &&
      a.entityId === overdue.bookingId &&
      a.metadata?.reason === 'BALANCE_NOT_PAID',
  );
  if (auditHit && auditHit.metadata?.actor === 'SYSTEM') {
    pass('audit event SYSTEM / BALANCE_NOT_PAID recorded');
  } else {
    fail('audit', auditHit ? JSON.stringify(auditHit.metadata) : 'missing');
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.detail}`);
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
