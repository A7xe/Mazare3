/**
 * Phase 8A / 8A.1 / 8B — Property media upload + review rules QA
 * Prefer: API_BASE=http://127.0.0.1:4000/api/v1 node scripts/qa-media-api.mjs
 * Or: pnpm qa:media
 *
 * Cloudinary config check uses compiled API helpers (no network / no real upload).
 * Run `pnpm --filter @mazare3/api build` before qa:media if dist is stale.
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
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

async function api(method, path, body, useCookie = true, headers = {}) {
  const h = { ...headers };
  if (body && !(body instanceof FormData)) {
    h['Content-Type'] = 'application/json';
  }
  if (useCookie && cookieJar) h.Cookie = cookieJar;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: h,
    body:
      body instanceof FormData
        ? body
        : body
          ? JSON.stringify(body)
          : undefined,
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

async function testCloudinaryNotConfigured() {
  const saved = {
    MEDIA_PROVIDER: process.env.MEDIA_PROVIDER,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  try {
    const mod = await import(
      '../apps/api/dist/services/property-media/storage/get-storage-provider.js'
    );
    const { assertMediaProviderReady, resetActiveStorageProviderCache } = mod;

    process.env.MEDIA_PROVIDER = 'cloudinary';
    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
    resetActiveStorageProviderCache();

    let threw = false;
    try {
      assertMediaProviderReady();
    } catch (err) {
      threw = true;
      const code = err?.code ?? err?.payload?.code;
      if (code === 'CLOUDINARY_NOT_CONFIGURED') {
        pass('MEDIA_PROVIDER=cloudinary without env → CLOUDINARY_NOT_CONFIGURED');
      } else {
        fail(
          'cloudinary config guard',
          `expected CLOUDINARY_NOT_CONFIGURED, got ${code ?? err?.message}`,
        );
      }
    }
    if (!threw) {
      fail('cloudinary config guard', 'assertMediaProviderReady did not throw');
    }
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') {
      fail(
        'cloudinary config guard (dist)',
        'build API first: pnpm --filter @mazare3/api build',
      );
    } else {
      fail('cloudinary config guard', err?.message ?? String(err));
    }
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    try {
      const mod = await import(
        '../apps/api/dist/services/property-media/storage/get-storage-provider.js'
      );
      mod.resetActiveStorageProviderCache?.();
    } catch {
      // ignore if dist missing
    }
  }
}

async function main() {
  console.log('\n🖼️  Phase 8A / 8A.1 / 8B Media API QA\n');

  await testCloudinaryNotConfigured();

  // Guest → 401
  cookieJar = '';
  const guest = await api(
    'POST',
    '/owner/properties/any-id/media',
    { url: SAMPLE_URL },
    false,
  );
  if (guest.status === 401) pass('guest POST media → 401');
  else fail('guest POST media → 401', `got ${guest.status}`);

  // Customer → 403
  await login(CUSTOMER);
  const cust = await api('POST', '/owner/properties/any-id/media', { url: SAMPLE_URL });
  if (cust.status === 403) pass('customer POST media → 403');
  else fail('customer POST media → 403', `got ${cust.status}`);

  // Owner1 gets a property id
  await login(OWNER1);
  const props = await api('GET', '/owner/properties');
  const propId = props.json.data?.[0]?.id;
  if (!propId) {
    fail('owner1 has property', 'no properties in seed');
    console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
    process.exit(1);
  }
  pass('owner1 has property');

  const add = await api('POST', `/owner/properties/${propId}/media`, { url: SAMPLE_URL });
  if (add.status === 201 && add.json.data?.media?.length) {
    pass('owner adds media to own property');
  } else {
    fail('owner adds media', `status ${add.status}`);
  }

  const mediaId = add.json.data?.media?.at(-1)?.id;
  if (!mediaId) {
    fail('media id returned', 'missing');
  } else {
    const cover = await api('POST', `/owner/properties/${propId}/media/${mediaId}/set-cover`);
    if (cover.status === 200 && cover.json.data?.media?.[0]?.id === mediaId) {
      pass('set cover works');
    } else {
      fail('set cover', `status ${cover.status}`);
    }

    const del = await api('DELETE', `/owner/properties/${propId}/media/${mediaId}`);
    if (del.status === 200) pass('delete media works');
    else fail('delete media', `status ${del.status}`);
  }

  // Owner2 cannot add to owner1 property
  await login(OWNER2);
  const other = await api('POST', `/owner/properties/${propId}/media`, { url: SAMPLE_URL });
  if (other.status === 403) pass('owner2 cannot add media to owner1 property → 403');
  else fail('owner2 cross-property media → 403', `got ${other.status}`);

  // Public published property returns images only when published
  cookieJar = '';
  const list = await api('GET', '/properties', null, false);
  const published = list.json.data?.find((p) => p.imageUrl);
  if (published?.slug) {
    const detail = await api('GET', `/properties/${published.slug}`, null, false);
    if (detail.status === 200 && Array.isArray(detail.json.data?.images)) {
      pass('public property detail includes images array');
    } else {
      fail('public property images', `status ${detail.status}`);
    }
  } else {
    fail('find published property in search', 'none with imageUrl');
  }

  // Admin sees media in property details
  await login(ADMIN);
  const adminProps = await api('GET', '/admin/properties');
  const adminPropId = adminProps.json.data?.[0]?.id;
  if (!adminPropId) {
    fail('admin property list', 'empty');
  } else {
    const adminDetail = await api('GET', `/admin/properties/${adminPropId}`);
    if (adminDetail.status === 200 && Array.isArray(adminDetail.json.data?.media)) {
      pass('admin property detail includes media[]');
    } else {
      fail('admin property media', `status ${adminDetail.status}`);
    }
  }

  // ── Phase 8A.1: submit-review & publish media rules ─────────────────────
  await login(OWNER1);
  const draftBody = {
    type: 'farm',
    titleAr: `اختبار صور QA ${Date.now()}`,
    titleEn: 'QA Media Rules Test',
    descriptionAr: 'وصف تجريبي لاختبار قواعد الصور قبل المراجعة والنشر في المنصة.',
    descriptionEn: 'Test property for media review rules before submit and publish.',
    city: 'amman',
    area: 'qa-media',
    approximateAddress: 'منطقة اختبار',
    exactAddress: 'عنوان داخلي للاختبار',
    basePrice: 120,
    capacity: 8,
    imageUrls: [],
    amenityKeys: [],
    rules: [],
  };
  const draftCreated = await api('POST', '/owner/properties', draftBody);
  const draftId = draftCreated.json.data?.id;
  if (!draftId) {
    fail('create draft property without photos', `status ${draftCreated.status}`);
  } else {
    pass('create draft property without photos');

    const submitNoMedia = await api('POST', `/owner/properties/${draftId}/submit-review`);
    if (
      submitNoMedia.status === 400 &&
      submitNoMedia.json.code === 'PROPERTY_MEDIA_REQUIRED'
    ) {
      pass('submit-review without photos → PROPERTY_MEDIA_REQUIRED');
    } else {
      fail(
        'submit-review without photos',
        `status ${submitNoMedia.status} code ${submitNoMedia.json.code}`,
      );
    }

    await api('POST', `/owner/properties/${draftId}/media`, { url: SAMPLE_URL });
    const submitOne = await api('POST', `/owner/properties/${draftId}/submit-review`);
    if (submitOne.status === 200 && submitOne.json.data?.status === 'pending_review') {
      pass('submit-review with 1 photo → pending_review');
    } else {
      fail('submit-review with 1 photo', `status ${submitOne.status}`);
    }

    await login(ADMIN);
    const pubOne = await api('PATCH', `/admin/properties/${draftId}/status`, {
      status: 'published',
    });
    if (
      pubOne.status === 400 &&
      pubOne.json.code === 'PROPERTY_MIN_MEDIA_REQUIRED'
    ) {
      pass('publish with 1 photo → PROPERTY_MIN_MEDIA_REQUIRED');
    } else {
      fail(
        'publish with 1 photo blocked',
        `status ${pubOne.status} code ${pubOne.json.code}`,
      );
    }

    await login(OWNER1);
    const url2 =
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80';
    const url3 =
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80';
    await api('POST', `/owner/properties/${draftId}/media`, { url: url2 });
    const afterThree = await api('POST', `/owner/properties/${draftId}/media`, {
      url: url3,
    });
    const mediaList = afterThree.json.data?.media ?? [];
    if (mediaList.length >= 3 && mediaList[0]?.sortOrder === 0) {
      pass('3 photos with cover at sortOrder=0');
    } else {
      fail('3 photos cover sortOrder', `count ${mediaList.length}`);
    }

    await login(ADMIN);
    const pubOk = await api('PATCH', `/admin/properties/${draftId}/status`, {
      status: 'published',
    });
    if (pubOk.status === 200 && pubOk.json.data?.status === 'published') {
      pass('publish with 3+ photos and cover → published');
    } else {
      fail('publish with 3+ photos', `status ${pubOk.status} code ${pubOk.json.code}`);
    }
  }

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
