import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';
import { getApiBase } from './constants.js';

async function api(cookie: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

async function createListing(titleEn: string, basePrice: number, area: string) {
  return createAndPublishTestProperty({ titleEn, basePrice, area });
}

test.describe('Phase 10F.3B paid sponsorship requests', () => {
  test('Arabic owner request, admin pay/activate, customer sees إعلان', async ({ page }) => {
    test.setTimeout(180_000);
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const area = `e2e-spon-${Date.now()}`;
      const titleEn = `E2E Paid ${Date.now()}`;
      const listing = await createListing(titleEn, 1500, area);
      fixtures.track(listing.id);
      const pkgLabel = `إعلان ${Date.now().toString().slice(-6)}`;

      const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
      const payoutsBefore = await api(ownerCookie, 'GET', '/owner/payouts');
      const beforeCount = Array.isArray(payoutsBefore.json.data) ? payoutsBefore.json.data.length : 0;

      await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto('/ar/admin/sponsorship');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('admin-sponsorship-packages')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('package-name-ar').fill(pkgLabel);
      await page.getByTestId('package-name-en').fill('7-day sponsored');
      await page.getByTestId('package-days').fill('7');
      await page.getByTestId('package-price').fill('25');
      await page.getByTestId('package-create').click();
      await expect(page.getByTestId('package-row-active').first()).toBeVisible({ timeout: 15_000 });

      await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
      await page.goto(`/ar/owner/properties/${listing.id}`);
      await expect(page.getByTestId('owner-promote')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('promote-open').click();
      await expect(page.getByTestId('package-select')).toBeVisible();
      const pkgValue = await page
        .getByTestId('package-select')
        .locator('option')
        .filter({ hasText: pkgLabel })
        .getAttribute('value');
      expect(pkgValue).toBeTruthy();
      await page.getByTestId('package-select').selectOption(pkgValue!);
      await page.getByTestId('promote-confirm').click();
      await expect(page.getByTestId('sponsorship-order-row-pending_review')).toBeVisible({ timeout: 15_000 });

      await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
      await page.goto('/ar/admin/sponsorship');
      const pending = page.locator('[data-testid="admin-order-row-pending_review"]', { hasText: titleEn });
      await expect(pending).toBeVisible({ timeout: 20_000 });
      await pending.getByTestId('order-approve').click();
      const awaiting = page.locator('[data-testid="admin-order-row-approved_pending_payment"]', {
        hasText: titleEn,
      });
      await expect(awaiting).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('order-pay-ref').fill('E2E-SPON-REF');
      await awaiting.getByTestId('order-confirm-pay').click();
      const paid = page.locator('[data-testid="admin-order-row-paid"]', { hasText: titleEn });
      await expect(paid).toBeVisible({ timeout: 15_000 });
      await paid.getByTestId('order-activate').click();
      await expect(page.locator('[data-testid="admin-order-row-active"]', { hasText: titleEn })).toBeVisible({
        timeout: 15_000,
      });

      await page.goto(`/ar/search?city=amman&area=${encodeURIComponent(area)}&sort=recommended`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId(`property-card-${listing.slug}`)).toBeVisible({ timeout: 45_000 });
      await expect(
        page.getByTestId(`property-card-${listing.slug}`).getByTestId('placement-badge-sponsored'),
      ).toHaveText('إعلان');

      const payoutsAfter = await api(ownerCookie, 'GET', '/owner/payouts');
      const afterCount = Array.isArray(payoutsAfter.json.data) ? payoutsAfter.json.data.length : 0;
      expect(afterCount).toBe(beforeCount);
    } finally {
      await fixtures.dispose();
    }
  });
});
