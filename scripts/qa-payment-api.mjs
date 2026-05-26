/**
 * Phase 6A — Payments API QA
 * Prefer: pnpm qa:api (isolated :4012, no rate limit, internal routes)
 * Or: API_BASE=http://localhost:4012/api/v1 node scripts/qa-payment-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
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

async function findAvailableSlot(minDaysAhead = 1) {
  const from = todayPlus(minDaysAhead);
  const to = todayPlus(minDaysAhead + 25);
  const { status, json } = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${from}&to=${to}`,
    null,
    false,
  );
  if (status !== 200) return null;
  const slot = json.data?.find((s) => s.status === 'available');
  return slot ? { date: slot.date, period: slot.period } : null;
}

function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function expectCommission(bookingTotal) {
  const commission = roundMoney((bookingTotal * 12) / 100);
  const ownerNet = roundMoney(bookingTotal - commission);
  return { commission, ownerNet };
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

async function createPendingBooking() {
  const slot = await findAvailableSlot();
  if (!slot) return null;
  const r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
  if (r.status !== 201 || r.json.data?.status !== 'pending_payment') return null;
  return { booking: r.json.data, slot };
}

async function main() {
  console.log('\n💳 Phase 6B.1 Payments API QA (full payment + policy)\n');

  if (!(await login(CUSTOMER))) {
    fail('customer login', 'failed');
    printSummary();
    process.exit(1);
  }
  pass('customer login');

  const created = await createPendingBooking();
  if (!created) {
    fail('create pending_payment booking', 'no slot or bad status');
    printSummary();
    process.exit(1);
  }
  const { booking } = created;
  pass('POST /bookings → pending_payment');
  const bookingId = booking.id;

  let r = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
  });
  if (r.status === 201 && r.json.data?.id && r.json.data?.status === 'pending') {
    pass('POST /payments/create-intent');
    const payable =
      r.json.data.financial?.customerPayableAmount ?? Number(r.json.data.amount);
    if (payable === Number(booking.totalAmount)) {
      pass('customerPayableAmount equals full booking amount');
    } else {
      fail('customerPayableAmount', `expected ${booking.totalAmount} got ${payable}`);
    }
  } else {
    fail('POST /payments/create-intent', `${r.status} ${JSON.stringify(r.json)}`);
    printSummary();
    process.exit(1);
  }
  const paymentId = r.json.data.id;

  r = await api('POST', '/payments/create-intent', { bookingId, method: 'cliq' });
  if (r.status === 201 && r.json.data?.id === paymentId) {
    pass('duplicate active intent returns same payment');
  } else if (r.status === 201 && r.json.data?.id) {
    fail('duplicate intent', 'created second active payment');
  } else {
    fail('duplicate intent', `status ${r.status}`);
  }

  r = await api('GET', `/payments/${paymentId}`);
  if (r.status === 200 && r.json.data?.id === paymentId) pass('GET /payments/:id');
  else fail('GET /payments/:id', `status ${r.status}`);

  r = await api('POST', `/payments/${paymentId}/simulate-success`);
  if (r.status === 200 && r.json.data?.status === 'succeeded') {
    pass('POST simulate-success → succeeded');
    const { commission, ownerNet } = expectCommission(Number(booking.totalAmount));
    const fin = r.json.data.financial;
    if (fin && fin.platformCommissionAmount === commission) {
      pass('platformCommissionAmount 12% correct');
    } else {
      fail('platformCommissionAmount', JSON.stringify(fin));
    }
    if (fin && fin.ownerNetPayoutAmount === ownerNet) {
      pass('ownerNetPayoutAmount correct');
    } else {
      fail('ownerNetPayoutAmount', JSON.stringify(fin));
    }
    if (r.json.data.payoutStatus && r.json.data.payoutStatus !== 'paid') {
      pass('payoutStatus not paid immediately');
    } else {
      fail('payoutStatus', r.json.data.payoutStatus);
    }
    if (r.json.data.payoutAvailableAt) {
      pass('payoutAvailableAt set after success');
    } else {
      fail('payoutAvailableAt', 'missing');
    }
  } else {
    fail('simulate-success', `${r.status} ${JSON.stringify(r.json)}`);
  }

  r = await api('GET', `/me/bookings/${bookingId}`);
  if (r.status === 200 && r.json.data?.status === 'confirmed') {
    pass('booking confirmed after payment');
  } else {
    fail('booking confirmed', `${r.status} status=${r.json.data?.status}`);
  }

  r = await api('POST', '/payments/create-intent', { bookingId, method: 'card' });
  if (r.status === 400 && (r.json.code === 'ALREADY_PAID' || r.json.code === 'BOOKING_NOT_PAYABLE')) {
    pass('cannot create intent for paid booking');
  } else {
    fail('intent on paid booking', `status ${r.status} code ${r.json.code}`);
  }

  // Another customer cannot pay
  cookieJar = '';
  const otherEmail = `pay-qa-${Date.now()}@test.mazare3.jo`;
  r = await api('POST', '/auth/signup', {
    email: otherEmail,
    password: 'Mazare3Demo2026!',
    name: 'Pay QA',
    locale: 'ar',
  });
  if (r.status === 201 || r.status === 200) pass('second customer signup');
  else fail('second customer signup', `status ${r.status}`);

  r = await api('POST', '/payments/create-intent', { bookingId, method: 'card' });
  if (r.status === 404) pass('other customer create-intent → 404');
  else fail('other customer payment', `status ${r.status}`);

  r = await api('GET', `/payments/${paymentId}`);
  if (r.status === 404) pass('other customer GET payment → 404');
  else fail('other customer GET payment', `status ${r.status}`);

  r = await api('POST', `/payments/${paymentId}/simulate-success`);
  if (r.status === 404) pass('other customer simulate-success → 404');
  else fail('other customer simulate', `status ${r.status}`);

  // Owner cannot access payments
  await login(OWNER);
  r = await api('POST', '/payments/create-intent', { bookingId, method: 'card' });
  if (r.status === 403) pass('owner POST create-intent → 403');
  else fail('owner payments', `status ${r.status}`);

  r = await api('GET', `/payments/${paymentId}`);
  if (r.status === 403) pass('owner GET payment → 403');
  else fail('owner GET payment', `status ${r.status}`);

  // Simulate failure on fresh booking
  await login(CUSTOMER);
  const created2 = await createPendingBooking();
  if (!created2) {
    fail('second booking for failure test', 'no slot');
  } else {
    const bid2 = created2.booking.id;
    r = await api('POST', '/payments/create-intent', { bookingId: bid2, method: 'cliq' });
    const pid2 = r.json.data?.id;
    if (r.status === 201 && pid2) pass('intent for failure test');
    r = await api('POST', `/payments/${pid2}/simulate-failure`);
    if (r.status === 200 && r.json.data?.status === 'failed') {
      pass('POST simulate-failure → failed');
    } else {
      fail('simulate-failure', `${r.status}`);
    }
    r = await api('GET', `/me/bookings/${bid2}`);
    if (r.status === 200 && r.json.data?.status === 'cancelled') {
      pass('booking cancelled after payment failure');
    } else {
      fail('booking after failure', `status ${r.json.data?.status}`);
    }
    r = await api('POST', '/payments/create-intent', { bookingId: bid2, method: 'card' });
    if (r.status === 400 && r.json.code === 'BOOKING_NOT_PAYABLE') {
      pass('cancelled booking cannot be paid');
    } else {
      fail('pay cancelled booking', `status ${r.status} code ${r.json.code}`);
    }
  }

  // Payment expiry cleanup (internal QA routes)
  const createdExp = await createPendingBooking();
  if (!createdExp) {
    fail('booking for expiry test', 'no slot');
  } else {
    const expBid = createdExp.booking.id;
    const expDate = createdExp.slot.date;
    const expPeriod = createdExp.slot.period;
    r = await api('POST', '/payments/create-intent', { bookingId: expBid, method: 'card' });
    const expPid = r.json.data?.id;
    if (r.status === 201 && expPid) pass('intent for expiry test');
    else fail('intent for expiry', `status ${r.status}`);

    r = await api('POST', `/internal/payments/${expPid}/backdate-expiry`, null, false);
    if (r.status === 200) pass('internal backdate-expiry');
    else fail('backdate-expiry', `status ${r.status} (enable ENABLE_INTERNAL_QA_ROUTES)`);

    r = await api('POST', '/internal/payments/expire-stale', null, false);
    if (r.status === 200 && r.json.data?.expired >= 1) pass('expire-stale expires payment');
    else fail('expire-stale', JSON.stringify(r.json));

    r = await api('POST', '/internal/payments/expire-stale', null, false);
    if (r.status === 200 && r.json.data?.expired === 0) pass('expire-stale idempotent (second run)');
    else fail('expire-stale idempotent', JSON.stringify(r.json));

    r = await api('GET', `/payments/${expPid}`);
    if (r.status === 200 && r.json.data?.status === 'expired') pass('payment status expired');
    else fail('payment expired', `status ${r.json.data?.status}`);

    r = await api('GET', `/me/bookings/${expBid}`);
    if (r.status === 200 && r.json.data?.status === 'expired') pass('booking status expired');
    else fail('booking expired', `status ${r.json.data?.status}`);

    const from = todayPlus(0);
    const to = todayPlus(25);
    const avail = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${from}&to=${to}`,
      null,
      false,
    );
    const slotRow = avail.json.data?.find((s) => s.date === expDate && s.period === expPeriod);
    if (slotRow?.status === 'available') pass('slot available after expiry');
    else fail('slot after expiry', `status ${slotRow?.status ?? 'missing'}`);

    r = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: expDate,
      period: expPeriod,
      guestsCount: 3,
    });
    if (r.status === 201 && r.json.data?.status === 'pending_payment') {
      pass('rebook same slot after expiry');
      await api('POST', `/me/bookings/${r.json.data.id}/cancel`);
    } else {
      fail('rebook after expiry', `status ${r.status}`);
    }
  }

  // Paid booking cancellation policy (slot far ahead → free tier)
  r = await api('GET', `/me/bookings/${bookingId}`);
  if (
    r.status === 200 &&
    r.json.data?.paidInFull === true &&
    r.json.data?.cancellationPolicy?.canCancel === true
  ) {
    pass('paid booking exposes cancellation policy + paidInFull');
  } else {
    fail('paid booking policy view', JSON.stringify(r.json.data));
  }

  const farSlot = await findAvailableSlot(10);
  if (farSlot) {
    const farBook = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: farSlot.date,
      period: farSlot.period,
      guestsCount: 3,
    });
    if (farBook.status === 201 && farBook.json.data?.id) {
      const farId = farBook.json.data.id;
      const farTotal = Number(farBook.json.data.totalAmount);
      r = await api('POST', '/payments/create-intent', { bookingId: farId, method: 'card' });
      const farPid = r.json.data?.id;
      if (farPid) {
        await api('POST', `/payments/${farPid}/simulate-success`);
        r = await api('POST', `/me/bookings/${farId}/cancel`);
        if (r.status === 200 && r.json.data?.status === 'cancelled') {
          pass('paid booking cancel with policy → cancelled');
        } else {
          fail('paid booking cancel', `status ${r.status} code ${r.json.code}`);
        }
        await login(ADMIN);
        r = await api('GET', '/admin/payments');
        const farPay = r.json.data?.find((p) => p.bookingId === farId);
        if (farPay?.refundStatus === 'pending' && farPay.cancellationRefundAmount > 0) {
          pass('cancellation sets refundStatus pending (no real refund)');
        } else {
          fail('refund foundation', JSON.stringify(farPay));
        }
        await login(CUSTOMER);
      }
    }
  } else {
    fail('far-ahead slot for cancel test', 'no slot');
  }

  // Checkout API
  r = await api('GET', `/me/bookings/${bookingId}/checkout`);
  if (r.status === 200 && r.json.data?.status === 'confirmed') {
    pass('GET checkout for paid booking');
  } else {
    fail('checkout paid', `status ${r.status}`);
  }

  cookieJar = '';
  await login(OWNER);
  r = await api('GET', `/me/bookings/${bookingId}/checkout`);
  if (r.status === 404) pass('owner cannot open customer checkout');
  else fail('checkout isolation', `status ${r.status}`);

  await login(CUSTOMER);
  const pending = await createPendingBooking();
  if (pending) {
    r = await api('GET', `/me/bookings/${pending.booking.id}/checkout`);
    if (r.status === 200 && r.json.data?.status === 'pending_payment') {
      pass('GET checkout for pending_payment');
    } else {
      fail('checkout pending', `status ${r.status}`);
    }
    r = await api('POST', `/me/bookings/${pending.booking.id}/cancel`);
    if (r.status === 200 && r.json.data?.status === 'cancelled') {
      pass('cancel pending_payment releases booking');
    } else {
      fail('cancel pending_payment', `status ${r.status}`);
    }
  }

  // Admin list payments
  await login(ADMIN);
  r = await api('GET', '/admin/payments');
  if (r.status === 200 && Array.isArray(r.json.data)) {
    pass('admin GET /admin/payments');
    const row = r.json.data?.find((p) => p.id === paymentId);
    if (row) {
      pass('admin payments includes succeeded payment');
      if (
        row.bookingTotalAmount != null &&
        row.platformCommissionAmount != null &&
        row.ownerNetPayoutAmount != null
      ) {
        pass('admin payments financial breakdown');
      } else {
        fail('admin breakdown', JSON.stringify(row));
      }
    } else {
      fail('admin payment list', 'succeeded payment not listed');
    }
    const blob = JSON.stringify(r.json.data).toLowerCase();
    const forbidden = ['cardnumber', 'cvv', 'pan', 'secret', 'token'];
    const leaks = forbidden.filter((k) => blob.includes(k));
    if (leaks.length === 0) pass('admin payments no card/secrets in payload');
    else fail('admin payments sensitive', leaks.join(', '));
  } else {
    fail('admin GET /admin/payments', `status ${r.status}`);
  }

  await login(CUSTOMER);
  r = await api('GET', '/admin/payments');
  if (r.status === 403) pass('customer GET /admin/payments → 403');
  else fail('customer admin payments', `status ${r.status}`);

  await login(OWNER);
  r = await api('GET', '/admin/payments');
  if (r.status === 403) pass('owner GET /admin/payments → 403');
  else fail('owner admin payments', `status ${r.status}`);

  r = await api('GET', '/owner/bookings');
  if (r.status === 200 && Array.isArray(r.json.data) && r.json.data.length > 0) {
    pass('owner GET /owner/bookings');
    const row = r.json.data[0];
    const extra = ['provider', 'providerRef', 'events', 'idempotencyKey'].filter((k) => k in row);
    if (extra.length === 0) pass('owner bookings omit payment provider/events');
    else fail('owner bookings leak', extra.join(', '));
    if ('paymentStatus' in row && 'totalAmount' in row && 'ownerNetPayoutAmount' in row) {
      pass('owner bookings show paymentStatus + payout fields');
    } else fail('owner payment fields', Object.keys(row).join(', '));
  } else {
    fail('owner bookings', `status ${r.status}`);
  }

  // Phase 6B — provider readiness
  r = await api('GET', '/payments/config', null, false);
  if (r.status === 200 && r.json.data?.provider === 'test' && r.json.data?.simulateEnabled === true) {
    pass('GET /payments/config (test + simulate)');
  } else {
    fail('GET /payments/config', JSON.stringify(r.json));
  }

  r = await api('POST', '/payments/webhooks/unknown-provider', { ok: true }, false);
  if (r.status === 400 && r.json.code === 'UNKNOWN_PROVIDER') {
    pass('webhook unknown provider → 400');
  } else {
    fail('webhook unknown', `status ${r.status} code ${r.json.code}`);
  }

  r = await api('POST', '/payments/webhooks/cliq', { event: 'test' }, false);
  if (r.status === 501 && r.json.code === 'NOT_IMPLEMENTED') {
    pass('webhook cliq → 501 NOT_IMPLEMENTED');
  } else {
    fail('webhook cliq', `status ${r.status}`);
  }

  r = await api('POST', '/payments/webhooks/card_gateway', {}, false);
  if (r.status === 501) pass('webhook card_gateway → 501');
  else fail('webhook card_gateway', `status ${r.status}`);

  r = await api('POST', '/payments/webhooks/test', { ping: true }, false);
  if (r.status === 200 && r.json.data?.handled === true) pass('webhook test → 200 ack');
  else fail('webhook test', `status ${r.status}`);

  r = await api('POST', '/internal/payments/expire-stale', null, false);
  if (r.status === 200) pass('internal expire-stale available on QA server');
  else if (r.status === 403) fail('internal routes', 'ENABLE_INTERNAL_QA_ROUTES missing on QA API');
  else fail('internal expire-stale', `status ${r.status}`);

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n--- ${passed} passed, ${failed} failed ---`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
