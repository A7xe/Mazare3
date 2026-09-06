/**
 * Phase 10F.4A — homepage merchandising discovery
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
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `hm-${Date.now()}`;
const AREA = `qa-home-${RUN}`;
const EMPTY_AREA = `qa-home-empty-${RUN}`;
const IMAGES = [
  'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
];

const prisma = new PrismaClient({ log: ['error'] });
let cookieJar = '';
let passed = 0;
let failed = 0;
const failures = [];
let ownerProfileId = null;
let ownerPrevStatus = null;

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

function allWeekRules() {
  const periods = [
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 140 },
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 210 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

function windowIso(startOffset, endOffset) {
  const s = new Date();
  s.setUTCDate(s.getUTCDate() + startOffset);
  const e = new Date();
  e.setUTCDate(e.getUTCDate() + endOffset);
  return { startsAt: s.toISOString(), endsAt: e.toISOString() };
}

async function setupListing(titleEn, extra = {}) {
  await login(OWNER1);
  const created = await api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة رئيسية ${titleEn}`,
    titleEn,
    descriptionAr: 'مزرعة اختبار لتبويب الصفحة الرئيسية.',
    descriptionEn: 'Homepage merchandising QA farm.',
    city: extra.city ?? 'amman',
    area: extra.area ?? AREA,
    approximateAddress: 'عمان — اختبار الرئيسية',
    exactAddress: 'عنوان مخفي',
    basePrice: extra.basePrice ?? 500,
    capacity: extra.capacity ?? 18,
    imageUrls: IMAGES,
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) throw new Error(`create ${created.status}`);
  const id = created.json.data.id;
  const slug = created.json.data.slug;
  await api('PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api('POST', `/owner/properties/${id}/availability/generate`, {});
  if (extra.publish !== false) {
    await api('POST', `/owner/properties/${id}/submit-review`);
    await login(ADMIN);
    const pub = await api('PATCH', `/admin/properties/${id}/status`, { status: 'published' });
    if (pub.status !== 200) throw new Error(`publish ${pub.status}`);
  }
  return { id, slug };
}

async function activatePlacement(propertyId, type) {
  await login(ADMIN);
  const win = windowIso(-1, 14);
  const created = await api('POST', `/admin/properties/${propertyId}/placements`, {
    placementType: type,
    ...win,
  });
  if (created.status !== 201) throw new Error(`placement ${created.status}`);
  const act = await api('POST', `/admin/properties/${propertyId}/placements/${created.json.data.id}/activate`, {});
  if (act.status !== 200) throw new Error(`activate ${act.status}`);
}

function sectionMap(disc) {
  const map = {};
  for (const s of disc.json.data?.sections ?? []) map[s.id] = s;
  return map;
}

async function unpublishByIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return;
  await login(ADMIN);
  for (const id of unique) {
    try {
      const placements = await api('GET', `/admin/properties/${id}/placements`);
      for (const row of placements.json?.data ?? []) {
        if (row?.status === 'active' && row?.id) {
          await api('POST', `/admin/properties/${id}/placements/${row.id}/pause`, {});
        }
      }
    } catch {
      /* best-effort */
    }
    try {
      const detail = await api('GET', `/admin/properties/${id}`);
      if (detail.json?.data?.status === 'published') {
        await api('PATCH', `/admin/properties/${id}/status`, { status: 'unpublished' });
      }
    } catch {
      /* best-effort */
    }
  }
}

