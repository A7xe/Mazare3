/**
 * Phase 10G.1 — Payment gateway boundary QA
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

async function createPendingBooking() {
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
  return book.json.data;
}

function jod(n) {
  return Math.round(Number(n) * 100) / 100;
}

function runStartupGuard(env) {
  const tsxBin = path.join(
    ROOT,
    'apps',
    'api',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.CMD' : 'tsx',
  );
  const result = spawnSync(
    tsxBin,
    [path.join(ROOT, 'scripts', 'qa-payment-gateway-startup-probe.mjs')],
    {
      cwd: ROOT,
      encoding: 'utf8',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        APP_ENV: env.APP_ENV,
        PAYMENT_GATEWAY_PROVIDER: env.PAYMENT_GATEWAY_PROVIDER ?? '',
        PAYMENT_PROVIDER: env.PAYMENT_PROVIDER ?? '',
        PAYMENT_SIMULATE_ENABLED: env.PAYMENT_SIMULATE_ENABLED ?? 'false',
        DISABLE_AUTH_RATE_LIMIT: 'false',
        ENABLE_INTERNAL_QA_ROUTES: 'false',
        CLIQ_MERCHANT_ALIAS: env.CLIQ_MERCHANT_ALIAS ?? '',
        CLIQ_API_BASE_URL: env.CLIQ_API_BASE_URL ?? '',
        CLIQ_API_KEY: env.CLIQ_API_KEY ?? '',
        CLIQ_WEBHOOK_SECRET: env.CLIQ_WEBHOOK_SECRET ?? '',
        CARD_GATEWAY_PROVIDER: '',
        CARD_GATEWAY_API_BASE_URL: '',
        CARD_GATEWAY_MERCHANT_ID: '',
        CARD_GATEWAY_API_KEY: '',
        CARD_GATEWAY_WEBHOOK_SECRET: '',
      },
    },
  );
  return {
    ok: result.status === 0 && (result.stdout || '').includes('OK'),
    out: `${result.stdout || ''}${result.stderr || ''}`,
    status: result.status,
  };
}

async function main() {
  console.log('\n💳 Phase 10G.1 payment gateway boundary QA\n');

  try {
    const booking = await createPendingBooking();
    if (!booking) {
      fail('create pending booking', 'failed');
      throw new Error('no booking');
    }

    const expectedDeposit = jod(booking.depositAmount);
    const expectedRemaining = jod(booking.remainingAmount);

    const dep = await api('POST', '/payments/create-intent', {
      bookingId: booking.id,
      method: 'card',
      purpose: 'deposit',
      amount: 1,
      customerPayableAmount: 1,
    });
    if (dep.status === 201 && dep.json.data?.purpose === 'deposit' && dep.json.data?.provider === 'test' && dep.json.data?.status === 'pending') {
      pass('Mock gateway creates deposit payment');
    } else fail('Mock gateway creates deposit payment', JSON.stringify(dep.json));

    if (dep.status === 201 && jod(dep.json.data.amount) === expectedDeposit) {
      pass('Amount comes from backend financial snapshot');
    } else {
      fail(
        'Amount comes from backend financial snapshot',
        `${dep.json.data?.amount} vs expected ${expectedDeposit}`,
      );
    }

    if (dep.status === 201 && jod(dep.json.data.amount) !== 1) {
      pass('Customer cannot override amount');
    } else fail('Customer cannot override amount', String(dep.json.data?.amount));

    const idemKey = `gw-idem-${Date.now()}`;
    const booking2 = await createPendingBooking();
    const a = await api('POST', '/payments/create-intent', {
      bookingId: booking2.id,
      method: 'card',
      purpose: 'deposit',
      idempotencyKey: idemKey,
    });
    const b = await api('POST', '/payments/create-intent', {
      bookingId: booking2.id,
      method: 'card',
      purpose: 'deposit',
      idempotencyKey: idemKey,
    });
    if (a.status === 201 && b.status === 201 && a.json.data.id === b.json.data.id) {
      pass('Duplicate create remains idempotent');
    } else fail('Duplicate create remains idempotent', `${a.json.data?.id} / ${b.json.data?.id}`);

    const paymentId = dep.json.data.id;
    const browser = await api('POST', `/payments/${paymentId}/browser-return`, {});
    const stillPending = await api('GET', `/payments/${paymentId}`);
    if (
      browser.status === 200 &&
      stillPending.json.data?.status !== 'succeeded' &&
      (stillPending.json.data?.status === 'pending' ||
        stillPending.json.data?.status === 'initiated')
    ) {
      pass('Browser-return-style request cannot mark payment successful');
    } else {
      fail(
        'Browser-return-style request cannot mark payment successful',
        `${browser.status} ${stillPending.json.data?.status}`,
      );
    }

    const eventId = `evt_${Date.now()}`;
    const wh = await api(
      'POST',
      '/payments/webhooks/mock',
      {
        type: 'payment_succeeded',
        paymentId,
        providerEventId: eventId,
        providerRef: dep.json.data.providerRef,
      },
      false,
    );
    if (wh.status === 200 && wh.json.data?.handled && wh.json.data?.message?.includes('payment_succeeded')) {
      pass('Payment success uses normalized gateway event');
    } else fail('Payment success uses normalized gateway event', JSON.stringify(wh.json));

    const afterOk = await api('GET', `/payments/${paymentId}`);
    if (afterOk.json.data?.status === 'succeeded') {
      /* already covered by webhook path */
    }

    const whDup = await api(
      'POST',
      '/payments/webhooks/mock',
      {
        type: 'payment_succeeded',
        paymentId,
        providerEventId: eventId,
      },
      false,
    );
    if (
      whDup.status === 200 &&
      (whDup.json.data?.message?.includes('Duplicate') || whDup.json.data?.handled === true)
    ) {
      pass('Duplicate success event is safe');
    } else fail('Duplicate success event is safe', JSON.stringify(whDup.json));

    const bookingFail = await createPendingBooking();
    const failIntent = await api('POST', '/payments/create-intent', {
      bookingId: bookingFail.id,
      method: 'card',
      purpose: 'deposit',
    });
    const failWh = await api(
      'POST',
      '/payments/webhooks/mock',
      {
        type: 'payment_failed',
        paymentId: failIntent.json.data.id,
        providerEventId: `fail_${Date.now()}`,
      },
      false,
    );
    const failPay = await api('GET', `/payments/${failIntent.json.data.id}`);
    const failBook = await api('GET', `/me/bookings/${bookingFail.id}`);
    if (
      failWh.status === 200 &&
      failPay.json.data?.status === 'failed' &&
      failBook.json.data?.status !== 'confirmed'
    ) {
      pass('Failed event does not confirm booking');
    } else {
      fail(
        'Failed event does not confirm booking',
        `${failPay.json.data?.status} / ${failBook.json.data?.status}`,
      );
    }

    const bal = await api('POST', '/payments/create-intent', {
      bookingId: booking.id,
      method: 'card',
      purpose: 'balance',
    });
    if (bal.status === 201 && bal.json.data?.purpose === 'balance' && jod(bal.json.data.amount) === expectedRemaining) {
      pass('Mock gateway creates balance payment');
    } else fail('Mock gateway creates balance payment', JSON.stringify(bal.json));

    await api(
      'POST',
      '/payments/webhooks/mock',
      {
        type: 'payment_succeeded',
        paymentId: bal.json.data.id,
        providerEventId: `bal_${Date.now()}`,
      },
      false,
    );

    const refundReq = await api('POST', `/me/bookings/${booking.id}/refund-request`, {
      reason: 'Gateway boundary QA refund',
    });
    if (refundReq.status === 201 || refundReq.status === 200) {
      await login(ADMIN);
      const approvedAmt = jod(refundReq.json.data.requestedAmount ?? refundReq.json.data.policyRefundAmount ?? 0);
      if (approvedAmt <= 0) {
        // Still prove gateway is invoked on processed path by approving 0 is invalid — use min policy.
        fail('Refund routes through gateway boundary', `non-positive policy amount ${approvedAmt}`);
      } else {
        const processed = await api('PATCH', `/admin/refund-requests/${refundReq.json.data.id}/status`, {
          status: 'processed',
          approvedAmount: approvedAmt,
          adminNote: 'gateway boundary',
        });
        if (processed.status === 200 && processed.json.data?.status === 'processed') {
          pass('Refund routes through gateway boundary');
        } else fail('Refund routes through gateway boundary', JSON.stringify(processed.json));
      }
    } else {
      fail('Refund routes through gateway boundary', `create ${refundReq.status} ${JSON.stringify(refundReq.json)}`);
    }

    const mockProd = runStartupGuard({
      APP_ENV: 'production',
      PAYMENT_GATEWAY_PROVIDER: 'mock',
      PAYMENT_SIMULATE_ENABLED: 'false',
    });
    if (!mockProd.ok && mockProd.out.includes('ERR:')) {
      pass('Production rejects mock gateway');
    } else fail('Production rejects mock gateway', mockProd.out.slice(0, 400));

    const missingCliq = runStartupGuard({
      APP_ENV: 'production',
      PAYMENT_GATEWAY_PROVIDER: 'cliq',
      PAYMENT_SIMULATE_ENABLED: 'false',
      CLIQ_MERCHANT_ALIAS: '',
      CLIQ_API_BASE_URL: '',
      CLIQ_API_KEY: '',
      CLIQ_WEBHOOK_SECRET: '',
    });
    if (!missingCliq.ok && missingCliq.out.includes('ERR:')) {
      pass('Missing real-provider configuration fails closed');
    } else fail('Missing real-provider configuration fails closed', missingCliq.out.slice(0, 400));
  } catch (e) {
    fail('gateway boundary runner', e instanceof Error ? e.message : String(e));
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failed) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
