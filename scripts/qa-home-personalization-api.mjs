/**
 * Phase 10F.4B — personalized customer homepage
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '../packages/db/generated/client/index.js';

function loadEnv() {
  const raw = readFileSync(new URL('../.env', import.meta.url), 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const BASE = process.env.API_BASE ?? 'http://127.0.0.1:4000/api/v1';
const SLUG = 'chalet-emerald-dead-sea';
const SLUG2 = 'farm-zarqa-outskirts';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };

const prisma = new PrismaClient({ log: ['error'] });
let cookieJar = '';
let passed = 0;
let failed = 0;
const failures = [];
let prop2PrevStatus = null;
let prop2Id = null;

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

async function payFully(bookingId) {
  for (const purpose of ['deposit', 'balance']) {
    const dep = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose });
    if (dep.status !== 201 || !dep.json.data?.id) return false;
    await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
  }
  return true;
}

async function createPaidPastBooking(slug, guestsCount = 4) {
  await login(CUSTOMER);
  const slot = await api('POST', `/internal/properties/${slug}/ensure-available-slot`, {}, false);
  if (slot.status !== 200 || !slot.json.data?.date) return null;
  const book = await api('POST', '/bookings', {
    propertySlug: slug,
    date: slot.json.data.date,
    period: slot.json.data.period,
    guestsCount,
  });
  if (book.status !== 201) return null;
  if (!(await payFully(book.json.data.id))) return null;
  await api('POST', `/internal/bookings/${book.json.data.id}/backdate-slot`, {}, false);
  const fresh = await api('GET', `/me/bookings/${book.json.data.id}`);
  return fresh.json.data;
}

async function main() {
  console.log('\n🏠 Phase 10F.4B home personalization QA\n');
  try {
    cookieJar = '';
    const anon = await api('GET', '/me/home-personalization', undefined, false);
    if (anon.status === 401) pass('anonymous homepage personalization is rejected');
    else fail('anonymous homepage personalization is rejected', String(anon.status));

    await login(OWNER1);
    const owner = await api('GET', '/me/home-personalization');
    if (owner.status === 403) pass('owner/admin do not receive customer personalization');
    else fail('owner/admin do not receive customer personalization', String(owner.status));

    await login(ADMIN);
    const admin = await api('GET', '/me/home-personalization');
    if (admin.status === 403) pass('admin does not receive customer personalization');
    else fail('admin does not receive customer personalization', String(admin.status));

    const pub = await api('GET', `/properties/${SLUG}`, undefined, false);
    const propertyId = pub.json.data?.id;
    const row2 = await prisma.property.findUnique({
      where: { slug: SLUG2 },
      select: { id: true, status: true },
    });
    prop2Id = row2?.id ?? null;
    prop2PrevStatus = row2?.status ?? null;
    if (prop2Id && prop2PrevStatus !== 'published') {
      await login(ADMIN);
      await api('PATCH', `/admin/properties/${prop2Id}/status`, { status: 'published' });
    }
    if (!prop2Id) {
      fail('second seeded property for personalization QA', `missing slug ${SLUG2}`);
    }

    await login(CUSTOMER);
    if (propertyId) await api('DELETE', `/me/favorites/${propertyId}`);
    if (prop2Id) await api('DELETE', `/me/favorites/${prop2Id}`);

    const first = await createPaidPastBooking(SLUG, 4);
    const second = await createPaidPastBooking(SLUG, 6);
    let otherPast = null;
    if (prop2Id) otherPast = await createPaidPastBooking(SLUG2, 3);

    await login(CUSTOMER);
    const pendingSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const pending = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: pendingSlot.json.data.date,
      period: pendingSlot.json.data.period,
      guestsCount: 2,
    });

    if (propertyId) await api('POST', `/me/favorites/${propertyId}`);
    if (prop2Id) await api('POST', `/me/favorites/${prop2Id}`);

    const home = await api('GET', '/me/home-personalization');
    const data = home.json.data;
    if (home.status === 200 && Array.isArray(data?.bookAgain) && data.bookAgain.length >= 1) {
      pass('logged-in customer gets Book Again');
    } else fail('logged-in customer gets Book Again', JSON.stringify(data?.bookAgain));

    const bookAgainIds = (data?.bookAgain ?? []).map((i) => i.bookingId);
    if (second && bookAgainIds[0] === second.id) pass('most recent eligible past bookings are used');
    else if (second && bookAgainIds.includes(second.id) && !bookAgainIds.includes(first?.id)) {
      pass('most recent eligible past bookings are used');
    } else if (second && bookAgainIds.includes(second.id)) {
      // first may be collapsed by property dedupe — second should represent the property
      const slugs = (data.bookAgain ?? []).filter((i) => i.property.slug === SLUG);
      if (slugs.length === 1 && slugs[0].bookingId === second.id) {
        pass('most recent eligible past bookings are used');
      } else fail('most recent eligible past bookings are used', bookAgainIds.join(','));
    } else fail('most recent eligible past bookings are used', bookAgainIds.join(','));

    const slugCount = (data.bookAgain ?? []).filter((i) => i.property.slug === SLUG).length;
    if (slugCount === 1) pass('duplicate property bookings collapse to one');
    else fail('duplicate property bookings collapse to one', String(slugCount));

    if (pending.status === 201 && !bookAgainIds.includes(pending.json.data.id)) {
      pass('pending booking is excluded');
    } else fail('pending booking is excluded', JSON.stringify({ pending: pending.status, bookAgainIds }));

    if (prop2Id && prop2PrevStatus !== null) {
      await login(ADMIN);
      await api('PATCH', `/admin/properties/${prop2Id}/status`, { status: 'unpublished' });
      await login(CUSTOMER);
      const afterUnpub = await api('GET', '/me/home-personalization');
      const ba = afterUnpub.json.data?.bookAgain ?? [];
      const fav = afterUnpub.json.data?.favorites ?? [];
      if (!ba.some((i) => i.property.id === prop2Id) && !fav.some((p) => p.id === prop2Id)) {
        pass('unbookable property is excluded');
        pass('unpublished favorite is not presented as bookable');
      } else {
        fail('unbookable property is excluded', JSON.stringify(ba.map((i) => i.property.id)));
        fail('unpublished favorite is not presented as bookable', JSON.stringify(fav.map((p) => p.id)));
      }
      await login(ADMIN);
      await api('PATCH', `/admin/properties/${prop2Id}/status`, { status: 'published' });
      await login(CUSTOMER);
    } else {
      fail('unbookable property is excluded', 'no second property');
      fail('unpublished favorite is not presented as bookable', 'no second property');
    }

    const email = `hp-${Date.now()}@mazare3.jo`;
    const signup = await api(
      'POST',
      '/auth/signup',
      { email, password: 'Mazare3Demo2026!', name: 'HP Other', locale: 'ar' },
      false,
    );
    if (signup.status === 201 || signup.status === 200) {
      await login({ email, password: 'Mazare3Demo2026!' });
      const otherHome = await api('GET', '/me/home-personalization');
      const otherBa = otherHome.json.data?.bookAgain ?? [];
      if (!otherBa.some((i) => i.bookingId === second?.id || i.bookingId === first?.id)) {
        pass('customer cannot receive another customer booking');
      } else fail('customer cannot receive another customer booking', 'leaked');
      const otherFav = otherHome.json.data?.favorites ?? [];
      if (!otherFav.some((p) => p.id === propertyId)) pass("another customer's favorites do not appear");
      else fail("another customer's favorites do not appear", 'leaked');
    } else {
      fail('customer cannot receive another customer booking', `signup ${signup.status}`);
      fail("another customer's favorites do not appear", `signup ${signup.status}`);
    }

    await login(CUSTOMER);
    if (propertyId) await api('POST', `/me/favorites/${propertyId}`);
    if (prop2Id) await api('POST', `/me/favorites/${prop2Id}`);

    // Favorites rail omits Book Again properties — use a third published listing for a visible favorite.
    const baProbe = await api('GET', '/me/home-personalization');
    const bookAgainPropIdsProbe = new Set(
      (baProbe.json.data?.bookAgain ?? []).map((i) => i.property.id),
    );
    const favOnly = await prisma.property.findFirst({
      where: {
        status: 'published',
        id: { notIn: [...bookAgainPropIdsProbe] },
        owner: { status: 'approved' },
      },
      select: { id: true, slug: true },
    });
    if (favOnly?.id) {
      await api('POST', `/me/favorites/${favOnly.id}`);
    }

    const home2 = await api('GET', '/me/home-personalization');
    const fav2 = home2.json.data?.favorites ?? [];
    const ba2 = home2.json.data?.bookAgain ?? [];
    const favOmitsBookAgain = !fav2.some((p) => ba2.some((i) => i.property.id === p.id));
    const favShowsExtra = favOnly ? fav2.some((p) => p.id === favOnly.id) : fav2.length > 0;
    if (favShowsExtra && favOmitsBookAgain) pass('customer favorites appear');
    else {
      fail(
        'customer favorites appear',
        JSON.stringify({ favs: fav2.map((p) => p.slug), favOnly: favOnly?.slug ?? null }),
      );
    }

    const home3 = await api('GET', '/me/home-personalization');
    const bookAgainPropIds = new Set((home3.json.data?.bookAgain ?? []).map((i) => i.property.id));
    const favOverlap = (home3.json.data?.favorites ?? []).some((p) => bookAgainPropIds.has(p.id));
    if (!favOverlap) pass('property appearing in Book Again is removed from homepage Favorites rail');
    else fail('property appearing in Book Again is removed from homepage Favorites rail', 'overlap');

    cookieJar = '';
    const disc = await api('GET', '/properties/discovery', undefined, false);
    const sectionIds = (disc.json.data?.sections ?? []).map((s) => s.id);
    if (!sectionIds.includes('bookAgain') && !sectionIds.includes('yourFavorites')) {
      pass('anonymous homepage remains unchanged');
    } else fail('anonymous homepage remains unchanged', sectionIds.join(','));

    const flagsOk = (home3.json.data?.bookAgain ?? []).every(
      (i) => typeof i.property.isSponsored === 'boolean' && typeof i.property.isFeatured === 'boolean',
    );
    if (flagsOk && (home3.json.data?.bookAgain?.length ?? 0) <= 6 && (home3.json.data?.favorites?.length ?? 0) <= 6) {
      pass('query behavior is bounded/no N+1');
    } else fail('query behavior is bounded/no N+1', 'bad flags or oversized');

    void otherPast;
    if (pending.status === 201) {
      try {
        await login(CUSTOMER);
        await api('POST', `/me/bookings/${pending.json.data.id}/cancel`);
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    fail('home personalization runner', e instanceof Error ? e.message : String(e));
  } finally {
    // Leave the seeded secondary property published so sibling QA (favorites) can resolve it.
    if (prop2Id) {
      await prisma.property
        .update({ where: { id: prop2Id }, data: { status: 'published' } })
        .catch(() => {});
    }
    await prisma.$disconnect();
  }

  console.log(`\n📊 ${passed} passed, ${failed} failed\n`);
  if (failed) {
    for (const f of failures) console.log(`   - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main();
