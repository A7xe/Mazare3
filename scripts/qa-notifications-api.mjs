/**
 * Phase 9A — In-app notifications API QA
 * Prefer: API_BASE=http://localhost:4012/api/v1 node scripts/qa-notifications-api.mjs
 * Or: pnpm qa:notifications
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const SAMPLE_URL = 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800&q=80';

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

function printSummary() {
  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`   • ${f.name}: ${f.detail}`);
  }
}

async function main() {
  console.log('\n🔔 Phase 9A Notifications API QA\n');

  cookieJar = '';
  let r = await api('GET', '/me/notifications', null, false);
  if (r.status === 401) pass('guest GET /me/notifications → 401');
  else fail('guest GET /me/notifications → 401', `got ${r.status}`);

  if (!(await login(CUSTOMER))) {
    fail('customer login', 'failed');
    printSummary();
    process.exit(1);
  }
  pass('customer login');

  const slot = await findAvailableSlot();
  if (!slot) {
    fail('find available slot', 'none');
    printSummary();
    process.exit(1);
  }

  r = await api('POST', '/bookings', {
    propertySlug: SLUG,
    date: slot.date,
    period: slot.period,
    guestsCount: 4,
  });
  if (r.status !== 201) {
    fail('create booking', `status ${r.status}`);
    printSummary();
    process.exit(1);
  }
  const bookingId = r.json.data?.id;
  pass('booking created');

  r = await api('GET', '/me/notifications');
  const bookingNotif = r.json.data?.items?.find((n) => n.type === 'booking.created');
  if (r.status === 200 && bookingNotif) {
    pass('booking.created notification for customer');
  } else {
    fail('booking.created notification', JSON.stringify(r.json.data?.items?.map((n) => n.type)));
  }

  r = await api('POST', '/payments/create-intent', { bookingId, method: 'card' });
  const paymentId = r.json.data?.id;
  if (!paymentId) {
    fail('payment intent', `status ${r.status}`);
    printSummary();
    process.exit(1);
  }

  r = await api('POST', `/payments/${paymentId}/simulate-success`);
  if (r.status !== 200) {
    fail('simulate-success', `status ${r.status}`);
    printSummary();
    process.exit(1);
  }
  pass('payment succeeded');

  r = await api('GET', '/me/notifications');
  const payNotif = r.json.data?.items?.find((n) => n.type === 'payment.succeeded');
  const customerNotifId = payNotif?.id ?? bookingNotif?.id;
  if (payNotif) pass('payment.succeeded notification for customer');
  else fail('payment.succeeded notification', 'missing');

  if (customerNotifId) {
    await login(OWNER1);
    r = await api('PATCH', `/me/notifications/${customerNotifId}/read`);
    if (r.status === 403) pass('other user cannot read customer notification');
    else fail('customer isolation', `expected 403 got ${r.status}`);
  } else {
    fail('customer isolation', 'no notification id to test');
  }

  if (!(await login(ADMIN))) {
    fail('admin login', 'failed');
  } else {
    pass('admin login');
    r = await api('GET', '/me/notifications');
    if (r.status === 200) pass('admin GET /me/notifications');
    else fail('admin list notifications', `status ${r.status}`);
  }

  await login(OWNER1);
  pass('owner1 login');
  const props = await api('GET', '/owner/properties');
  let draft = props.json.data?.find(
    (p) => p.status === 'draft' || p.status === 'changes_requested',
  );
  if (!draft?.id) {
    const created = await api('POST', '/owner/properties', {
      type: 'chalet',
      titleAr: 'عقار اختبار إشعارات',
      titleEn: 'Notifications QA Property',
      descriptionAr: 'وصف تجريبي لعقار يستخدم في اختبار الإشعارات الداخلية فقط.',
      city: 'عمان',
      area: 'العبدلي',
      approximateAddress: 'عمان، الأردن',
      exactAddress: 'عمان، الأردن — عنوان داخلي للاختبار',
      basePrice: 150,
      capacity: 10,
    });
    if (created.status === 201 && created.json.data?.id) {
      draft = { id: created.json.data.id };
      pass('owner created draft property for QA');
    } else {
      fail('create draft property', `status ${created.status}`);
    }
  }
  if (draft?.id) {
    const propId = draft.id;
    const mediaList = await api('GET', `/owner/properties/${propId}`);
    const mediaCount = mediaList.json.data?.media?.length ?? 0;
    if (mediaCount < 1) {
      await api('POST', `/owner/properties/${propId}/media`, { url: SAMPLE_URL });
    }
    r = await api('POST', `/owner/properties/${propId}/submit-review`);
    if (r.status === 200) {
      pass('owner property submitted for review');
    } else {
      fail('submit-review', `status ${r.status} ${JSON.stringify(r.json)}`);
    }
  }

  await login(ADMIN);
  r = await api('GET', '/me/notifications');
  const reviewNotif = r.json.data?.items?.find(
    (n) => n.type === 'owner.property_submitted_for_review',
  );
  if (reviewNotif) {
    pass('admin notification after property submitted');
    const nid = reviewNotif.id;
    r = await api('PATCH', `/me/notifications/${nid}/read`);
    if (r.status === 200 && r.json.data?.isRead === true) {
      pass('mark read works');
    } else {
      fail('mark read', `status ${r.status}`);
    }

    r = await api('PATCH', '/me/notifications/read-all');
    if (r.status === 200 && typeof r.json.data?.updated === 'number') {
      pass('mark all read works');
    } else {
      fail('mark all read', `status ${r.status}`);
    }

    r = await api('GET', '/me/notifications');
    const stillUnread = r.json.data?.items?.some((n) => !n.isRead);
    if (r.json.data?.unreadCount === 0 || !stillUnread) {
      pass('unread count cleared after mark all');
    } else {
      fail('unread after mark all', `count=${r.json.data?.unreadCount}`);
    }
  } else {
    fail('admin property submitted notification', 'missing');
  }

  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
