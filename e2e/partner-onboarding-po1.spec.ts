import { test, expect } from '@playwright/test';
import path from 'node:path';
import { OWNER_EMAIL, OWNER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-onboarding-po1');

test.describe('PO-1 partner entry visual smoke', () => {
  test('guest AR/EN landing + approved owner redirect', async ({ page }) => {
    test.setTimeout(120_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('partner-entry-landing')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('partner-auth-bridge')).toBeVisible();
    await expect(page.getByTestId('partner-how-it-works')).toBeVisible();
    await expect(page.getByTestId('become-owner-entry-bridge')).toBeVisible();
    const overflowAr = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflowAr).toBe(false);
    await page.screenshot({ path: path.join(SHOT_DIR, 'guest-ar-390.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('partner-entry-landing')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, 'guest-ar-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    await expect(page.getByTestId('partner-entry-landing')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Join Mazare3 as a partner/i);
    await page.screenshot({ path: path.join(SHOT_DIR, 'guest-en-390.png'), fullPage: true });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'guest-en-1440.png'), fullPage: true });

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page).toHaveURL(/\/owner\/properties\/new/, { timeout: 45_000 });
    await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'approved-owner-ar-390-wizard.png'), fullPage: true });
  });
});
