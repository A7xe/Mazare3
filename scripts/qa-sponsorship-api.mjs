/**
 * Phase 10F.3B — paid partner sponsored placement orders
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
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `sp-${Date.now()}`;
const AREA = `qa-spon-${RUN}`;
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
let owner2Prev = null;
let owner2Id = null;

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

async function setupListing(titleEn, extra = {}) {
  await login(OWNER1);
  const created = await api('POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة إعلان ${titleEn}`,
    titleEn,
    descriptionAr: 'مزرعة اختبار لطلبات الإعلان المدفوع للمالك.',
    descriptionEn: 'Sponsorship order QA farm.',
    city: extra.city ?? 'amman',
    area: extra.area ?? AREA,
    approximateAddress: 'عمان — اختبار الإعلان',
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

async function main() {
  console.log('\n📣 Phase 10F.3B sponsorship order QA\n');
  try {
    const payoutBefore = await prisma.ownerPayout.aggregate({ _sum: { amount: true }, _count: true });
    const paymentBefore = await prisma.payment.count();
    const settlementBefore = await prisma.ownerSettlement.aggregate({ _sum: { ownerNetAmount: true }, _count: true });

    await login(ADMIN);
    const pkg = await api('POST', '/admin/sponsorship-packages', {
      nameAr: `باقة ${RUN}`,
      nameEn: `Pack ${RUN}`,
      durationDays: 7,
      priceAmount: 25,
    });
    if (pkg.status === 201 && pkg.json.data?.priceAmount === 25 && pkg.json.data?.status === 'active') {
      pass('admin creates sponsorship package');
    } else fail('admin creates sponsorship package', JSON.stringify(pkg.json));
    const packageId = pkg.json.data?.id;

    await login(OWNER1);
    const pkgs = await api('GET', '/owner/sponsorship-packages');
    if (pkgs.status === 200 && pkgs.json.data?.some((p) => p.id === packageId)) pass('owner sees active packages');
    else fail('owner sees active packages', String(pkgs.status));

    const sponsored = await setupListing(`QA Spon ${RUN}`, { basePrice: 1600 });
    const organic = await setupListing(`QA Org ${RUN}`, { basePrice: 400 });
    const unpublished = await setupListing(`QA Draft ${RUN}`, { publish: false, basePrice: 700 });

    await login(OWNER1);
    const reqOk = await api('POST', `/owner/properties/${sponsored.id}/sponsorship-orders`, { packageId });
    if (reqOk.status === 201 && reqOk.json.data?.status === 'pending_review') {
      pass('owner requests package for own property');
    } else fail('owner requests package for own property', JSON.stringify(reqOk.json));
    const orderId = reqOk.json.data?.id;

    await login(OWNER2);
    const cross = await api('POST', `/owner/properties/${sponsored.id}/sponsorship-orders`, { packageId });
    if (cross.status === 403 || cross.status === 404) pass('owner cannot request for another owner property');
    else fail('owner cannot request for another owner property', String(cross.status));

    const o2 = await prisma.ownerProfile.findFirst({ where: { user: { email: OWNER2.email } } });
    owner2Id = o2?.id ?? null;
    owner2Prev = o2?.status ?? null;
    if (owner2Id) {
      await prisma.ownerProfile.update({ where: { id: owner2Id }, data: { status: 'pending' } });
    }
    await login(OWNER2);
    const unapproved = await api('POST', `/owner/properties/${sponsored.id}/sponsorship-orders`, { packageId });
    if (unapproved.status === 403) pass('unapproved owner cannot request');
    else fail('unapproved owner cannot request', String(unapproved.status));
    if (owner2Id && owner2Prev) {
      await prisma.ownerProfile.update({ where: { id: owner2Id }, data: { status: owner2Prev } });
      owner2Id = null;
    }

    await login(OWNER1);
    const unpub = await api('POST', `/owner/properties/${unpublished.id}/sponsorship-orders`, { packageId });
    if (unpub.status === 409 && unpub.json.code === 'PROPERTY_NOT_PUBLISHED') {
      pass('unpublished property cannot request');
    } else fail('unpublished property cannot request', `${unpub.status} ${unpub.json.code}`);

    await login(ADMIN);
    await api('PATCH', `/admin/sponsorship-packages/${packageId}`, { priceAmount: 99, durationDays: 30 });
    const snap = await api('GET', `/admin/sponsorship-orders`);
    const orderRow = snap.json.data?.find((o) => o.id === orderId);
    if (orderRow?.priceAmountSnapshot === 25 && orderRow?.durationDaysSnapshot === 7) {
      pass('package price/duration snapshots remain unchanged after package edit');
    } else fail('package snapshots', JSON.stringify(orderRow));

    const approved = await api('POST', `/admin/sponsorship-orders/${orderId}/approve`, {});
    if (approved.status === 200 && approved.json.data?.status === 'approved_pending_payment') {
      pass('admin can approve');
    } else fail('admin can approve', JSON.stringify(approved.json));

    await login(OWNER1);
    const rejectCreated = await api('POST', `/owner/properties/${organic.id}/sponsorship-orders`, { packageId });
    await login(ADMIN);
    const rejected = await api('POST', `/admin/sponsorship-orders/${rejectCreated.json.data.id}/reject`, {
      adminNote: 'qa reject',
    });
    if (rejected.status === 200 && rejected.json.data?.status === 'rejected') pass('admin can reject');
    else fail('admin can reject', JSON.stringify(rejected.json));

    const unpaidAct = await api('POST', `/admin/sponsorship-orders/${orderId}/activate`, {});
    if (unpaidAct.status === 409) pass('unpaid order cannot activate');
    else fail('unpaid order cannot activate', String(unpaidAct.status));

    const payDate = new Date().toISOString().slice(0, 10);
    const paid = await api('POST', `/admin/sponsorship-orders/${orderId}/confirm-payment`, {
      paymentReference: `REF-${RUN}`,
      paymentDate: payDate,
    });
    if (
      paid.status === 200 &&
      paid.json.data?.paymentReference === `REF-${RUN}` &&
      paid.json.data?.paymentDate === payDate &&
      paid.json.data?.advertisingRevenueAmount === 25
    ) {
      pass('payment confirmation stores reference/date');
    } else fail('payment confirmation stores reference/date', JSON.stringify(paid.json));

    const paidTwice = await api('POST', `/admin/sponsorship-orders/${orderId}/confirm-payment`, {
      paymentReference: 'SECOND',
      paymentDate: payDate,
    });
    if (paidTwice.status === 409) pass('payment cannot be confirmed twice');
    else fail('payment cannot be confirmed twice', String(paidTwice.status));

    const act = await api('POST', `/admin/sponsorship-orders/${orderId}/activate`, {});
    if (act.status === 200 && act.json.data?.placementId && act.json.data?.status === 'active') {
      pass('paid order activates exactly one sponsored placement');
    } else fail('paid order activates exactly one sponsored placement', JSON.stringify(act.json));
    const placementId = act.json.data?.placementId;
    const placements = await prisma.propertyPlacement.count({
      where: { id: placementId, placementType: 'sponsored' },
    });
    if (placements === 1) pass('exactly one placement row');
    else fail('exactly one placement row', String(placements));

    const actTwice = await api('POST', `/admin/sponsorship-orders/${orderId}/activate`, {});
    if (actTwice.status === 409) pass('cannot activate twice');
    else fail('cannot activate twice', String(actTwice.status));

    const starts = new Date(act.json.data.placementStartsAt).getTime();
    const ends = new Date(act.json.data.placementEndsAt).getTime();
    const days = Math.round((ends - starts) / 86400000);
    if (days === 7) pass('placement duration matches purchased duration');
    else fail('placement duration matches purchased duration', String(days));

    const rec = await api('GET', `/properties?area=${AREA}&sort=recommended`, null, false);
    const recIds = (rec.json.data ?? []).map((p) => p.id);
    const sCard = rec.json.data?.find((p) => p.id === sponsored.id);
    if (recIds[0] === sponsored.id && sCard?.isSponsored === true) {
      pass('sponsored ranking reuses existing placement behavior');
    } else fail('sponsored ranking', JSON.stringify({ recIds: recIds.slice(0, 3), sCard }));

    await prisma.propertyPlacement.update({
      where: { id: placementId },
      data: { endsAt: new Date(Date.now() - 60_000), status: 'active' },
    });
    const rec2 = await api('GET', `/properties?area=${AREA}&sort=recommended`, null, false);
    const expiredCard = rec2.json.data?.find((p) => p.id === sponsored.id);
    if (expiredCard?.isSponsored !== true) pass('expired placement stops affecting ranking');
    else fail('expired placement stops affecting ranking', JSON.stringify(expiredCard));

    const payoutAfter = await prisma.ownerPayout.aggregate({ _sum: { amount: true }, _count: true });
    const paymentAfter = await prisma.payment.count();
    const settlementAfter = await prisma.ownerSettlement.aggregate({ _sum: { ownerNetAmount: true }, _count: true });
    if (
      payoutAfter._count === payoutBefore._count &&
      String(payoutAfter._sum.amount) === String(payoutBefore._sum.amount) &&
      settlementAfter._count === settlementBefore._count
    ) {
      pass('sponsorship cost does not affect OwnerPayout or settlement');
    } else fail('sponsorship cost does not affect OwnerPayout or settlement', 'changed');

    if (paymentAfter === paymentBefore) pass('sponsorship revenue remains separate from booking payments');
    else fail('sponsorship revenue remains separate from booking payments', `${paymentBefore} -> ${paymentAfter}`);

    await login(OWNER2);
    const listOther = await api('GET', `/owner/properties/${sponsored.id}/sponsorship-orders`);
    if (listOther.status === 403) pass('cross-owner access is rejected');
    else fail('cross-owner access is rejected', String(listOther.status));
  } catch (e) {
    fail('sponsorship runner', e instanceof Error ? e.message : String(e));
  } finally {
    if (owner2Id && owner2Prev) {
      await prisma.ownerProfile.update({ where: { id: owner2Id }, data: { status: owner2Prev } });
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
