/**
 * Phase 9B — Email Notification Delivery Foundation QA
 * Requirements:
 * - EMAIL_PROVIDER=none should create NotificationDelivery rows with status=skipped
 * - No real email is sent (providers are placeholders)
 * - Missing provider config is handled safely
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '../packages/db/generated/client/index.js';
import { createEmailDeliveryLogForNotification } from '../apps/api/dist/services/email/notification-email-delivery.service.js';

// Minimal .env loader (avoid external dotenv dependency in this script).
function loadEnv() {
  const envPath = new URL('../.env', import.meta.url);
  const raw = readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnv();

const prisma = new PrismaClient({ log: ['error'] });

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';

const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

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

const SLUG = 'chalet-emerald-dead-sea';

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
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

function maskSecretLeaks(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return (
    lower.includes('smtp_pass') ||
    lower.includes('resend_api_key') ||
    lower.includes('sendgrid_api_key') ||
    lower.includes('smtp_password') ||
    lower.includes('api_key') ||
    lower.includes('secret')
  );
}

async function main() {
  console.log('\n📧 Phase 9B Email Delivery QA\n');

  // 1) Booking + payment success should create email deliveries with skipped status (EMAIL_PROVIDER=none).
  if (!(await login(CUSTOMER))) {
    fail('customer login', 'failed');
  } else {
    pass('customer login');
  }

  const slot = await findAvailableSlot();
  if (!slot) {
    fail('find available slot', 'none');
    printSummary();
    process.exit(1);
  }

  const bookingRes = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
  if (bookingRes.status !== 201) {
    fail('create booking', `status ${bookingRes.status}`);
    printSummary();
    process.exit(1);
  }
  const bookingId = bookingRes.json.data?.id;
  pass('booking created');

  const intentRes = await api('POST', '/payments/create-intent', {
    bookingId,
    method: 'card',
  });
  const paymentId = intentRes.json.data?.id;
  if (intentRes.status !== 201 || !paymentId) {
    fail('create payment intent', `status ${intentRes.status}`);
    printSummary();
    process.exit(1);
  }

  pass('payment intent created');
  const simRes = await api('POST', `/payments/${paymentId}/simulate-success`);
  if (simRes.status !== 200) {
    fail('simulate-success', `status ${simRes.status}`);
    printSummary();
    process.exit(1);
  }
  pass('payment succeeded (simulate)');

  const customer = await prisma.user.findUnique({
    where: { email: CUSTOMER.email },
    select: { id: true, email: true, locale: true },
  });
  if (!customer) {
    fail('customer exists in DB', 'missing user');
    printSummary();
    process.exit(1);
  }

  const deliveries = await prisma.notificationDelivery.findMany({
    where: {
      userId: customer.id,
      channel: 'email',
    },
    include: { notification: { select: { type: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const byType = new Map();
  for (const d of deliveries) {
    if (!d.notification) continue;
    const list = byType.get(d.notification.type) ?? [];
    list.push(d);
    byType.set(d.notification.type, list);
  }

  const paymentDelivery = (byType.get('payment.succeeded') ?? [])[0];
  const bookingDelivery = (byType.get('booking.confirmed') ?? [])[0];

  if (paymentDelivery?.status === 'skipped' && paymentDelivery.provider === 'none') {
    pass('payment.succeeded email delivery skipped (provider=none)');
  } else {
    fail(
      'payment.succeeded email delivery',
      JSON.stringify({
        status: paymentDelivery?.status,
        provider: paymentDelivery?.provider,
      }),
    );
  }

  if (bookingDelivery?.status === 'skipped' && bookingDelivery.provider === 'none') {
    pass('booking.confirmed email delivery skipped (provider=none)');
  } else {
    fail(
      'booking.confirmed email delivery',
      JSON.stringify({
        status: bookingDelivery?.status,
        provider: bookingDelivery?.provider,
      }),
    );
  }

  const anySecretsInErrors = deliveries.some((d) => maskSecretLeaks(d.errorMessage));
  if (!anySecretsInErrors) pass('delivery logs do not leak secrets (errors masked)');
  else fail('delivery logs leak secrets', 'errorMessage contains secret-like text');

  // 2) Missing provider config should be safe (no throw, status skipped).
  const notificationRow = await prisma.notification.create({
    data: {
      userId: customer.id,
      roleTarget: null,
      type: 'payment.succeeded',
      title: 'QA',
      message: 'QA',
      entityType: null,
      entityId: null,
      isRead: false,
    },
  });

  const notificationItem = {
    id: notificationRow.id,
    userId: notificationRow.userId,
    roleTarget: notificationRow.roleTarget,
    type: notificationRow.type,
    title: notificationRow.title,
    message: notificationRow.message,
    entityType: notificationRow.entityType,
    entityId: notificationRow.entityId,
    isRead: notificationRow.isRead,
    readAt: notificationRow.readAt?.toISOString() ?? null,
    createdAt: notificationRow.createdAt.toISOString(),
  };

  // Simulate misconfigured provider.
  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.EMAIL_FROM = '';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;

  try {
    await createEmailDeliveryLogForNotification({
      notification: notificationItem,
      templateId: 'payment_succeeded',
      vars: { publicCode: 'MZ-QA-EMAIL-MISCONFIG' },
    });

    const delivery = await prisma.notificationDelivery.findFirst({
      where: { notificationId: notificationRow.id, channel: 'email' },
    });

    if (delivery?.status === 'skipped') pass('misconfigured provider → delivery skipped safely');
    else fail('misconfigured provider delivery', JSON.stringify(delivery));

    const leaked = maskSecretLeaks(delivery?.errorMessage);
    if (!leaked) pass('misconfigured provider errors do not leak secrets');
    else fail('misconfigured provider leaked secrets', delivery?.errorMessage);
  } catch (err) {
    fail('misconfigured provider does not throw', String(err));
  }

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

function printSummary() {
  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.detail}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

