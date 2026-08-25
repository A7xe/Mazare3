import { test, expect } from '@playwright/test';
import { OWNER_EMAIL, OWNER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

test.describe('Owner performance (10C.2D)', () => {
  test('owner dashboard shows performance section in Arabic RTL', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/owner');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('owner-dashboard')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-performance')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-performance-range-label')).toBeVisible();
    await page.getByTestId('owner-performance-range-90d').click();
    await expect(page.getByTestId('owner-performance-range-label')).toContainText('90');
  });
});
