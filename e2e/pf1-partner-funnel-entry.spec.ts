/**
 * PF-1 — Partner landing + Unified Auth handoff (browser).
 */
import { test, expect } from '@playwright/test';
import { applySessionCookie } from './helpers/session.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  mockCapabilities,
  ua6aEmail,
} from './helpers/ua6a.js';

test.describe('PF-1 partner funnel entry', () => {
  test.describe.configure({ retries: 0 });

  test('A AR guest hero — Start + Resume, no Login/Signup box', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('partner-acquisition-hero')).toBeVisible();
    await expect(page.getByTestId('partner-entry-eyebrow')).toContainText('انضم كشريك');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('انضم كشريك في مزارع');
    await expect(page.getByTestId('partner-start-application')).toBeVisible();
    await expect(page.getByTestId('partner-resume-application')).toBeVisible();
    await expect(page.getByTestId('partner-auth-bridge')).toHaveCount(0);
    await expect(page.getByTestId('partner-start-signup')).toHaveCount(0);
    await expect(page.getByTestId('partner-start-login')).toHaveCount(0);
    // Start CTA visible without scrolling past fold for primary action
    const startBox = await page.getByTestId('partner-start-application').boundingBox();
    expect(startBox && startBox.y < 700).toBeTruthy();
  });

  test('B guest Start → Unified Auth with returnUrl, no forced email mode', async ({ page }) => {
    await page.goto('/ar/become-owner');
    await page.getByTestId('partner-start-application').click();
    await expect(page).toHaveURL(/\/ar\/auth/);
    const url = new URL(page.url());
    expect(url.searchParams.get('returnUrl')).toMatch(/become-owner/);
    expect(url.searchParams.get('mode')).toBeNull();
    expect(url.searchParams.get('emailMode')).toBeNull();
    await expect(page.getByTestId('auth-card')).toBeVisible({ timeout: 45000 });
  });

  test('C guest Resume → Unified Auth with returnUrl', async ({ page }) => {
    await page.goto('/en/become-owner');
    await page.getByTestId('partner-resume-application').click();
    await expect(page).toHaveURL(/\/en\/auth/);
    const url = new URL(page.url());
    expect(url.searchParams.get('returnUrl')).toMatch(/become-owner/);
    expect(url.searchParams.get('mode')).toBeNull();
    expect(url.searchParams.get('emailMode')).toBeNull();
  });

  test('D capabilities on auth after Partner Start (Google+Email local)', async ({ page }) => {
    await mockCapabilities(page, { phone: false, google: true });
    await page.goto('/ar/become-owner');
    await page.getByTestId('partner-start-application').click();
    await expect(page.getByTestId('auth-continue-google')).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId('auth-continue-email')).toBeVisible();
    await expect(page.getByTestId('auth-continue-phone')).toHaveCount(0);
  });

  test('E Phone capability future path (mocked)', async ({ page }) => {
    await mockCapabilities(page, { phone: true, google: true });
    await page.goto('/ar/become-owner');
    await page.getByTestId('partner-start-application').click();
    await expect(page.getByTestId('auth-continue-phone')).toBeVisible({ timeout: 45000 });
    await expect(page.getByTestId('auth-continue-google')).toBeVisible();
    await expect(page.getByTestId('auth-continue-email')).toBeVisible();
  });

  test('F authenticated customer skips auth bounce', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = ua6aEmail('pf1-customer');
    const password = 'Pf1TestPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF1 Customer',
      attachPasswordIdentity: true,
    });
    try {
      // Cookie first — avoid an extra full navigation that can abort under load.
      await applySessionCookie(page.context(), email, password);
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/auth/);
      await expect(page.getByTestId('partner-auth-bridge')).toHaveCount(0);
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45000 });
      await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('partner-resume-application')).toHaveCount(0);
      await expect(page.getByTestId('partner-start-application')).toBeVisible();
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });
});

