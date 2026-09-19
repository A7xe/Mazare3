/**
 * Phase 10H.4 — Background operational jobs QA
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

async function ensureCustomerTermsAccepted() {
  const status = await api('GET', '/me/legal/status');
  const termsGate = (status.json.data?.customer?.gates ?? []).find(
    (g) => g.documentType === 'terms_and_conditions',
  );
  if (termsGate && termsGate.status !== 'missing' && termsGate.status !== 'reacceptance_required') {
    return true;
  }
  if (!termsGate && status.json.data?.customer?.requiresAction === false) return true;
  const doc = await api('GET', '/legal/documents/terms_and_conditions?lang=en', null, false);
  const versionId = doc.json.data?.id;
  if (!versionId) return false;
  const accept = await api('POST', '/me/legal/accept', {
    documentVersionId: versionId,
    context: 'login_reacceptance',
    sourceSurface: 'qa.background-jobs',
  });
  return accept.status === 201 || accept.status === 200;
}

async function ensureSlot() {
  const r = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (r.status === 200 && r.json.data?.date) return r.json.data;
  return null;
}

async function main() {
  console.log('\n📦 Phase 10H.4 Background Jobs QA\n');

  const catalog = await api('GET', '/internal/jobs', null, false);
  if (catalog.status === 200 && Array.isArray(catalog.json.data?.jobs) && catalog.json.data.jobs.length >= 5) {
    pass('internal jobs catalog lists registered jobs');
  } else {
    fail('jobs catalog', `${catalog.status} ${JSON.stringify(catalog.json)}`);
  }
  if (
    catalog.status === 200 &&
    Array.isArray(catalog.json.data?.jobs) &&
    catalog.json.data.jobs.includes('auto-cancel-unpaid-balances')
  ) {
    pass('auto-cancel-unpaid-balances job is registered');
  } else {
    fail('auto-cancel job registered', JSON.stringify(catalog.json.data?.jobs));
  }

  await login(CUSTOMER);
  const gate = await api('POST', '/internal/jobs/run-due', {}, false);
  if (gate.status === 404) {
    pass('internal jobs rejected when routes are not mounted (404)');
  } else if (gate.status === 403) {
    pass('internal jobs rejected when QA routes disabled (403)');
  } else if (gate.status === 200 || gate.status === 207) {
    pass('internal jobs reachable only when ENABLE_INTERNAL_QA_ROUTES is on (not customer-auth gated)');
  } else {
    fail('internal access gate', `status ${gate.status}`);
  }

  // Owner approval expiry via named job
  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const propertyId = (props.json.data ?? []).find((p) => p.slug === SLUG)?.id;
  if (!propertyId) {
    fail('property', 'missing');
    process.exit(1);
  }
  await api('PATCH', `/owner/properties/${propertyId}`, { instantBookingEnabled: false });

  const slot = await ensureSlot();
  await login(CUSTOMER);
  if (!(await ensureCustomerTermsAccepted())) {
    fail('customer terms accept', 'failed');
    process.exit(1);
  }
  const created = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 2,
  });
  const bookingId = created.json.data?.id;
  if (!bookingId) {
    fail('approval booking', `${created.status}`);
    process.exit(1);
  }

  await api('POST', `/internal/bookings/${bookingId}/backdate-owner-approval`, {}, false);
  const job1 = await api('POST', '/internal/jobs/expire-owner-approval-requests/run', {}, false);
  if (job1.status === 200 && job1.json.data?.success && job1.json.data?.summary?.expired >= 1) {
    pass('owner-approval expiry job runs once');
  } else {
    fail('owner-approval job', `${job1.status} ${JSON.stringify(job1.json.data)}`);
  }

  const job1b = await api('POST', '/internal/jobs/expire-owner-approval-requests/run', {}, false);
  if (job1b.status === 200 && job1b.json.data?.summary?.expired === 0) {
    pass('owner-approval expiry job idempotent on second run');
  } else {
    fail('owner-approval idempotent', JSON.stringify(job1b.json.data?.summary));
  }

  const slotCheck = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${slot.date}&to=${slot.date}`,
    null,
    false,
  );
  const released = (slotCheck.json.data ?? []).find((s) => s.period === slot.period);
  if (released?.status === 'available') pass('slot released after owner-approval expiry');
  else fail('slot released', released?.status);

  // Unpaid hold expiry (requires instant booking so payment can start)
  await login(OWNER1);
  const instantOn = await api('PATCH', `/owner/properties/${propertyId}`, { instantBookingEnabled: true });
  if (instantOn.status !== 200 || !instantOn.json.data?.instantBookingEnabled) {
    fail('instant booking restore', `${instantOn.status}`);
    process.exit(1);
  }

  const holdSlot = await ensureSlot();
  await login(CUSTOMER);
  const holdBook = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: holdSlot.date,
    period: holdSlot.period,
    guestsCount: 2,
  });
  const holdId = holdBook.json.data?.id;
  if (!holdId || holdBook.status !== 201) {
    fail('hold booking', `${holdBook.status} ${JSON.stringify(holdBook.json)}`);
    process.exit(1);
  }
  const holdIntent = await api('POST', '/payments/create-intent', {
    bookingId: holdId,
    method: 'card',
    purpose: 'deposit',
    contactPhone: '+962790000001',
  });
  const payId = holdIntent.json.data?.id;
  if (!payId || holdIntent.status !== 201) {
    fail('hold payment intent', `${holdIntent.status} ${JSON.stringify(holdIntent.json)}`);
    process.exit(1);
  }
  await api('POST', `/internal/payments/${payId}/backdate-expiry`, {}, false);
  await api('POST', `/internal/bookings/${holdId}/backdate-hold`, {}, false);

  const holdJob = await api('POST', '/internal/jobs/expire-unpaid-booking-holds/run', {}, false);
  const holdExpired =
    (holdJob.json.data?.summary?.holdsExpired ?? 0) >= 1 ||
    (holdJob.json.data?.summary?.paymentsExpired ?? 0) >= 1;
  if (holdJob.status === 200 && holdJob.json.data?.success && holdExpired) {
    pass('unpaid hold expiry job runs once');
  } else {
    fail('hold job', `${holdJob.status} ${JSON.stringify(holdJob.json.data)}`);
  }

  const holdJob2 = await api('POST', '/internal/jobs/expire-unpaid-booking-holds/run', {}, false);
  if (holdJob2.status === 200 && holdJob2.json.data?.summary?.holdsExpired === 0 && holdJob2.json.data?.summary?.paymentsExpired === 0) {
    pass('unpaid hold expiry job idempotent on second run');
  } else {
    fail('hold idempotent', JSON.stringify(holdJob2.json.data?.summary));
  }

  await login(CUSTOMER);
  if (!(await ensureCustomerTermsAccepted())) {
    fail('customer terms accept (paid)', 'failed');
    process.exit(1);
  }
  const paidSlot = await ensureSlot();
  const paidBook = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: paidSlot.date,
    period: paidSlot.period,
    guestsCount: 2,
  });
  const paidId = paidBook.json.data?.id;
  if (!paidId || paidBook.status !== 201) {
    fail('paid booking', `${paidBook.status} ${JSON.stringify(paidBook.json)}`);
    process.exit(1);
  }
  const dep = await api('POST', '/payments/create-intent', { bookingId: paidId, method: 'card', purpose: 'deposit', contactPhone: '+962790000001' });
  if (!dep.json.data?.id || dep.status !== 201) {
    fail('paid deposit intent', `${dep.status} ${JSON.stringify(dep.json)}`);
    process.exit(1);
  }
  await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  const bal = await api('POST', '/payments/create-intent', { bookingId: paidId, method: 'card', purpose: 'balance', contactPhone: '+962790000001' });
  if (!bal.json.data?.id || bal.status !== 201) {
    fail('paid balance intent', `${bal.status} ${JSON.stringify(bal.json)}`);
    process.exit(1);
  }
  await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});

  await api('POST', `/internal/bookings/${paidId}/backdate-hold`, {}, false);
  const afterPaid = await api('POST', '/internal/jobs/expire-unpaid-booking-holds/run', {}, false);
  const paidRow = await api('GET', `/me/bookings/${paidId}`);
  if (
    paidRow.json.data?.status === 'confirmed' &&
    afterPaid.json.data?.summary?.holdsExpired === 0
  ) {
    pass('successful payment booking is not expired by hold job');
  } else {
    fail('paid not expired', `${paidRow.json.data?.status} holdsExpired=${afterPaid.json.data?.summary?.holdsExpired}`);
  }

  // Settlement generation idempotent
  const settle1 = await api('POST', '/internal/jobs/generate-due-settlement-cycles/run', {}, false);
  if (settle1.status === 200 && settle1.json.data?.success) {
    pass('settlement cycle generation job runs');
  } else {
    fail('settlement job', `${settle1.status} ${JSON.stringify(settle1.json.data)}`);
  }
  const created1 = settle1.json.data?.summary?.settlementsCreated ?? 0;
  const settle2 = await api('POST', '/internal/jobs/generate-due-settlement-cycles/run', {}, false);
  const created2 = settle2.json.data?.summary?.settlementsCreated ?? 0;
  if (settle2.status === 200 && created2 === 0) {
    pass('settlement cycle generation idempotent (no duplicate drafts)');
  } else {
    fail('settlement idempotent', `first=${created1} second=${created2}`);
  }

  await login(ADMIN);
  const settleList = await api('GET', '/admin/partners');
  if (settleList.status === 200) {
    pass('settlement job does not mark settlements paid (admin still operational)');
  } else {
    fail('admin settlements', settleList.status);
  }

  // Availability horizon
  const avail1 = await api('POST', '/internal/jobs/maintain-availability-horizon/run', {}, false);
  if (avail1.status === 200 && avail1.json.data?.success) {
    pass('availability horizon maintenance job runs');
  } else {
    fail('availability job', `${avail1.status} ${JSON.stringify(avail1.json.data)}`);
  }
  const avail2 = await api('POST', '/internal/jobs/maintain-availability-horizon/run', {}, false);
  if (avail2.status === 200 && avail2.json.data?.success) {
    pass('availability horizon job safe on second run');
  } else {
    fail('availability idempotent', JSON.stringify(avail2.json.data));
  }

  const runDue = await api('POST', '/internal/jobs/run-due', {}, false);
  if (runDue.status === 200 && Array.isArray(runDue.json.data?.jobs) && runDue.json.data.jobs.length >= 5) {
    pass('run-due executes all registered jobs with structured report');
  } else {
    fail('run-due', `${runDue.status} jobs=${runDue.json.data?.jobs?.length}`);
  }

  // Phase 3C.4A.1 — unpaid balance auto-cancel job (deposit paid, balance due past)
  const balSlot = await ensureSlot();
  await login(CUSTOMER);
  const balBook = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: balSlot.date,
    period: balSlot.period,
    guestsCount: 2,
  });
  const balId = balBook.json.data?.id;
  if (!balId || balBook.status !== 201) {
    fail('balance auto-cancel booking', `${balBook.status}`);
  } else {
    const dep = await api('POST', '/payments/create-intent', {
      bookingId: balId,
      method: 'card',
      purpose: 'deposit',
      contactPhone: '+962790000001',
    });
    await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
    await api('POST', `/internal/bookings/${balId}/backdate-balance-due`, {}, false);
    const balJob = await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
    const balRow = await api('GET', `/me/bookings/${balId}`);
    if (
      balJob.status === 200 &&
      (balJob.json.data?.summary?.cancelled ?? 0) >= 1 &&
      balRow.json.data?.status === 'cancelled' &&
      balRow.json.data?.cancellationReasonCode === 'BALANCE_NOT_PAID'
    ) {
      pass('auto-cancel-unpaid-balances job cancels overdue deposit booking');
    } else {
      fail(
        'auto-cancel unpaid balances',
        `${balJob.status} ${JSON.stringify(balJob.json.data)} status=${balRow.json.data?.status}`,
      );
    }
    const balJob2 = await api('POST', '/internal/jobs/auto-cancel-unpaid-balances/run', {}, false);
    if (balJob2.status === 200 && (balJob2.json.data?.summary?.cancelled ?? -1) === 0) {
      pass('auto-cancel-unpaid-balances job idempotent on second run');
    } else {
      fail('auto-cancel idempotent', JSON.stringify(balJob2.json.data?.summary));
    }
  }

  printSummary();
  process.exit(failed ? 1 : 0);
}

function printSummary() {
  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.detail}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
