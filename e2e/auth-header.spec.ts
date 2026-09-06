import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Authenticated top header', () => {
  test.describe.configure({ retries: 0 });

  test('customer account surfaces use one shared header', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.goto('/ar/account');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-identity')).toBeVisible();
    await expect(page.getByTestId('auth-header-identity')).toHaveAttribute('href', /\/account$/);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('حسابي');
    await expect(page.getByTestId('auth-header-notifications')).toHaveAttribute(
      'href',
      /\/account\/notifications$/,
    );
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('حجوزاتي');
    await expect(page.getByTestId('my-bookings')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('طلب الشراكة');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
  });

  test('logged-in marketplace surfaces keep the authenticated header', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.goto('/ar');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('الرئيسية');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();

    await page.goto('/ar/search');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('استكشف');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();

    await page.goto('/ar/search?q=مزرعة');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('نتائج البحث');

    await page.goto('/ar/properties/chalet-emerald-dead-sea');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('استكشف');
    await expect(page.getByTestId('auth-header-breadcrumb')).not.toContainText('chalet-emerald-dead-sea');
  });

  test('guest marketplace stays unchanged without authenticated header', async ({ page }) => {
    await page.goto('/ar');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();

    await page.goto('/ar/search');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
  });

  test('English account header mirrors LTR', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/en/account');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('authenticated-top-header')).toBeVisible();
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('Account');
    await expect(page.getByTestId('auth-header-identity')).toBeVisible();
  });

  test('auth pages do not use the authenticated header', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/login');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
  });

  test('admin shell keeps SiteHeader', async ({ page }) => {
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
  });

  test('owner properties and add-farm use owner breadcrumbs without bottom nav', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner/properties');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(1);
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('إدارة المزارع');
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('مزارعي');
    await expect(page.getByTestId('marketplace-bottom-nav')).toHaveCount(0);
    await expect(page.getByTestId('owner-properties-list')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar/owner/properties/new');
    await expect(page.getByTestId('auth-header-breadcrumb')).toContainText('إضافة مزرعة');
  });

  test('mobile account header stays compact', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account');
    await expect(page.getByTestId('authenticated-top-header')).toBeVisible();
    await expect(page.getByTestId('auth-header-mobile-context')).toBeVisible();
    await expect(page.getByTestId('auth-header-breadcrumb')).toBeHidden();
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
    await expect(page.getByTestId('auth-header-identity')).toBeVisible();
    await expect(page.getByTestId('auth-header-notifications')).toBeVisible();
  });

  test('mobile marketplace header stays compact with bottom nav', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/search');
    await expect(page.getByTestId('authenticated-top-header')).toBeVisible();
    await expect(page.getByTestId('auth-header-mobile-context')).toContainText('استكشف');
    await expect(page.getByTestId('auth-header-breadcrumb')).toBeHidden();
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
  });
});
