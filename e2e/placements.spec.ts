import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';

async function createListing(titleEn: string, basePrice: number, area: string) {
  return createAndPublishTestProperty({ titleEn, basePrice, area });
}

test.describe('Phase 10F.3A sponsored and featured placements', () => {
  test('Arabic recommended ranks sponsored then featured; price sort is pure', async ({ page }) => {
    test.setTimeout(150_000);
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const area = `e2e-place-${Date.now()}`;
      const sponsored = await createListing(`E2E Spon ${Date.now()}`, 1800, area);
      const featured = await createListing(`E2E Feat ${Date.now()}`, 900, area);
      const organic = await createListing(`E2E Org ${Date.now()}`, 400, area);
      fixtures.trackMany([sponsored, featured, organic]);

      await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);

      await page.goto(`/ar/admin/properties/${sponsored.id}`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('admin-placements')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('placement-type').selectOption('sponsored');
      await page.getByTestId('placement-create').click();
      await expect(page.getByTestId('placement-row-sponsored-active')).toBeVisible({ timeout: 15_000 });

      await page.goto(`/ar/admin/properties/${featured.id}`);
      await expect(page.getByTestId('admin-placements')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('placement-type').selectOption('featured');
      await page.getByTestId('placement-create').click();
      await expect(page.getByTestId('placement-row-featured-active')).toBeVisible({ timeout: 15_000 });

      await page.goto(`/ar/search?city=amman&area=${encodeURIComponent(area)}&sort=recommended`);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('search-results-grid')).toBeVisible({ timeout: 45_000 });

      const recCards = page.getByTestId('search-results-grid').getByTestId('property-card');
      await expect(recCards.first().getByTestId(`property-card-${sponsored.slug}`)).toBeVisible();
      const recSlugs = await recCards.locator('a[data-testid^="property-card-"]').evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-testid') ?? ''),
      );
      const sIdx = recSlugs.findIndex((t) => t.includes(sponsored.slug));
      const fIdx = recSlugs.findIndex((t) => t.includes(featured.slug));
      expect(sIdx).toBeGreaterThanOrEqual(0);
      expect(fIdx).toBeGreaterThan(sIdx);

      await expect(
        page.getByTestId(`property-card-${sponsored.slug}`).getByTestId('placement-badge-sponsored'),
      ).toHaveText('إعلان');
      await expect(
        page.getByTestId(`property-card-${featured.slug}`).getByTestId('placement-badge-featured'),
      ).toHaveText('مميز');

      await page.getByTestId('search-sort').selectOption('price_asc');
      await page.getByTestId('apply-filters').click();
      await expect(page).toHaveURL(/sort=price_asc/);
      await expect(page.getByTestId('search-results-grid')).toBeVisible({ timeout: 45_000 });
      const priceCards = page.getByTestId('search-results-grid').locator('a[data-testid^="property-card-"]');
      const priceSlugs = await priceCards.evaluateAll((els) =>
        els.map((el) => el.getAttribute('data-testid') ?? ''),
      );
      const sPrice = priceSlugs.findIndex((t) => t.includes(sponsored.slug));
      const fPrice = priceSlugs.findIndex((t) => t.includes(featured.slug));
      expect(fPrice).toBeGreaterThanOrEqual(0);
      expect(sPrice).toBeGreaterThan(fPrice);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    } finally {
      await fixtures.dispose();
    }
  });
});
