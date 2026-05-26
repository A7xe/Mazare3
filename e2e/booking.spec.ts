import { test, expect } from '@playwright/test';
import { getApiBase, PROPERTY_SLUG, SLOT_UNAVAILABLE_AR } from './constants.js';
import {
  cancelBookingViaApi,
  findAvailableSlot,
  loginViaApi,
} from './helpers/api.js';
import {
  clickBookNow,
  expectDraftRestored,
  gotoProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { ensureCustomerLoggedIn, loginOnPage } from './helpers/auth-ui.js';

test.describe.configure({ mode: 'serial' });

/** Stagger day windows so serial tests and QA (:4012) rarely collide on the same slot. */
const E2E_SLOT_WINDOWS = {
  fullFlow: { minDaysAhead: 3, maxDaysAhead: 20 },
  payFailure: { minDaysAhead: 12, maxDaysAhead: 28 },
  cancelPending: { minDaysAhead: 20, maxDaysAhead: 34 },
  conflict: { minDaysAhead: 38, maxDaysAhead: 75 },
} as const;

test.describe('Booking E2E — Arabic', () => {
  test('guest book redirects to login with returnUrl, then completes booking with draft restore', async ({
    page,
  }) => {
    const slot = await findAvailableSlot(E2E_SLOT_WINDOWS.fullFlow);
    const guests = 6;

    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, guests);
    await clickBookNow(page);

    await page.waitForURL(/\/ar\/login\?returnUrl=/);
    expect(page.url()).toContain(encodeURIComponent('/properties/chalet-emerald-dead-sea'));

    await loginOnPage(page);

    await page.waitForURL(/\/ar\/properties\/chalet-emerald-dead-sea/);
    await expectDraftRestored(page, slot, guests);

    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//);
    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-full-payment-badge')).toBeVisible();
    await expect(page.getByTestId('checkout-due-now')).toBeVisible();

    await page.getByTestId('checkout-simulate-success').click();
    await page.waitForURL(/\/ar\/account\/bookings/);

    await expect(page.getByRole('heading', { name: 'حجوزاتي' })).toBeVisible();
    await expect(page.getByText(slot.date).first()).toBeVisible();
    await expect(page.getByText('مؤكد').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('مدفوع').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('booking-paid-in-full').first()).toBeVisible({ timeout: 15_000 });
  });

  test('checkout simulate failure does not confirm booking', async ({ page }) => {
    const slot = await findAvailableSlot(E2E_SLOT_WINDOWS.payFailure);
    await ensureCustomerLoggedIn(page, 'ar');
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 5);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//);
    await expect(page.getByTestId('checkout-page')).toBeVisible({ timeout: 15_000 });
    const failBtn = page.getByTestId('checkout-simulate-failure');
    await expect(failBtn).toBeEnabled({ timeout: 20_000 });
    const failRes = page.waitForResponse(
      (res) => res.url().includes('simulate-failure') && res.request().method() === 'POST',
    );
    await failBtn.click();
    expect((await failRes).ok()).toBeTruthy();
    const checkout = page.getByTestId('checkout-page');
    await expect(checkout.getByText('ملغى')).toBeVisible({ timeout: 15_000 });
    await expect(checkout.getByText('فشل', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('checkout-simulate-success')).toHaveCount(0);
  });

  test('cancel pending_payment booking shows cancelled status', async ({ page }) => {
    const slot = await findAvailableSlot(E2E_SLOT_WINDOWS.cancelPending);
    await ensureCustomerLoggedIn(page, 'ar');
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(page, slot, 4);
    await clickBookNow(page);
    await page.waitForURL(/\/ar\/checkout\//);

    await page.goto('/ar/account/bookings');
    await expect(page.getByRole('heading', { name: 'حجوزاتي' })).toBeVisible();

    const cancelBtn = page.getByTestId('booking-cancel').first();
    await expect(cancelBtn).toBeVisible({ timeout: 15_000 });
    await cancelBtn.click();
    await expect(page.getByText('ملغى').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('booking-cancel')).toHaveCount(0);
  });
});

test.describe('Booking conflict', () => {
  test('second booking attempt shows slot unavailable message', async ({ browser }) => {
    test.setTimeout(120_000);

    const slot = await findAvailableSlot(E2E_SLOT_WINDOWS.conflict);
    const cookie = await loginViaApi();

    const context = await browser.newContext();
    let heldBookingId: string | null = null;

    try {
      const pageA = await context.newPage();
      const pageB = await context.newPage();
      await ensureCustomerLoggedIn(pageA, 'ar');
      await ensureCustomerLoggedIn(pageB, 'ar');
      await gotoProperty(pageA, 'ar', PROPERTY_SLUG);
      await gotoProperty(pageB, 'ar', PROPERTY_SLUG);
      await pageA.waitForLoadState('domcontentloaded');
      await pageB.waitForLoadState('domcontentloaded');

      // Select the same slot on both tabs before either books — after the first POST
      // the slot is marked booked and the period button disappears on refresh.
      await selectBookingSlot(pageA, slot, 4);
      await selectBookingSlot(pageB, slot, 4);

      const bookB = pageB.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await clickBookNow(pageB);
      const resB = await bookB;
      expect(resB.status()).toBe(201);
      const bodyB = (await resB.json()) as { data?: { id?: string } };
      heldBookingId = bodyB.data?.id ?? null;
      await pageB.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });

      await expect(pageA.getByTestId('booking-submit')).toBeEnabled({ timeout: 15_000 });

      const conflictPost = pageA.waitForResponse(
        (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
        { timeout: 30_000 },
      );
      await clickBookNow(pageA);
      const postRes = await conflictPost;
      expect(postRes.status()).toBe(409);
      await expect(pageA.getByTestId('booking-error')).toContainText(SLOT_UNAVAILABLE_AR, {
        timeout: 20_000,
      });
    } finally {
      if (heldBookingId) {
        await cancelBookingViaApi(cookie, heldBookingId);
      }
      await context.close();
    }
  });
});

test.describe('Auth guards', () => {
  test('account bookings requires login when logged out', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/ar/account/bookings');
    await page.waitForURL(/\/ar\/login/);
    expect(page.url()).toContain('returnUrl');
    await context.close();
  });

  test('guest cannot create booking via API', async ({ request }) => {
    const slot = await findAvailableSlot({ minDaysAhead: 5, maxDaysAhead: 15 });
    const res = await request.post(`${getApiBase()}/bookings`, {
      data: {
        propertySlug: PROPERTY_SLUG,
        date: slot.date,
        period: slot.period,
        guestsCount: 2,
      },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('English smoke', () => {
  test('property and bookings pages render LTR', async ({ page }) => {
    await ensureCustomerLoggedIn(page, 'en');

    await page.goto('/en/properties/chalet-emerald-dead-sea', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('booking-panel')).toBeVisible({ timeout: 20_000 });

    await page.goto('/en/account/bookings', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible({ timeout: 20_000 });
  });
});
