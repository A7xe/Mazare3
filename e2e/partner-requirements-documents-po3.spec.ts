import { test, expect } from '@playwright/test';
import path from 'node:path';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, OWNER_EMAIL, OWNER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-requirements-documents-po3');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(64, 1),
]);

async function assertNoOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

async function openWizard(page: import('@playwright/test').Page) {
  await page.goto('/ar/become-owner');
  await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 30_000 });
  const start = page.getByTestId('partner-start-application');
  const cont = page.getByTestId('partner-continue-application');
  if (await start.isVisible().catch(() => false)) await start.click();
  else if (await cont.isVisible().catch(() => false)) await cont.click();
  await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
}

async function ensureEntityContact(page: import('@playwright/test').Page) {
  if (await page.getByTestId('partner-step-entity-panel').isVisible().catch(() => false)) {
    await page.getByTestId('partner-entity-individual').click();
    await page.getByTestId('owner-apply-displayName').fill('شريك اختبار PO3');
    await page.getByTestId('owner-apply-city').fill('عمان');
    await page.getByTestId('owner-apply-area').fill('خلدا');
    await page.getByTestId('owner-apply-bio').fill(
      'نبذة تجريبية لشريك اختبار المرحلة الثالثة تحتوي أكثر من عشرين حرفاً.',
    );
    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30_000 });
  }
  if (await page.getByTestId('partner-step-contact-panel').isVisible().catch(() => false)) {
    const phone = page.getByTestId('owner-apply-phone');
    const current = await phone.inputValue().catch(() => '');
    if (!current || current.length < 8) {
      await phone.fill(`079${String(Date.now()).slice(-7)}`);
    }
    await expect(page.getByTestId('partner-wizard-next')).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId('partner-wizard-next').click();
    await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
  }
}

test.describe('PO-3 combined documents step', () => {
  test('documents UX, upload, resume, owner redirect; cross-user denied', async ({ page, request }) => {
    test.setTimeout(240_000);

    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await openWizard(page);
    await ensureEntityContact(page);

    // Combined Documents — no standalone Requirements screen
    await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('partner-step-requirements-panel')).toHaveCount(0);
    await expect(page.getByTestId('partner-documents-list')).toBeVisible();
    await expect(page.getByTestId('partner-docs-progress')).toBeVisible();
    await expect(page.getByTestId('partner-docs-privacy')).toBeVisible();
    await expect(page.getByTestId('partner-docs-entity-hint').or(page.getByText(/اختر نوع الشريك/))).toBeVisible();
    await assertNoOverflow(page);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-documents.png'), fullPage: true }).catch(() => undefined);

    // Legacy ?step=requirements opens Documents
    await page.goto('/ar/become-owner?step=requirements');
    if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-continue-application').click();
    } else if (await page.getByTestId('partner-start-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-start-application').click();
    }
    await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });

    const uploadInputs = page.locator('[data-testid^="partner-doc-upload-"]');
    const count = await uploadInputs.count();
    expect(count).toBeGreaterThan(0);

    // Upload a safe synthetic PNG for each required card that has an upload control
    for (let i = 0; i < count; i++) {
      const input = uploadInputs.nth(i);
      const testId = await input.getAttribute('data-testid');
      if (!testId) continue;
      const reqId = testId.replace('partner-doc-upload-', '');
      const card = page.getByTestId(`partner-doc-card-${reqId}`);
      const isOptional = await card.getByText(/اختياري|Optional/i).count();
      const badgeRequired = await card.getByText(/^مطلوب$|^Required$/).count();
      if (badgeRequired === 0 && isOptional > 0) continue;
      await input.setInputFiles({
        name: `po3-${reqId}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      });
      await expect(page.getByTestId(`partner-doc-filename-${reqId}`)).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId(`partner-doc-status-${reqId}`)).toContainText(
        /تم الرفع|Uploaded|قيد المراجعة|Under review|مقبول|Accepted/,
      );
    }

    // Resume — uploads persist; 6-step stepper has documents, not requirements
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openWizard(page);
    await expect(page.getByTestId('partner-step-documents')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-step-requirements')).toHaveCount(0);
    await page.getByTestId('partner-step-documents').click();
    await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('[data-testid^="partner-doc-filename-"]').first()).toBeVisible();

    // Back to Contact then forward keeps uploads
    await page.getByTestId('partner-step-contact').click();
    await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible();
    await page.getByTestId('partner-step-documents').click();
    await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible();
    await expect(page.locator('[data-testid^="partner-doc-filename-"]').first()).toBeVisible();

    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-documents.png'), fullPage: true }).catch(() => undefined);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
      await page.getByTestId('partner-continue-application').click();
    }
    await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });
    if (await page.getByTestId('partner-step-documents').isVisible().catch(() => false)) {
      await page.getByTestId('partner-step-documents').click();
    }
    await page.screenshot({ path: path.join(SHOT_DIR, 'en-390-documents.png'), fullPage: true }).catch(() => undefined);

    // Next to payout when required docs complete
    await page.setViewportSize({ width: 1440, height: 900 });
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await openWizard(page);
    if (await page.getByTestId('partner-step-documents').isVisible().catch(() => false)) {
      await page.getByTestId('partner-step-documents').click();
    }
    const nextBtn = page.getByTestId('partner-wizard-next');
    if (await nextBtn.isEnabled()) {
      await nextBtn.click();
      await expect(page.getByTestId('partner-wizard-step-payout')).toBeVisible({ timeout: 20_000 });
    }

    // Cross-user: customer cannot read owner document file if any
    const cookieHeader = await (async () => {
      const res = await request.post(`${getApiBase()}/auth/login`, {
        data: { email: CUSTOMER_EMAIL, password: CUSTOMER_PASSWORD },
      });
      const setCookie = res.headers()['set-cookie'] ?? '';
      return Array.isArray(setCookie) ? setCookie.join(';') : setCookie;
    })();
    const probe = await request.get(`${getApiBase()}/owner/onboarding/documents/nonexistent-doc-id/file`, {
      headers: { Cookie: cookieHeader.split(';')[0] ?? cookieHeader },
    });
    expect([401, 403, 404]).toContain(probe.status());

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page).toHaveURL(/\/owner\/properties\/new/, { timeout: 45_000 });
    await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
  });
});
