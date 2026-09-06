import { test, expect } from '@playwright/test';
import path from 'node:path';
import { getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-agreement-review-submit-po5');
const PASSWORD = 'Mazare3Demo2026!';
const SYNTH_IBAN = 'JO93CBJO0010000000000131000311';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);

async function jsonFetch(apiPath: string, init: RequestInit = {}) {
  const res = await fetch(`${getApiBase()}${apiPath}`, init);
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body: body as Record<string, any> };
}

async function clickWizardNext(page: import('@playwright/test').Page) {
  const next = page.getByTestId('partner-wizard-next');
  await expect(next).toBeEnabled({ timeout: 20_000 });
  await next.click();
}

test.describe('PO-5 agreement review submit', () => {
  test('full applicant submit → status panel; role stays customer; Add Farm blocked', async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const email = `e2e-po5-${Date.now()}@test.mazare3.jo`;
    const api = getApiBase();

    await fetch(`${api}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        name: 'E2E PO5',
        locale: 'ar',
      }),
    });

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 30_000 });

    const start = page.getByTestId('partner-start-application');
    if (await start.isVisible().catch(() => false)) await start.click();
    await expect(page.getByTestId('partner-onboarding-shell')).toBeVisible({ timeout: 30_000 });

    // Step 1 — Partner info
    await expect(page.getByTestId('partner-wizard-step-entity')).toBeVisible();
    await page.getByTestId('partner-entity-individual').click();
    await page.getByTestId('owner-apply-displayName').fill('شريك PO5');
    await page.getByTestId('owner-apply-city').fill('عمان');
    await page.getByTestId('owner-apply-area').fill('خلدا');
    await page.getByTestId('owner-apply-bio').fill(
      'نبذة تشغيلية واضحة لطلب شراكة مزارع في مرحلة مراجعة الاتفاقية والإرسال.',
    );
    await clickWizardNext(page);

    // Step 2 — Contact
    await expect(page.getByTestId('partner-wizard-step-contact')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('owner-apply-phone').fill('0791234599');
    await clickWizardNext(page);

    // Step 3 — Documents (combined)
    await expect(page.getByTestId('partner-wizard-step-documents')).toBeVisible({ timeout: 20_000 });
    const uploads = page.locator('[data-testid^="partner-doc-upload-"]');
    await expect(uploads.first()).toBeAttached({ timeout: 20_000 });
    const count = await uploads.count();
    for (let i = 0; i < count; i++) {
      await uploads.nth(i).setInputFiles({
        name: `po5-${i}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      });
    }
    await expect(page.getByTestId('partner-wizard-next')).toBeEnabled({ timeout: 30_000 });
    await clickWizardNext(page);

    // Step 4 — Transfer
    await expect(page.getByTestId('partner-wizard-step-payout')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('partner-payout-beneficiary').fill('PO5 Synthetic Holder');
    await page.getByTestId('partner-payout-bank').fill('PO5 Synthetic Bank');
    await page.getByTestId('partner-payout-iban').fill(SYNTH_IBAN);
    await page.getByTestId('partner-payout-save').click();
    await expect(page.getByTestId('partner-iban-masked')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-iban-masked')).not.toContainText(SYNTH_IBAN);
    await clickWizardNext(page);

    // Step 5 — Agreement
    await expect(page.getByTestId('partner-wizard-step-agreement')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-agreement-content')).toBeVisible();
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-agreement.png'), fullPage: true }).catch(() => undefined);

    // Checkbox alone must not show accepted state
    await page.getByTestId('owner-apply-terms').check();
    await expect(page.getByTestId('partner-agreement-accepted')).toHaveCount(0);
    await page.getByTestId('partner-agreement-accept').click();
    await expect(page.getByTestId('partner-agreement-accepted')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-agreement-accepted')).toContainText(/تم قبول الاتفاقية|accepted/i);
    await expect(page.getByTestId('partner-agreement-accepted')).not.toContainText(/معتمد|Approved partner/i);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-agreement.png'), fullPage: true }).catch(() => undefined);
    await clickWizardNext(page);

    // Step 6 — Review
    await expect(page.getByTestId('partner-wizard-step-review')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-review-checklist')).toBeVisible();
    await expect(page.getByTestId('partner-review-applicant-vs-admin')).toBeVisible();
    await expect(page.getByTestId('partner-review-what-next')).toBeVisible();
    await expect(page.getByTestId('partner-review-iban-masked')).toBeVisible();
    await expect(page.getByTestId('partner-review-iban-masked')).not.toContainText(SYNTH_IBAN);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-review.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-review.png'), fullPage: true }).catch(() => undefined);

    await expect(page.getByTestId('partner-submit')).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId('partner-submit').click();

    // Submitted status panel (not editable wizard)
    await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
      'data-partner-status',
      'submitted',
    );
    await expect(page.getByTestId('partner-wizard-step-review')).toHaveCount(0);
    await expect(page.getByTestId('partner-status-chip')).toContainText(/مُرسل|Submitted/i);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-submitted.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-submitted.png'), fullPage: true }).catch(() => undefined);

    // Role still customer; Add Farm blocked
    const cookie = await loginViaApi(email, PASSWORD);
    const me = await jsonFetch('/auth/me', { headers: { Cookie: cookie } });
    expect(me.body.data?.user?.role).toBe('customer');

    const onboard = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
    expect(onboard.body.data?.verificationStatus).toBe('submitted');

    const props = await jsonFetch('/owner/properties', { headers: { Cookie: cookie } });
    expect([401, 403]).toContain(props.status);

    await page.goto('/ar/owner/properties/new');
    // Guarded: customer / non-approved cannot use Add Farm wizard (URL may stay; shell shows block).
    await expect(
      page.getByTestId('owner-forbidden').or(page.getByTestId('owner-pending')),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('add-farm-wizard')).toHaveCount(0);

    // Double submit rejected
    const resub = await jsonFetch('/owner/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
    expect([400, 409]).toContain(resub.status);

    // EN smoke
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 20_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'en-390-submitted.png'), fullPage: true }).catch(() => undefined);
  });

  test('resubmit E2E skipped unless changes_requested fixture', async () => {
    test.info().annotations.push({
      type: 'note',
      description:
        'Resubmit covered by existing partner-onboarding.spec Admin Flow B; no dedicated changes_requested fixture for PO-5-only run.',
    });
    test.skip(true, 'No safe PO-5-only changes_requested fixture; see partner-onboarding.spec Flow B');
  });
});
