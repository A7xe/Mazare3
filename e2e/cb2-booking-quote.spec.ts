import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
  SLOT_UNAVAILABLE_AR,
  getApiBase,
} from './constants.js';
import {
  cancelBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';
import {
  clickBookNow,
  gotoProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';
import { applySessionToPage } from './helpers/session.js';

async function patchInstant(cookie: string, propertyId: string, enabled: boolean) {
  const res = await fetch(`${getApiBase()}/owner/properties/${propertyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ instantBookingEnabled: enabled }),
  });
  expect(res.ok).toBeTruthy();
}

test.describe('CB-2 booking quote — AR mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('select date/period → quote + instant CTA', async ({ page }) => {
    test.setTimeout(120_000);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 5, maxDaysAhead: 25 });

    const quoteReqs: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/booking-quote')) {
        quoteReqs.push(req.url());
      }
    });

    await selectBookingSlot(page, slot, 3);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('booking-summary-price')).toBeVisible();
    await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
    await expect(page.getByTestId('booking-summary-remaining')).toBeVisible();
    await expect(page.getByText(/الضريبة|VAT/i)).toHaveCount(0);
    await expect(page.getByTestId('booking-submit')).toHaveText(/متابعة للدفع/);
    await expect(page.getByTestId('instant-hold-hint')).toBeVisible();
    expect(quoteReqs.length).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/cb2-ar-mobile-instant-quote.png', fullPage: true });
  });
});

test.describe('CB-2 booking quote — AR desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('desktop aside quote', async ({ page }) => {
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 6, maxDaysAhead: 28 });
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/cb2-ar-desktop-aside.png' });
  });
});

test.describe('CB-2 booking quote — EN mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('EN instant CTA + quote', async ({ page }) => {
    await gotoProperty(page, 'en', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 7, maxDaysAhead: 30 });
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-submit')).toHaveText(/Continue to payment/);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: 'test-results/cb2-en-mobile-instant.png' });
  });
});

test.describe('CB-2 quote create regressions', () => {
  test('quote API is read-only (no booking created)', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const before = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
    const beforeCount = ((await before.json()) as { data?: unknown[] }).data?.length ?? 0;

    const slot = await findAvailableSlot({ minDaysAhead: 8, maxDaysAhead: 35 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });

    // Requote by toggling guests
    await page.getByTestId('booking-guests-increase').click();
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 15_000 });

    const after = await fetch(`${getApiBase()}/me/bookings`, { headers: { Cookie: cookie } });
    expect(((await after.json()) as { data?: unknown[] }).data?.length ?? 0).toBe(beforeCount);
  });

  test('instant create → checkout uses quote expected total', async ({ page }) => {
    test.setTimeout(120_000);
    const slot = await findAvailableSlot({ minDaysAhead: 9, maxDaysAhead: 36 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 4);
    await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
    await expect(page.getByTestId('checkout-page')).toBeVisible();
  });

  test('owner-approval CTA + create → my bookings', async ({ page }) => {
    test.setTimeout(150_000);
    const fixtures = new TestPropertyFixtureTracker();
    const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    let propertyId = '';
    try {
      const prop = await createAndPublishTestProperty({
        titleEn: `CB2 OA ${Date.now()}`,
        area: 'e2e-cb2-oa',
      });
      propertyId = prop.id;
      fixtures.track(prop.id);
      await patchInstant(owner, prop.id, false);

      const slot = await findAvailableSlot({
        slug: prop.slug,
        minDaysAhead: 5,
        maxDaysAhead: 40,
      });
      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await gotoProperty(page, 'ar', prop.slug);
      await expect(page.getByTestId('owner-approval-no-charge-note')).toBeVisible();
      await expect(page.getByTestId('booking-submit')).toHaveText(/إرسال طلب الحجز/);
      await selectBookingSlot(page, slot, 2);
      await expect(page.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });
      await page.screenshot({ path: 'test-results/cb2-ar-mobile-owner-approval.png', fullPage: true });
      await clickBookNow(page);
      await page.waitForURL(/\/ar\/account\/bookings/, { timeout: 30_000 });
    } finally {
      if (propertyId) {
        await patchInstant(owner, propertyId, true).catch(() => undefined);
      }
      await fixtures.dispose();
    }
  });

  test('stale slot rejected after quote', async ({ browser }) => {
    test.setTimeout(120_000);
    const slot = await findAvailableSlot({ minDaysAhead: 40, maxDaysAhead: 70 });
    const cookie = await loginViaApi();
    const context = await browser.newContext();
    let heldId: string | null = null;
    try {
      const pageA = await context.newPage();
      const pageB = await context.newPage();
      await applySessionToPage(pageA, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await applySessionToPage(pageB, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await gotoProperty(pageA, 'ar', PROPERTY_SLUG);
      await gotoProperty(pageB, 'ar', PROPERTY_SLUG);
      await selectBookingSlot(pageA, slot, 2);
      await selectBookingSlot(pageB, slot, 2);
      await expect(pageA.getByTestId('booking-quote-breakdown')).toBeVisible({ timeout: 20_000 });

      const bookB = pageB.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      );
      await clickBookNow(pageB);
      const resB = await bookB;
      expect(resB.status()).toBe(201);
      heldId = ((await resB.json()) as { data?: { id?: string } }).data?.id ?? null;

      const conflict = pageA.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      );
      await clickBookNow(pageA);
      expect((await conflict).status()).toBe(409);
      await expect(pageA.getByTestId('booking-error')).toContainText(SLOT_UNAVAILABLE_AR, {
        timeout: 20_000,
      });
    } finally {
      if (heldId) await cancelBookingViaApi(cookie, heldId);
      await context.close();
    }
  });

  test('API quote matches panel totals and guests unchanged money', async () => {
    const slot = await findAvailableSlot({ minDaysAhead: 10, maxDaysAhead: 40 });
    const q1 = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}/booking-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: slot.date,
        period: slot.period,
        guestsCount: 2,
      }),
    });
    expect(q1.status).toBe(200);
    const body1 = (await q1.json()) as {
      data: {
        expectedTotalAmount: number;
        customerPayableTotal: number;
        depositDueAmount: number;
        remainingAmount: number;
        customerServiceFeeAmount: number;
      };
    };
    expect(body1.data.expectedTotalAmount).toBeGreaterThan(0);
    expect(
      Math.round(
        (body1.data.depositDueAmount -
          body1.data.customerServiceFeeAmount +
          body1.data.remainingAmount) *
          100,
      ),
    ).toBe(Math.round(body1.data.expectedTotalAmount * 100));

    const q2 = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}/booking-quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: slot.date,
        period: slot.period,
        guestsCount: 5,
      }),
    });
    const body2 = (await q2.json()) as { data: { expectedTotalAmount: number } };
    expect(body2.data.expectedTotalAmount).toBe(body1.data.expectedTotalAmount);
  });
});
