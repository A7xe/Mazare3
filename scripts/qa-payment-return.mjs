/**
 * Targeted PayTabs return-page BFF checks (no PayTabs transactions).
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = resolve(ROOT, 'apps/web');
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://127.0.0.1:3000';
const API_BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const PUBLIC_WEB_TUNNEL =
  process.env.PUBLIC_WEB_TUNNEL ??
  'https://developer-columbus-advertisements-rat.trycloudflare.com';
const PAYMENT_ID = 'cmsx31gzg000juv5o3s2cuz58';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

let passed = 0;
let failed = 0;
function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${String(detail).slice(0, 240)}`);
}

function read(rel) {
  return readFileSync(resolve(WEB, rel), 'utf8');
}

async function login(creds) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(creds),
  });
  const cookies = res.headers.getSetCookie?.() ?? [];
  return cookies.map((c) => c.split(';')[0]).join('; ');
}

async function bff(path, cookie, method = 'GET') {
  const res = await fetch(`${WEB_ORIGIN}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

const returnView = read('src/components/checkout/checkout-return-view.tsx');
const returnClient = read('src/lib/api-payment-return.ts');
if (
  returnView.includes('fetchPaymentReturnStatus') &&
  returnView.includes('acknowledgePaymentReturn') &&
  returnClient.includes('/api/payment-return/') &&
  !returnView.includes('getApiBaseUrl') &&
  !returnClient.includes('getApiBaseUrl') &&
  !returnView.includes('localhost:4000') &&
  !returnClient.includes('localhost:4000') &&
  !returnView.includes('NEXT_PUBLIC_API_URL') &&
  !returnClient.includes('NEXT_PUBLIC_API_URL')
) {
  pass('Return page uses same-origin Web API');
  pass('Browser client never embeds localhost API URL');
} else {
  fail('Return page uses same-origin Web API', 'client still references API origin');
}

const customerCookie = await login(CUSTOMER);
const own = await bff(`/api/payment-return/${PAYMENT_ID}`, customerCookie);
if (own.status === 200 && own.json.data?.id === PAYMENT_ID && own.json.data?.status) {
  pass('Authenticated customer can read own payment status');
} else fail('Authenticated customer can read own payment status', JSON.stringify(own));

const ownerCookie = await login(OWNER);
const other = await bff(`/api/payment-return/${PAYMENT_ID}`, ownerCookie);
if (other.status === 401 || other.status === 403) {
  pass('Another principal cannot read the payment');
} else fail('Another principal cannot read the payment', JSON.stringify(other));

const anon = await bff(`/api/payment-return/${PAYMENT_ID}`, '');
if (anon.status === 401) pass('Unauthenticated return status is rejected');
else fail('Unauthenticated return status is rejected', JSON.stringify(anon));

const before = await fetch(`${API_BASE}/payments/${PAYMENT_ID}`, {
  headers: { Cookie: customerCookie },
});
const beforeJson = await before.json();
const beforeStatus = beforeJson.data?.status;
const ack = await bff(`/api/payment-return/${PAYMENT_ID}/ack`, customerCookie, 'POST');
const after = await fetch(`${API_BASE}/payments/${PAYMENT_ID}`, {
  headers: { Cookie: customerCookie },
});
const afterJson = await after.json();
if (
  ack.status === 200 &&
  beforeStatus === 'succeeded' &&
  afterJson.data?.status === 'succeeded'
) {
  pass('Return route cannot finalize payment');
} else {
  fail(
    'Return route cannot finalize payment',
    JSON.stringify({ ack: ack.status, beforeStatus, after: afterJson.data?.status }),
  );
}

const bookingId = own.json.data?.bookingId;
if (bookingId) {
  try {
    const tunnelRes = await fetch(`${PUBLIC_WEB_TUNNEL}/api/payment-return/${PAYMENT_ID}`, {
      headers: { Cookie: customerCookie, Accept: 'application/json' },
    });
    const tunnelJson = await tunnelRes.json().catch(() => ({}));
    if (tunnelRes.status === 200 && tunnelJson.data?.id === PAYMENT_ID) {
      pass('Public tunnel BFF returns own payment status');
    } else {
      fail(
        'Public tunnel BFF returns own payment status',
        JSON.stringify({ status: tunnelRes.status, body: tunnelJson }),
      );
    }

    const { chromium } = await import('@playwright/test');
    const sessionPart = customerCookie
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith('mazare3_session='));
    const sessionValue = sessionPart?.slice('mazare3_session='.length);
    const tunnelHost = new URL(PUBLIC_WEB_TUNNEL).hostname;
    const browser = await chromium.launch();
    const context = await browser.newContext();
    if (sessionValue) {
      await context.addCookies([
        {
          name: 'mazare3_session',
          value: sessionValue,
          domain: tunnelHost,
          path: '/',
          httpOnly: true,
          secure: true,
          sameSite: 'Lax',
        },
      ]);
    }
    const page = await context.newPage();
    const browserUrls = [];
    page.on('request', (req) => browserUrls.push(req.url()));
    await page.goto(
      `${PUBLIC_WEB_TUNNEL}/ar/checkout/${bookingId}/return?paymentId=${PAYMENT_ID}`,
      { waitUntil: 'domcontentloaded', timeout: 45_000 },
    );
    await page.waitForSelector('[data-testid="checkout-return-status"]', { timeout: 20_000 });
    await page.waitForSelector('[data-testid="checkout-return-status"][data-status="succeeded"]', {
      timeout: 20_000,
    });
    const status = await page.getAttribute('[data-testid="checkout-return-status"]', 'data-status');
    await page.waitForTimeout(800);
    const bad = browserUrls.filter(
      (u) =>
        u.includes('localhost:4000') ||
        u.includes('127.0.0.1:4000') ||
        /https:\/\/[^/]*trycloudflare\.com\/api\/v1\//.test(u),
    );
    const sameOrigin = browserUrls.filter((u) => u.includes('/api/payment-return/'));
    await browser.close();
    if (sameOrigin.length > 0 && bad.length === 0) {
      pass('Public tunnel browser uses same-origin BFF (no localhost API)');
    } else {
      fail(
        'Public tunnel browser uses same-origin BFF (no localhost API)',
        JSON.stringify({ sameOrigin: sameOrigin.length, bad: bad.slice(0, 8) }),
      );
    }
    if (status === 'succeeded') pass('Succeeded payment renders success on public tunnel');
    else fail('Succeeded payment renders success on public tunnel', `data-status=${status}`);
  } catch (err) {
    fail('Public tunnel browser check', err instanceof Error ? err.message : err);
  }
} else {
  fail('Public tunnel browser check', 'bookingId missing from BFF payload');
}

console.log(`\n📊 Payment return BFF ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
