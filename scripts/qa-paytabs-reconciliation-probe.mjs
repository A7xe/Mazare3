/**
 * PayTabs reconciliation QA — mocked /payment/query only. No live PayTabs network.
 */
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '../packages/db/generated/client/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] == null) process.env[key] = value;
  }
}
loadEnv();

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const prisma = new PrismaClient({ log: ['error'] });

let cookieJar = '';
let passed = 0;
let failed = 0;
function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${String(detail).slice(0, 280)}`);
}

async function api(method, pathName, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookieJar = setCookie.map((c) => c.split(';')[0]).join('; ');
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function login(creds) {
  cookieJar = '';
  return (await api('POST', '/auth/login', creds, false)).status === 200;
}

async function createPendingBooking(extra = {}) {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount: 2,
    ...extra,
  });
  if (book.status !== 201) return null;
  return { booking: book.json.data, slot: slot.json.data };
}

async function createPaytabsPending(bookingId, purpose = 'deposit') {
  await login(CUSTOMER);
  const intent = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
    purpose,
  });
  const payment = intent.json.data;
  if (intent.status !== 201 || !payment?.id) return null;
  const ref = `TST_RECON_${payment.id.slice(-10)}`;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { provider: 'paytabs', providerRef: ref },
  });
  return { ...payment, providerRef: ref, amount: payment.amount, currency: payment.currency };
}

function queryStub(payment, status, overrides = {}) {
  return {
    status,
    providerRef: payment.providerRef,
    amount: payment.amount,
    currency: payment.currency ?? 'JOD',
    profileId: process.env.PAYTABS_PROFILE_ID || '12345',
    providerStatus: status === 'succeeded' ? 'A' : status === 'failed' ? 'D' : 'H',
    ...overrides,
  };
}

async function reconcile(paymentId, query) {
  return api('POST', `/internal/payments/${paymentId}/reconcile`, { query }, false);
}

function windowIso() {
  const startsAt = new Date();
  const endsAt = new Date();
  endsAt.setUTCDate(endsAt.getUTCDate() + 120);
  return { startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

async function paytabsWebhook(payment, status = 'A') {
  const profileId = process.env.PAYTABS_PROFILE_ID;
  const serverKey = process.env.PAYTABS_SERVER_KEY;
  const purpose = payment.purpose ?? 'deposit';
  const payload = {
    profile_id: Number(profileId) || profileId,
    tran_ref: payment.providerRef,
    cart_id: `mazare3_pay_${payment.id}_${purpose}`,
    payment_result: {
      response_status: status,
      transaction_time: new Date().toISOString(),
    },
  };
  const raw = JSON.stringify(payload);
  const sig = createHmac('sha256', serverKey).update(raw, 'utf8').digest('hex');
  const res = await fetch(`${BASE}/payments/webhooks/paytabs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Signature: sig },
    body: raw,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function main() {
  console.log('\n🔁 Phase 10G.2C-B PayTabs reconciliation QA\n');

  const returnView = readFileSync(
    resolve(ROOT, 'apps/web/src/components/checkout/checkout-return-view.tsx'),
    'utf8',
  );
  if (!returnView.includes('reconcile')) pass('Browser return does not trigger reconciliation');
  else fail('Browser return does not trigger reconciliation', 'checkout return references reconcile');

  const pending = await createPendingBooking();
  const pay1 = pending ? await createPaytabsPending(pending.booking.id) : null;
  if (!pay1) {
    fail('Local pending + PayTabs succeeded → finalized once', 'setup failed');
  } else {
    const r1 = await reconcile(pay1.id, queryStub(pay1, 'succeeded'));
    const row = await prisma.payment.findUnique({ where: { id: pay1.id } });
    const succeededEvents = await prisma.paymentEvent.count({
      where: { paymentId: pay1.id, action: 'payment.succeeded' },
    });
    if (r1.status === 200 && row?.status === 'succeeded' && succeededEvents === 1) {
      pass('Local pending + PayTabs succeeded → finalized once');
    } else fail('Local pending + PayTabs succeeded → finalized once', JSON.stringify({ status: r1.status, body: r1.json, pay: row?.status, events: succeededEvents }));

    const r2 = await reconcile(pay1.id, queryStub(pay1, 'succeeded'));
    const succeededEvents2 = await prisma.paymentEvent.count({
      where: { paymentId: pay1.id, action: 'payment.succeeded' },
    });
    if (r2.status === 200 && r2.json.data?.result === 'already_succeeded' && succeededEvents2 === 1) {
      pass('Reconcile twice → idempotent');
    } else fail('Reconcile twice → idempotent', JSON.stringify(r2.json));
  }

  const expCase = await createPendingBooking();
  const expPay = expCase ? await createPaytabsPending(expCase.booking.id) : null;
  if (expPay) {
    await api('POST', `/internal/bookings/${expCase.booking.id}/backdate-hold`, {}, false);
    await api('POST', '/internal/payments/expire-stale', {}, false);
    const rec = await reconcile(expPay.id, queryStub(expPay, 'succeeded'));
    const booking = await prisma.booking.findUnique({ where: { id: expCase.booking.id } });
    const pay = await prisma.payment.findUnique({ where: { id: expPay.id } });
    if (rec.status === 200 && pay?.status === 'succeeded' && booking?.status === 'confirmed') {
      pass('Local expired + PayTabs succeeded + slot free → safely recovered');
    } else fail('Local expired + PayTabs succeeded + slot free → safely recovered', JSON.stringify({ rec: rec.json, pay: pay?.status, booking: booking?.status }));
  }

  const occ = await createPendingBooking();
  const occPay = occ ? await createPaytabsPending(occ.booking.id) : null;
  if (occPay) {
    await api('POST', `/internal/bookings/${occ.booking.id}/backdate-hold`, {}, false);
    await api('POST', '/internal/payments/expire-stale', {}, false);
    await login(CUSTOMER);
    const other = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: occ.slot.date,
      period: occ.slot.period,
      guestsCount: 2,
    });
    const rec = await reconcile(occPay.id, queryStub(occPay, 'succeeded'));
    const original = await prisma.booking.findUnique({ where: { id: occ.booking.id } });
    if (
      rec.status === 409 &&
      rec.json.code === 'RECONCILE_NEEDS_REVIEW' &&
      original?.status !== 'confirmed' &&
      other.status === 201
    ) {
      pass('Expired + slot now occupied → no unsafe confirmation');
    } else fail('Expired + slot now occupied → no unsafe confirmation', JSON.stringify({ rec: rec.json, original: original?.status, other: other.status }));
  }

  const pend = await createPendingBooking();
  const pendPay = pend ? await createPaytabsPending(pend.booking.id) : null;
  if (pendPay) {
    const rec = await reconcile(pendPay.id, queryStub(pendPay, 'pending'));
    const row = await prisma.payment.findUnique({ where: { id: pendPay.id } });
    if (rec.status === 200 && rec.json.data?.result === 'pending' && row?.status === 'pending') {
      pass('PayTabs pending → no state change');
    } else fail('PayTabs pending → no state change', JSON.stringify({ rec: rec.json, status: row?.status }));
  }

  const failCase = await createPendingBooking();
  const failPay = failCase ? await createPaytabsPending(failCase.booking.id) : null;
  if (failPay) {
    const rec = await reconcile(failPay.id, queryStub(failPay, 'failed'));
    const row = await prisma.payment.findUnique({ where: { id: failPay.id } });
    if (rec.status === 200 && row?.status === 'failed') {
      pass('PayTabs failed → existing failure path');
    } else fail('PayTabs failed → existing failure path', JSON.stringify({ rec: rec.json, status: row?.status }));
  }

  if (pay1) {
    const rec = await reconcile(pay1.id, queryStub(pay1, 'succeeded'));
    if (rec.status === 200 && rec.json.data?.result === 'already_succeeded') {
      pass('Already succeeded → no-op');
    } else fail('Already succeeded → no-op', JSON.stringify(rec.json));
  }

  const mm = await createPendingBooking();
  const mmPay = mm ? await createPaytabsPending(mm.booking.id) : null;
  if (mmPay) {
    const recAmt = await reconcile(mmPay.id, queryStub(mmPay, 'succeeded', { amount: 0.01 }));
    const afterAmt = await prisma.payment.findUnique({ where: { id: mmPay.id } });
    if (recAmt.status === 409 && recAmt.json.code === 'RECONCILE_MISMATCH' && afterAmt?.status !== 'succeeded') {
      pass('Amount mismatch → fail closed');
    } else fail('Amount mismatch → fail closed', JSON.stringify(recAmt.json));

    const recCur = await reconcile(mmPay.id, queryStub(mmPay, 'succeeded', { currency: 'USD' }));
    const afterCur = await prisma.payment.findUnique({ where: { id: mmPay.id } });
    if (recCur.status === 409 && recCur.json.code === 'RECONCILE_MISMATCH' && afterCur?.status !== 'succeeded') {
      pass('Currency mismatch → fail closed');
    } else fail('Currency mismatch → fail closed', JSON.stringify(recCur.json));

    const recRef = await reconcile(mmPay.id, queryStub(mmPay, 'succeeded', { providerRef: 'WRONG_TRAN_REF' }));
    const afterRef = await prisma.payment.findUnique({ where: { id: mmPay.id } });
    if (recRef.status === 409 && recRef.json.code === 'RECONCILE_MISMATCH' && afterRef?.status !== 'succeeded') {
      pass('Wrong tran_ref → fail closed');
    } else fail('Wrong tran_ref → fail closed', JSON.stringify(recRef.json));
  }

  const cbFirst = await createPendingBooking();
  const cbPay = cbFirst ? await createPaytabsPending(cbFirst.booking.id) : null;
  if (cbPay && process.env.PAYTABS_SERVER_KEY) {
    const hook = await paytabsWebhook(cbPay, 'A');
    const afterHook = await prisma.payment.findUnique({ where: { id: cbPay.id } });
    const rec = await reconcile(cbPay.id, queryStub(cbPay, 'succeeded'));
    const succeededEvents = await prisma.paymentEvent.count({
      where: { paymentId: cbPay.id, action: 'payment.succeeded' },
    });
    if (
      hook.status === 200 &&
      afterHook?.status === 'succeeded' &&
      rec.json.data?.result === 'already_succeeded' &&
      succeededEvents === 1
    ) {
      pass('Callback then reconcile → no duplicate');
    } else fail('Callback then reconcile → no duplicate', JSON.stringify({ hook: hook.status, rec: rec.json, events: succeededEvents }));
  } else fail('Callback then reconcile → no duplicate', 'missing PayTabs test key or setup');

  const recFirst = await createPendingBooking();
  const recPay = recFirst ? await createPaytabsPending(recFirst.booking.id) : null;
  if (recPay && process.env.PAYTABS_SERVER_KEY) {
    await reconcile(recPay.id, queryStub(recPay, 'succeeded'));
    const hook = await paytabsWebhook(recPay, 'A');
    const succeededEvents = await prisma.paymentEvent.count({
      where: { paymentId: recPay.id, action: 'payment.succeeded' },
    });
    const row = await prisma.payment.findUnique({ where: { id: recPay.id } });
    if (hook.status === 200 && row?.status === 'succeeded' && succeededEvents === 1) {
      pass('Reconcile then callback → callback safely duplicate');
    } else fail('Reconcile then callback → callback safely duplicate', JSON.stringify({ hook: hook.json, events: succeededEvents }));
  } else fail('Reconcile then callback → callback safely duplicate', 'missing PayTabs test key or setup');

  await login(OWNER);
  const props = await api('GET', '/owner/properties');
  const property = (props.json.data ?? []).find((p) => p.slug === SLUG) ?? props.json.data?.[0];
  const code = `R${Date.now().toString(36).slice(-6).toUpperCase()}`;
  let couponOk = false;
  if (property?.id) {
    const created = await api('POST', `/owner/properties/${property.id}/coupons`, {
      code,
      discountType: 'percentage',
      discountValue: 10,
      maxUses: 5,
      maxUsesPerCustomer: 2,
      ...windowIso(),
    });
    if (created.status === 201) {
      await api('POST', `/owner/properties/${property.id}/coupons/${created.json.data.id}/activate`);
      couponOk = true;
    }
  }
  const couponBookSlot = couponOk
    ? await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false)
    : { status: 0, json: {} };
  let couponBook = null;
  if (couponOk && couponBookSlot.json.data?.date) {
    await login(CUSTOMER);
    const priced = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code,
      date: couponBookSlot.json.data.date,
      period: couponBookSlot.json.data.period,
    });
    const booked = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: couponBookSlot.json.data.date,
      period: couponBookSlot.json.data.period,
      guestsCount: 2,
      couponCode: code,
      expectedTotalAmount: priced.json.data?.finalPrice,
    });
    if (booked.status === 201) couponBook = { booking: booked.json.data };
  }
  const couponPay = couponBook ? await createPaytabsPending(couponBook.booking.id) : null;
  if (couponPay) {
    await reconcile(couponPay.id, queryStub(couponPay, 'succeeded'));
    await reconcile(couponPay.id, queryStub(couponPay, 'succeeded'));
    const redemptions = await prisma.couponRedemption.findMany({
      where: { bookingId: couponBook.booking.id },
    });
    if (redemptions.length === 1 && redemptions[0].status === 'redeemed') {
      pass('Deposit coupon redemption occurs once');
    } else fail('Deposit coupon redemption occurs once', JSON.stringify(redemptions.map((r) => r.status)));
  } else fail('Deposit coupon redemption occurs once', 'coupon booking setup failed');

  const balBook = await createPendingBooking();
  if (balBook) {
    await login(CUSTOMER);
    const dep = await api('POST', '/payments/create-intent', {
      bookingId: balBook.booking.id,
      method: 'card',
      purpose: 'deposit',
    });
    await api('POST', `/payments/${dep.json.data.id}/simulate-success`);
    const bal = await createPaytabsPending(balBook.booking.id, 'balance');
    if (bal) {
      await reconcile(bal.id, queryStub(bal, 'succeeded'));
      const booking1 = await prisma.booking.findUnique({ where: { id: balBook.booking.id } });
      const fully1 = booking1?.fullyPaidAt;
      await reconcile(bal.id, queryStub(bal, 'succeeded'));
      const booking2 = await prisma.booking.findUnique({ where: { id: balBook.booking.id } });
      const pay = await prisma.payment.findUnique({ where: { id: bal.id } });
      if (
        booking2?.paymentState === 'fully_paid' &&
        fully1 &&
        booking2.fullyPaidAt?.getTime() === fully1.getTime() &&
        pay?.payoutStatus &&
        pay.payoutStatus !== 'not_ready'
      ) {
        pass('Balance fully-paid transition occurs once');
        pass('Payout integrity remains correct');
      } else {
        fail('Balance fully-paid transition occurs once', JSON.stringify({ state: booking2?.paymentState, payout: pay?.payoutStatus }));
        fail('Payout integrity remains correct', JSON.stringify({ payout: pay?.payoutStatus }));
      }
    }
  }

  const pub = await fetch(`${BASE}/internal/payments/not-a-real-id/reconcile`, { method: 'POST' });
  await login(CUSTOMER);
  const asCustomer = await api('POST', `/admin/payments/${pay1?.id ?? 'x'}/reconcile`, {});
  const anonCookie = cookieJar;
  cookieJar = '';
  const anonAdmin = await api('POST', `/admin/payments/${pay1?.id ?? 'x'}/reconcile`, {}, false);
  const missingPublic = await api('POST', `/payments/${pay1?.id ?? 'x'}/reconcile`, {}, false);
  if (
    asCustomer.status === 403 &&
    (anonAdmin.status === 401 || anonAdmin.status === 403) &&
    missingPublic.status >= 400
  ) {
    pass('Unauthorized/public reconciliation rejected');
  } else fail('Unauthorized/public reconciliation rejected', JSON.stringify({ asCustomer: asCustomer.status, anonAdmin: anonAdmin.status, missingPublic: missingPublic.status, pub: pub.status }));
  cookieJar = anonCookie;

  console.log(`\n📊 PayTabs reconciliation ${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
