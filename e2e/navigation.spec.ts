import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Customer account dock destination', () => {
  test.describe.configure({ retries: 0 });

  test('guest dock does not treat Account as a destination', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nav-login')).toBeVisible();
    await page.getByTestId('nav-login').click();
    await expect(page).toHaveURL(/\/ar\/auth/);
  });

  test('customer Account opens /account in Arabic and English', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('nav-account')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nav-account').click();
    await expect(page).toHaveURL(/\/ar\/account(?:\/)?$/);
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('account-home-bookings')).toBeVisible();
    await expect(page.getByTestId('account-home-notifications')).toBeVisible();

    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await page.getByTestId('nav-account').click();
    await expect(page).toHaveURL(/\/en\/account(?:\/)?$/);
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });
  });

  test('Account stays active on support, not on bookings or favorites', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.goto('/ar/account');
    await expect(page.getByTestId('nav-account')).toHaveClass(/sm:min-w-20 text-blue-600/);

    await page.goto('/ar/account/support');
    await expect(page.getByTestId('nav-account')).toHaveClass(/sm:min-w-20 text-blue-600/);

    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('nav-bookings')).toHaveClass(/sm:min-w-20 text-blue-600/);
    await expect(page.getByTestId('nav-account')).toHaveClass(/text-slate-500/);

    await page.goto('/ar/account/favorites');
    await expect(page.getByTestId('nav-favorites')).toHaveClass(/sm:min-w-20 text-blue-600/);
    await expect(page.getByTestId('nav-account')).toHaveClass(/text-slate-500/);
  });

  test('logout returns the dock to guest mode', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('account-home').getByTestId('nav-logout').click();
    await page.waitForURL((url) => !url.pathname.includes('/account'), { timeout: 20_000 });
    await expect(page.getByTestId('nav-login')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('nav-list-property')).toBeVisible();
  });
});
