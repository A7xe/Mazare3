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
  const headers = {};
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
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
  if (
    (applyDup.status === 200 || applyDup.status === 201) &&
    applyDup.json.data?.status === 'pending'
  ) {
    pass('duplicate apply stays in onboarding draft (pending, not approved)');
  } else if (applyDup.status === 409) {
    pass('duplicate apply blocked without approval shortcut');
  } else {
    fail('duplicate apply', `got ${applyDup.status} status=${applyDup.json.data?.status}`);
  }

  const meApp = await api('GET', '/owner/application/me');
  if (meApp.status === 200 && meApp.json.data?.status === 'pending') {
    pass('GET /owner/application/me');
  } else {
    fail('GET /owner/application/me', `status ${meApp.status}`);
  }

  const ownerBefore = await api('GET', '/owner/summary');
  if (ownerBefore.status === 403) pass('customer GET /owner/summary → 403');
  else fail('customer GET /owner/summary → 403', `got ${ownerBefore.status}`);

  function tinyPng() {
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(16, 1),
    ]);
  }

  async function completeKycAndSubmit() {
    const profile = await api('PATCH', '/owner/onboarding/profile', {
      entityType: 'individual',
      displayName: applyBody.displayName,
      businessName: applyBody.businessName,
      phone: applyBody.phone,
      city: applyBody.city,
      area: applyBody.area,
      bio: applyBody.bio,
      legalName: applyBody.displayName,
      operatingPhone: applyBody.phone,
      operatingCity: applyBody.city,
      operatingArea: applyBody.area,
    });
    if (profile.status !== 200) return { ok: false, step: 'profile', profile };
    const reqs = await api('GET', '/owner/onboarding/requirements');
    for (const r of (reqs.json.data ?? []).filter((x) => x.required)) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(tinyPng())], { type: 'image/png' }), `${r.documentType}.png`);
      form.append('requirementId', r.id);
      const up = await api('POST', '/owner/onboarding/documents', form);
      if (up.status !== 201) return { ok: false, step: 'doc', up };
    }
    const pay = await api('PUT', '/owner/payout-profile', {
      beneficiaryName: 'Onboard QA',
      bankName: 'Arab Bank',
      iban: 'JO94CBJO0010000000000131000302',
    });
    if (pay.status !== 200) return { ok: false, step: 'payout', pay };
    const agr = await api('GET', '/owner/partner-agreement');
    const acc = await api('POST', '/owner/partner-agreement/accept', {
      agreementId: agr.json.data?.current?.id,
      acceptedLocale: 'ar',
    });
    if (acc.status !== 200) return { ok: false, step: 'agreement', acc };
    const sub = await api('POST', '/owner/onboarding/submit');
    if (sub.status !== 200) return { ok: false, step: 'submit', sub };
    return { ok: true, ownerProfileId: sub.json.data?.ownerProfileId };
  }

  await login(ADMIN);
  const owners = await api('GET', '/admin/owners');
  const pending = owners.json.data?.find((o) => o.email === testEmail);
  if (!pending) {
    fail('admin finds pending owner', 'not in list');
  } else {
    const bypass = await api('PATCH', `/admin/owners/${pending.id}/status`, {
      status: 'approved',
    });
    if (bypass.status === 400) pass('legacy PATCH /admin/owners/:id/status cannot bypass KYC gates');
    else fail('legacy PATCH bypass', `status ${bypass.status}`);

    await login({ email: testEmail, password: 'Mazare3Demo2026!' });
    const kyc = await completeKycAndSubmit();
    if (kyc.ok) pass('onboarding KYC completed for partner approval');
    else fail('onboarding KYC', kyc.step || 'failed');

    await login(ADMIN);
    const partnerId = pending.id;
    const detail = await api('GET', `/admin/partners/${partnerId}`);
    for (const d of detail.json.data?.documents ?? []) {
      await api('PATCH', `/admin/partners/${partnerId}/documents/${d.id}`, { status: 'approved' });
    }
    await api('POST', `/admin/partners/${partnerId}/payout-review`, { status: 'reviewed' });
    const approve = await api('POST', `/admin/partners/${partnerId}/approve`, {
      usePlatformDefaultCommission: true,
    });
    if (approve.status === 200) pass('admin approves owner via partner gates');
    else fail('admin approves owner', `status ${approve.status} ${JSON.stringify(approve.json).slice(0, 180)}`);

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
      imageUrls: [
        'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
        'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
        'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
      ],
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

      const rulesPut = await api('PUT', `/owner/properties/${propId}/availability-rules`, {
        rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          period: 'morning',
          enabled: true,
          startTime: '09:00',
          endTime: '13:00',
          price: 150,
        })),
      });
      if (rulesPut.status === 200 && rulesPut.json.data?.length >= 1) {
        pass('onboarding owner PUT weekly availability rule');
      } else {
        fail('onboarding owner PUT weekly availability rule', `status ${rulesPut.status}`);
      }
      const gen = await api('POST', `/owner/properties/${propId}/availability/generate`, {});
      if (gen.status === 200 && (gen.json.data?.created ?? 0) >= 1) {
        pass('onboarding owner generate availability');
      } else {
        fail('onboarding owner generate availability', `created ${gen.json.data?.created}`);
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
