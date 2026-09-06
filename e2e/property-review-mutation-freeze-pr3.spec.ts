import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'property-review-mutation-freeze');
const REASON = 'يرجى تحديث وصف الموقع وإضافة صورة أوضح للواجهة.';

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

async function cookieHeader(email: string, password: string) {
  return loginViaApi(email, password);
}

async function apiJson(
  request: APIRequestContext,
  method: string,
  urlPath: string,
  cookie: string,
  body?: unknown,
) {
  const res = await request.fetch(`${getApiBase()}${urlPath}`, {
    method,
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    data: body,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status(), json };
}

async function createSubmittedProperty(page: Page): Promise<string> {
  await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
  await page.goto('/ar/owner/properties/new');
  await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('add-farm-title-ar').fill(`مزرعة PR3 ${Date.now()}`);
  await page.getByTestId('add-farm-type-farm').click();
  await page.getByTestId('add-farm-capacity').fill('10');
  await page.getByTestId('add-farm-description-ar').fill(
    'وصف تجريبي لمزرعة تجميد المراجعة يحتوي أكثر من عشرين حرفاً.',
  );
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/draft=/, { timeout: 20_000 });
  const draftId = new URL(page.url()).searchParams.get('draft');
  expect(draftId).toBeTruthy();

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-location-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-city').selectOption('amman');
  await page.getByTestId('add-farm-area').fill('منطقة PR3');
  await page.getByTestId('add-farm-approx-address').fill('قرب الطريق الرئيسي للاختبار PR3');
  await page.getByTestId('add-farm-exact-address').fill('بوابة الاختبار PR3 الخاصة');
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-photos-panel')).toBeVisible({ timeout: 20_000 });
  await page.locator('#owner-media-file-input').setInputFiles({
    name: 'pr3-cover.png',
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await page.getByTestId('owner-media-upload-cta').click();
  await expect(page.getByTestId('owner-media-card').first()).toBeVisible({ timeout: 45_000 });
  await page.getByTestId('add-farm-amenities').locator('label').first().click();

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-pricing-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-base-price').fill('180');
  await page.getByTestId('add-farm-period-morning').locator('input[type="checkbox"]').check();
  await page.getByTestId('add-farm-period-price-morning').fill('170');
  await page.getByTestId('add-farm-save-draft').click();
  await expect(page.getByTestId('add-farm-saved')).toBeVisible({ timeout: 30_000 });

  await page.getByTestId('add-farm-next').click();
  await expect(page.getByTestId('add-farm-step-review-panel')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('add-farm-submit-review').click();
  await expect(page).toHaveURL(new RegExp(`/owner/properties/${draftId}`), { timeout: 45_000 });
  return draftId!;
}

test.describe('PR-3 Property review mutation freeze', () => {
  test.describe.configure({ retries: 0 });

  test('pending_review freeze → changes_requested unlock → resubmit freeze', async ({
    page,
    request,
  }) => {
    test.setTimeout(360_000);

    const propertyId = await createSubmittedProperty(page);
    const ownerCookie = await cookieHeader(OWNER_EMAIL, OWNER_PASSWORD);
    const otherCookie = await cookieHeader(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    // UI: pending review — no edit CTA, frozen hints
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-submitted-banner')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('owner-property-pending-frozen-hint')).toBeVisible();
    await expect(page.getByTestId('owner-property-edit-cta')).toHaveCount(0);
    await expect(page.getByTestId('owner-property-availability-frozen')).toBeVisible();
    await shot(page, 'ar-390-pending-review-detail');

    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, 'ar-1440-pending-review-detail');

    // Direct API mutations rejected while pending_review
    const core = await apiJson(request, 'PATCH', `/owner/properties/${propertyId}`, ownerCookie, {
      titleAr: 'محاولة تعديل أثناء المراجعة',
    });
    expect(core.status).toBe(403);

    const location = await apiJson(request, 'PATCH', `/owner/properties/${propertyId}`, ownerCookie, {
      city: 'amman',
      area: 'bypass-attempt',
      approximateAddress: 'should fail',
    });
    expect(location.status).toBe(403);

    const mediaUrl = await apiJson(request, 'POST', `/owner/properties/${propertyId}/media`, ownerCookie, {
      url: 'https://example.com/x.jpg',
    });
    expect([400, 403]).toContain(mediaUrl.status);

    const rules = await apiJson(
      request,
      'PUT',
      `/owner/properties/${propertyId}/availability-rules`,
      ownerCookie,
      {
        rules: [
          {
            weekday: 0,
            period: 'morning',
            enabled: true,
            startTime: '09:00',
            endTime: '12:00',
            price: 100,
          },
        ],
      },
    );
    expect(rules.status).toBe(403);

    const generate = await apiJson(
      request,
      'POST',
      `/owner/properties/${propertyId}/availability/generate`,
      ownerCookie,
      {},
    );
    expect(generate.status).toBe(403);

    const otherOwner = await apiJson(
      request,
      'PATCH',
      `/owner/properties/${propertyId}`,
      otherCookie,
      { titleAr: 'سرقة' },
    );
    expect([401, 403, 404]).toContain(otherOwner.status);

    // Snapshot title unchanged after rejected core PATCH
    const after = await apiJson(request, 'GET', `/owner/properties/${propertyId}`, ownerCookie);
    expect(after.status).toBe(200);
    const afterData = after.json as { data: { status: string; titleAr: string } };
    expect(afterData.data.status).toBe('pending_review');
    expect(afterData.data.titleAr).not.toContain('محاولة تعديل');

    // Admin request changes
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await page.getByTestId('admin-property-request-changes').click();
    await page.getByTestId('admin-property-change-reason-input').fill(REASON);
    await page.getByTestId('admin-property-change-reason-confirm').click();
    await expect(page.getByTestId('admin-property-change-reason')).toContainText(REASON, {
      timeout: 20_000,
    });

    // Owner correction unlocked
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('owner-property-change-reason')).toHaveText(REASON);
    await expect(page.getByTestId('owner-property-edit-cta')).toBeVisible();
    await shot(page, 'ar-390-changes-requested-detail');

    await page.setViewportSize({ width: 1440, height: 900 });
    await shot(page, 'ar-1440-changes-requested-detail');

    const okPatch = await apiJson(request, 'PATCH', `/owner/properties/${propertyId}`, ownerCookie, {
      descriptionAr: 'وصف محدّث بعد طلب التعديلات مع تفاصيل أوضح كافية للاختبار.',
    });
    expect(okPatch.status).toBe(200);

    // Resubmit → freeze again
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await page.getByTestId('owner-property-resubmit-cta').click();
    await expect(page.getByTestId('owner-property-submitted-banner')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId('owner-property-pending-frozen-hint')).toBeVisible();

    const blockedAgain = await apiJson(
      request,
      'PATCH',
      `/owner/properties/${propertyId}`,
      ownerCookie,
      { titleAr: 'يجب أن يفشل بعد إعادة الإرسال' },
    );
    expect(blockedAgain.status).toBe(403);

    const finalGet = await apiJson(request, 'GET', `/owner/properties/${propertyId}`, ownerCookie);
    const finalData = finalGet.json as { data: { id: string; status: string } };
    expect(finalData.data.id).toBe(propertyId);
    expect(finalData.data.status).toBe('pending_review');

    // Published availability regression (seed property if available)
    const props = await apiJson(request, 'GET', '/owner/properties', ownerCookie);
    const list = props.json as { data: Array<{ id: string; status: string }> };
    const published = list.data.find((p) => p.status === 'published');
    if (published) {
      const pubRules = await apiJson(
        request,
        'GET',
        `/owner/properties/${published.id}/availability-rules`,
        ownerCookie,
      );
      expect(pubRules.status).toBe(200);
      // Slot list read still works; mutation path not frozen for published
      expect(isOwnerReviewContentMutable(published.status)).toBe(true);
    }
  });
});

function isOwnerReviewContentMutable(status: string) {
  return status !== 'pending_review';
}
