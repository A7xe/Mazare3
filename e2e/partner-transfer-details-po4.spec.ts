import { test, expect } from '@playwright/test';
import path from 'node:path';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-transfer-details-po4');

/** Synthetic fixture — not a real customer account. Last4 used only for mask assertion. */
const SYNTH_IBAN = 'JO93CBJO0010000000000131000302';
const SYNTH_LAST4 = '0302';

async function openWizard(page: import('@playwright/test').Page) {
  await page.goto('/ar/become-owner');
  await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 30_000 });
  const start = page.getByTestId('partner-start-application');
  const cont = page.getByTestId('partner-continue-application');
  if (await start.isVisible().catch(() => false)) await start.click();
  else if (await cont.isVisible().catch(() => false)) await cont.click();
  await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
}

async function goToPayout(page: import('@playwright/test').Page) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByTestId('partner-step-payout')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('partner-step-payout').click();
  await expect(page.getByTestId('partner-step-payout-panel')).toBeVisible({ timeout: 20_000 });
}

test.describe('PO-4 transfer details', () => {
  test('save masked payout, resume, advance to agreement; cross-user denied', async ({ page, request }) => {
    test.setTimeout(240_000);

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await openWizard(page);

    // Prefer desktop jump for reliability after prior PO steps
    await goToPayout(page);

    await expect(page.getByTestId('partner-transfer-privacy')).toBeVisible();
    await expect(page.getByTestId('partner-transfer-proof-note')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-payout-first.png'), fullPage: true }).catch(() => undefined);

    // If already saved from prior runs, enter update mode
    if (await page.getByTestId('partner-payout-saved-summary').isVisible().catch(() => false)) {
      await page.getByTestId('partner-payout-update').click();
    }
    await expect(page.getByTestId('partner-payout-form')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('partner-payout-beneficiary').fill('PO4 Synthetic Holder');
    await page.getByTestId('partner-payout-bank').fill('PO4 Synthetic Bank');
    await page.getByTestId('partner-payout-iban').fill(SYNTH_IBAN);
    await page.getByTestId('partner-payout-save').click();

    await expect(page.getByTestId('partner-payout-saved-summary')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('partner-iban-masked')).toContainText(SYNTH_LAST4);
    await expect(page.getByTestId('partner-iban-masked')).not.toContainText(SYNTH_IBAN);
    // Must not claim reviewed merely because save succeeded
    await expect(page.getByTestId('partner-payout-review-status')).toContainText(/تم الحفظ|Saved|Needs update|يحتاج/);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-payout-saved.png'), fullPage: true }).catch(() => undefined);

    // Resume
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await openWizard(page);
    await goToPayout(page);
    await expect(page.getByTestId('partner-payout-saved-summary')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-iban-masked')).toContainText(SYNTH_LAST4);
    // Form must not be prefilled with masked value as editable IBAN
    if (await page.getByTestId('partner-payout-iban').isVisible().catch(() => false)) {
      await expect(page.getByTestId('partner-payout-iban')).toHaveValue('');
    }

    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-payout.png'), fullPage: true }).catch(() => undefined);

    // Next → Agreement
    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-wizard-step-agreement')).toBeVisible({ timeout: 20_000 });

    // EN smoke
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-continue-application').click();
    }
    await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
    if (await page.getByTestId('partner-step-payout').isVisible().catch(() => false)) {
      await page.getByTestId('partner-step-payout').click();
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-390-payout-saved.png'), fullPage: true }).catch(() => undefined);
    }

    // Cross-user: another session cannot PUT without auth / ownership
    const probe = await request.put(`${getApiBase()}/owner/payout-profile`, {
      data: {
        beneficiaryName: 'Other',
        bankName: 'Other Bank',
        iban: 'JO00OTHER00000000000000000001',
      },
    });
    expect([401, 403]).toContain(probe.status());

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page).toHaveURL(/\/owner\/properties\/new/, { timeout: 45_000 });
    await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
  });
});
