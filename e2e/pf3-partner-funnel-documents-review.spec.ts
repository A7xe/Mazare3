/**
 * PF-3 — Documents checklist + Agreement-in-Review (four visible steps; PF-5: no Partner payout).
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { applySessionCookie } from './helpers/session.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const SHOT_DIR = path.join(process.cwd(), '_pf3_visual');
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(48, 1),
]);

async function assertNoOverflow(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
  );
  expect(overflow).toBe(false);
}

async function fillAboutYou(page: import('@playwright/test').Page, name: string) {
  await page.getByTestId('owner-apply-displayName').fill(name);
  await page.getByTestId('owner-apply-city').fill('عمان');
  await page.getByTestId('owner-apply-area').fill('خلدا');
  await page.getByTestId('partner-wizard-next').click();
}

async function fillPartnerDetails(
  page: import('@playwright/test').Page,
  entity: 'individual' | 'business',
) {
  await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId(`partner-entity-${entity}`).click();
  if (entity === 'business') {
    const biz = page.getByTestId('owner-apply-businessName');
    if (await biz.isVisible().catch(() => false)) await biz.fill('منشأة PF3');
  }
  await page.getByTestId('owner-apply-bio').fill(
    'نبذة تشغيلية واضحة لطلب شراكة مزارع تغطي أكثر من عشرين حرفاً للتحقق.',
  );
  await page.getByTestId('owner-apply-phone').fill(`079${String(Date.now()).slice(-7)}`);
  await page.getByTestId('partner-wizard-next').click();
}

async function uploadAllDocs(page: import('@playwright/test').Page, prefix: string) {
  await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
  const uploads = page.locator('[data-testid^="partner-doc-upload-"]');
  await expect(uploads.first()).toBeAttached({ timeout: 20_000 });
  const count = await uploads.count();
  for (let i = 0; i < count; i++) {
    await uploads.nth(i).setInputFiles({
      name: `${prefix}-${i}.png`,
      mimeType: 'image/png',
      buffer: PNG,
    });
  }
  await expect(page.getByTestId('partner-wizard-next')).toBeEnabled({ timeout: 45_000 });
}

test.describe('PF-3 documents + agreement-in-review', () => {
  test.describe.configure({ retries: 0 });

  test('A–B Individual + Business documents cards; 4 steps; no Agreement/Payout steps', async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const email = ua6aEmail('pf3-docs');
    const password = 'Pf3DocsPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF3 Docs',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await fillAboutYou(page, 'فرد PF3');
      await fillPartnerDetails(page, 'individual');

      await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('partner-wizard-step-agreement')).toHaveCount(0);
      await expect(page.getByTestId('partner-step-agreement-panel')).toHaveCount(0);
      await expect(page.getByTestId('partner-wizard-step-payout')).toHaveCount(0);
      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);

      const types = await page.locator('[data-doc-type]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-doc-type')),
      );
      expect(types).toContain('identity');
      expect(types).toContain('property_ownership');
      // PF-5: payout_proof is post-approval financial setup, not Partner KYC checklist.
      expect(types).not.toContain('payout_proof');
      expect(types).not.toContain('business_registration');
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-documents-individual-390.png'),
        fullPage: true,
      });

      // Switch to business via edit partner details
      await page.getByTestId('partner-wizard-back').click();
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 15_000 });
      await page.getByTestId('partner-entity-business').click();
      const biz = page.getByTestId('owner-apply-businessName');
      if (await biz.isVisible().catch(() => false)) await biz.fill('منشأة PF3');
      await page.getByTestId('partner-wizard-next').click();
      await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
      const bizTypes = await page.locator('[data-doc-type]').evaluateAll((els) =>
        els.map((e) => e.getAttribute('data-doc-type')),
      );
      expect(bizTypes).toContain('business_registration');
      expect(bizTypes).not.toContain('payout_proof');
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-documents-business-390.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-documents-1440.png'),
        fullPage: true,
      });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('C–J upload, review, agreement gate, legacy ?step=agreement, reload', async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    const email = ua6aEmail('pf3-review');
    const password = 'Pf3DocsPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF3 Review',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await fillAboutYou(page, 'مراجعة PF3');
      await fillPartnerDetails(page, 'individual');
      await uploadAllDocs(page, 'pf3');

      // Replace first document
      const firstUpload = page.locator('[data-testid^="partner-doc-upload-"]').first();
      await firstUpload.setInputFiles({
        name: 'pf3-replaced.png',
        mimeType: 'image/png',
        buffer: PNG,
      });
      // PF-5: Documents → Review (no Partner payout wizard step).
      await page.getByTestId('partner-wizard-next').click();

      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('partner-review-section-entity')).toBeVisible();
      await expect(page.getByTestId('partner-review-section-contact')).toBeVisible();
      await expect(page.getByTestId('partner-review-section-documents')).toBeVisible();
      await expect(page.getByTestId('partner-review-section-payout')).toHaveCount(0);
      await expect(page.getByTestId('partner-review-section-agreement')).toBeVisible();
      await expect(page.getByTestId('owner-apply-terms')).not.toBeChecked();
      await expect(page.getByTestId('partner-submit')).toBeDisabled();
      await assertNoOverflow(page);
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-review-agreement-unchecked-390.png'),
        fullPage: true,
      });

      await page.getByTestId('owner-apply-terms').check();
      await page.getByTestId('partner-agreement-accept').click();
      await expect(page.getByTestId('partner-agreement-accepted')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('partner-submit')).toBeEnabled({ timeout: 20_000 });
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-review-agreement-checked-390.png'),
        fullPage: true,
      });

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45_000 });
      await expect(page.getByTestId('partner-agreement-accepted')).toBeVisible({ timeout: 45_000 });

      // Legacy ?step=agreement → Review
      await page.goto('/ar/become-owner?step=agreement', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45_000 });
      if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
        await page.getByTestId('partner-continue-application').click();
      }
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-wizard-step-agreement')).toHaveCount(0);

      // Legacy ?step=payout → Review (payout is post-approval /owner/payout)
      await page.goto('/ar/become-owner?step=payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45_000 });
      if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
        await page.getByTestId('partner-continue-application').click();
      }
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-review-1440.png'), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner?step=documents', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45_000 });
      if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
        await page.getByTestId('partner-continue-application').click();
      }
      await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-documents-390.png'), fullPage: true });
      await page.goto('/en/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45_000 });
      if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
        await page.getByTestId('partner-continue-application').click();
      }
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-review-390.png'), fullPage: true });

      // Submit
      await page.goto('/ar/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      if (await page.getByTestId('partner-continue-application').isVisible().catch(() => false)) {
        await page.getByTestId('partner-continue-application').click();
      }
      await expect(page.getByTestId('partner-submit')).toBeEnabled({ timeout: 45_000 });
      await page.getByTestId('partner-submit').click();
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'submitted',
      );
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });
});
