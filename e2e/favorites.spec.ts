import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  PROPERTY_SLUG,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

test.describe('Customer favorites (10E.2)', () => {
  test('favorite from card, list, detail, then remove', async ({ page }) => {
    const cookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const pub = await fetch(`${getApiBase()}/properties/${PROPERTY_SLUG}`);
    const body = (await pub.json()) as { data?: { id?: string } };
    const propertyId = body.data?.id;
    expect(propertyId).toBeTruthy();
    await fetch(`${getApiBase()}/me/favorites/${propertyId}`, {
      method: 'DELETE',
      headers: { Cookie: cookie },
    });

    await page.goto('/ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/search');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    const card = page.getByTestId(`property-card-${PROPERTY_SLUG}`);
    await expect(card).toBeVisible({ timeout: 30_000 });
    const heart = page
      .locator('[data-testid="property-card"]')
      .filter({ has: card })
      .getByTestId('favorite-toggle');
    await expect(heart).toBeVisible();
    await heart.click();
    await expect(heart).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

    await page.goto('/ar/account/favorites');
    await expect(page.getByTestId(`property-card-${PROPERTY_SLUG}`)).toBeVisible({ timeout: 20_000 });

    await page.getByTestId(`property-card-${PROPERTY_SLUG}`).click();
    await expect(page).toHaveURL(new RegExp(`/ar/properties/${PROPERTY_SLUG}`));
    const detailHeart = page.getByTestId('favorite-toggle');
    await expect(detailHeart).toHaveAttribute('aria-pressed', 'true');

    await detailHeart.click();
    await expect(detailHeart).toHaveAttribute('aria-pressed', 'false', { timeout: 15_000 });

    await page.goto('/ar/account/favorites');
    await expect(page.getByTestId('favorites-empty')).toBeVisible({ timeout: 20_000 });
  });
});
