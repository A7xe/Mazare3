import { test, expect, type Page } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  PROPERTY_SLUG,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const IGNORE_CONSOLE = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /Failed to load resource/i,
  /net::ERR_/i,
];

function collectRuntimeIssues(page: Page) {
  const issues: string[] = [];
  page.on('pageerror', (err) => {
    issues.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE_CONSOLE.some((re) => re.test(text))) return;
    issues.push(`console: ${text}`);
  });
  return issues;
}

test.describe('Phase 10H.5 polish smoke', () => {
  test.describe.configure({ retries: 0 });

  test('anonymous homepage → search → property (Arabic RTL)', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible();
    await expect(page.getByTestId('footer-legal-terms')).toBeVisible();

    await page.goto('/ar/search');
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('search-result-count').or(page.getByTestId('search-empty'))).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('property-location-section')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#booking-entry')).toBeVisible();
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('English LTR homepage and property', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await page.goto('/en');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible({ timeout: 20_000 });
    await page.goto(`/en/properties/${PROPERTY_SLUG}`);
    await expect(page.getByTestId('property-location-section')).toBeVisible({ timeout: 30_000 });
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('customer account bookings / favorites / support', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account/bookings');
    await expect(page.getByTestId('my-bookings')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/account/favorites');
    await expect(page.getByTestId('favorites-empty').or(page.locator('[data-testid="property-card"]').first())).toBeVisible({
      timeout: 20_000,
    });

    await page.goto('/ar/account/support');
    await expect(page.getByTestId('help-center')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('my-support')).toBeVisible();
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('owner dashboard → property editor / media / location / bookings', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-summary-cards')).toBeVisible();

    await page.goto('/ar/owner/properties');
    await expect(page.getByTestId('owner-properties-list')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('owner-edit-property').first().click();
    await expect(page.getByTestId('owner-property-form')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-location-section')).toBeVisible();
    await expect(page.getByTestId('owner-media-editor')).toBeVisible();

    await page.goto('/ar/owner/bookings');
    await expect(page.getByTestId('owner-booking-inbox')).toBeVisible({ timeout: 20_000 });
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('admin core operational pages', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto('/ar/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible({ timeout: 30_000 });

    await page.goto('/ar/admin/owners');
    await expect(page.getByTestId('admin-owners')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/properties');
    await expect(page.getByTestId('admin-properties')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/bookings');
    await expect(page.getByTestId('admin-bookings')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/payments');
    await expect(page.getByTestId('admin-payments')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/refunds');
    await expect(page.getByTestId('admin-refunds')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/support');
    await expect(page.getByTestId('admin-support')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/coupons');
    await expect(page.getByTestId('admin-platform-coupons')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/sponsorship');
    await expect(page.getByTestId('admin-sponsorship-packages')).toBeVisible({ timeout: 20_000 });
    await page.goto('/ar/admin/payouts');
    await expect(page.getByTestId('admin-payouts')).toBeVisible({ timeout: 20_000 });
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('mobile customer marketplace (~390px)', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar');
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible();
    await page.goto('/ar/search');
    await expect(page.getByTestId('marketplace-search-form')).toBeVisible({ timeout: 20_000 });
    await page.goto(`/ar/properties/${PROPERTY_SLUG}`);
    await expect(page.locator('#booking-entry')).toBeVisible({ timeout: 30_000 });
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('mobile owner dashboard and editor (~390px)', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });
    await page.goto('/ar/owner/properties');
    await page.getByTestId('owner-edit-property').first().click();
    await expect(page.getByTestId('owner-property-form')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('nav-logout-mobile')).toBeVisible();
    expect(issues, issues.join('\n')).toEqual([]);
  });
});
