import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, PROPERTY_SLUG, getApiBase } from './constants.js';
import { findAvailableSlot, loginViaApi } from './helpers/api.js';
import {
  clickBookNow,
  gotoProperty,
  gotoPropertyDetail,
  openBookingFromProperty,
  selectBookingSlot,
} from './helpers/booking-ui.js';
import { applySessionToPage } from './helpers/session.js';

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.screenshot({
    path: `_cb_ux1_visual/${name}.png`,
    fullPage: true,
  });
}

test.describe('CB-UX-1 booking journey UX', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('property entry is informational; book page configures; instant continues to payment', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await gotoPropertyDetail(page, 'ar', PROPERTY_SLUG);
    await expect(page.getByTestId('booking-entry-card')).toBeVisible();
    await expect(page.getByTestId('booking-date-trigger')).toHaveCount(0);
    await expect(page.getByTestId('booking-period-morning')).toHaveCount(0);
    await expect(page.getByTestId('booking-guests')).toHaveCount(0);
    await expect(page.getByTestId('booking-entry-cta')).toContainText(/احجز الآن/);
    await expect(page.getByText(/7 أيام قبل الوصول/)).toHaveCount(0);
    await shot(page, '01-ar-390-property-entry');

    await openBookingFromProperty(page);
    await expect(page).toHaveURL(/\/properties\/[^/]+\/book/);
    await expect(page.getByTestId('booking-panel')).toBeVisible();
    await shot(page, '02-ar-390-booking-config-initial');

    await page.getByTestId('booking-date-trigger').click();
    await expect(page.getByTestId('booking-calendar-dialog')).toBeVisible();
    await shot(page, '03-ar-390-calendar');
    await page.getByTestId('booking-calendar-close').click();

    const before = await fetch(`${getApiBase()}/me/bookings`, {
      headers: { Cookie: cookie },
    });
    const beforeCount = ((await before.json()) as { data: unknown[] }).data.length;

    const slot = await findAvailableSlot({ minDaysAhead: 5, maxDaysAhead: 25 });
    await selectBookingSlot(page, slot, 4);
    await shot(page, '04-ar-390-configured');

    const mid = await fetch(`${getApiBase()}/me/bookings`, {
      headers: { Cookie: cookie },
    });
    const midCount = ((await mid.json()) as { data: unknown[] }).data.length;
    expect(midCount).toBe(beforeCount);

    await expect(page.getByTestId('booking-submit')).toContainText(/متابعة للدفع/);
    await clickBookNow(page);
    await expect(page).toHaveURL(/\/checkout\//, { timeout: 30_000 });
    await expect(page.getByTestId('checkout-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /إتمام الدفع/ })).toBeVisible();
    await shot(page, '05-ar-390-payment');

    const after = await fetch(`${getApiBase()}/me/bookings`, {
      headers: { Cookie: cookie },
    });
    const afterCount = ((await after.json()) as { data: unknown[] }).data.length;
    expect(afterCount).toBe(beforeCount + 1);
  });

  test('desktop booking configuration', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'ar', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 6, maxDaysAhead: 28 });
    await selectBookingSlot(page, slot, 3);
    await shot(page, '06-ar-1440-booking-config');
  });

  test('EN booking configuration', async ({ page }) => {
    test.setTimeout(120_000);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await gotoProperty(page, 'en', PROPERTY_SLUG);
    const slot = await findAvailableSlot({ minDaysAhead: 7, maxDaysAhead: 30 });
    await selectBookingSlot(page, slot, 2);
    await expect(page.getByTestId('booking-submit')).toContainText(/Continue to payment/);
    await shot(page, '07-en-390-booking-config');
  });
});
