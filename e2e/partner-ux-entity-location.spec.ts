/**
 * Partner UX refinement — entity type + location simplification visual QA.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { applySessionCookie } from './helpers/session.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const SHOT_DIR = path.join(process.cwd(), '_partner_ux_entity_location');

async function assertNoOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

test.describe('Partner UX entity + location refinement', () => {
  test.describe.configure({ retries: 0 });

  test('AR 390/1440 Individual + Business; EN 390 Individual', async ({ page, request }) => {
    test.setTimeout(180_000);
    const email = ua6aEmail('ux-entity-loc');
    const password = 'UxEntityLoc!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'UX Entity Loc',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await expect(page.getByTestId('partner-about-you')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('partner-location-clarification')).toContainText(
        'مكان إقامتك أو مقر نشاطك',
      );
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-about-you-390.png'),
        fullPage: true,
      });
      await page.getByTestId('owner-apply-displayName').fill('شريك فرد');
      await page.getByTestId('owner-apply-city').fill('عمان');
      await page.getByTestId('owner-apply-area').fill('عبدون');
      await page.getByTestId('partner-wizard-next').click();
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30_000 });

      await page.getByTestId('partner-entity-individual').click();
      await expect(page.getByTestId('owner-apply-businessName')).toHaveCount(0);
      await expect(page.getByTestId('partner-different-operating-location')).toHaveCount(0);
      await expect(page.getByText('أتقدم بصفتي الشخصية')).toBeVisible();
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-individual-details-390.png'),
        fullPage: true,
      });

      await page.getByTestId('partner-entity-business').click();
      await expect(page.getByTestId('owner-apply-businessName')).toBeVisible();
      await expect(page.getByText('أتقدم باسم شركة أو نشاط تجاري')).toBeVisible();
      await expect(page.getByTestId('partner-different-operating-location')).toHaveCount(0);
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-business-details-390.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-business-details-1440.png'),
        fullPage: true,
      });
      await page.getByTestId('partner-entity-individual').click();
      await expect(page.getByTestId('owner-apply-businessName')).toHaveCount(0);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-individual-details-1440.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 45_000 });
      await page.getByTestId('partner-entity-individual').click();
      await expect(page.getByTestId('owner-apply-businessName')).toHaveCount(0);
      await expect(page.getByText('I am applying in my personal capacity')).toBeVisible();
      await expect(page.getByTestId('partner-different-operating-location')).toHaveCount(0);
      await page.getByTestId('partner-wizard-back').click();
      await expect(page.getByTestId('partner-location-clarification')).toContainText(
        'residence or business headquarters',
      );
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'en-about-you-390.png'),
        fullPage: true,
      });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });
});
