import { test, expect } from '@playwright/test';
import path from 'node:path';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-info-contact-po2');

async function assertNoOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

async function openPartnerWizard(page: import('@playwright/test').Page) {
  await page.goto('/ar/become-owner');
  await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 30_000 });
  const start = page.getByTestId('partner-start-application');
  const cont = page.getByTestId('partner-continue-application');
  if (await start.isVisible().catch(() => false)) {
    await start.click();
  } else if (await cont.isVisible().catch(() => false)) {
    await cont.click();
  }
  await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
}

test.describe('PO-2 partner info + contact', () => {
  test('customer Step1→Contact→Documents persists; owner redirects', async ({ page }) => {
    test.setTimeout(240_000);

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await openPartnerWizard(page);

    // Mobile compact stepper — ensure entity panel via Next/Back if needed
    if (!(await page.getByTestId('partner-step-entity-panel').isVisible().catch(() => false))) {
      await page.getByTestId('partner-wizard-back').click({ force: true }).catch(() => undefined);
    }
    await expect(page.getByTestId('partner-step-entity-panel')).toBeVisible({ timeout: 20_000 });
    await assertNoOverflow(page);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-step1.png'), fullPage: true }).catch(() => undefined);

    await page.getByTestId('partner-entity-individual').click();
    await page.getByTestId('owner-apply-displayName').fill('شريك اختبار PO2');
    await page.getByTestId('owner-apply-city').fill('عمان');
    await page.getByTestId('owner-apply-area').fill('خلدا');
    await page.getByTestId('owner-apply-bio').fill(
      'نبذة تجريبية لشريك اختبار المرحلة الثانية تحتوي أكثر من عشرين حرفاً.',
    );
    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('partner-contact-privacy')).toBeVisible();
    await expect(page.getByText(/Verified|تم التحقق من الرقم/i)).toHaveCount(0);
    await assertNoOverflow(page);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-step2.png'), fullPage: true }).catch(() => undefined);

    const phone = `079${String(Date.now()).slice(-7)}`;
    await page.getByTestId('owner-apply-phone').fill(phone);
    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-wizard-step-documents')).toBeVisible({ timeout: 30_000 });

    // Fresh session + resume (hard reload can drop cookie in local Playwright)
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await openPartnerWizard(page);
    await expect(page.getByTestId('partner-step-entity-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('owner-apply-displayName')).toHaveValue('شريك اختبار PO2');
    await expect(page.getByTestId('owner-apply-city')).toHaveValue('عمان');

    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('owner-apply-phone')).toHaveValue(phone);

    // Back preserves Step 1 values in local form
    await page.getByTestId('partner-wizard-back').click();
    await expect(page.getByTestId('partner-step-entity-panel')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('owner-apply-displayName')).toHaveValue('شريك اختبار PO2');

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByTestId('partner-step-entity')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-step1.png'), fullPage: true }).catch(() => undefined);
    await page.getByTestId('partner-step-contact').click();
    await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-step2.png'), fullPage: true }).catch(() => undefined);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-continue-application').click();
    } else if (await page.getByTestId('partner-start-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-start-application').click();
    }
    await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'en-390-step1.png'), fullPage: true }).catch(() => undefined);

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page).toHaveURL(/\/owner\/properties\/new/, { timeout: 45_000 });
    await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
  });
});
