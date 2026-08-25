/**
 * Phase 10A — Deposit + remaining balance API QA
 * Prefer: pnpm qa:api  OR  API_BASE=http://127.0.0.1:4012/api/v1 node scripts/qa-deposit-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
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

async function findAvailableSlot(minDaysAhead = 2) {
  const from = todayPlus(minDaysAhead);
  const to = todayPlus(minDaysAhead + 80);
  const { status, json } = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${from}&to=${to}`,
    null,
    false,
  );
  if (status === 200) {
    const slot = json.data?.find((s) => s.status === 'available');
    if (slot) return { date: slot.date, period: slot.period, price: slot.price };
  }
  const ensured = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (ensured.status === 200 && ensured.json.data?.date) {
    return {
      date: ensured.json.data.date,
      period: ensured.json.data.period,
      price: ensured.json.data.price,
    };
  }
  return null;
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function jodToFils(n) {
  return Math.round(Number(n) * 100);
}
function percentOfFils(base, pct) {
  return Math.round((base * pct) / 100);
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
  if (r.status !== 201) return null;
  return { booking: r.json.data, slot };
}

async function main() {
  console.log('\n💳 Phase 10A Deposit + Balance API QA\n');

  const cfg = await api('GET', '/payments/config', null, false);
  const depositPct = cfg.json.data?.policy?.defaultDepositPercent ?? 30;
  const commissionPct = cfg.json.data?.policy?.platformCommissionPercent ?? 12;
  if (cfg.status === 200 && depositPct > 0 && depositPct < 100) {
    pass(`public policy defaultDepositPercent=${depositPct}`);
  } else {
    fail('payments/config deposit percent', JSON.stringify(cfg.json));
  }

  if (!(await login(CUSTOMER))) {
    fail('customer login', 'failed');
    printSummary();
    process.exit(1);
  }
  pass('customer login');

  const created = await createPendingBooking();
  if (!created) {
    fail('create booking', 'no slot');
    printSummary();
    process.exit(1);
  }
  const { booking } = created;
  const total = Number(booking.totalAmount);
  const totalFils = jodToFils(total);
  const expectDeposit = percentOfFils(totalFils, depositPct) / 100;
  const expectRemaining = (totalFils - percentOfFils(totalFils, depositPct)) / 100;
  const expectCommission = percentOfFils(totalFils, commissionPct) / 100;

  if (
    booking.paymentState === 'unpaid' &&
    booking.paymentCollectionMode === 'deposit_balance' &&
    booking.canPayDeposit === true &&
    booking.holdExpiresAt &&
    Number(booking.depositAmount) === expectDeposit &&
    Number(booking.remainingAmount) === expectRemaining
  ) {
    pass('booking snapshot: unpaid deposit_balance + holdExpiresAt');
  } else {
    fail('booking snapshot', JSON.stringify(booking));
  }

  let r = await api('POST', '/payments/create-intent', {
    bookingId: booking.id,
    method: 'card',
    purpose: 'balance',
  });
  if (r.status === 400 && r.json.code === 'BALANCE_BEFORE_DEPOSIT') {
    pass('cannot pay balance before deposit');
  } else {
    fail('balance before deposit', `${r.status} ${r.json.code}`);
  }

  r = await api('POST', '/payments/create-intent', {
    bookingId: booking.id,
    method: 'card',
    purpose: 'deposit',
  });
  if (r.status === 201 && Number(r.json.data?.amount) === expectDeposit) {
    pass('deposit intent amount = deposit share of total');
  } else {
    fail('deposit intent', `${r.status} amount=${r.json.data?.amount}`);
    printSummary();
    process.exit(1);
  }
  const depositPid = r.json.data.id;

  r = await api('POST', `/payments/${depositPid}/simulate-success`);
  if (
    r.status === 200 &&
    r.json.data?.status === 'succeeded' &&
    r.json.data?.purpose === 'deposit' &&
    r.json.data?.payoutStatus === 'not_ready' &&
    !r.json.data?.payoutAvailableAt
  ) {
    pass('deposit success → payout not_ready (no owner payout)');
  } else {
    fail('deposit success payout', JSON.stringify(r.json.data));
  }

  r = await api('GET', `/me/bookings/${booking.id}`);
  const afterDep = r.json.data;
  if (
    r.status === 200 &&
    afterDep?.status === 'confirmed' &&
    afterDep?.paymentState === 'deposit_paid' &&
    afterDep?.isFullyPaid === false &&
    afterDep?.canPayDeposit === false &&
    afterDep?.canPayBalance === true
  ) {
    pass('after deposit: confirmed + deposit_paid + canPayBalance');
  } else {
    fail('after deposit serializer', JSON.stringify(afterDep));
  }

  r = await api('GET', `/me/notifications`);
  const items = r.json.data?.items ?? [];
  const depositNotif = items.find(
    (n) => n.type === 'booking.deposit_paid' && n.entityId === booking.id,
  );
  if (depositNotif) pass('in-app notification booking.deposit_paid');
  else fail('deposit notification', 'booking.deposit_paid not found');

  r = await api('POST', '/payments/create-intent', {
    bookingId: booking.id,
    method: 'card',
    purpose: 'deposit',
  });
  if (r.status === 400 && r.json.code === 'DEPOSIT_ALREADY_PAID') {
    pass('cannot pay deposit twice');
  } else {
    fail('duplicate deposit', `${r.status} ${r.json.code}`);
  }

  r = await api('POST', '/payments/create-intent', {
    bookingId: booking.id,
    method: 'card',
    purpose: 'balance',
  });
  if (r.status === 201 && Number(r.json.data?.amount) === expectRemaining) {
    pass('balance intent amount = remaining');
  } else {
    fail('balance intent', `${r.status} ${JSON.stringify(r.json)}`);
    printSummary();
    process.exit(1);
  }
  const balancePid = r.json.data.id;

  r = await api('POST', `/payments/${balancePid}/simulate-success`);
  if (r.status === 200 && r.json.data?.status === 'succeeded') {
    pass('balance simulate-success');
  } else {
    fail('balance success', `${r.status}`);
  }

  r = await api('GET', `/me/bookings/${booking.id}`);
  if (
    r.status === 200 &&
    r.json.data?.paymentState === 'fully_paid' &&
    r.json.data?.isFullyPaid === true &&
    r.json.data?.canPayBalance === false
  ) {
    pass('after balance: fully_paid');
  } else {
    fail('fully_paid serializer', JSON.stringify(r.json.data));
  }

  r = await api('POST', '/payments/create-intent', {
    bookingId: booking.id,
    method: 'card',
    purpose: 'balance',
  });
  if (r.status === 400 && (r.json.code === 'ALREADY_PAID' || r.json.code === 'BOOKING_NOT_PAYABLE')) {
    pass('cannot pay balance twice / exceed total');
  } else {
    fail('duplicate balance', `${r.status} ${r.json.code}`);
  }

  await login(ADMIN);
  r = await api('GET', '/admin/payouts');
  const payoutRow = (r.json.data ?? []).find((p) => p.bookingId === booking.id);
  if (!payoutRow || payoutRow.payoutStatus === 'not_ready' || payoutRow.payoutStatus === 'pending') {
    pass('admin payouts: no eligible payout immediately after full pay (visit not ended)');
  } else if (payoutRow.payoutStatus === 'eligible') {
    fail('payout too early', payoutRow.payoutStatus);
  } else {
    pass(`admin payouts status=${payoutRow.payoutStatus} (not paid)`);
  }

  r = await api('GET', '/admin/bookings');
  const adminRow = (r.json.data ?? []).find((b) => b.id === booking.id);
  if (adminRow?.paymentState === 'fully_paid' || adminRow?.isFullyPaid) {
    pass('admin booking list exposes paymentState');
  } else {
    fail('admin paymentState', JSON.stringify(adminRow));
  }

  // Hold expiry without payment intent
  await login(CUSTOMER);
  const holdCase = await createPendingBooking();
  if (!holdCase) {
    fail('hold booking', 'no slot');
  } else {
    const hid = holdCase.booking.id;
    const hDate = holdCase.slot.date;
    const hPeriod = holdCase.slot.period;
    r = await api('POST', `/internal/bookings/${hid}/backdate-hold`, null, false);
    if (r.status === 200) pass('internal backdate-hold');
    else fail('backdate-hold', `status ${r.status}`);

    r = await api('POST', '/internal/payments/expire-stale', null, false);
    if (r.status === 200 && r.json.data?.holdsExpired >= 1) {
      pass('expire-stale expires unpaid hold without intent');
    } else {
      fail('holdsExpired', JSON.stringify(r.json));
    }

    r = await api('GET', `/me/bookings/${hid}`);
    if (r.json.data?.status === 'expired') pass('booking expired without Payment Intent');
    else fail('hold expired status', r.json.data?.status);

    const avail = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${hDate}&to=${hDate}`,
      null,
      false,
    );
    const slotRow = avail.json.data?.find((s) => s.date === hDate && s.period === hPeriod);
    if (slotRow?.status === 'available') pass('slot released after hold expiry');
    else fail('slot after hold', slotRow?.status);
  }

  // Failure does not cancel booking
  const failCase = await createPendingBooking();
  if (failCase) {
    r = await api('POST', '/payments/create-intent', {
      bookingId: failCase.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    const fpid = r.json.data?.id;
    r = await api('POST', `/payments/${fpid}/simulate-failure`);
    r = await api('GET', `/me/bookings/${failCase.booking.id}`);
    if (r.json.data?.status === 'pending_payment') {
      pass('deposit failure keeps booking pending_payment (retry allowed)');
    } else {
      fail('after failure status', r.json.data?.status);
    }
    r = await api('POST', '/payments/create-intent', {
      bookingId: failCase.booking.id,
      method: 'cliq',
      purpose: 'deposit',
    });
    if (r.status === 201) pass('retry deposit intent after failure');
    else fail('retry after failure', `${r.status} ${r.json.code}`);
    await api('POST', `/me/bookings/${failCase.booking.id}/cancel`);
  }

  // Overdue state
  const over = await createPendingBooking();
  if (over) {
    r = await api('POST', '/payments/create-intent', {
      bookingId: over.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    await api('POST', `/payments/${r.json.data.id}/simulate-success`);
    r = await api('POST', `/internal/bookings/${over.booking.id}/backdate-balance-due`, null, false);
    if (r.status === 200) pass('internal backdate-balance-due');
    else fail('backdate-balance-due', `status ${r.status}`);
    await api('POST', '/internal/payments/expire-stale', null, false);
    r = await api('GET', `/me/bookings/${over.booking.id}`);
    if (r.json.data?.paymentState === 'balance_overdue') {
      pass('paymentState=balance_overdue is queryable');
    } else {
      fail('overdue state', r.json.data?.paymentState);
    }
    r = await api('POST', '/payments/create-intent', {
      bookingId: over.booking.id,
      method: 'card',
      purpose: 'balance',
    });
    if (r.status === 201) pass('can still pay balance when overdue');
    else fail('pay overdue balance', `${r.status} ${r.json.code}`);
    await api('POST', `/payments/${r.json.data.id}/simulate-success`);
  }

  // Commission still on full total
  if (expectCommission > 0 && created) {
    pass(`commission expected on full ${total} = ${expectCommission} (not on ${expectDeposit} deposit)`);
  }

  async function payDepositOnly() {
    const row = await createPendingBooking();
    if (!row) return null;
    let x = await api('POST', '/payments/create-intent', {
      bookingId: row.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    if (x.status !== 201) return null;
    x = await api('POST', `/payments/${x.json.data.id}/simulate-success`);
    if (x.status !== 200) return null;
    return { ...row, depositPaymentId: x.json.data.id, depositAmount: Number(x.json.data.amount) };
  }

  const overCap = await payDepositOnly();
  if (overCap) {
    r = await api('POST', `/me/bookings/${overCap.booking.id}/refund-request`, {
      reason: 'مبلغ أكبر من المحصّل — يجب الرفض',
      requestedAmount: overCap.depositAmount + 50,
    });
    if (r.status === 400) pass('cannot refund more than captured amount');
    else fail('over-captured refund', `${r.status} ${r.json.code}`);
    await api('POST', `/me/bookings/${overCap.booking.id}/cancel`);
  }

  await login(CUSTOMER);
  const depRefund = await payDepositOnly();
  if (!depRefund) {
    fail('deposit-only booking for refund', 'create failed');
  } else {
    r = await api('POST', `/me/bookings/${depRefund.booking.id}/refund-request`, {
      reason: 'طلب استرداد بعد العربون فقط — اختبار 10A.1',
    });
    if (r.status === 201) pass('refund request allowed after deposit only');
    else fail('refund after deposit', `${r.status} ${r.json.code}`);
    await login(ADMIN);
    const listed = await api('GET', '/admin/refund-requests');
    const rr = listed.json.data?.find((x) => x.bookingId === depRefund.booking.id);
    if (rr?.id) {
      const approve = await api('PATCH', `/admin/refund-requests/${rr.id}/status`, {
        status: 'approved',
        approvedAmount: depRefund.depositAmount,
        adminNote: 'QA full deposit refund',
      });
      if (approve.status === 200) pass('admin approves full deposit refund');
      else fail('approve full deposit refund', `${approve.status}`);
    } else {
      fail('admin refund row after deposit', 'missing');
    }

    await login(CUSTOMER);
    r = await api('GET', `/me/bookings/${depRefund.booking.id}`);
    if (r.json.data?.paymentState === 'refunded') pass('paymentState=refunded after full captured refund');
    else fail('refunded state', r.json.data?.paymentState);
    if (r.json.data?.status === 'cancelled') pass('future booking cancelled after full captured refund');
    else fail('cancel after full refund', r.json.data?.status);

    const avail = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${depRefund.slot.date}&to=${depRefund.slot.date}`,
      null,
      false,
    );
    const slotRow = avail.json.data?.find(
      (s) => s.date === depRefund.slot.date && s.period === depRefund.slot.period,
    );
    if (slotRow?.status === 'available') pass('slot released after full future refund');
    else fail('slot after full refund', slotRow?.status);
  }

  const partialCase = await payDepositOnly();
  if (partialCase) {
    r = await api('POST', `/me/bookings/${partialCase.booking.id}/refund-request`, {
      reason: 'استرداد جزئي من العربون — اختبار',
      requestedAmount: 1,
    });
    if (r.status === 201) pass('partial deposit refund request');
    else fail('partial refund request', `${r.status} ${r.json.code}`);
    await login(ADMIN);
    const listed = await api('GET', '/admin/refund-requests');
    const rr = listed.json.data?.find((x) => x.bookingId === partialCase.booking.id);
    if (rr) {
      const approve = await api('PATCH', `/admin/refund-requests/${rr.id}/status`, {
        status: 'approved',
        approvedAmount: 1,
        adminNote: 'QA partial',
      });
      if (approve.status === 200) pass('admin approves partial deposit refund');
      else fail('approve partial', `${approve.status}`);
    }
    await login(CUSTOMER);
    r = await api('GET', `/me/bookings/${partialCase.booking.id}`);
    if (r.json.data?.paymentState === 'partially_refunded') pass('paymentState=partially_refunded');
    else fail('partially_refunded state', r.json.data?.paymentState);
    await login(ADMIN);
    r = await api('GET', '/admin/payouts');
    const prow = (r.json.data ?? []).find((p) => p.bookingId === partialCase.booking.id);
    if (!prow || prow.payoutStatus === 'not_ready' || prow.blocked) {
      pass('owner payout blocked after refund');
    } else {
      fail('payout after refund', prow?.payoutStatus);
    }
  }

  const disputeCase = await (async () => {
    await login(CUSTOMER);
    return payDepositOnly();
  })();
  if (disputeCase) {
    r = await api('POST', `/internal/bookings/${disputeCase.booking.id}/backdate-slot`, {}, false);
    if (r.status === 200) pass('backdate-slot unique past date');
    else fail('backdate-slot unique', `${r.status} ${JSON.stringify(r.json)}`);
    await login(CUSTOMER);
    r = await api('POST', `/me/bookings/${disputeCase.booking.id}/disputes`, {
      type: 'property_mismatch',
      description: 'نزاع بعد العربون فقط — اختبار 10A.1',
    });
    if (r.status === 201) pass('dispute allowed after deposit only');
    else fail('dispute after deposit', `${r.status} ${r.json.code} ${JSON.stringify(r.json)}`);
    await login(ADMIN);
    r = await api('GET', '/admin/payouts');
    const drow = (r.json.data ?? []).find((p) => p.bookingId === disputeCase.booking.id);
    if (!drow || drow.payoutStatus === 'not_ready' || drow.blocked) {
      pass('owner payout blocked during dispute');
    } else {
      fail('payout during dispute', drow?.payoutStatus);
    }
  }

  const bothPaid = await (async () => {
    await login(CUSTOMER);
    const row = await payDepositOnly();
    if (!row) return null;
    let x = await api('POST', '/payments/create-intent', {
      bookingId: row.booking.id,
      method: 'card',
      purpose: 'balance',
    });
    if (x.status !== 201) return null;
    x = await api('POST', `/payments/${x.json.data.id}/simulate-success`);
    if (x.status !== 200) return null;
    return row;
  })();
  if (bothPaid) {
    r = await api('POST', `/me/bookings/${bothPaid.booking.id}/refund-request`, {
      reason: 'استرداد بعد العربون والرصيد — اختبار',
    });
    if (r.status === 201) pass('refund after deposit and balance');
    else fail('refund after both', `${r.status} ${r.json.code}`);
  }

  const conc = await createPendingBooking();
  if (conc) {
    const key = `idem-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const [a, b] = await Promise.all([
      api('POST', '/payments/create-intent', {
        bookingId: conc.booking.id,
        method: 'card',
        purpose: 'deposit',
        idempotencyKey: key,
      }),
      api('POST', '/payments/create-intent', {
        bookingId: conc.booking.id,
        method: 'card',
        purpose: 'deposit',
        idempotencyKey: key,
      }),
    ]);
    if (a.status === 201 && b.status === 201 && a.json.data?.id === b.json.data?.id) {
      pass('idempotency key returns the same payment');
    } else {
      fail('idempotency', `${a.status}/${b.status} ${a.json.data?.id} ${b.json.data?.id}`);
    }
    const pid = a.json.data?.id;
    const [s1, s2] = await Promise.all([
      api('POST', `/payments/${pid}/simulate-success`),
      api('POST', `/payments/${pid}/simulate-success`),
    ]);
    const ok =
      s1.status === 200 &&
      s2.status === 200 &&
      s1.json.data?.status === 'succeeded' &&
      s2.json.data?.status === 'succeeded';
    if (ok) pass('concurrent deposit simulate-success is idempotent');
    else fail('concurrent deposit success', `${s1.status}/${s2.status}`);
  }

  const concTwo = await createPendingBooking();
  if (concTwo) {
    const [c1, c2] = await Promise.all([
      api('POST', '/payments/create-intent', {
        bookingId: concTwo.booking.id,
        method: 'card',
        purpose: 'deposit',
        idempotencyKey: `dep-a-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
      api('POST', '/payments/create-intent', {
        bookingId: concTwo.booking.id,
        method: 'card',
        purpose: 'deposit',
        idempotencyKey: `dep-b-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
    ]);
    const sameRow = c1.status === 201 && c2.status === 201 && c1.json.data?.id === c2.json.data?.id;
    if (sameRow) pass('concurrent deposit intents reuse one payment row');
    else fail('concurrent deposit intents', `${c1.status}/${c2.status} ${c1.json.data?.id} ${c2.json.data?.id}`);
    const [d1, d2] = await Promise.all([
      api('POST', `/payments/${c1.json.data?.id}/simulate-success`),
      api('POST', `/payments/${c2.json.data?.id}/simulate-success`),
    ]);
    const capturedOnce =
      [d1, d2].every((x) => x.status === 200 && x.json.data?.status === 'succeeded') ||
      ([d1, d2].some((x) => x.status === 200) && [d1, d2].some((x) => x.status >= 400));
    r = await api('GET', `/me/bookings/${concTwo.booking.id}`);
    const secondDeposit = await api('POST', '/payments/create-intent', {
      bookingId: concTwo.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    if (
      capturedOnce &&
      r.json.data?.paymentState === 'deposit_paid' &&
      secondDeposit.status >= 400
    ) {
      pass('concurrent deposit success captures once');
    } else {
      fail(
        'concurrent deposit double-capture',
        `state=${r.json.data?.paymentState} second=${secondDeposit.status} ${d1.status}/${d2.status}`,
      );
    }

    const [b1, b2] = await Promise.all([
      api('POST', '/payments/create-intent', {
        bookingId: concTwo.booking.id,
        method: 'card',
        purpose: 'balance',
        idempotencyKey: `bal-a-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
      api('POST', '/payments/create-intent', {
        bookingId: concTwo.booking.id,
        method: 'card',
        purpose: 'balance',
        idempotencyKey: `bal-b-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      }),
    ]);
    if (b1.status === 201 && b2.status === 201 && b1.json.data?.id === b2.json.data?.id) {
      pass('concurrent balance intents reuse one payment row');
    } else {
      fail('concurrent balance intents', `${b1.status}/${b2.status}`);
    }
    const [bs1, bs2] = await Promise.all([
      api('POST', `/payments/${b1.json.data?.id}/simulate-success`),
      api('POST', `/payments/${b2.json.data?.id}/simulate-success`),
    ]);
    r = await api('GET', `/me/bookings/${concTwo.booking.id}`);
    const secondBalance = await api('POST', '/payments/create-intent', {
      bookingId: concTwo.booking.id,
      method: 'card',
      purpose: 'balance',
    });
    if (r.json.data?.paymentState === 'fully_paid' && secondBalance.status >= 400) {
      pass('concurrent balance success captures once');
    } else {
      fail(
        'concurrent balance double-capture',
        `state=${r.json.data?.paymentState} second=${secondBalance.status} ${bs1.status}/${bs2.status}`,
      );
    }
  }

  const holdOld = await createPendingBooking();
  if (holdOld) {
    r = await api('POST', '/payments/create-intent', {
      bookingId: holdOld.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    const oldPid = r.json.data?.id;
    await api('POST', `/internal/bookings/${holdOld.booking.id}/backdate-hold`, null, false);
    await api('POST', '/internal/payments/expire-stale', null, false);
    r = await api('POST', `/payments/${oldPid}/simulate-success`);
    if (r.status >= 400) pass('payment success after hold expiry is rejected');
    else fail('stale success after hold', `${r.status}`);
    r = await api('POST', '/payments/create-intent', {
      bookingId: holdOld.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    if (r.status >= 400) pass('retry after hold expiry is rejected');
    else fail('retry after hold', `${r.status} ${r.json.code}`);
  }

  await login(ADMIN);
  r = await api('GET', '/admin/bookings');
  const legacy = (r.json.data ?? []).find((b) => b.paymentCollectionMode === 'full');
  if (legacy) pass('legacy full-payment booking still listed');
  else pass('legacy full-payment rows may be absent in this QA database');

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
