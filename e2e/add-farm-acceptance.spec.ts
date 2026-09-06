import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { OWNER_EMAIL, OWNER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'add-farm-acceptance');

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function openWizard(page: Page, locale: 'ar' | 'en') {
  await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
  await page.goto(`/${locale}/owner/properties/new`);
  await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
}

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth > doc.clientWidth + 2;
  });
  expect(overflow, 'page should not horizontally overflow').toBe(false);
}

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

test.describe('AF-6 Add Farm acceptance', () => {
  test.describe.configure({ retries: 0 });

  test('visual smoke AR/EN viewports + full submit flow', async ({ page }) => {
    test.setTimeout(240_000);

    await page.setViewportSize({ width: 390, height: 844 });
    await openWizard(page, 'ar');
    await expect(page.getByTestId('owner-add-farm-shell-label')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-step1');

    await page.getByTestId('add-farm-title-ar').fill('مزرعة قبول AF6');
    await page.getByTestId('add-farm-type-farm').click();
    await page.getByTestId('add-farm-capacity').fill('12');
    await page.getByTestId('add-farm-description-ar').fill(
      'وصف تجريبي لمزرعة قبول الإضافة يحتوي أكثر من عشرين حرفاً.',
    );
    await page.getByTestId('add-farm-save-draft').click();
    await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(/draft=/);
    const draftUrl = page.url();
    const draftId = new URL(draftUrl).searchParams.get('draft');
    expect(draftId).toBeTruthy();

    await page.getByTestId('add-farm-next').click();
    await expect(page.getByTestId('add-farm-step-location-panel')).toBeVisible({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-step2');

    await page.getByTestId('add-farm-city').selectOption('amman');
    await page.getByTestId('add-farm-area').fill('منطقة الاختبار');
    await page.getByTestId('add-farm-approx-address').fill('قرب الطريق الرئيسي للاختبار');
    await page.getByTestId('add-farm-exact-address').fill('بوابة الاختبار رقم ١٢ الخاصة');
    await expect(page.getByTestId('add-farm-city')).toHaveValue('amman');
    await expect(page.getByTestId('add-farm-area')).toHaveValue('منطقة الاختبار');
    await page.getByTestId('add-farm-save-draft').click();
    await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('add-farm-city')).toHaveValue('amman');
    await page.getByTestId('add-farm-next').click();
    await expect(page.getByTestId('add-farm-step-photos-panel')).toBeVisible({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-step3');

    await page.locator('#owner-media-file-input').setInputFiles({
      name: 'af6-cover.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });
    await page.getByTestId('owner-media-upload-cta').click();
    await expect(page.getByTestId('owner-media-card').first()).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('owner-media-cover-badge').first()).toBeVisible();

    await page.getByTestId('add-farm-amenities').locator('label').first().click();
    await page.getByTestId('add-farm-next').click();
    await expect(page.getByTestId('add-farm-step-pricing-panel')).toBeVisible({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-step4');

    await expect(page.getByTestId('add-farm-base-pricing')).toContainText(/أساسي|Base/i);
    await expect(page.getByTestId('add-farm-deposit-note')).toBeVisible();
    await page.getByTestId('add-farm-base-price').fill('150');
    await page.getByTestId('add-farm-period-morning').locator('input[type="checkbox"]').check();
    await page.getByTestId('add-farm-period-price-morning').fill('140');
    await page.getByTestId('add-farm-save-draft').click();
    await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('add-farm-next').click();
    await expect(page.getByTestId('add-farm-step-review-panel')).toBeVisible({ timeout: 20_000 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-390-step5');

    await expect(page.getByTestId('add-farm-ready-for-review')).toBeVisible();
    await expect(page.getByTestId('add-farm-before-live')).toBeVisible();
    await expect(page.getByTestId('add-farm-review-preview')).toBeVisible();
    await expect(page.getByTestId('add-farm-review-preview')).not.toContainText(/4\.8|Sponsored|Verified/i);

    await page.setViewportSize({ width: 1440, height: 900 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-1440-step5');

    await page.setViewportSize({ width: 1024, height: 768 });
    await assertNoHorizontalOverflow(page);
    await shot(page, 'ar-1024-step5');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/en/owner/properties/new?draft=${draftId}&step=review`);
    await expect(page.getByTestId('add-farm-step-review-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('add-farm-submit-review')).toContainText(/Submit for review/i);
    await assertNoHorizontalOverflow(page);
    await shot(page, 'en-390-step5');

    await page.getByTestId('add-farm-submit-review').click();
    await expect(page).toHaveURL(new RegExp(`/owner/properties/${draftId}`), { timeout: 45_000 });
    await expect(page.getByTestId('owner-property-submitted-banner')).toBeVisible({ timeout: 20_000 });

    const api = getApiBase();
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    const propRes = await page.request.get(`${api}/owner/properties/${draftId}`, {
      headers: { Cookie: cookieHeader },
    });
    expect(propRes.ok()).toBeTruthy();
    const propBody = await propRes.json();
    expect(propBody.data?.status).toBe('pending_review');

    await page.goto('/ar/search');
    await expect(page.locator('body')).not.toContainText('مزرعة قبول AF6');
  });

  test('360 and 430 mobile no overflow on step 1', async ({ page }) => {
    for (const width of [360, 430] as const) {
      await page.setViewportSize({ width, height: 800 });
      await openWizard(page, 'ar');
      await assertNoHorizontalOverflow(page);
      await shot(page, `ar-${width}-step1`);
      await page.goto('/en/owner/properties/new');
      await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
      await assertNoHorizontalOverflow(page);
      await shot(page, `en-${width}-step1`);
    }
  });
});
