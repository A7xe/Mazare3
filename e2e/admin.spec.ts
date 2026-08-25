import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Admin dashboard E2E', () => {
  test('admin sees dashboard and can open key pages', async ({ page }) => {
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('admin-summary-cards')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/admin/users');
    await expect(page.getByTestId('admin-users')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/admin/properties');
    await expect(page.getByTestId('admin-properties')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/admin/bookings');
    await expect(page.getByTestId('admin-bookings')).toBeVisible({ timeout: 30_000 });
  });

  test('header shows admin dashboard link when logged in as admin', async ({ page }) => {
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nav-account').click();
    await expect(page.getByTestId('nav-admin-dashboard').first()).toBeVisible({
      timeout: 20_000,
    });
  });
});

test.describe('Admin access guards', () => {
  test('customer does not see admin link and gets forbidden on /admin', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar');
    await expect(page.getByTestId('nav-admin-dashboard')).toHaveCount(0);

    await page.goto('/ar/admin');
    await expect(page.getByTestId('admin-forbidden')).toBeVisible({ timeout: 20_000 });
  });

  test('guest visiting /admin redirects to login', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto('/ar/admin');
    await page.waitForURL(/\/ar\/login\?returnUrl=/);
    expect(page.url()).toContain('returnUrl');
    await context.close();
  });
});
