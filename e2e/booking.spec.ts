import { test, expect } from '@playwright/test';
import { API_BASE, PROPERTY_SLUG, SLOT_UNAVAILABLE_AR } from './constants.js';
import { findFirstAvailableSlot } from './helpers/api.js';
import {
  clickBookNow,
  expectDraftRestored,
  gotoProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { ensureCustomerLoggedIn, loginOnPage } from './helpers/auth-ui.js';

test.describe.configure({ mode: 'serial' });

test.describe('Booking E2E — Arabic', () => {
  test('guest book redirects to login with returnUrl, then completes booking with draft restore', async ({
    page,
  }) => {
    const slot = await findFirstAvailableSlot();
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
    await page.waitForURL(/\/ar\/account\/bookings/);

    await expect(page.getByRole('heading', { name: 'حجوزاتي' })).toBeVisible();
    await expect(page.getByText(slot.date).first()).toBeVisible();
  });

  test('cancel booking shows cancelled status', async ({ page }) => {
    await ensureCustomerLoggedIn(page, 'ar');
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
    const slot = await findFirstAvailableSlot();

    const context = await browser.newContext();
    const loginPage = await context.newPage();
    await ensureCustomerLoggedIn(loginPage, 'ar');
    await loginPage.close();

    const pageA = await context.newPage();
    const pageB = await context.newPage();

    await gotoProperty(pageA, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(pageA, slot, 4);

    await gotoProperty(pageB, 'ar', PROPERTY_SLUG);
    await selectBookingSlot(pageB, slot, 4);
    const bookB = pageB.waitForResponse(
      (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
    );
    await clickBookNow(pageB);
    expect((await bookB).status()).toBe(201);
    await pageB.waitForURL(/\/ar\/account\/bookings/);

    await expect(pageA.getByTestId('booking-submit')).toBeEnabled();
    const conflictPost = pageA.waitForResponse(
      (res) => res.url().includes('/bookings') && res.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await clickBookNow(pageA);
    const postRes = await conflictPost;
    expect(postRes.status()).toBe(409);
    await expect(pageA.getByTestId('booking-error')).toContainText(SLOT_UNAVAILABLE_AR, {
      timeout: 15_000,
    });

    await context.close();
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
    const slot = await findFirstAvailableSlot();
    const res = await request.post(`${API_BASE}/bookings`, {
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

    await page.goto('/en/properties/chalet-emerald-dead-sea');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('booking-panel')).toBeVisible();

    await page.goto('/en/account/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible();
  });
});
