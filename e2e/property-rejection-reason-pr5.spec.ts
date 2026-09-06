import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import { QA_FARM_IMAGES } from './helpers/farm-images.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'property-rejection-reason');
const REASON_A =
  'الصور المرفوعة لا توضح المزرعة بشكل كافٍ ولا يمكن اعتماد الإعلان بهذه الجودة.';

async function shot(page: Page, name: string) {
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}.png`),
    fullPage: true,
  });
}

async function api(cookie: string, method: string, apiPath: string, body?: unknown) {
  const res = await fetch(`${getApiBase()}${apiPath}`, {
    method,
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

function allWeekRules() {
  const periods = [
    { period: 'morning', startTime: '09:00', endTime: '13:00', price: 175 },
  ];
  const rules = [];
  for (let weekday = 0; weekday <= 6; weekday++) {
    for (const p of periods) rules.push({ weekday, enabled: true, ...p });
  }
  return rules;
}

async function createSubmittedProperty(): Promise<string> {
  const owner = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
  const stamp = Date.now();
  const created = await api(owner, 'POST', '/owner/properties', {
    type: 'farm',
    titleAr: `مزرعة PR5 ${stamp}`,
    titleEn: `PR5 Farm ${stamp}`,
    descriptionAr: 'وصف تجريبي لمزرعة اختبار سبب الرفض مع أكثر من عشرين حرفاً.',
    descriptionEn: 'Playwright PR-5 property rejection reason test farm.',
    city: 'amman',
    area: `PR5-${stamp}`,
    approximateAddress: 'عمان — اختبار PR5',
    exactAddress: 'عنوان مخفي PR5',
    basePrice: 175,
    capacity: 10,
    imageUrls: QA_FARM_IMAGES.slice(0, 3),
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) {
    throw new Error(`create failed ${created.status}`);
  }
  const id = created.json.data.id as string;
  await api(owner, 'PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api(owner, 'POST', `/owner/properties/${id}/submit-review`);
  return id;
}

test.describe('PR-5 Property rejection reason', () => {
  test.describe.configure({ retries: 0 });

  test('admin reject with reason → owner sees terminal rejection UX', async ({ page }) => {
    test.setTimeout(300_000);

    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-reject')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('admin-property-reject').click();
    await expect(page.getByTestId('admin-property-reject-reason-dialog')).toBeVisible();
    await shot(page, 'ar-1440-admin-reject-dialog');

    await page.getByTestId('admin-property-reject-reason-confirm').click();
    await expect(page.locator('#admin-property-reject-reason-error')).toBeVisible();

    await page.getByTestId('admin-property-reject-reason-input').fill(REASON_A);
    await page.getByTestId('admin-property-reject-reason-confirm').click();
    await expect(page.getByTestId('admin-property-reject-reason-dialog')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(page.getByTestId('admin-property-rejection-reason')).toContainText(REASON_A);
    await expect(page.getByTestId('admin-property-publish')).toHaveCount(0);
    await expect(page.getByTestId('admin-property-approve')).toHaveCount(0);
    await shot(page, 'ar-1440-admin-rejected');

    const rejected = await api(adminCookie, 'GET', `/admin/properties/${propertyId}`);
    expect(rejected.json.data.status).toBe('rejected');
    expect(rejected.json.data.reviewRejectionReason).toBe(REASON_A);

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-rejected-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-property-rejection-reason')).toHaveText(REASON_A);
    await expect(page.getByTestId('owner-property-edit-cta')).toHaveCount(0);
    await expect(page.getByTestId('owner-property-resubmit-cta')).toHaveCount(0);
    await shot(page, 'ar-390-owner-rejected');

    const submitBlocked = await api(ownerCookie, 'POST', `/owner/properties/${propertyId}/submit-review`);
    expect(submitBlocked.status).toBe(400);

    const editBlocked = await api(ownerCookie, 'PATCH', `/owner/properties/${propertyId}`, {
      descriptionAr: 'محاولة تعديل بعد الرفض يجب أن تفشل.',
    });
    expect(editBlocked.status).toBe(403);

    await page.goto(`/ar/owner/properties/${propertyId}/edit`);
    await expect(page).toHaveURL(new RegExp(`/owner/properties/${propertyId}$`), { timeout: 20_000 });

    await page.goto(`/en/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-rejected-panel')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'en-390-owner-rejected-smoke');
  });

  test('another owner cannot read rejection reason', async () => {
    test.setTimeout(120_000);
    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'rejected',
      reason: REASON_A,
    });

    const customerCookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const forbidden = await api(customerCookie, 'GET', `/owner/properties/${propertyId}`);
    expect([403, 404]).toContain(forbidden.status);
  });

  test('stale reject does not overwrite approved status', async () => {
    test.setTimeout(120_000);
    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

    await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, { status: 'approved' });
    const staleReject = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'rejected',
      reason: REASON_A,
    });
    expect(staleReject.status).toBe(400);
    expect(staleReject.json.code).toBe('INVALID_PROPERTY_STATUS_TRANSITION');

    const detail = await api(adminCookie, 'GET', `/admin/properties/${propertyId}`);
    expect(detail.json.data.status).toBe('approved');
    expect(detail.json.data.reviewRejectionReason).toBeFalsy();
  });
});
