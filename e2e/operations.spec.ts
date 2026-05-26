import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  PROPERTY_SLUG,
} from './constants.js';
import { findAvailableSlot } from './helpers/api.js';
import { applySessionToPage } from './helpers/session.js';
import { ensureCustomerLoggedIn } from './helpers/auth-ui.js';
import { gotoProperty, selectBookingSlot, clickBookNow } from './helpers/booking-ui.js';

test('customer refund request appears in admin refunds', async ({ page }) => {
  test.setTimeout(120_000);

  const slot = await findAvailableSlot({ minDaysAhead: 55, maxDaysAhead: 70 });
  await ensureCustomerLoggedIn(page, 'ar');
  await gotoProperty(page, 'ar', PROPERTY_SLUG);
  await selectBookingSlot(page, slot, 4);
  await clickBookNow(page);
  await page.waitForURL(/\/ar\/checkout\//, { timeout: 30_000 });
  await page.getByTestId('checkout-simulate-success').click();
  await page.waitForURL(/\/ar\/account\/bookings/, { timeout: 30_000 });

  const reasonInput = page.locator('[data-testid^="refund-reason-"]').first();
  await expect(reasonInput).toBeVisible({ timeout: 15_000 });
  await reasonInput.fill('طلب استرداد تجريبي E2E — تغيير موعد السفر');
  await page.locator('[data-testid^="refund-request-"]').first().click();
  await expect(page.locator('[data-testid^="refund-status-"]').first()).toBeVisible({
    timeout: 20_000,
  });

  await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/ar/admin/refunds', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admin-refunds')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('[data-testid^="refund-approve-"]').first()).toBeVisible({
    timeout: 15_000,
  });
});
