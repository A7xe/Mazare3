/**
 * PF-2 — Early Partner steps + lazy draft (browser).
 */
import { test, expect } from '@playwright/test';
import { applySessionCookie, applySessionToPage } from './helpers/session.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const OWNER_EMAIL = process.env.E2E_OWNER_EMAIL ?? 'owner1@mazare3.jo';
const OWNER_PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'Mazare3Demo2026!';

test.describe('PF-2 partner funnel early steps', () => {
  test.describe.configure({ retries: 0 });

  test('A–D fresh customer: Start → About You → save → Partner Details + resume', async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const email = ua6aEmail('pf2-early');
    const password = 'Pf2EarlyPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF2 Early',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 45000 });
      await expect(page.getByTestId('partner-start-application')).toBeVisible({ timeout: 30000 });

      await page.getByTestId('partner-start-application').click();
      await expect(page.getByTestId('partner-step-entity-panel')).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('partner-about-you')).toBeVisible();
      await expect(page.getByTestId('partner-location-clarification')).toContainText(
        'مكان إقامتك أو مقر نشاطك',
      );
      await expect(
        page.getByTestId('partner-step-entity-panel').getByRole('heading', { level: 2 }),
      ).toContainText('عنك');
      await expect(page.getByTestId('partner-entity-individual')).toHaveCount(0);

      await page.getByTestId('owner-apply-displayName').fill('شريك تجريبي');
      await page.getByTestId('owner-apply-city').fill('عمان');
      await page.getByTestId('owner-apply-area').fill('عبدون');
      await page.getByTestId('partner-farm-count-one').click();
      await page.getByTestId('partner-wizard-next').click();

      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30000 });
      await expect(page.getByTestId('partner-partner-details')).toBeVisible();
      await expect(page.getByTestId('partner-entity-individual')).toBeVisible();

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('become-owner-loading')).toHaveCount(0, { timeout: 45000 });
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 45000 });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('F–H Partner Details individual hides business name and management location', async ({
    page,
    request,
  }) => {
    test.setTimeout(150_000);
    const email = ua6aEmail('pf2-details');
    const password = 'Pf2EarlyPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF2 Details',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await page.getByTestId('owner-apply-displayName').fill('فرد تجريبي');
      await page.getByTestId('owner-apply-city').fill('جرش');
      await page.getByTestId('owner-apply-area').fill('الوسط');
      await page.getByTestId('partner-wizard-next').click();
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 30000 });

      await page.getByTestId('partner-entity-individual').click();
      await expect(page.getByTestId('owner-apply-businessName')).toHaveCount(0);
      await expect(page.getByTestId('partner-different-operating-location')).toHaveCount(0);
      await expect(page.getByTestId('partner-different-operating-location-toggle')).toHaveCount(0);
      await page.getByTestId('owner-apply-bio').fill('نبذة تعريفية كافية عن الشريك الفرد لاختبار الواجهة هنا.');
      await page.getByTestId('owner-apply-phone').fill('0791234567');
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('G business Partner Details fields visible', async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = ua6aEmail('pf2-biz');
    const password = 'Pf2EarlyPass!2026';
    await createPasswordFixture(request, {
      email,
      password,
      name: 'PF2 Biz',
      attachPasswordIdentity: true,
    });
    try {
      await applySessionCookie(page.context(), email, password);
      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('partner-start-application').click();
      await page.getByTestId('owner-apply-displayName').fill('Biz Partner');
      await page.getByTestId('owner-apply-city').fill('Amman');
      await page.getByTestId('owner-apply-area').fill('Abdoun');
      await page.getByTestId('partner-wizard-next').click();
      await page.getByTestId('partner-entity-business').click();
      await expect(page.getByTestId('owner-apply-businessName')).toBeVisible();
      await expect(page.getByTestId('partner-different-operating-location')).toHaveCount(0);
      await expect(
        page.getByTestId('partner-step-contact-panel').getByRole('heading', { level: 2 }),
      ).toContainText(/Partner details/i);
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('J approved owner stays on tracking success with Add Farm CTA', async ({ page }) => {
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
    // PF-4: approved partners see success tracking first — not an auto-redirect to Add Farm.
    await expect(page).toHaveURL(/become-owner/, { timeout: 45_000 });
    await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
      'data-partner-status',
      /approved|legacy_approved/,
      { timeout: 45_000 },
    );
    await expect(page.getByTestId('partner-go-add-farm')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('add-farm-wizard')).toHaveCount(0);
  });
});
