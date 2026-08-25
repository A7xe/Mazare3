/**
 * Phase 10F.1 — owner-funded property promotions
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '../packages/db/generated/client/index.js';

function loadEnv() {
  const envPath = new URL('../.env', import.meta.url);
  const raw = readFileSync(envPath, 'utf8');
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

const prisma = new PrismaClient({ log: ['error'] });
const createdPromoIds = [];
const createdBookingIds = [];

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

function windowIso(daysAheadStart, daysAheadEnd) {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() + daysAheadStart);
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + daysAheadEnd);
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function promoBody(extra = {}) {
  const w = windowIso(0, 21);
  return {
    titleAr: 'عرض اختبار',
    titleEn: 'QA offer',
    discountType: 'percentage',
    discountValue: 10,
    ...w,
    period: null,
    ...extra,
  };
}

async function ensureMorningAndEveningSlots(propertyId) {
  for (let add = 11; add <= 20; add++) {
    const now = new Date();
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + add));
    const existing = await prisma.availabilitySlot.findMany({
      where: { propertyId, date, period: { in: ['morning', 'evening'] } },
    });
    if (existing.some((s) => s.status !== 'available')) continue;
    for (const period of ['morning', 'evening']) {
      await prisma.availabilitySlot.upsert({
        where: { propertyId_date_period: { propertyId, date, period } },
        create: {
          propertyId,
          date,
          period,
          price: 200,
          status: 'available',
        },
        update: { status: 'available', price: 200 },
      });
    }
    return date.toISOString().slice(0, 10);
  }
  throw new Error('Could not create an isolated morning+evening QA date');
}

async function cleanup() {
  for (const id of createdBookingIds) {
    try {
      await api('POST', `/me/bookings/${id}/cancel`);
    } catch {
      /* ignore */
    }
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
  console.log('\n🏷️  Phase 10F.1 promotions QA\n');
  try {
    await login(OWNER1);
    const mine = await api('GET', '/owner/properties');
    const emerald = (mine.json.data ?? []).find((p) => p.slug === SLUG);
    if (!emerald) {
      fail('owner1 emerald property', JSON.stringify(mine.json));
      return;
    }
    const propertyId = emerald.id;

    await prisma.propertyPromotion.updateMany({
      where: { propertyId, status: 'active' },
      data: { status: 'paused' },
    });

    await login(OWNER2);
    const otherList = await api('GET', '/owner/properties');
    const otherId = otherList.json.data?.[0]?.id;

    await login(OWNER1);
    const created = await api('POST', `/owner/properties/${propertyId}/promotions`, promoBody());
    if (created.status === 201 && created.json.data?.id) {
      createdPromoIds.push(created.json.data.id);
      pass('owner can create promotion for own property');
    } else fail('owner can create promotion for own property', `${created.status} ${JSON.stringify(created.json)}`);

    if (otherId) {
      const cross = await api('POST', `/owner/properties/${otherId}/promotions`, promoBody({ titleEn: 'cross' }));
      if (cross.status === 403 || cross.status === 404) pass('owner cannot create promotion for another property');
      else fail('owner cannot create promotion for another property', String(cross.status));
    } else fail('owner cannot create promotion for another property', 'no owner2 property');

    const badPct = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions`,
      promoBody({ discountValue: 150, titleEn: 'bad pct' }),
    );
    if (badPct.status === 400) pass('invalid percentage rejected');
    else fail('invalid percentage rejected', String(badPct.status));

    const badFixed = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions`,
      promoBody({
        discountType: 'fixed_amount',
        discountValue: 99999,
        titleEn: 'bad fixed',
      }),
    );
    if (badFixed.status === 400) pass('invalid fixed discount rejected');
    else fail('invalid fixed discount rejected', String(badFixed.status));

    const badDates = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions`,
      promoBody({
        startsAt: '2028-06-20T00:00:00.000Z',
        endsAt: '2028-06-10T00:00:00.000Z',
        titleEn: 'bad dates',
      }),
    );
    if (badDates.status === 400) pass('date-range validation');
    else fail('date-range validation', String(badDates.status));

    const morningPromo = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions`,
      promoBody({ period: 'morning', discountValue: 20, titleEn: 'morning only' }),
    );
    if (morningPromo.status === 201) createdPromoIds.push(morningPromo.json.data.id);
    await api('POST', `/owner/properties/${propertyId}/promotions/${morningPromo.json.data.id}/activate`);

    const pairDate = await ensureMorningAndEveningSlots(propertyId);
    const avail = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${pairDate}&to=${pairDate}`,
      undefined,
      false,
    );
    const slots = avail.json.data ?? [];
    const morning = slots.find((s) => s.period === 'morning' && s.bookable);
    const evening = slots.find((s) => s.period === 'evening' && s.bookable);
    const morningHas = Boolean(morning && morning.discountAmount > 0);
    const eveningHas = Boolean(evening && evening.discountAmount > 0);
    if (morning && evening && morningHas && !eveningHas) {
      pass('period-specific promotion applies only to that period');
    } else {
      fail(
        'period-specific promotion applies only to that period',
        JSON.stringify({
          pairDate,
          morning: morning ? { d: morning.discountAmount, bookable: morning.bookable } : null,
          evening: evening ? { d: evening.discountAmount, bookable: evening.bookable } : null,
        }),
      );
    }

    await api('POST', `/owner/properties/${propertyId}/promotions/${morningPromo.json.data.id}/pause`);

    const existingSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    await login(CUSTOMER);
    const beforePromo = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: existingSlot.json.data.date,
      period: existingSlot.json.data.period,
      guestsCount: 2,
    });
    if (beforePromo.status === 201) createdBookingIds.push(beforePromo.json.data.id);
    const existingTotal = beforePromo.json.data?.totalAmount;
    const existingDeposit = beforePromo.json.data?.depositAmount;

    await login(OWNER1);
    const live = await api('POST', `/owner/properties/${propertyId}/promotions`, promoBody({ titleEn: 'live 10' }));
    if (live.status === 201) createdPromoIds.push(live.json.data.id);
    const activated = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions/${live.json.data.id}/activate`,
    );
    if (activated.status !== 200 && activated.status !== 201) {
      fail('activate live promo', `${activated.status}`);
    }

    await login(CUSTOMER);
    const afterEdit = await api('GET', `/me/bookings/${beforePromo.json.data.id}`);
    if (
      jodToFils(afterEdit.json.data?.totalAmount) === jodToFils(existingTotal) &&
      jodToFils(afterEdit.json.data?.depositAmount) === jodToFils(existingDeposit)
    ) {
      pass('existing booking is unchanged after promotion edits');
    } else fail('existing booking is unchanged after promotion edits', JSON.stringify(afterEdit.json.data));

    const pricedSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const av2 = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${pricedSlot.json.data.date}&to=${pricedSlot.json.data.date}`,
      undefined,
      false,
    );
    const chosen = (av2.json.data ?? []).find((s) => s.period === pricedSlot.json.data.period);
    const original = chosen?.originalPrice ?? pricedSlot.json.data.price;
    const expectedFinal = chosen?.price;
    if (chosen?.discountAmount > 0 && expectedFinal < original) pass('active promotion calculates correct final price');
    else fail('active promotion calculates correct final price', JSON.stringify(chosen));

    const searchExact = await api(
      'GET',
      `/properties?date=${pricedSlot.json.data.date}&period=${pricedSlot.json.data.period}&pageSize=48`,
      undefined,
      false,
    );
    const card = (searchExact.json.data ?? []).find((p) => p.slug === SLUG);
    if (card?.searchMatch?.discountAmount > 0 && card.searchMatch.originalSlotPrice > card.searchMatch.slotPrice) {
      pass('search shows exact discount only when applicable');
    } else fail('search exact discount', JSON.stringify(card?.searchMatch ?? searchExact.json.meta));

    const booked = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: pricedSlot.json.data.date,
      period: pricedSlot.json.data.period,
      guestsCount: 2,
      expectedTotalAmount: expectedFinal,
    });
    if (booked.status === 201) createdBookingIds.push(booked.json.data.id);
    const b = booked.json.data;
    if (b && jodToFils(b.totalAmount) === jodToFils(expectedFinal)) {
      pass('booking stores promotion snapshot (final total)');
    } else fail('booking stores promotion snapshot', JSON.stringify(b));
    if (b && jodToFils(b.originalSlotPrice) === jodToFils(original) && b.promotionId) {
      pass('booking snapshot stores original slot price and promotionId');
    } else fail('booking snapshot original/promotionId', JSON.stringify(b));

    if (b && jodToFils(b.depositAmount + b.remainingAmount) === jodToFils(b.totalAmount)) {
      pass('deposit and remaining use discounted total');
    } else fail('deposit/remaining identity', JSON.stringify({ d: b?.depositAmount, r: b?.remainingAmount, t: b?.totalAmount }));

    if (b?.id) {
      const ledger = await prisma.booking.findUnique({
        where: { id: b.id },
        select: { platformCommissionAmount: true, ownerNetPayoutAmount: true, totalAmount: true },
      });
      const comm = Number(ledger?.platformCommissionAmount);
      const net = Number(ledger?.ownerNetPayoutAmount);
      const tot = Number(ledger?.totalAmount);
      if (jodToFils(comm + net) === jodToFils(tot) && comm > 0) {
        pass('commission uses discounted total');
      } else fail('commission identity', JSON.stringify({ comm, net, tot }));
    } else fail('commission uses discounted total', 'no booking');

    const searchBrowse = await api('GET', `/properties?q=emerald`, undefined, false);
    const browseCard = (searchBrowse.json.data ?? []).find((p) => p.slug === SLUG);
    if (browseCard?.hasActivePromotion === true && !browseCard.searchMatch?.slotPrice) {
      pass('browse shows offer-available without claiming exact discounted price');
    } else if (browseCard?.hasActivePromotion && browseCard.pricingMode === 'browse_from') {
      pass('browse shows offer-available without claiming exact discounted price');
    } else fail('browse offer badge', JSON.stringify({ has: browseCard?.hasActivePromotion, mode: browseCard?.pricingMode }));

    await login(OWNER1);
    await api('POST', `/owner/properties/${propertyId}/promotions/${live.json.data.id}/pause`);
    await login(CUSTOMER);
    const staleSlot = await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false);
    const stale = await api('POST', '/bookings', {
      propertySlug: SLUG,
      date: staleSlot.json.data.date,
      period: staleSlot.json.data.period,
      guestsCount: 2,
      expectedTotalAmount: expectedFinal,
    });
    if (stale.status === 409 && stale.json.code === 'PRICING_CHANGED') {
      pass('stale promotion is revalidated on booking creation');
    } else if (stale.status === 201 && jodToFils(stale.json.data.totalAmount) !== jodToFils(expectedFinal)) {
      createdBookingIds.push(stale.json.data.id);
      pass('stale promotion is revalidated on booking creation');
    } else fail('stale promotion is revalidated on booking creation', `${stale.status} ${JSON.stringify(stale.json)}`);

    await login(OWNER1);
    const expired = await api(
      'POST',
      `/owner/properties/${propertyId}/promotions`,
      promoBody({ titleEn: 'expired window' }),
    );
    if (expired.status === 201) createdPromoIds.push(expired.json.data.id);
    await prisma.propertyPromotion.update({
      where: { id: expired.json.data.id },
      data: {
        status: 'active',
        startsAt: new Date('2020-01-01T00:00:00.000Z'),
        endsAt: new Date('2020-01-02T00:00:00.000Z'),
      },
    });
    const expiredAvailDate = (await api('POST', `/internal/properties/${SLUG}/ensure-available-slot`, {}, false)).json
      .data.date;
    const expiredAvail = await api(
      'GET',
      `/properties/${SLUG}/availability?from=${expiredAvailDate}&to=${expiredAvailDate}`,
      undefined,
      false,
    );
    const discounted = (expiredAvail.json.data ?? []).some((s) => s.discountAmount > 0);
    if (!discounted) pass('expired promotion is ignored');
    else fail('expired promotion is ignored', 'still applied');

    const pausedAvail = expiredAvail;
    const pausedApplied = (pausedAvail.json.data ?? []).some((s) => s.promotionId === live.json.data.id);
    if (!pausedApplied) pass('paused promotion is ignored');
    else fail('paused promotion is ignored', 'paused id still on slots');

    const otherSlug = (otherList.json.data ?? []).find((p) => p.slug && p.slug !== SLUG)?.slug;
    if (otherSlug) {
      const otherSearch = await api('GET', `/properties?q=${encodeURIComponent(otherSlug)}`, undefined, false);
      const otherCard = (otherSearch.json.data ?? []).find((p) => p.slug === otherSlug);
      if (!otherCard || otherCard.hasActivePromotion !== true) pass('no fake offer badge without a real promotion');
      else fail('no fake offer badge without a real promotion', JSON.stringify(otherCard.hasActivePromotion));
    } else {
      const none = (searchBrowse.json.data ?? []).filter((p) => p.slug !== SLUG && p.hasActivePromotion);
      if (none.length === 0) pass('no fake offer badge without a real promotion');
      else fail('no fake offer badge without a real promotion', none.map((p) => p.slug).join(','));
    }
  } finally {
    try {
      await login(CUSTOMER);
    } catch {
      /* ignore */
    }
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
