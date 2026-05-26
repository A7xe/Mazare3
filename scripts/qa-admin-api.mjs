/**
 * Phase 5A — Admin API QA (run with API on :4000 or :4010)
 * Prefer: pnpm qa:api
 * Or: API_BASE=http://localhost:4012/api/v1 node scripts/qa-admin-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };

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

async function login(creds) {
  cookieJar = '';
  const r = await api('POST', '/auth/login', creds, false);
  return r.status === 200;
}

function todayPlus(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('\n🔐 Phase 5A Admin API QA\n');

  cookieJar = '';
  const guest = await api('GET', '/admin/summary', null, false);
  if (guest.status === 401) pass('guest GET /admin/summary → 401');
  else fail('guest GET /admin/summary → 401', `got ${guest.status}`);

  await login(CUSTOMER);
  const cust = await api('GET', '/admin/summary');
  if (cust.status === 403) pass('customer GET /admin/summary → 403');
  else fail('customer GET /admin/summary → 403', `got ${cust.status}`);

  await login(OWNER);
  const owner = await api('GET', '/admin/summary');
  if (owner.status === 403) pass('owner GET /admin/summary → 403');
  else fail('owner GET /admin/summary → 403', `got ${owner.status}`);

  await login(ADMIN);
  const summary = await api('GET', '/admin/summary');
  if (summary.status === 200 && summary.json.data?.usersCount != null) {
    pass('admin GET /admin/summary → 200');
  } else {
    fail('admin GET /admin/summary → 200', `status ${summary.status}`);
  }

  const users = await api('GET', '/admin/users');
  if (users.status === 200 && Array.isArray(users.json.data)) {
    pass(`admin GET /admin/users (${users.json.data.length} rows)`);
  } else {
    fail('admin GET /admin/users', `status ${users.status}`);
  }

  const properties = await api('GET', '/admin/properties');
  if (properties.status === 200 && properties.json.data?.length) {
    pass(`admin GET /admin/properties (${properties.json.data.length})`);
    const prop = properties.json.data[0];
    const detail = await api('GET', `/admin/properties/${prop.id}`);
    if (detail.status === 200) pass('admin GET /admin/properties/:id');
    else fail('admin GET /admin/properties/:id', `status ${detail.status}`);

    const from = todayPlus(1);
    const to = todayPlus(10);
    const avail = await api(
      'GET',
      `/admin/availability?propertyId=${prop.id}&from=${from}&to=${to}`,
    );
    if (avail.status === 200) pass('admin GET /admin/availability');
    else fail('admin GET /admin/availability', `status ${avail.status}`);
  } else {
    fail('admin GET /admin/properties', `status ${properties.status}`);
  }

  const bookings = await api('GET', '/admin/bookings');
  if (bookings.status === 200) pass('admin GET /admin/bookings');
  else fail('admin GET /admin/bookings', `status ${bookings.status}`);

  const owners = await api('GET', '/admin/owners');
  if (owners.status === 200) pass('admin GET /admin/owners');
  else fail('admin GET /admin/owners', `status ${owners.status}`);

  const audit = await api('GET', '/admin/audit-logs?limit=20');
  if (audit.status === 200 && Array.isArray(audit.json.data)) {
    pass('admin GET /admin/audit-logs');
    const hasDashboardAccess = audit.json.data.some(
      (l) => l.action === 'admin.dashboard_accessed',
    );
    if (hasDashboardAccess) pass('audit includes admin.dashboard_accessed');
    else fail('audit includes admin.dashboard_accessed', 'not in recent logs');
  } else {
    fail('admin GET /admin/audit-logs', `status ${audit.status}`);
  }

  const customerRow = users.json.data?.find((u) => u.email === CUSTOMER.email);
  if (customerRow && customerRow.status === 'active') {
    const suspended = await api('PATCH', `/admin/users/${customerRow.id}/status`, {
      status: 'suspended',
    });
    if (suspended.status === 200) pass('admin PATCH user → suspended');
    else fail('admin PATCH user status', `status ${suspended.status}`);

    const restored = await api('PATCH', `/admin/users/${customerRow.id}/status`, {
      status: 'active',
    });
    if (restored.status === 200) pass('admin PATCH user → active');
    else fail('admin PATCH user restore', `status ${restored.status}`);
  } else {
    fail('admin user status toggle', 'customer row not found or not active');
  }

  await login(CUSTOMER);
  const custUsers = await api('GET', '/admin/users');
  if (custUsers.status === 403) pass('customer GET /admin/users → 403');
  else fail('customer GET /admin/users → 403', `got ${custUsers.status}`);

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failures.length) {
    for (const f of failures) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