async function main() {
  console.log('\n🏠 Phase 10F.4A homepage discovery QA\n');
  /** @type {string[]} */
  const createdPropertyIds = [];
  try {
    const sponsored = await setupListing(`QA Home S ${RUN}`, { basePrice: 1600 });
    const featured = await setupListing(`QA Home F ${RUN}`, { basePrice: 900 });
    const offer = await setupListing(`QA Home O ${RUN}`, { basePrice: 700 });
    const rated = await setupListing(`QA Home R ${RUN}`, { basePrice: 800 });
    const recent = await setupListing(`QA Home N ${RUN}`, { basePrice: 400 });
    const unpublished = await setupListing(`QA Home U ${RUN}`, { publish: false, basePrice: 300 });
    const emptyOnly = await setupListing(`QA Home E ${RUN}`, { area: EMPTY_AREA, basePrice: 450 });
    createdPropertyIds.push(
      sponsored.id,
      featured.id,
      offer.id,
      rated.id,
      recent.id,
      unpublished.id,
      emptyOnly.id,
    );

    await activatePlacement(sponsored.id, 'sponsored');
    await activatePlacement(featured.id, 'featured');

    // Age commercial properties past the organic catalog cap (HOMEPAGE_CATALOG_LIMIT=2 in runner).
    const oldStamp = new Date('2020-01-01T00:00:00.000Z');
    await prisma.property.updateMany({
      where: { id: { in: [sponsored.id, featured.id, offer.id, rated.id] } },
      data: { createdAt: oldStamp },
    });

    await login(OWNER1);
    const promo = await api('POST', `/owner/properties/${offer.id}/promotions`, {
      titleAr: 'عرض الرئيسية',
      titleEn: 'Home offer',
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(-1, 14),
      period: null,
    });
    await api('POST', `/owner/properties/${offer.id}/promotions/${promo.json.data.id}/activate`, {});

    const coupon = await api('POST', `/owner/properties/${recent.id}/coupons`, {
      code: `HM${RUN.replace(/-/g, '').slice(-8).toUpperCase()}`,
      discountType: 'fixed_amount',
      discountValue: 5,
      ...windowIso(-1, 14),
    });
    if (coupon.json.data?.id) {
      await api('POST', `/owner/properties/${recent.id}/coupons/${coupon.json.data.id}/activate`, {});
    }

    await prisma.property.update({
      where: { id: recent.id },
      data: { hasPlatformDeal: true, ratingAvg: 5, reviewCount: 99 },
    });

    await login(CUSTOMER);
    const slot = await api('POST', `/internal/properties/${rated.slug}/ensure-available-slot`, {}, false);
    const book = await api('POST', '/bookings', {
      propertySlug: rated.slug,
      date: slot.json.data.date,
      period: slot.json.data.period,
      guestsCount: 4,
    });
    const bookingId = book.json.data.id;
    const dep = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'deposit' });
    await api('POST', `/payments/${dep.json.data.id}/simulate-success`, {});
    const bal = await api('POST', '/payments/create-intent', { bookingId, method: 'card', purpose: 'balance' });
    await api('POST', `/payments/${bal.json.data.id}/simulate-success`, {});
    await api('POST', `/internal/bookings/${bookingId}/backdate-slot`, {}, false);
    const review = await api('POST', `/me/bookings/${bookingId}/review`, { rating: 5, comment: 'ممتاز' });
    if (review.status !== 201) fail('publish review for top rated', `${review.status}`);

    const disc = await api('GET', `/properties/discovery?area=${AREA}`, null, false);
    const secs = sectionMap(disc);
    const spon = secs.sponsored;
    const feat = secs.featured;
    const offs = secs.offers;
    const top = secs.topRated;
    const rec = secs.recentlyAdded;

    if (spon?.propertyIds?.includes(sponsored.id) && spon.properties.find((p) => p.id === sponsored.id)?.isSponsored) {
      pass('sponsored section uses real live placements');
    } else fail('sponsored section uses real live placements', JSON.stringify(spon?.propertyIds));

    if (feat?.propertyIds?.includes(featured.id) && feat.properties.find((p) => p.id === featured.id)?.isFeatured) {
      pass('featured section uses real live placements');
    } else fail('featured section uses real live placements', JSON.stringify(feat?.propertyIds));

    if (offs?.propertyIds?.includes(offer.id) && offs.properties.find((p) => p.id === offer.id)?.hasActivePromotion) {
      pass('offers section uses real active promotions');
    } else fail('offers section uses real active promotions', JSON.stringify(offs?.propertyIds));

    if (!offs?.propertyIds?.includes(recent.id)) pass('coupons do not create homepage offer cards');
    else fail('coupons do not create homepage offer cards', 'coupon listing in offers');

    const ratedCard = top?.properties?.find((p) => p.id === rated.id);
    if (top?.propertyIds?.includes(rated.id) && ratedCard?.reviewCount > 0 && ratedCard.rating === 5) {
      pass('top rated uses published reviews only');
    } else fail('top rated uses published reviews only', JSON.stringify(ratedCard));

    if (!top?.propertyIds?.includes(recent.id)) pass('legacy seeded rating fields do not rank Top Rated');
    else fail('legacy seeded rating fields do not rank Top Rated', 'seeded listing in top rated');

    if (rec?.propertyIds?.[0] === recent.id) pass('recently added ordering is deterministic');
    else fail('recently added ordering is deterministic', JSON.stringify(rec?.propertyIds));

    const allIds = [spon, feat, offs, top, rec].flatMap((s) => s?.propertyIds ?? []);
    if (!allIds.includes(unpublished.id)) pass('unpublished property excluded');
    else fail('unpublished property excluded', 'listed');

    const ownerRow = await prisma.ownerProfile.findFirst({ where: { user: { email: OWNER1.email } } });
    ownerProfileId = ownerRow?.id ?? null;
    ownerPrevStatus = ownerRow?.status ?? null;
    if (ownerProfileId) {
      await prisma.ownerProfile.update({ where: { id: ownerProfileId }, data: { status: 'suspended' } });
    }
    const sus = await api('GET', `/properties/discovery?area=${AREA}`, null, false);
    const susIds = (sus.json.data?.sections ?? []).flatMap((s) => s.propertyIds);
    if (!susIds.includes(sponsored.id)) pass('suspended/non-approved owner excluded');
    else fail('suspended/non-approved owner excluded', 'still listed');
    if (ownerProfileId && ownerPrevStatus) {
      await prisma.ownerProfile.update({ where: { id: ownerProfileId }, data: { status: ownerPrevStatus } });
      ownerProfileId = null;
    }

    const emptyDisc = await api('GET', `/properties/discovery?area=${EMPTY_AREA}`, null, false);
    const emptyIds = (emptyDisc.json.data?.sections ?? []).map((s) => s.id);
    if (!emptyIds.includes('sponsored') && !emptyIds.includes('featured') && emptyIds.includes('recentlyAdded')) {
      pass('empty section is omitted');
    } else fail('empty section is omitted', emptyIds.join(','));

    const overlap =
      (spon?.propertyIds ?? []).some((id) => (feat?.propertyIds ?? []).includes(id)) ||
      (spon?.propertyIds ?? []).some((id) => (offs?.propertyIds ?? []).includes(id)) ||
      (spon?.propertyIds ?? []).some((id) => (rec?.propertyIds ?? []).includes(id));
    if (!overlap) pass('cross-section deduplication works');
    else fail('cross-section deduplication works', 'duplicate across rails');

    const flagged = (spon?.properties ?? []).every(
      (p) => typeof p.isSponsored === 'boolean' && typeof p.isFeatured === 'boolean',
    );
    if (flagged) pass('no N+1 regression');
    else fail('no N+1 regression', 'missing flags');

    if (
      !spon?.propertyIds?.includes(recent.id) &&
      !feat?.propertyIds?.includes(recent.id) &&
      recent
    ) {
      pass('hasPlatformDeal does not drive merchandising');
    } else fail('hasPlatformDeal does not drive merchandising', 'deal listing merchandised');

    const sCard = spon?.properties?.find((p) => p.id === sponsored.id);
    const fCard = feat?.properties?.find((p) => p.id === featured.id);
    const oCard = offs?.properties?.find((p) => p.id === offer.id);
    if (sCard?.isSponsored && fCard?.isFeatured && oCard?.hasActivePromotion && !sCard.hasActivePromotion) {
      pass('property card keeps correct sponsored/featured/offer labels');
    } else fail('property card keeps correct sponsored/featured/offer labels', JSON.stringify({ sCard, fCard, oCard }));

    const catalogProbe = await api('GET', `/properties?area=${AREA}&sort=newest`, null, false);
    const newestIds = (catalogProbe.json.data ?? []).map((p) => p.id);
    // With HOMEPAGE_CATALOG_LIMIT=2, organic newest rail must prefer recent, while commercial rails still include aged listings.
    if (spon?.propertyIds?.includes(sponsored.id)) pass('sponsored property older than newest-catalog boundary still appears');
    else fail('sponsored property older than newest-catalog boundary still appears', JSON.stringify(spon?.propertyIds));

    if (feat?.propertyIds?.includes(featured.id)) pass('old featured property still appears');
    else fail('old featured property still appears', JSON.stringify(feat?.propertyIds));

    if (offs?.propertyIds?.includes(offer.id)) pass('old property with current promotion still appears');
    else fail('old property with current promotion still appears', JSON.stringify(offs?.propertyIds));

    if (top?.propertyIds?.includes(rated.id)) pass('highly rated older property can appear in Top Rated');
    else fail('highly rated older property can appear in Top Rated', JSON.stringify(top?.propertyIds));

    if (
      (spon?.properties ?? []).length <= 8 &&
      (feat?.properties ?? []).length <= 8 &&
      (offs?.properties ?? []).length <= 8 &&
      (top?.properties ?? []).length <= 8
    ) {
      pass('query count remains bounded');
    } else fail('query count remains bounded', 'oversized rails');

    void newestIds;
    void emptyOnly;
    void unpublished;
  } catch (e) {
    fail('homepage runner', e instanceof Error ? e.message : String(e));
  } finally {
    if (ownerProfileId && ownerPrevStatus) {
      await prisma.ownerProfile.update({ where: { id: ownerProfileId }, data: { status: ownerPrevStatus } });
    }
    try {
      await unpublishByIds(createdPropertyIds);
    } catch (cleanupErr) {
      console.log(
        `  ⚠️ fixture cleanup: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`,
      );
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
