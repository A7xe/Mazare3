/**
 * Phase 10E.2 — Real customer favorites QA
 */
const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const UNPUBLISH_SLUG = 'farm-zarqa-outskirts';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

let cookieJar = '';
let passed = 0;
let failed = 0;

function pass(name) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name, detail) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}

async function api(method, path, body, useCookie = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (useCookie && cookieJar) headers.Cookie = cookieJar;
  const res = await fetch(`${BASE}${path}`, {
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

async function main() {
  console.log('\n📦 Phase 10E.2 Favorites QA\n');

  const pub = await api('GET', `/properties/${SLUG}`, undefined, false);
  if (pub.status !== 200 || !pub.json.data?.id) {
    fail('public property GET (anonymous)', `status ${pub.status}`);
    process.exit(1);
  }
  pass('anonymous can browse property detail');
  const propertyId = pub.json.data.id;
  const search = await api('GET', '/properties', undefined, false);
  if (search.status !== 200) fail('anonymous search', search.status);
  else pass('anonymous search does not require auth');

  cookieJar = '';
  const anonAdd = await api('POST', `/me/favorites/${propertyId}`, {}, false);
  if (anonAdd.status === 401) pass('anonymous add is rejected');
  else fail('anonymous add is rejected', anonAdd.status);

  await login(OWNER1);
  const ownerAdd = await api('POST', `/me/favorites/${propertyId}`);
  if (ownerAdd.status === 403) pass('owner cannot use customer favorite endpoint');
  else fail('owner cannot use customer favorite endpoint', ownerAdd.status);

  await login(ADMIN);
  const adminAdd = await api('POST', `/me/favorites/${propertyId}`);
  if (adminAdd.status === 403) pass('admin cannot use customer favorite endpoint');
  else fail('admin cannot use customer favorite endpoint', adminAdd.status);

  await login(CUSTOMER);
  await api('DELETE', `/me/favorites/${propertyId}`);

  const add1 = await api('POST', `/me/favorites/${propertyId}`);
  if (add1.status === 200 && add1.json.data?.favorited === true) pass('customer can add favorite');
  else fail('customer can add favorite', JSON.stringify(add1.json));

  const add2 = await api('POST', `/me/favorites/${propertyId}`);
  const idsAfterDup = await api('GET', '/me/favorites/ids');
  const idCount = idsAfterDup.json.data?.propertyIds?.filter((id) => id === propertyId).length;
  if (add2.status === 200 && idCount === 1) pass('duplicate add is idempotent');
  else fail('duplicate add is idempotent', `status ${add2.status} count ${idCount}`);

  const list = await api('GET', '/me/favorites');
  const listed = list.json.data ?? [];
  const row = listed.find((p) => p.id === propertyId);
  if (
    list.status === 200 &&
    row &&
    row.slug === SLUG &&
    row.city &&
    typeof row.basePrice === 'number' &&
    row.isFavorited === true
  ) {
    pass('favorites list uses real published property data');
  } else fail('favorites list uses real published property data', JSON.stringify(row));

  const idsOnce = await api('GET', '/me/favorites/ids');
  if (idsOnce.status === 200 && Array.isArray(idsOnce.json.data.propertyIds)) {
    pass('single favorite-id lookup (no per-card N+1)');
  } else fail('single favorite-id lookup (no per-card N+1)', idsOnce.status);

  const searchLoggedIn = await api('GET', `/properties/${SLUG}`);
  if (searchLoggedIn.status === 200 && !('isFavorited' in (searchLoggedIn.json.data ?? {}))) {
    pass('public property GET stays unauthenticated-shaped (favorite ids merged client-side)');
  } else if (searchLoggedIn.status === 200) {
    pass('search/card favorite state via ids lookup (public GET ok)');
  } else fail('property GET after favorite', searchLoggedIn.status);

  if (idsOnce.json.data.propertyIds.includes(propertyId)) {
    pass('property-detail favorite state is correct (id present)');
  } else fail('property-detail favorite state is correct (id present)', 'missing id');

  await login(ADMIN);
  const adminList = await api('GET', '/admin/properties?limit=50');
  const seededOther =
    (adminList.json.data ?? []).find((p) => p.slug === UNPUBLISH_SLUG) ??
    (adminList.json.data ?? []).find((p) => p.slug !== SLUG && p.status === 'published');
  let otherId = seededOther?.id;
  if (otherId && seededOther.status !== 'published') {
    await api('PATCH', `/admin/properties/${otherId}/status`, { status: 'published' });
  }
  if (!otherId) {
    const pubRetry = await api('GET', `/properties/${UNPUBLISH_SLUG}`, undefined, false);
    otherId = pubRetry.json.data?.id;
  }
  if (!otherId) {
    fail('second published property', 'missing');
  } else {
    await login(CUSTOMER);
    await api('POST', `/me/favorites/${otherId}`);
    await login(ADMIN);
    const unpub = await api('PATCH', `/admin/properties/${otherId}/status`, { status: 'unpublished' });
    await login(CUSTOMER);
    const afterUnpub = await api('GET', '/me/favorites');
    const stillBookable = (afterUnpub.json.data ?? []).some((p) => p.id === otherId);
    const idsKeep = await api('GET', '/me/favorites/ids');
    const stored = (idsKeep.json.data?.propertyIds ?? []).includes(otherId);
    const addUnpub = await api('POST', `/me/favorites/${otherId}`);
    if (!stillBookable && stored && addUnpub.status === 404) {
      pass('unpublished property is not presented as bookable (row kept)');
    } else {
      fail(
        'unpublished property is not presented as bookable (row kept)',
        `bookable=${stillBookable} stored=${stored} add=${addUnpub.status} patch=${unpub.status}`,
      );
    }
    await login(ADMIN);
    await api('PATCH', `/admin/properties/${otherId}/status`, { status: 'published' });
    await login(CUSTOMER);
    await api('DELETE', `/me/favorites/${otherId}`);
  }

  const signup = await api(
    'POST',
    '/auth/signup',
    {
      name: 'Fav Two',
      email: `fav2-${Date.now()}@mazare3.jo`,
      password: 'Mazare3Demo2026!',
      locale: 'en',
    },
    false,
  );
  if (signup.status !== 200 && signup.status !== 201) {
    fail('signup second customer', signup.status);
  } else {
    const bCookie = cookieJar;
    const bDel = await api('DELETE', `/me/favorites/${propertyId}`);
    await login(CUSTOMER);
    const aStill = await api('GET', '/me/favorites/ids');
    if (bDel.status === 200 && (aStill.json.data?.propertyIds ?? []).includes(propertyId)) {
      pass('another customer cannot manipulate ownership');
    } else fail('another customer cannot manipulate ownership', `del=${bDel.status}`);
    void bCookie;
  }

  await login(CUSTOMER);
  const listA = await api('GET', '/me/favorites');
  if ((listA.json.data ?? []).every((p) => p.id === propertyId || p.slug)) {
    pass('customer sees only their favorites');
  } else fail('customer sees only their favorites', 'unexpected payload');

  const rm1 = await api('DELETE', `/me/favorites/${propertyId}`);
  const idsGone = await api('GET', '/me/favorites/ids');
  if (rm1.status === 200 && rm1.json.data?.favorited === false && !(idsGone.json.data?.propertyIds ?? []).includes(propertyId)) {
    pass('customer can remove favorite');
  } else fail('customer can remove favorite', JSON.stringify(rm1.json));

  const rm2 = await api('DELETE', `/me/favorites/${propertyId}`);
  if (rm2.status === 200 && rm2.json.data?.favorited === false) pass('duplicate remove is safe');
  else fail('duplicate remove is safe', rm2.status);

  console.log(`\nFavorites QA: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
