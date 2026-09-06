import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'property-changes-requested');
const REASON_A =
  'يرجى إضافة صور أوضح للمسبح وتحديث وصف الموقع التقريبي.';
const REASON_B = 'Please clarify the approximate address and refresh the cover photo.';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow, 'page should not horizontally overflow').toBe(false);
}

async function createSubmittedProperty(page: Page): Promise<string> {
  await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
  await page.goto('/ar/owner/properties/new');
  await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });

  const title = `مزرعة PR2 ${Date.now()}`;
  await page.getByTestId('add-farm-title-ar').fill(title);
  await page.getByTestId('add-farm-type-farm').click();
  await page.getByTestId('add-farm-capacity').fill('10');
  await page.getByTestId('add-farm-description-ar').fill(
    'وصف تجريبي لمزرعة مراجعة التعديلات يحتوي أكثر من عشرين حرفاً.',
  );
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });
  const draftId = new URL(page.url()).searchParams.get('draft');
  expect(draftId).toBeTruthy();

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-location-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-city').selectOption('amman');
  await page.getByTestId('add-farm-area').fill('منطقة PR2');
  await page.getByTestId('add-farm-approx-address').fill('قرب الطريق الرئيسي للاختبار PR2');
  await page.getByTestId('add-farm-exact-address').fill('بوابة الاختبار PR2 الخاصة');
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-photos-panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('#owner-media-file-input').setInputFiles({
    name: 'pr2-cover.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await page.getByTestId('owner-media-upload-cta').click();
  await expect(page.getByTestId('owner-media-card').first()).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('add-farm-amenities').locator('label').first().click();

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-pricing-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-base-price').fill('175');
  await page.getByTestId('add-farm-period-morning').locator('input[type="checkbox"]').check();
  await page.getByTestId('add-farm-period-price-morning').fill('160');
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-review-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-submit-review').click();
  await expect(page).toHaveURL(new RegExp(`/owner/properties/${draftId}`), { timeout: 45_000 });
  return draftId!;
}

test.describe('PR-2 Property changes requested', () => {
  test.describe.configure({ retries: 0 });

  test('admin reason → owner correction → resubmit → second reason', async ({ page }) => {
    test.setTimeout(300_000);

    const propertyId = await createSubmittedProperty(page);

    // Admin requests changes with Reason A
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-request-changes')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('admin-property-request-changes').click();
    await expect(page.getByTestId('admin-property-change-reason-dialog')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-1440-admin-request-changes-dialog');

    // Empty confirm should stay in dialog with error
    await page.getByTestId('admin-property-change-reason-confirm').click();
    await expect(page.getByTestId('admin-property-change-reason-dialog')).toBeVisible();
    await expect(page.locator('#admin-property-change-reason-error')).toBeVisible();

    await page.getByTestId('admin-property-change-reason-input').fill(REASON_A);
    await page.getByTestId('admin-property-change-reason-confirm').click();
    await expect(page.getByTestId('admin-property-change-reason-dialog')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByTestId('admin-property-change-reason')).toContainText(REASON_A);

    // Owner sees reason on detail (mobile)
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('owner-property-change-reason')).toHaveText(REASON_A);
    await expect(page.getByTestId('owner-property-edit-cta')).toBeVisible();
    await expect(page.getByTestId('owner-property-resubmit-cta')).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-owner-changes-requested-detail');

    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-1440-owner-changes-requested-detail');

    // Edit correction notice
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByTestId('owner-property-edit-cta').click();
    await expect(page.getByTestId('owner-property-form')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-edit-correction-notice')).toContainText(REASON_A);
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-owner-edit-correction-notice');

    // Safe correction + resubmit from detail
    const desc = page.locator('textarea').first();
    await desc.fill('وصف محدّث بعد ملاحظات المراجعة مع تفاصيل أوضح للموقع والمسبح.');
    await page.getByRole('button', { name: /حفظ مسودة|Save draft/i }).click();
    await page.waitForTimeout(1500);
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('owner-property-resubmit-cta').click();
    await expect(page.getByTestId('owner-property-submitted-banner')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toHaveCount(0);

    const api = getApiBase();
    const cookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const propRes = await fetch(`${api}/owner/properties/${propertyId}`, {
      headers: { Cookie: cookie },
    });
    expect(propRes.ok).toBeTruthy();
    const propBody = (await propRes.json()) as {
      data: { id: string; status: string; reviewChangeReason?: string | null };
    };
    expect(propBody.data.id).toBe(propertyId);
    expect(propBody.data.status).toBe('pending_review');
    expect(propBody.data.reviewChangeReason == null || propBody.data.reviewChangeReason === '').toBe(
      true,
    );

    // Second change request with Reason B
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await page.getByTestId('admin-property-request-changes').click();
    await page.getByTestId('admin-property-change-reason-input').fill(REASON_B);
    await page.getByTestId('admin-property-change-reason-confirm').click();
    await expect(page.getByTestId('admin-property-change-reason')).toContainText(REASON_B, {
      timeout: 20_000,
    });

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-change-reason')).toHaveText(REASON_B);
    await expect(page.getByTestId('owner-property-change-reason')).not.toContainText(REASON_A);

    // EN smoke
    await page.goto(`/en/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await shot(page, 'en-390-owner-changes-requested-detail');

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/en/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-change-reason')).toContainText(REASON_B, {
      timeout: 20_000,
    });
    await page.getByTestId('admin-property-request-changes').click();
    await expect(page.getByTestId('admin-property-change-reason-dialog')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await shot(page, 'en-1440-admin-request-changes-dialog');
    await page.getByRole('button', { name: /Cancel|إلغاء/i }).click();
  });
});
