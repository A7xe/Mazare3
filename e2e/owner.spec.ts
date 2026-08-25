import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD, CUSTOMER_EMAIL, CUSTOMER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Owner dashboard E2E', () => {
  test('owner sees dashboard summary and availability after login', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-summary-cards')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/owner/availability');
    await expect(page.getByTestId('owner-availability-property')).toBeVisible({
      timeout: 45_000,
    });
  });

  test('header shows owner dashboard link when logged in as owner', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nav-account').click();
    await expect(page.getByTestId('nav-owner-dashboard').first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('English owner pages render LTR', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/en/owner');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });

    await page.goto('/en/owner/bookings');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.goto('/en/owner/availability');
    await expect(page.getByTestId('owner-availability-property')).toBeVisible({
      timeout: 45_000,
    });
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
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-forbidden')).toBeVisible({ timeout: 20_000 });
  });

  test('after logout owner panel requires login again', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });
    await context.clearCookies();
    await page.goto('/ar/owner');
    await page.waitForURL(/\/ar\/login/);
    await context.close();
  });
});
