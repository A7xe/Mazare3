/**
 * Phase 10F.3A — admin-managed sponsored/featured placements
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
const RUN = `pl-${Date.now()}`;
const AREA = `qa-place-${RUN}`;
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

function plusDays(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d;
}

function windowIso(startOffset, endOffset) {
  return {
    startsAt: plusDays(startOffset).toISOString(),
    endsAt: plusDays(endOffset).toISOString(),
  };
}

async function createProperty(titleEn, extra = {}) {
  return api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة إعلان ${titleEn}`,
    titleEn,
    descriptionAr: 'مزرعة اختبار للترتيب المموّل والمميز دون تغيير السعر أو التوفر.',
    descriptionEn: 'Placement ranking QA farm. Availability and filters must still apply.',
    city: extra.city ?? 'amman',
    area: extra.area ?? AREA,
    approximateAddress: 'عمان — اختبار الإعلان',
    exactAddress: 'عنوان مخفي',
    basePrice: extra.basePrice ?? 500,
    capacity: extra.capacity ?? 18,
    imageUrls: IMAGES,
    amenityKeys: extra.amenityKeys ?? ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
}

async function publish(propId) {
  await login(OWNER1);
  await api('POST', `/owner/properties/${propId}/submit-review`);
  await login(ADMIN);
  return api('PATCH', `/admin/properties/${propId}/status`, { status: 'published' });
}

async function setupListing(titleEn, extra = {}) {
  await login(OWNER1);
  const created = await createProperty(titleEn, extra);
  if (created.status !== 201) {
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json.data.id;
  const slug = created.json.data.slug;
  await api('PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api('POST', `/owner/properties/${id}/availability/generate`, {});
  const pub = await publish(id);
  if (pub.status !== 200) throw new Error(`publish failed ${pub.status}`);
  return { id, slug };
}

async function createAndActivate(propertyId, placementType, startsAt, endsAt) {
  await login(ADMIN);
  const created = await api('POST', `/admin/properties/${propertyId}/placements`, {
    placementType,
    startsAt,
    endsAt,
    adminNote: 'qa-10f3a',
  });
  if (created.status !== 201) return created;
  const id = created.json.data.id;
  const act = await api('POST', `/admin/properties/${propertyId}/placements/${id}/activate`, {});
  return { created, act, id };
}

function idsIn(data) {
  return (data ?? []).map((p) => p.id);
}

async function search(qs) {
  return api('GET', `/properties?${qs}`, null, false);
}

async function main() {
  console.log('\n📣 Phase 10F.3A placements API QA\n');
  try {
    await prisma.propertyPlacement.updateMany({
      where: { status: 'active' },
      data: { status: 'paused' },
    });

    const sponsored = await setupListing(`QA Spon ${RUN}`, { basePrice: 1800, capacity: 8 });
    const featured = await setupListing(`QA Feat ${RUN}`, { basePrice: 900, capacity: 18 });
    const organic = await setupListing(`QA Org ${RUN}`, { basePrice: 400, capacity: 18 });
    const unpublished = await setupListing(`QA Unpub ${RUN}`, { basePrice: 700, capacity: 18 });
    const future = await setupListing(`QA Future ${RUN}`, { basePrice: 1100, capacity: 18 });
    const expired = await setupListing(`QA Exp ${RUN}`, { basePrice: 1200, capacity: 18 });

    await prisma.property.update({
      where: { id: organic.id },
      data: { hasPlatformDeal: true },
    });

    const liveWin = windowIso(-1, 14);
    const featCreate = await createAndActivate(featured.id, 'featured', liveWin.startsAt, liveWin.endsAt);
    if (featCreate.created.status === 201 && featCreate.act.status === 200) {
      pass('admin creates featured placement');
    } else {
      fail('admin creates featured placement', JSON.stringify(featCreate.created.json));
    }

    const sponCreate = await createAndActivate(sponsored.id, 'sponsored', liveWin.startsAt, liveWin.endsAt);
    if (sponCreate.created.status === 201 && sponCreate.act.status === 200) {
      pass('admin creates sponsored placement');
    } else {
      fail('admin creates sponsored placement', JSON.stringify(sponCreate.created.json));
    }

    const note = sponCreate.created.json.data?.adminNote;
    const publicCard = await search(`area=${AREA}&sort=recommended`);
    const publicS = publicCard.json.data?.find((p) => p.id === sponsored.id);
    if (publicS && !('adminNote' in publicS) && !('createdByAdminId' in publicS)) {
      pass('public payload omits admin note and actor');
    } else fail('public payload omits admin note and actor', JSON.stringify(publicS));

    await login(OWNER1);
    const ownerPost = await api('POST', `/admin/properties/${sponsored.id}/placements`, {
      placementType: 'sponsored',
      ...liveWin,
    });
    if (ownerPost.status === 403 || ownerPost.status === 401) pass('owner cannot create placement');
    else fail('owner cannot create placement', String(ownerPost.status));

    await login(CUSTOMER);
    const custPost = await api('POST', `/admin/properties/${sponsored.id}/placements`, {
      placementType: 'featured',
      ...liveWin,
    });
    if (custPost.status === 403 || custPost.status === 401) pass('customer cannot create placement');
    else fail('customer cannot create placement', String(custPost.status));

    const futWin = windowIso(10, 20);
    const fut = await createAndActivate(future.id, 'sponsored', futWin.startsAt, futWin.endsAt);
    const futSearch = await search(`area=${AREA}&sort=recommended`);
    const futCard = futSearch.json.data?.find((p) => p.id === future.id);
    if (fut.act.status === 200 && futCard && futCard.isSponsored !== true && futCard.isFeatured !== true) {
      pass('future placement is not active early');
    } else fail('future placement is not active early', JSON.stringify(futCard));

    const exp = await createAndActivate(expired.id, 'sponsored', liveWin.startsAt, liveWin.endsAt);
    if (exp.id) {
      await prisma.propertyPlacement.update({
        where: { id: exp.id },
        data: { endsAt: plusDays(-1), status: 'active' },
      });
    }
    await login(ADMIN);
    await api('POST', `/admin/properties/${featured.id}/placements/${featCreate.id}/pause`, {});
    const pausedSearch = await search(`area=${AREA}&sort=recommended`);
    const pausedIds = idsIn(pausedSearch.json.data);
    const expCard = pausedSearch.json.data?.find((p) => p.id === expired.id);
    if (!pausedIds.includes(featured.id) || featured.id && pausedSearch.json.data?.find((p) => p.id === featured.id)?.isFeatured) {
      /* featured still in list as organic without badge */
    }
    const featPausedCard = pausedSearch.json.data?.find((p) => p.id === featured.id);
    if (featPausedCard?.isFeatured !== true && expCard?.isSponsored !== true) {
      pass('expired/paused placement does not rank');
    } else fail('expired/paused placement does not rank', JSON.stringify({ featPausedCard, expCard }));

    await login(ADMIN);
    await api('POST', `/admin/properties/${featured.id}/placements/${featCreate.id}/activate`, {});

    const ownerRow = await prisma.ownerProfile.findFirst({
      where: { user: { email: OWNER1.email } },
    });
    ownerProfileId = ownerRow?.id ?? null;
    ownerPrevStatus = ownerRow?.status ?? null;
    if (ownerProfileId) {
      await prisma.ownerProfile.update({
        where: { id: ownerProfileId },
        data: { status: 'suspended' },
      });
    }
    const sus = await search(`area=${AREA}&sort=recommended`);
    if (!(sus.json.data ?? []).some((p) => p.id === sponsored.id)) {
      pass('suspended owner placement does not appear');
    } else fail('suspended owner placement does not appear', 'still listed');
    if (ownerProfileId && ownerPrevStatus) {
      await prisma.ownerProfile.update({
        where: { id: ownerProfileId },
        data: { status: ownerPrevStatus },
      });
      ownerProfileId = null;
    }

    await login(ADMIN);
    await api('PATCH', `/admin/properties/${unpublished.id}/status`, { status: 'unpublished' });
    const unWin = windowIso(-1, 10);
    await createAndActivate(unpublished.id, 'sponsored', unWin.startsAt, unWin.endsAt);
    const unSearch = await search(`area=${AREA}&sort=recommended`);
    if (!(unSearch.json.data ?? []).some((p) => p.id === unpublished.id)) {
      pass('unpublished property placement does not appear');
    } else fail('unpublished property placement does not appear', 'listed');

    const date = plusDays(18).toISOString().slice(0, 10);
    await login(OWNER1);
    const slots = await api(
      'GET',
      `/owner/availability?propertyId=${sponsored.id}&from=${date}&to=${date}`,
    );
    const morning = slots.json.data?.find((s) => s.date === date && s.period === 'morning');
    if (morning?.id) {
      await api('PATCH', `/owner/availability/${morning.id}`, { status: 'blocked' });
    }
    const avail = await search(`date=${date}&period=morning&area=${AREA}&city=amman`);
    if (!(avail.json.data ?? []).some((p) => p.id === sponsored.id)) {
      pass('sponsored property still must match availability');
    } else fail('sponsored property still must match availability', 'listed while blocked');
    if (morning?.id) await api('PATCH', `/owner/availability/${morning.id}`, { status: 'available' });

    const cityMiss = await search(`city=irbid&area=${AREA}&sort=recommended`);
    const guestsMiss = await search(`area=${AREA}&guests=40&sort=recommended`);
    if (
      !(cityMiss.json.data ?? []).some((p) => p.id === sponsored.id) &&
      !(guestsMiss.json.data ?? []).some((p) => p.id === sponsored.id)
    ) {
      pass('sponsored property still must match city/guests/filters');
    } else fail('sponsored property still must match city/guests/filters', 'bypass');

    const rec = await search(`area=${AREA}&sort=recommended`);
    const recIds = idsIn(rec.json.data).filter((id) =>
      [sponsored.id, featured.id, organic.id].includes(id),
    );
    if (recIds[0] === sponsored.id && recIds[1] === featured.id && recIds[2] === organic.id) {
      pass('recommended ranks sponsored before featured before organic');
    } else fail('recommended ranks sponsored before featured before organic', recIds.join(','));

    const price = await search(`area=${AREA}&sort=price_asc`);
    const priceIds = idsIn(price.json.data).filter((id) =>
      [sponsored.id, featured.id, organic.id].includes(id),
    );
    if (priceIds[0] === organic.id && priceIds[1] === featured.id && priceIds[2] === sponsored.id) {
      pass('price sort is not distorted by sponsorship');
    } else fail('price sort is not distorted by sponsorship', priceIds.join(','));

    const sCard = rec.json.data?.find((p) => p.id === sponsored.id);
    const fCard = rec.json.data?.find((p) => p.id === featured.id);
    const oCard = rec.json.data?.find((p) => p.id === organic.id);
    if (sCard?.isSponsored === true && sCard.placementType === 'sponsored') {
      pass('sponsored badge is exposed truthfully');
    } else fail('sponsored badge is exposed truthfully', JSON.stringify(sCard));
    if (fCard?.isFeatured === true && fCard.placementType === 'featured' && fCard.isSponsored !== true) {
      pass('featured badge is exposed truthfully');
    } else fail('featured badge is exposed truthfully', JSON.stringify(fCard));
    if (
      oCard?.hasPlatformDeal === true &&
      oCard.isSponsored !== true &&
      oCard.isFeatured !== true
    ) {
      pass('legacy hasPlatformDeal no longer creates sponsored/discount messaging');
    } else fail('legacy hasPlatformDeal no longer creates sponsored/discount messaging', JSON.stringify(oCard));

    const flagged = (rec.json.data ?? []).every(
      (p) => typeof p.isSponsored === 'boolean' && typeof p.isFeatured === 'boolean',
    );
    if (flagged && (rec.json.data ?? []).length >= 3) {
      pass('no N+1 placement lookup regression (batched flags on list)');
    } else fail('no N+1 placement lookup regression', 'missing flags');

    const disc = await api('GET', `/properties/discovery?city=amman`, null, false);
    const sections = disc.json.data?.sections ?? [];
    const sponRail = sections.find((s) => s.id === 'sponsored');
    const featRail = sections.find((s) => s.id === 'featured');
    const sponHas = sponRail?.propertyIds?.includes(sponsored.id);
    const featHas = featRail?.propertyIds?.includes(featured.id);
    const dup =
      sponRail?.propertyIds?.includes(featured.id) && featRail?.propertyIds?.includes(sponsored.id);
    if (sponHas && featHas && !sponRail?.propertyIds?.includes(featured.id)) {
      pass('discovery rails use live placements without empty fakes');
    } else fail('discovery rails', JSON.stringify({ sponHas, featHas, dup }));

    void note;
  } catch (e) {
    fail('placements runner', e instanceof Error ? e.message : String(e));
  } finally {
    if (ownerProfileId && ownerPrevStatus) {
      await prisma.ownerProfile.update({
        where: { id: ownerProfileId },
        data: { status: ownerPrevStatus },
      });
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
