/**
 * Phase 6C — Refunds, disputes, owner payout operations QA
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

async function findAvailableSlot(min = 50, max = 80) {
  const from = todayPlus(min);
  const to = todayPlus(max);
  const { status, json } = await api(
    'GET',
    `/properties/${SLUG}/availability?from=${from}&to=${to}`,
    null,
    false,
  );
  if (status !== 200) return null;
  return json.data?.find((s) => s.status === 'available') ?? null;
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

async function createPaidBooking() {
  const slot = await findAvailableSlot();
  if (!slot) return null;
  let r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
  if (r.status !== 201) return null;
  const bookingId = r.json.data.id;
  r = await api('POST', '/payments/create-intent', { bookingId, method: 'manual_test' });
  if (r.status !== 201) return null;
  const paymentId = r.json.data.id;
  r = await api('POST', `/payments/${paymentId}/simulate-success`, {});
  if (r.status !== 200) return null;
  return { bookingId, paymentId, slot };
}

function printSummary() {
  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  • ${f.name}: ${f.detail}`);
  }
}

async function main() {
  console.log('\n📋 Phase 6C Operations API QA\n');

  if (!(await login(CUSTOMER))) {
    fail('customer login', 'failed');
    printSummary();
    process.exit(1);
  }
  pass('customer login');

  const paid = await createPaidBooking();
  if (!paid) {
    fail('create paid booking', 'failed');
    printSummary();
    process.exit(1);
  }
  pass('paid booking + simulate success');
  const { bookingId, paymentId } = paid;

  let r = await api('POST', `/me/bookings/${bookingId}/refund-request`, {
    reason: 'تغيير خطط السفر — طلب استرداد تجريبي للاختبار',
  });
  if (r.status !== 201) {
    fail('POST refund-request', `status ${r.status}`);
  } else {
    pass('POST /me/bookings/:id/refund-request');
    const policyAmt = r.json.data.policyRefundAmount;
    const requested = r.json.data.requestedAmount;
    if (typeof policyAmt !== 'number' || policyAmt < 0) {
      fail('policyRefundAmount', String(policyAmt));
    } else {
      pass('policyRefundAmount is numeric');
    }
    if (requested > policyAmt + 0.01) {
      fail('requestedAmount cap', `${requested} > ${policyAmt}`);
    } else {
      pass('requestedAmount within policy cap');
    }
  }

  r = await api('POST', `/me/bookings/${bookingId}/refund-request`, {
    reason: 'محاولة ثانية يجب أن ترفض',
  });
  if (r.status === 409) pass('duplicate refund request prevented');
  else fail('duplicate refund request', `status ${r.status}`);

  const refundId = (
    await api('GET', '/me/refund-requests')
  ).json.data?.[0]?.id;

  const otherBooking = await (async () => {
    if (!(await login(ADMIN))) return null;
    const br = await api('GET', '/admin/bookings');
    return (
      br.json.data?.find(
        (b) =>
          b.id !== bookingId &&
          b.status === 'confirmed' &&
          b.customerEmail !== CUSTOMER.email,
      )?.id ?? null
    );
  })();
  if (!(await login(CUSTOMER))) fail('customer re-login for isolation', 'failed');
  else if (otherBooking) {
    r = await api('POST', `/me/bookings/${otherBooking}/refund-request`, {
      reason: 'محاولة وصول لحجز غير مملوك — يجب أن تفشل',
    });
    if (r.status === 404) pass('customer cannot refund others booking');
    else fail('refund isolation', `status ${r.status}`);
  } else {
    if (!(await login(OWNER))) fail('owner login for isolation', 'failed');
    else {
      r = await api('POST', `/me/bookings/${bookingId}/refund-request`, {
        reason: 'مالك يحاول طلب استرداد على حجز عميل — يجب أن يفشل',
      });
      if (r.status === 404 || r.status === 403) pass('non-customer cannot refund booking');
      else fail('refund isolation', `status ${r.status}`);
    }
  }

  if (!(await login(ADMIN))) {
    fail('admin login', 'failed');
  } else {
    pass('admin login');
    r = await api('GET', '/admin/refund-requests');
    if (r.status !== 200) fail('admin list refunds', `status ${r.status}`);
    else {
      pass('admin GET /admin/refund-requests');
      const row = r.json.data?.find((x) => x.bookingId === bookingId);
      if (!row) fail('admin sees refund row', 'missing');
      else {
        pass('admin sees customer refund request');
        if (refundId) {
          r = await api('PATCH', `/admin/refund-requests/${refundId}/status`, {
            status: 'approved',
            adminNote: 'QA approve',
          });
          if (r.status === 200) pass('admin approves refund');
          else fail('admin approve refund', `status ${r.status}`);
        }
      }
    }
  }

  if (!(await login(CUSTOMER))) fail('customer re-login', 'failed');
  else {
    await api('POST', `/internal/bookings/${bookingId}/backdate-slot`, {
      date: '2020-06-15',
    });
    pass('QA backdate slot for dispute');
    r = await api('POST', `/me/bookings/${bookingId}/disputes`, {
      type: 'property_mismatch',
      description: 'الوصف لا يطابق ما ظهر في المنصة — اختبار QA',
    });
    if (r.status === 201) pass('POST dispute');
    else fail('POST dispute', `status ${r.status} ${JSON.stringify(r.json)}`);
  }

  if (!(await login(ADMIN))) fail('admin login 2', 'failed');
  else {
    r = await api('GET', '/admin/disputes');
    if (r.status === 200 && r.json.data?.some((d) => d.bookingId === bookingId)) {
      pass('admin lists dispute');
      const disputeId = r.json.data.find((d) => d.bookingId === bookingId).id;
      r = await api('PATCH', `/admin/disputes/${disputeId}/status`, {
        status: 'resolved',
        adminNote: 'QA resolved',
      });
      if (r.status === 200) pass('admin resolves dispute');
      else fail('admin resolve dispute', `status ${r.status}`);
    } else fail('admin dispute list', 'missing row');
  }

  const paid2 = await (async () => {
    if (!(await login(CUSTOMER))) return null;
    return createPaidBooking();
  })();
  if (!paid2) {
    fail('second paid booking for payout', 'failed');
  } else {
    pass('second paid booking for payout test');
    const { bookingId: b2, paymentId: p2 } = paid2;
    if (!(await login(ADMIN))) fail('admin for payout', 'failed');
    else {
      await api('POST', `/internal/payments/${p2}/backdate-payout-eligible`, {});
      r = await api('GET', '/admin/payouts');
      const row = r.json.data?.find((x) => x.paymentId === p2);
      if (!row) fail('admin payouts list', 'missing payment');
      else {
        pass('admin GET /admin/payouts');
        if (row.blocked) fail('payout not blocked before mark', row.blockedReason);
        else pass('eligible payout row not blocked (no open dispute/refund on b2)');
        r = await api('POST', `/admin/payouts/${p2}/mark-paid`, {
          manualReference: 'QA-MANUAL-REF-001',
        });
        if (r.status === 200 && r.json.data?.payoutStatus === 'paid') {
          pass('admin mark payout paid manually');
        } else fail('mark payout paid', `status ${r.status}`);
      }
    }

    const paid3 = await (async () => {
      if (!(await login(CUSTOMER))) return null;
      return createPaidBooking();
    })();
    if (paid3) {
      const { paymentId: p3 } = paid3;
      await api('POST', `/me/bookings/${paid3.bookingId}/refund-request`, {
        reason: 'حجز لاختبار حظر المستحقات — سبب واضح للاختبار',
      });
      if (!(await login(ADMIN))) fail('admin payout block check', 'login');
      else {
        await api('POST', `/internal/payments/${p3}/backdate-payout-eligible`, {});
        r = await api('GET', '/admin/payouts');
        const blocked = r.json.data?.find((x) => x.paymentId === p3);
        if (blocked?.blocked) pass('refund pending blocks owner payout');
        else fail('payout blocked by refund', JSON.stringify(blocked));
        r = await api('POST', `/admin/payouts/${p3}/mark-paid`, {
          manualReference: 'SHOULD-FAIL',
        });
        if (r.status === 409) pass('mark paid rejected when blocked');
        else fail('mark paid when blocked', `status ${r.status}`);
      }
    } else fail('paid booking for block test', 'failed');
  }

  if (!(await login(OWNER))) fail('owner login', 'failed');
  else {
    pass('owner login');
    r = await api('GET', '/owner/payouts');
    if (r.status !== 200) fail('owner GET /owner/payouts', `status ${r.status}`);
    else {
      pass('owner GET /owner/payouts');
      const raw = JSON.stringify(r.json);
      if (raw.includes('providerRef') || raw.includes('card')) {
        fail('owner payout no secrets', 'leaked provider fields');
      } else pass('owner payout summary without provider secrets');
    }
    r = await api('GET', '/admin/refund-requests');
    if (r.status === 403) pass('owner cannot access admin refunds');
    else fail('owner admin refunds RBAC', `status ${r.status}`);
  }

  r = await api('POST', '/auth/login', CUSTOMER, false);
  cookieJar = '';
  r = await api('GET', '/admin/payouts', null, false);
  if (r.status === 401) pass('guest GET admin payouts → 401');
  else fail('guest admin payouts', `status ${r.status}`);

  printSummary();
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
