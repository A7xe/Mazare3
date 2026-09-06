import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { clickBookNow, gotoProperty, selectBookingSlot } from './helpers/booking-ui.js';
import { nextQaFarmImages } from './helpers/farm-images.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function createOwnerProperty(cookie: string, titleEn: string) {
  const created = await api(cookie, 'POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة ${titleEn}`,
    titleEn,
    descriptionAr: 'وصف تجريبي لمزرعة اختبار التوفر من واجهة المالك والزبون في المنصة.',
    descriptionEn: 'Playwright availability engine property for timed slots.',
    city: 'amman',
    area: 'e2e-availability',
    approximateAddress: 'عمان — اختبار',
    exactAddress: 'عنوان مخفي للاختبار',
    basePrice: 190,
    capacity: 16,
    imageUrls: nextQaFarmImages(titleEn),
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) {
    throw new Error(`create property failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  return created.json.data as { id: string; slug: string };
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10B.1 owner availability calendar', () => {
  test('owner configures weekly rules, generates, blocks, reopens, and overrides price', async ({
    page,
  }) => {
    const cookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const prop = await createOwnerProperty(cookie, `E2E Owner Avail ${Date.now()}`);

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/availability?propertyId=${prop.id}`);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-availability-schedule')).toBeVisible({ timeout: 45_000 });

    await page.getByTestId('owner-rule-1-morning-enabled').scrollIntoViewIfNeeded();
    await page.getByTestId('owner-rule-1-morning-enabled').check();
    await page.getByTestId('owner-rule-1-morning-start').fill('09:00');
    await page.getByTestId('owner-rule-1-morning-end').fill('13:00');
    await page.getByTestId('owner-rule-1-morning-price').fill('180');
    await page.getByTestId('owner-rule-1-evening-enabled').check();
    await page.getByTestId('owner-rule-1-evening-start').fill('16:00');
    await page.getByTestId('owner-rule-1-evening-end').fill('22:00');
    await page.getByTestId('owner-rule-1-evening-price').fill('220');
    await page.getByTestId('owner-schedule-save').click();
    await expect(page.getByTestId('owner-availability-schedule')).toBeVisible();

    await page.getByTestId('owner-availability-generate').click();
    await expect(page.getByTestId('owner-generate-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-availability-range')).toBeVisible();

    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 13 * 86400000).toISOString().slice(0, 10);
    const slots = await api(
      cookie,
      'GET',
      `/owner/availability?propertyId=${prop.id}&from=${today}&to=${horizon}`,
    );
    const morning = (
      slots.json.data as Array<{
        id: string;
        period: string;
        status: string;
        startAtLocal: string | null;
        price: number;
        date: string;
      }>
    ).find((s) => s.period === 'morning' && s.status === 'available' && s.startAtLocal === '09:00');
    expect(morning, 'generated Monday-style morning slot').toBeTruthy();
    await expect(page.getByTestId(`owner-slot-times-${morning!.id}`)).toContainText('09:00');

    const toggle = page.getByTestId(`owner-slot-toggle-${morning!.id}`);
    await toggle.scrollIntoViewIfNeeded();
    const blockRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' &&
        res.url().includes(`/owner/availability/${morning!.id}`) &&
        res.ok(),
      { timeout: 20_000 },
    );
    await toggle.click();
    await blockRes;
    await expect.poll(async () => {
      const rows = await api(
        cookie,
        'GET',
        `/owner/availability?propertyId=${prop.id}&from=${today}&to=${horizon}`,
      );
      return (rows.json.data as Array<{ id: string; status: string }>).find((s) => s.id === morning!.id)
        ?.status;
    }).toBe('blocked');

    const reopenRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' &&
        res.url().includes(`/owner/availability/${morning!.id}`) &&
        res.ok(),
      { timeout: 20_000 },
    );
    await toggle.click();
    await reopenRes;
    await expect.poll(async () => {
      const rows = await api(
        cookie,
        'GET',
        `/owner/availability?propertyId=${prop.id}&from=${today}&to=${horizon}`,
      );
      return (rows.json.data as Array<{ id: string; status: string }>).find((s) => s.id === morning!.id)
        ?.status;
    }).toBe('available');

    await page.getByTestId(`owner-slot-price-${morning!.id}`).fill('265');
    const saveRes = page.waitForResponse(
      (res) =>
        res.request().method() === 'PATCH' &&
        res.url().includes(`/owner/availability/${morning!.id}`) &&
        res.ok(),
      { timeout: 20_000 },
    );
    await page.getByTestId(`owner-slot-save-${morning!.id}`).click();
    await saveRes;

    await page.getByTestId('owner-availability-generate').click();
    await expect(page.getByTestId('owner-generate-summary')).toBeVisible({ timeout: 30_000 });
    const afterGen = await api(
      cookie,
      'GET',
      `/owner/availability?propertyId=${prop.id}&from=${new Date().toISOString().slice(0, 10)}&to=${new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10)}`,
    );
    const priced = (afterGen.json.data as Array<{ id: string; price: number }>).find(
      (s) => s.id === morning!.id,
    );
    expect(priced?.price).toBe(265);
  });
});

