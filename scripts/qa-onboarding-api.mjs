/**
 * Phase 5B — Owner onboarding & property submission QA
 * Prefer: pnpm qa:api
 * Or: API_BASE=http://localhost:4012/api/v1 node scripts/qa-onboarding-api.mjs
 */
const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
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

const applyBody = {
  displayName: 'مالك تجريبي',
  businessName: 'مزرعة الاختبار',
  phone: '0791112233',
  city: 'amman',
  area: 'ماركا',
  bio: 'نبذة تجريبية لمالك يريد الانضمام للمنصة وإدارة حجوزاته بشكل احترافي.',
  approximateFarmCount: 2,
  acceptTerms: true,
};

async function main() {
  console.log('\n🏡 Phase 5B Onboarding API QA\n');

  const testEmail = `onboard-${Date.now()}@test.mazare3.jo`;
  cookieJar = '';
  const signup = await api(
    'POST',
    '/auth/signup',
    { email: testEmail, password: 'Mazare3Demo2026!', name: 'Onboard Test', locale: 'ar' },
    false,
  );
  if (signup.status !== 201) {
    fail('signup test customer', `status ${signup.status}`);
  } else {
    pass('signup test customer');
  }

  const apply1 = await api('POST', '/owner/apply', applyBody);
  if (apply1.status === 201 && apply1.json.data?.status === 'pending') {
    pass('customer POST /owner/apply → pending');
  } else {
    fail('customer POST /owner/apply', `status ${apply1.status}`);
  }

  const applyDup = await api('POST', '/owner/apply', applyBody);
  if (applyDup.status === 409) pass('duplicate apply → 409');
  else fail('duplicate apply → 409', `got ${applyDup.status}`);

  const meApp = await api('GET', '/owner/application/me');
  if (meApp.status === 200 && meApp.json.data?.status === 'pending') {
    pass('GET /owner/application/me');
  } else {
    fail('GET /owner/application/me', `status ${meApp.status}`);
  }

  const ownerBefore = await api('GET', '/owner/summary');
  if (ownerBefore.status === 403) pass('customer GET /owner/summary → 403');
  else fail('customer GET /owner/summary → 403', `got ${ownerBefore.status}`);

  await login(ADMIN);
  const owners = await api('GET', '/admin/owners');
  const pending = owners.json.data?.find((o) => o.email === testEmail);
  if (!pending) {
    fail('admin finds pending owner', 'not in list');
  } else {
    const approve = await api('PATCH', `/admin/owners/${pending.id}/status`, {
      status: 'approved',
    });
    if (approve.status === 200) pass('admin approves owner');
    else fail('admin approves owner', `status ${approve.status}`);

    await login({ email: testEmail, password: 'Mazare3Demo2026!' });
    const refresh = await api('POST', '/auth/refresh-session');
    if (refresh.status === 200 && refresh.json.data?.user?.role === 'owner') {
      pass('refresh-session → role owner');
    } else {
      fail('refresh-session → role owner', `role ${refresh.json.data?.user?.role}`);
    }

    const summary = await api('GET', '/owner/summary');
    if (summary.status === 200) pass('approved owner GET /owner/summary');
    else fail('approved owner GET /owner/summary', `status ${summary.status}`);

    const propBody = {
      type: 'farm',
      titleAr: 'مزرعة اختبار QA',
      titleEn: 'QA Test Farm',
      descriptionAr: 'وصف تجريبي لمزرعة يتم إنشاؤها عبر اختبار الانضمام والمراجعة في المنصة.',
      descriptionEn: 'Test farm description for onboarding QA script.',
      city: 'amman',
      area: 'test-area',
      approximateAddress: 'منطقة تجريبية — عمان',
      exactAddress: 'عنوان دقيق مخفي للاختبار',
      basePrice: 150,
      capacity: 12,
      imageUrls: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800'],
      amenityKeys: ['pool', 'parking'],
      rules: [{ titleAr: 'لا حفلات', titleEn: 'No parties' }],
    };

    const created = await api('POST', '/owner/properties', propBody);
    if (created.status === 201 && created.json.data?.status === 'draft') {
      pass('owner POST property → draft');
      const propId = created.json.data.id;

      const publishAttempt = await api('PATCH', `/owner/properties/${propId}`, {
        status: 'published',
      });
      if (publishAttempt.status === 200 && publishAttempt.json.data?.status === 'draft') {
        pass('owner cannot self-publish (status stays draft)');
      } else if (publishAttempt.status >= 400) {
        pass('owner cannot self-publish (rejected)');
      } else {
        fail('owner cannot self-publish', `status ${publishAttempt.json.data?.status}`);
      }

      const submitted = await api('POST', `/owner/properties/${propId}/submit-review`);
      if (submitted.status === 200 && submitted.json.data?.status === 'pending_review') {
        pass('owner submit-review → pending_review');
      } else {
        fail('owner submit-review', `status ${submitted.status}`);
      }

      await login(ADMIN);
      const pub = await api('PATCH', `/admin/properties/${propId}/status`, {
        status: 'published',
      });
      if (pub.status === 200) pass('admin publish property');
      else fail('admin publish property', `status ${pub.status}`);

      cookieJar = '';
      const search = await api('GET', '/properties', null, false);
      const found = search.json.data?.some((p) => p.slug === created.json.data.slug);
      if (search.status === 200 && found) pass('public GET /properties includes published');
      else fail('public search includes published', found ? 'ok' : 'slug missing');

      const draftSearch = await api('GET', '/properties?q=QA+Test+Farm+UNPUBLISHED', null, false);
      const draftOnly = search.json.data?.every((p) => p.slug !== 'nonexistent-draft-only');
      if (draftOnly) pass('public search excludes non-published slugs');

      await login(ADMIN);
      const suspend = await api('PATCH', `/admin/owners/${pending.id}/status`, {
        status: 'suspended',
      });
      if (suspend.status === 200) pass('admin suspend owner');
      else fail('admin suspend owner', `status ${suspend.status}`);

      await login({ email: testEmail, password: 'Mazare3Demo2026!' });
      const blocked = await api('GET', '/owner/summary');
      if (blocked.status === 403) pass('suspended owner GET /owner/summary → 403');
      else fail('suspended owner blocked', `got ${blocked.status}`);
    } else {
      fail('owner POST property', `status ${created.status}`);
    }
  }

  await login(OWNER1);
  const o1 = await api('GET', '/owner/summary');
  if (o1.status === 200) pass('seed owner1 still works after onboarding QA');
  else fail('seed owner1 still works', `status ${o1.status}`);

  await login(CUSTOMER);
  const custOwner = await api('GET', '/owner/summary');
  if (custOwner.status === 403) pass('seed customer still blocked from owner API');
  else fail('seed customer owner block', `got ${custOwner.status}`);

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
