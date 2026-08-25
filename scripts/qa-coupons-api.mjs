/**
 * Phase 10F.2A — owner-funded property coupons
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
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER2 = { email: 'owner2@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `C${Date.now().toString(36).slice(-6).toUpperCase()}`;

const prisma = new PrismaClient({ log: ['error'] });
const createdCouponIds = [];
const createdBookingIds = [];
const createdPromoIds = [];

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
function jodToFils(value) {
  return Math.round(Number(value) * 100);
}
function windowIso() {
  const start = new Date();
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + 21);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
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

async function cleanup() {
  for (const id of createdBookingIds) {
    try {
      await login(CUSTOMER);
      await api('POST', `/me/bookings/${id}/cancel`);
    } catch {
      /* ignore */
    }
  }
  if (createdCouponIds.length) {
    await prisma.propertyCoupon.updateMany({
      where: { id: { in: createdCouponIds } },
      data: { status: 'paused' },
    });
  }
  if (createdPromoIds.length) {
    await prisma.propertyPromotion.updateMany({
      where: { id: { in: createdPromoIds } },
      data: { status: 'paused' },
    });
  }
  await prisma.$disconnect();
}

async function main() {
  console.log('\n🎟️  Phase 10F.2A coupons QA\n');
  try {
    await login(OWNER1);
    const mine = await api('GET', '/owner/properties');
    const emerald = (mine.json.data ?? []).find((p) => p.slug === SLUG);
    if (!emerald) {
      fail('owner1 emerald', 'missing');
      return;
    }
    const propertyId = emerald.id;
    await prisma.propertyPromotion.updateMany({
      where: { propertyId, status: 'active' },
      data: { status: 'paused' },
    });
    await prisma.propertyCoupon.updateMany({
      where: { propertyId, status: 'active' },
      data: { status: 'paused' },
    });

    await login(OWNER2);
    const otherList = await api('GET', '/owner/properties');
    const otherId = otherList.json.data?.[0]?.id;

    await login(OWNER1);
    const created = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `own${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (created.status === 201 && created.json.data?.id) {
      createdCouponIds.push(created.json.data.id);
      await api('POST', `/owner/properties/${propertyId}/coupons/${created.json.data.id}/activate`);
      pass('owner creates coupon for own property');
    } else fail('owner creates coupon for own property', `${created.status} ${JSON.stringify(created.json)}`);

    if (otherId) {
      const cross = await api('POST', `/owner/properties/${otherId}/coupons`, {
        code: `x${RUN}`,
        discountType: 'percentage',
        discountValue: 10,
        ...windowIso(),
      });
      if (cross.status === 403 || cross.status === 404) pass('owner cannot create coupon for another property');
      else fail('owner cannot create coupon for another property', String(cross.status));
    } else fail('owner cannot create coupon for another property', 'no owner2 property');

    const caseCoupon = created.json.data?.normalizedCode;
    const slot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const lower = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: String(caseCoupon).toLowerCase(),
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    if (lower.status === 200 && lower.json.data?.valid && lower.json.data.normalizedCode === caseCoupon) {
      pass('code matching is case-insensitive');
    } else fail('code matching is case-insensitive', `${lower.status} ${JSON.stringify(lower.json)}`);

    await login(OWNER1);
    const badPct = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `badp${RUN}`,
      discountType: 'percentage',
      discountValue: 150,
      ...windowIso(),
    });
    const badFixed = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `badf${RUN}`,
      discountType: 'fixed_amount',
      discountValue: 99999,
      ...windowIso(),
    });
    if (badPct.status === 400 && badFixed.status === 400) pass('invalid percentage/fixed amount rejected');
    else fail('invalid percentage/fixed amount rejected', `${badPct.status}/${badFixed.status}`);

    const paused = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `pause${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (paused.status === 201) createdCouponIds.push(paused.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${paused.json.data.id}/activate`);
    await api('POST', `/owner/properties/${propertyId}/coupons/${paused.json.data.id}/pause`);
    const expired = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `exp${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (expired.status === 201) createdCouponIds.push(expired.json.data.id);
    await prisma.propertyCoupon.update({
      where: { id: expired.json.data.id },
      data: {
        status: 'active',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: new Date('2020-01-02T00:00:00.000Z'),
      },
    });
    await login(CUSTOMER);
    const pausedV = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `pause${RUN}`,
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    const expiredV = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `exp${RUN}`,
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    if (
      (pausedV.status === 400 && (pausedV.json.code === 'COUPON_PAUSED' || pausedV.json.code === 'COUPON_EXPIRED')) &&
      (expiredV.status === 400 && (expiredV.json.code === 'COUPON_EXPIRED' || expiredV.json.code === 'COUPON_INVALID'))
    ) {
      pass('expired/paused coupon rejected');
    } else fail('expired/paused coupon rejected', `${pausedV.json.code}/${expiredV.json.code}`);

    await login(OWNER1);
    const minC = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `min${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      minBookingAmount: 99999,
      ...windowIso(),
    });
    if (minC.status === 201) createdCouponIds.push(minC.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${minC.json.data.id}/activate`);
    await login(CUSTOMER);
    const minV = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `min${RUN}`,
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    if (minV.status === 400 && minV.json.code === 'COUPON_MIN_AMOUNT') pass('minimum amount enforced');
    else fail('minimum amount enforced', `${minV.status} ${minV.json.code}`);

    const existingSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const before = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: existingSlot.json.data.date,
      period: existingSlot.json.data.period,
      guestsCount: 2,
    });
    if (before.status === 201) createdBookingIds.push(before.json.data.id);
    const existingTotal = before.json.data?.totalAmount;
    if (before.status !== 201) fail('historical booking setup', `${before.status} ${JSON.stringify(before.json)}`);

    await login(OWNER1);
    const once = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `once${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      maxUses: 1,
      maxUsesPerCustomer: 1,
      ...windowIso(),
    });
    if (once.status === 201) createdCouponIds.push(once.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${once.json.data.id}/activate`);

    await login(CUSTOMER);
    const afterEdit = await api('GET', `/me/bookings/${before.json.data.id}`);
    if (jodToFils(afterEdit.json.data?.totalAmount) === jodToFils(existingTotal)) {
      pass('historical bookings remain unchanged');
    } else fail('historical bookings remain unchanged', JSON.stringify(afterEdit.json.data?.totalAmount));

    const v1 = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `once${RUN}`,
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    const v2 = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `once${RUN}`,
      date: slot.json.data.date,
      period: slot.json.data.period,
    });
    const usageBefore = await prisma.couponRedemption.count({
      where: { couponId: once.json.data.id, status: { in: ['reserved', 'redeemed'] } },
    });
    if (v1.status === 200 && v2.status === 200 && usageBefore === 0) pass('validation does not consume usage');
    else fail('validation does not consume usage', `${usageBefore} ${v1.status} ${v2.status}`);

    const bookSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const priced = (
      await api('POST', `/properties/${SLUG}/coupons/validate`, {
        code: `once${RUN}`,
        date: bookSlot.json.data.date,
        period: bookSlot.json.data.period,
      })
    ).json.data;
    const booked = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: bookSlot.json.data.date,
      period: bookSlot.json.data.period,
      guestsCount: 2,
      couponCode: `once${RUN}`,
      expectedTotalAmount: priced.finalPrice,
    });
    if (booked.status === 201) createdBookingIds.push(booked.json.data.id);
    const reserved = await prisma.couponRedemption.findUnique({
      where: { bookingId: booked.json.data?.id ?? '' },
    });
    if (booked.status === 201 && reserved?.status === 'reserved') pass('booking reserves usage atomically');
    else fail('booking reserves usage atomically', `${booked.status} ${reserved?.status}`);

    if (
      booked.json.data &&
      jodToFils(booked.json.data.depositAmount + booked.json.data.remainingAmount) ===
        jodToFils(booked.json.data.totalAmount) &&
      booked.json.data.couponDiscountAmount > 0
    ) {
      pass('deposit/remaining/commission use coupon-discounted total');
    } else fail('deposit/remaining use coupon-discounted total', JSON.stringify(booked.json.data));

    const ledger = booked.json.data?.id
      ? await prisma.booking.findUnique({
          where: { id: booked.json.data.id },
          select: { platformCommissionAmount: true, ownerNetPayoutAmount: true, totalAmount: true },
        })
      : null;
    if (
      ledger &&
      jodToFils(Number(ledger.platformCommissionAmount) + Number(ledger.ownerNetPayoutAmount)) ===
        jodToFils(Number(ledger.totalAmount))
    ) {
      pass('commission uses coupon-discounted total');
    } else fail('commission uses coupon-discounted total', JSON.stringify(ledger));

    const reuseSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const reuse = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: reuseSlot.json.data.date,
      period: reuseSlot.json.data.period,
      guestsCount: 2,
      couponCode: `once${RUN}`,
      expectedTotalAmount: priced.finalPrice,
    });
    if (reuse.status === 400 && (reuse.json.code === 'COUPON_ALREADY_USED' || reuse.json.code === 'COUPON_USAGE_LIMIT')) {
      pass('customer-use limit enforced');
    } else fail('customer-use limit enforced', `${reuse.status} ${reuse.json.code}`);
    if (reuse.status === 201) createdBookingIds.push(reuse.json.data.id);

    await login(OWNER1);
    const glob = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `glob${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      maxUses: 1,
      maxUsesPerCustomer: 5,
      ...windowIso(),
    });
    if (glob.status === 201) createdCouponIds.push(glob.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${glob.json.data.id}/activate`);
    const twoDb = await prisma.availabilitySlot.findMany({
      where: { propertyId, status: 'available', date: { gte: new Date() } },
      orderBy: { date: 'asc' },
      take: 2,
    });
    const two = twoDb.map((s) => ({
      date: s.date.toISOString().slice(0, 10),
      period: s.period,
      bookable: true,
    }));
    await login(CUSTOMER);
    if (two.length >= 2) {
      const [r1, r2] = await Promise.all([
        api('POST', '/bookings', {
          propertySlug: SLUG,
          date: two[0].date,
          period: two[0].period,
          guestsCount: 2,
          couponCode: `glob${RUN}`,
        }),
        api('POST', '/bookings', {
          propertySlug: SLUG,
          date: two[1].date,
          period: two[1].period,
          guestsCount: 2,
          couponCode: `glob${RUN}`,
        }),
      ]);
      const ok = [r1, r2].filter((r) => r.status === 201);
      const blocked = [r1, r2].filter((r) => r.status !== 201);
      for (const r of ok) createdBookingIds.push(r.json.data.id);
      const used = await prisma.couponRedemption.count({
        where: { couponId: glob.json.data.id, status: { in: ['reserved', 'redeemed'] } },
      });
      if (ok.length === 1 && blocked.length === 1 && used === 1) pass('global use limit enforced');
      else fail('global use limit enforced', `ok=${ok.length} blocked=${blocked.length} used=${used}`);
      if (ok.length === 1 && blocked.length === 1) pass('concurrent final use cannot exceed limit');
      else fail('concurrent final use cannot exceed limit', `ok=${ok.length}`);
    } else {
      fail('global use limit enforced', 'need two bookable slots');
      fail('concurrent final use cannot exceed limit', 'need two bookable slots');
    }

    const relSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(OWNER1);
    const relC = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `rel${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      maxUsesPerCustomer: 1,
      ...windowIso(),
    });
    if (relC.status === 201) createdCouponIds.push(relC.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${relC.json.data.id}/activate`);
    await login(CUSTOMER);
    const relBook = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: relSlot.json.data.date,
      period: relSlot.json.data.period,
      guestsCount: 2,
      couponCode: `rel${RUN}`,
    });
    if (relBook.status === 201) createdBookingIds.push(relBook.json.data.id);
    await api('POST', `/internal/bookings/${relBook.json.data.id}/backdate-hold`, {}, false);
    await api('POST', '/internal/payments/expire-stale', {}, false);
    const relRow = await prisma.couponRedemption.findUnique({
      where: { bookingId: relBook.json.data.id },
    });
    if (relRow?.status === 'released') pass('cancel/expire before deposit releases reservation');
    else fail('cancel/expire before deposit releases reservation', relRow?.status);

    const paySlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(OWNER1);
    const payC = await api('POST', `/owner/properties/${propertyId}/coupons`, {
      code: `pay${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      maxUsesPerCustomer: 1,
      ...windowIso(),
    });
    if (payC.status === 201) createdCouponIds.push(payC.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/coupons/${payC.json.data.id}/activate`);
    await login(CUSTOMER);
    const payBook = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: paySlot.json.data.date,
      period: paySlot.json.data.period,
      guestsCount: 2,
      couponCode: `pay${RUN}`,
    });
    if (payBook.status === 201) createdBookingIds.push(payBook.json.data.id);
    const intent = await api('POST', '/payments/create-intent', {
      bookingId: payBook.json.data.id,
      method: 'card',
      purpose: 'deposit',
    });
    await api('POST', `/payments/${intent.json.data.id}/simulate-success`, {});
    const redeemed = await prisma.couponRedemption.findUnique({
      where: { bookingId: payBook.json.data.id },
    });
    if (redeemed?.status === 'redeemed') pass('deposit success marks redemption');
    else fail('deposit success marks redemption', redeemed?.status);

    await login(OWNER1);
    const promo = await api('POST', `/owner/properties/${propertyId}/promotions`, {
      titleAr: 'عرض كوبون',
      titleEn: 'stack promo',
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (promo.status === 201) createdPromoIds.push(promo.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/promotions/${promo.json.data.id}/activate`);
    const stackSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const stack = await api('POST', `/properties/${SLUG}/coupons/validate`, {
      code: `own${RUN}`,
      date: stackSlot.json.data.date,
      period: stackSlot.json.data.period,
    });
    if (stack.status === 409 && stack.json.code === 'DISCOUNT_NOT_STACKABLE') {
      pass('promotion + coupon stacking is rejected');
    } else fail('promotion + coupon stacking is rejected', `${stack.status} ${stack.json.code}`);
  } finally {
    await cleanup();
  }

  console.log(`\n--- ${passed} passed, ${failed} failed ---\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await cleanup();
  process.exit(1);
});