test.describe('Phase 10B.1 customer overlap and timed display', () => {
  test('overlapping period is rejected; non-overlapping remains bookable; times display', async ({
    page,
  }) => {
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const prop = await createOwnerProperty(ownerCookie, `E2E Overlap ${Date.now()}`);
    const rules = [];
    for (let weekday = 0; weekday <= 6; weekday++) {
      rules.push(
        { weekday, period: 'morning', enabled: true, startTime: '09:00', endTime: '13:00', price: 140 },
        { weekday, period: 'evening', enabled: true, startTime: '16:00', endTime: '22:00', price: 190 },
        { weekday, period: 'full_day', enabled: true, startTime: '08:00', endTime: '20:00', price: 320 },
      );
    }
    const put = await api(ownerCookie, 'PUT', `/owner/properties/${prop.id}/availability-rules`, {
      rules,
    });
    expect(put.status).toBe(200);
    const gen = await api(ownerCookie, 'POST', `/owner/properties/${prop.id}/availability/generate`, {});
    expect(gen.status).toBe(200);
    await api(ownerCookie, 'POST', `/owner/properties/${prop.id}/submit-review`);
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const approved = await api(adminCookie, 'PATCH', `/admin/properties/${prop.id}/status`, {
      status: 'approved',
    });
    expect(approved.status).toBe(200);
    const pub = await api(adminCookie, 'PATCH', `/admin/properties/${prop.id}/status`, {
      status: 'published',
    });
    expect(pub.status).toBe(200);

    const from = gen.json.data.from as string;
    const to = gen.json.data.to as string;
    const avail = await fetch(
      `${getApiBase()}/properties/${prop.slug}/availability?from=${from}&to=${to}`,
    );
    const body = (await avail.json()) as {
      data: Array<{ date: string; period: string; bookable: boolean; startAtLocal: string | null }>;
    };
    const date = body.data.find((s) => s.period === 'morning' && s.bookable)?.date;
    expect(date).toBeTruthy();

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', prop.slug);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await selectBookingSlot(page, { date: date!, period: 'morning', price: 140, status: 'available' }, 4);
    await expect(page.getByTestId('booking-summary-times')).toContainText('09:00');
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//);
    await expect(page.getByTestId('checkout-booking-times')).toContainText('09:00');
    await expect(page.getByTestId('checkout-balance-due-at')).toBeVisible();
    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/ar\/account\/bookings/);
    await expect(page.getByTestId('booking-local-times').first()).toContainText('09:00');

    await gotoProperty(page, 'ar', prop.slug);
    await selectBookingSlot(page, { date: date!, period: 'full_day', price: 320, status: 'available' }, 4);
    await clickBookNow(page);
    await expect(page.getByTestId('booking-error')).toBeVisible({ timeout: 20_000 });

    await gotoProperty(page, 'ar', prop.slug);
    await selectBookingSlot(page, { date: date!, period: 'evening', price: 190, status: 'available' }, 4);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//);
    await expect(page.getByTestId('checkout-booking-times')).toContainText('16:00');
  });
});
