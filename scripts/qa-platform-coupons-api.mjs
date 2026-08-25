/**
 * Phase 10F.2B — platform-funded coupons
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
const OTHER_SLUG = 'villa-naour-amman';
const ADMIN = { email: 'admin@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER1 = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const RUN = `P${Date.now().toString(36).slice(-6).toUpperCase()}`;

const prisma = new PrismaClient({ log: ['error'] });
const createdCouponIds = [];
const createdBookingIds = [];
const createdPromoIds = [];
const createdOwnerCouponIds = [];

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

async function upsertIsolatedSlot(propertyId, price, period = 'morning') {
  for (let add = 11; add <= 20; add++) {
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
    const existing = await prisma.availabilitySlot.findUnique({
      where: { propertyId_date_period: { propertyId, date, period } },
    });
    if (existing && existing.status !== 'available') continue;
    const row = await prisma.availabilitySlot.upsert({
      where: { propertyId_date_period: { propertyId, date, period } },
      create: { propertyId, date, period, price, status: 'available' },
      update: { status: 'available', price },
    });
    return {
      date: date.toISOString().slice(0, 10),
      period,
      price: Number(row.price),
    };
  }
  throw new Error('Could not create an isolated QA slot');
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
    await prisma.platformCoupon.updateMany({
      where: { id: { in: createdCouponIds } },
      data: { status: 'paused' },
    });
  }
  if (createdOwnerCouponIds.length) {
    await prisma.propertyCoupon.updateMany({
      where: { id: { in: createdOwnerCouponIds } },
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
  console.log('\n🏷️  Phase 10F.2B platform coupons QA\n');
  try {
    const emerald = await prisma.property.findFirst({
      where: { slug: SLUG },
      select: { id: true, depositPercent: true },
    });
    if (!emerald) {
      fail('emerald property', 'missing');
      return;
    }
    await prisma.propertyPromotion.updateMany({
      where: { propertyId: emerald.id, status: 'active' },
      data: { status: 'paused' },
    });
    await prisma.propertyCoupon.updateMany({
      where: { propertyId: emerald.id, status: 'active' },
      data: { status: 'paused' },
    });
    await prisma.platformCoupon.updateMany({
      where: { status: 'active' },
      data: { status: 'paused' },
    });

    await login(OWNER1);
    const ownerCreate = await api('POST', '/admin/platform-coupons', {
      code: `own${RUN}`,
      titleAr: 'تجربة',
      titleEn: 'test',
      discountType: 'fixed_amount',
      discountValue: 20,
      ...windowIso(),
    });
    if (ownerCreate.status === 403 || ownerCreate.status === 401) pass('owner cannot manage platform coupons');
    else fail('owner cannot manage platform coupons', String(ownerCreate.status));

    await login(ADMIN);
    const created = await api('POST', '/admin/platform-coupons', {
      code: `plat${RUN}`,
      titleAr: 'خصم المنصة',
      titleEn: 'Platform cut',
      discountType: 'fixed_amount',
      discountValue: 20,
      ...windowIso(),
    });
    if (created.status === 201 && created.json.data?.id) {
      createdCouponIds.push(created.json.data.id);
      const act = await api('POST', `/admin/platform-coupons/${created.json.data.id}/activate`);
      if (act.status === 200 && act.json.data?.status === 'active') pass('admin creates and activates platform coupon');
      else fail('admin creates and activates platform coupon', `${act.status}`);
    } else fail('admin creates and activates platform coupon', `${created.status} ${JSON.stringify(created.json)}`);

    const slot = await upsertIsolatedSlot(emerald.id, 200, 'morning');
    await login(CUSTOMER);
    const lower = await api('POST', `/properties/${SLUG}/platform-coupons/validate`, {
      code: `plat${RUN}`.toLowerCase(),
      date: slot.date,
      period: slot.period,
    });
    if (lower.status === 200 && lower.json.data?.valid) pass('platform coupon matching is case-insensitive');
    else fail('platform coupon matching is case-insensitive', `${lower.status} ${lower.json.code}`);

    const v = lower.json.data;
    if (
      v &&
      jodToFils(v.originalBookingValue) === jodToFils(200) &&
      jodToFils(v.platformDiscount) === jodToFils(20) &&
      jodToFils(v.finalPrice) === jodToFils(180) &&
      jodToFils(v.depositAmount) === jodToFils(54) &&
      jodToFils(v.remainingAmount) === jodToFils(126) &&
      jodToFils(v.commissionBasis) === jodToFils(200) &&
      jodToFils(v.ownerExpectedNet) === jodToFils(176)
    ) {
      pass('200 JOD example: 180 payable, 54 deposit, 126 remaining, 24 commission, 176 owner net');
    } else fail('200 JOD example', JSON.stringify(v));

    const book = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: slot.date,
      period: slot.period,
      guestsCount: 2,
      couponCode: `plat${RUN}`,
      expectedTotalAmount: 180,
    });
    if (book.status === 201) createdBookingIds.push(book.json.data.id);
    else fail('booking with platform coupon', `${book.status} ${JSON.stringify(book.json)}`);

    if (book.status === 201) {
      const row = await prisma.booking.findUnique({ where: { id: book.json.data.id } });
      if (jodToFils(row.totalAmount) === jodToFils(200) && jodToFils(row.merchantBookingValue) === jodToFils(200)) {
        pass('merchantBookingValue / totalAmount stays 200');
      } else fail('merchantBookingValue / totalAmount stays 200', `${row.totalAmount}/${row.merchantBookingValue}`);
      if (jodToFils(row.platformDiscountAmount) === jodToFils(20)) pass('platformDiscountAmount snapshot is 20');
      else fail('platformDiscountAmount snapshot is 20', String(row.platformDiscountAmount));
      if (jodToFils(row.depositAmount) === jodToFils(54) && jodToFils(row.remainingAmount) === jodToFils(126)) {
        pass('deposit 54 and remaining 126 from customer payable 180');
      } else fail('deposit/remaining from 180', `${row.depositAmount}/${row.remainingAmount}`);
      if (jodToFils(row.platformCommissionAmount) === jodToFils(24)) pass('commission 24 on merchant 200');
      else fail('commission 24 on merchant 200', String(row.platformCommissionAmount));
      if (jodToFils(row.ownerNetPayoutAmount) === jodToFils(176)) pass('owner net stays 176');
      else fail('owner net stays 176', String(row.ownerNetPayoutAmount));

      const intent = await api('POST', '/payments/create-intent', {
        bookingId: book.json.data.id,
        method: 'card',
        purpose: 'deposit',
      });
      await api('POST', `/payments/${intent.json.data.id}/simulate-success`, {});
      const payRow = await prisma.payment.findUnique({ where: { id: intent.json.data.id } });
      if (
        payRow &&
        jodToFils(payRow.ownerNetPayoutAmount) === jodToFils(176) &&
        jodToFils(payRow.bookingTotalAmount) === jodToFils(200) &&
        jodToFils(payRow.platformCommissionAmount) === jodToFils(24)
      ) {
        pass('payment/settlement snapshot keeps owner net 176 (subsidy not taken from owner)');
      } else {
        fail(
          'payment/settlement snapshot keeps owner net 176 (subsidy not taken from owner)',
          JSON.stringify({
            ownerNet: payRow?.ownerNetPayoutAmount,
            bookingTotal: payRow?.bookingTotalAmount,
            commission: payRow?.platformCommissionAmount,
          }),
        );
      }
      const redeemedPlat = await prisma.platformCouponRedemption.findUnique({
        where: { bookingId: book.json.data.id },
      });
      if (redeemedPlat?.status === 'redeemed') pass('deposit success redeems platform coupon');
      else fail('deposit success redeems platform coupon', redeemedPlat?.status);
    }

    await login(ADMIN);
    const scoped = await api('POST', '/admin/platform-coupons', {
      code: `scope${RUN}`,
      titleAr: 'عقار واحد',
      titleEn: 'one property',
      discountType: 'fixed_amount',
      discountValue: 15,
      propertyId: emerald.id,
      ...windowIso(),
    });
    if (scoped.status === 201) {
      createdCouponIds.push(scoped.json.data.id);
      await api('POST', `/admin/platform-coupons/${scoped.json.data.id}/activate`);
    }
    const otherSlot = await api('POST', `/internal/properties/${OTHER_SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const wrong = await api('POST', `/properties/${OTHER_SLUG}/platform-coupons/validate`, {
      code: `scope${RUN}`,
      date: otherSlot.json.data.date,
      period: otherSlot.json.data.period,
    });
    if (wrong.status === 400 && wrong.json.code === 'COUPON_INVALID') pass('property-scoped coupon rejected on other listing');
    else fail('property-scoped coupon rejected on other listing', `${wrong.status} ${wrong.json.code}`);

    await login(OWNER1);
    const promo = await api('POST', `/owner/properties/${emerald.id}/promotions`, {
      titleAr: 'عرض',
      titleEn: 'promo',
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (promo.status === 201) createdPromoIds.push(promo.json.data.id);
    await api('POST', `/owner/properties/${emerald.id}/promotions/${promo.json.data.id}/activate`);
    const stackSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const stack = await api('POST', `/properties/${SLUG}/platform-coupons/validate`, {
      code: `plat${RUN}`,
      date: stackSlot.json.data.date,
      period: stackSlot.json.data.period,
    });
    if (stack.status === 409 && stack.json.code === 'DISCOUNT_NOT_STACKABLE') {
      pass('platform coupon does not stack with promotion');
    } else fail('platform coupon does not stack with promotion', `${stack.status} ${stack.json.code}`);
    await prisma.propertyPromotion.update({
      where: { id: promo.json.data.id },
      data: { status: 'paused' },
    });

    await login(OWNER1);
    const own = await api('POST', `/owner/properties/${emerald.id}/coupons`, {
      code: `ownc${RUN}`,
      discountType: 'percentage',
      discountValue: 10,
      ...windowIso(),
    });
    if (own.status === 201) createdOwnerCouponIds.push(own.json.data.id);
    await api('POST', `/owner/properties/${emerald.id}/coupons/${own.json.data.id}/activate`);
    const sameCode = await api('POST', '/admin/platform-coupons', {
      code: `ownc${RUN}`,
      titleAr: 'تصادم',
      titleEn: 'clash',
      discountType: 'fixed_amount',
      discountValue: 10,
      ...windowIso(),
    });
    if (sameCode.status === 201) {
      createdCouponIds.push(sameCode.json.data.id);
      await api('POST', `/admin/platform-coupons/${sameCode.json.data.id}/activate`);
    }
    const clashSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const clash = await api('POST', `/properties/${SLUG}/platform-coupons/validate`, {
      code: `ownc${RUN}`,
      date: clashSlot.json.data.date,
      period: clashSlot.json.data.period,
    });
    if (clash.status === 409 && clash.json.code === 'DISCOUNT_NOT_STACKABLE') {
      pass('platform coupon does not stack with owner coupon of the same code');
    } else fail('platform coupon does not stack with owner coupon of the same code', `${clash.status} ${clash.json.code}`);

    await login(ADMIN);
    const payC = await api('POST', '/admin/platform-coupons', {
      code: `pay${RUN}`,
      titleAr: 'دفع',
      titleEn: 'pay',
      discountType: 'fixed_amount',
      discountValue: 20,
      maxUsesPerCustomer: 5,
      ...windowIso(),
    });
    if (payC.status === 201) {
      createdCouponIds.push(payC.json.data.id);
      await api('POST', `/admin/platform-coupons/${payC.json.data.id}/activate`);
    }

    const paySlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const payBook = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: paySlot.json.data.date,
      period: paySlot.json.data.period,
      guestsCount: 2,
      couponCode: `pay${RUN}`,
    });
    if (payBook.status === 201) createdBookingIds.push(payBook.json.data.id);
    else {
      fail('deposit success redeems platform coupon', `${payBook.status} ${JSON.stringify(payBook.json)}`);
    }
    if (payBook.status === 201) {
      const intent = await api('POST', '/payments/create-intent', {
        bookingId: payBook.json.data.id,
        method: 'card',
        purpose: 'deposit',
      });
      await api('POST', `/payments/${intent.json.data.id}/simulate-success`, {});
      const redeemed = await prisma.platformCouponRedemption.findUnique({
        where: { bookingId: payBook.json.data.id },
      });
      if (redeemed?.status === 'redeemed') pass('deposit success redeems platform coupon');
      else fail('deposit success redeems platform coupon', redeemed?.status);
    }

    const relSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const relBook = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: relSlot.json.data.date,
      period: relSlot.json.data.period,
      guestsCount: 2,
      couponCode: `pay${RUN}`,
    });
    if (relBook.status === 201) {
      createdBookingIds.push(relBook.json.data.id);
      await api('POST', `/internal/bookings/${relBook.json.data.id}/backdate-hold`, {}, false);
      await api('POST', '/internal/payments/expire-stale', {}, false);
      const relRow = await prisma.platformCouponRedemption.findUnique({
        where: { bookingId: relBook.json.data.id },
      });
      if (relRow?.status === 'released') pass('expire before deposit releases platform reservation');
      else fail('expire before deposit releases platform reservation', relRow?.status);
    } else {
      fail('expire before deposit releases platform reservation', `${relBook.status} ${JSON.stringify(relBook.json)}`);
    }
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
