/**
 * PF-2 visual captures (local artifacts under _pf2_visual/).
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { applySessionCookie } from './helpers/session.js';
import { cleanupUa6aFixtures, createPasswordFixture, ua6aEmail } from './helpers/ua6a.js';

test.describe('PF-2 visual QA', () => {
  test('capture About You + Partner Details viewports', async ({ page, request }) => {
    test.setTimeout(180_000);
    mkdirSync('_pf2_visual', { recursive: true });
    const email = ua6aEmail('pf2-vis');
    const password = 'Pf2EarlyPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF2 Visual',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await expect(page.getByTestId('partner-about-you')).toBeVisible({ timeout: 30000 });
      await page.screenshot({ path: '_pf2_visual/ar-about-390.png' });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: '_pf2_visual/ar-about-1440.png' });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId('owner-apply-displayName').fill('شريك بصري');
      await page.getByTestId('owner-apply-city').fill('عمان');
      await page.getByTestId('owner-apply-area').fill('خلدا');
      await page.getByTestId('partner-wizard-next').click();
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30000 });
      await page.getByTestId('partner-entity-individual').click();
      await page.screenshot({ path: '_pf2_visual/ar-details-individual-390.png' });
      await page.getByTestId('partner-entity-business').click();
      await page.screenshot({ path: '_pf2_visual/ar-details-business-390.png' });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: '_pf2_visual/ar-details-1440.png' });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      // Resume lands on Partner Details when About You is complete
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 45000 });
      await page.screenshot({ path: '_pf2_visual/en-details-390.png' });

      // Fresh about for EN: use continue back if available, else assert details OK
      await page.getByTestId('partner-wizard-back').click().catch(() => undefined);
      if (await page.getByTestId('partner-about-you').isVisible().catch(() => false)) {
        await page.screenshot({ path: '_pf2_visual/en-about-390.png' });
      }
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });
});
