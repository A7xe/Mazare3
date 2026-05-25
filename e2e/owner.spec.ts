import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD } from './constants.js';
import { ensureCustomerLoggedIn, ensureOwnerLoggedIn } from './helpers/auth-ui.js';

test.describe('Owner dashboard E2E', () => {
  test('owner sees dashboard summary and availability after login', async ({ page }) => {
    await ensureOwnerLoggedIn(page, 'ar');
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();
    await expect(page.getByTestId('owner-summary-cards')).toBeVisible();

    await page.goto('/ar/owner/availability');
    await expect(page.getByTestId('owner-availability')).toBeVisible();
    await expect(page.getByTestId('owner-availability-property')).toBeVisible();
  });

  test('header shows owner dashboard link when logged in as owner', async ({ page }) => {
    await ensureOwnerLoggedIn(page, 'ar');
    await page.goto('/ar');
    await expect(page.getByTestId('nav-owner-dashboard')).toBeVisible();
    await expect(page.getByTestId('nav-owner-dashboard')).toContainText(/لوحة المالك/);
  });

  test('English owner pages render LTR', async ({ page }) => {
    await ensureOwnerLoggedIn(page, 'en');
    await page.goto('/en/owner');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible();

    await page.goto('/en/owner/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.goto('/en/owner/availability');
    await expect(page.getByTestId('owner-availability-property')).toBeVisible();
  });
});

test.describe('Owner access guards', () => {
  test('guest visiting /owner redirects to login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/ar/owner');
    await page.waitForURL(/\/ar\/login\?returnUrl=/);
    expect(page.url()).toContain('returnUrl');
    await context.close();
  });

  test('customer sees forbidden on /owner', async ({ page }) => {
    await ensureCustomerLoggedIn(page, 'ar');
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-forbidden')).toBeVisible({ timeout: 15_000 });
  });

  test('after logout owner panel requires login again', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await ensureOwnerLoggedIn(page, 'ar');
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 20_000 });
    await context.clearCookies();
    await page.goto('/ar/owner');
    await page.waitForURL(/\/ar\/login/);
    await context.close();
  });
});
