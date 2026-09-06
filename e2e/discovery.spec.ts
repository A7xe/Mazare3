import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { createAndPublishTestProperty } from './helpers/publish-test-property.js';
import { TestPropertyFixtureTracker } from './helpers/cleanup-test-fixtures.js';

async function createSearchProperty(titleEn: string) {
  return createAndPublishTestProperty({
    titleEn,
    basePrice: 900,
    area: 'e2e-discovery',
    descriptionAr: 'وصف تجريبي لمزرعة اختبار تجربة البحث والحجز من الصفحة الرئيسية.',
    descriptionEn: 'Playwright discovery farm for availability search and checkout handoff.',
  });
}

function plusDays(n: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

test.describe.configure({ mode: 'serial' });

test.describe('Phase 10B.2 Arabic mobile marketplace', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('hero search preserves intent through property and checkout', async ({ page }) => {
    test.setTimeout(120_000);
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const title = `E2E Disc ${Date.now()}`;
      const prop = await createSearchProperty(title);
      fixtures.track(prop.id);
      const date = plusDays(18);

      await page.goto('/ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.getByTestId('marketplace-search-form')).toBeVisible();

      await page.getByTestId('search-city').selectOption('amman');
      await page.getByTestId('search-date').fill(date);
      await page.getByTestId('search-period').selectOption('morning');
      await page.getByTestId('search-guests').fill('6');
      await page.getByTestId('search-submit').click();

      await expect(page).toHaveURL(new RegExp(`date=${date}`));
      await expect(page).toHaveURL(/period=morning/);
      await expect(page).toHaveURL(/city=amman/);
      await expect(page).toHaveURL(/guests=6/);

      await expect(page.getByTestId('search-result-count')).toBeVisible({ timeout: 45_000 });
      const card = page.getByTestId(`property-card-${prop.slug}`);
      await expect(card).toBeVisible();
      await expect(card.getByTestId('exact-slot-price')).toBeVisible();
      await expect(card.locator('text=900')).toHaveCount(0);
      await expect(page.locator('[aria-label="Favorite"]')).toHaveCount(0);

      await page.getByTestId('open-mobile-filters').click();
      await expect(page.getByTestId('search-filters-sheet')).toBeVisible();
      await page.getByTestId('search-filters-sheet').locator('input[name="allowsOvernight"]').check();
      await page.getByTestId('search-filters-sheet').getByTestId('apply-filters').click();
      await expect(page).toHaveURL(/allowsOvernight=true/);
      await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible({ timeout: 45_000 });

      await page.getByTestId(`property-card-${prop.slug}`).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${prop.slug}`));
      await expect(page).toHaveURL(new RegExp(`date=${date}`));
      await expect(page.getByTestId('booking-date')).toHaveValue(date);
      await expect(page.getByTestId('booking-period-morning')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('booking-guests')).toHaveValue('6');
      await expect(page.getByTestId('booking-summary-times')).toBeVisible();
      await expect(page.getByTestId('booking-summary-deposit')).toBeVisible();
      await expect(page.getByTestId('booking-summary-remaining')).toBeVisible();

      await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
      await page.goto(`/ar/properties/${prop.slug}?date=${date}&period=morning&guests=6`);
      await expect(page.getByTestId('booking-submit')).toBeEnabled({ timeout: 30_000 });
      await page.getByTestId('booking-submit').click();
      await expect(page).toHaveURL(/\/checkout\//, { timeout: 45_000 });
      await expect(page.getByTestId('booking-date')).toHaveCount(0);
    } finally {
      await fixtures.dispose();
    }
  });
});

test.describe('Phase 10B.2 desktop search recovery', () => {
  test('empty results recover, sort, and back keeps state', async ({ page }) => {
    const fixtures = new TestPropertyFixtureTracker();
    try {
      const title = `E2E Desk ${Date.now()}`;
      const prop = await createSearchProperty(title);
      fixtures.track(prop.id);
      const date = plusDays(19);

      await page.goto(
        `/en/search?city=amman&area=e2e-discovery&date=${date}&period=overnight`,
      );
      await expect(page.getByTestId('search-empty')).toBeVisible({ timeout: 45_000 });
      await page.getByRole('link', { name: /morning|any period/i }).first().click();
      await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible({ timeout: 45_000 });
      await page.getByTestId('search-sort').selectOption('price_asc');
      await page.getByTestId('apply-filters').click();
      await expect(page).toHaveURL(/sort=price_asc/);

      await page.getByTestId(`property-card-${prop.slug}`).click();
      await expect(page).toHaveURL(new RegExp(`/properties/${prop.slug}`));
      await page.goBack();
      await expect(page).toHaveURL(/date=/);
      await expect(page).toHaveURL(/sort=price_asc/);
      await expect(page.getByTestId(`property-card-${prop.slug}`)).toBeVisible();
    } finally {
      await fixtures.dispose();
    }
  });
});
