import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Owner booking inbox (10C.2C)', () => {
  test('Arabic inbox is RTL, tabs preserve filter in URL', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-booking-inbox')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-inbox-tab-action')).toBeVisible();
    await expect(page.getByTestId('owner-inbox-tab-waiting')).toBeVisible();
    await expect(page.getByTestId('owner-inbox-tab-upcoming')).toBeVisible();
    await expect(page.getByTestId('owner-inbox-tab-history')).toBeVisible();

    await page.getByTestId('owner-inbox-tab-waiting').click();
    await expect(page).toHaveURL(/inbox=waiting/);

    await page.getByTestId('owner-inbox-tab-history').click();
    await expect(page).toHaveURL(/inbox=history/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  });

  test('mobile width keeps inbox usable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner/bookings?inbox=action');
    await expect(page.getByTestId('owner-booking-inbox')).toBeVisible({ timeout: 30_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    expect(overflow).toBe(false);
  });
});
