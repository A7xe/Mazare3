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
import { QA_FARM_IMAGES } from './helpers/farm-images.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'property-status-fsm');
const CHANGE_REASON =
  'يرجى تحديث وصف المزرعة وتوضيح العنوان التقريبي قبل إعادة النشر.';

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
    { period: 'evening', startTime: '16:00', endTime: '22:00', price: 240 },
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
    titleAr: `مزرعة PR4 ${stamp}`,
    titleEn: `PR4 Farm ${stamp}`,
    descriptionAr: 'وصف تجريبي لمزرعة مراجعة FSM يحتوي أكثر من عشرين حرفاً للاختبار.',
    descriptionEn: 'Playwright PR-4 property status FSM lifecycle test farm.',
    city: 'amman',
    area: `PR4-${stamp}`,
    approximateAddress: 'عمان — اختبار FSM',
    exactAddress: 'عنوان مخفي PR4',
    basePrice: 175,
    capacity: 10,
    imageUrls: QA_FARM_IMAGES.slice(0, 3),
    amenityKeys: ['pool'],
    rules: [{ titleAr: 'اختبار', titleEn: 'Test' }],
  });
  if (created.status !== 201) {
    throw new Error(`create failed ${created.status} ${JSON.stringify(created.json)}`);
  }
  const id = created.json.data.id as string;
  await api(owner, 'PUT', `/owner/properties/${id}/availability-rules`, { rules: allWeekRules() });
  await api(owner, 'POST', `/owner/properties/${id}/availability/generate`, {});
  const submitted = await api(owner, 'POST', `/owner/properties/${id}/submit-review`);
  if (submitted.status !== 200) {
    throw new Error(`submit failed ${submitted.status} ${JSON.stringify(submitted.json)}`);
  }
  return id;
}

test.describe('PR-4 Property status FSM', () => {
  test.describe.configure({ retries: 0 });

  test('review approval distinct from publication lifecycle', async ({ page }) => {
    test.setTimeout(360_000);

    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);

    // Admin pending_review UI — no Publish
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-approve')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('admin-property-request-changes')).toBeVisible();
    await expect(page.getByTestId('admin-property-reject')).toBeVisible();
    await expect(page.getByTestId('admin-property-publish')).toHaveCount(0);
    await shot(page, 'ar-390-admin-pending-review');

    // Direct API bypass rejected
    const invalidPublish = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    expect(invalidPublish.status).toBe(400);
    expect(invalidPublish.json.code).toBe('INVALID_PROPERTY_STATUS_TRANSITION');

    const stillPending = await api(adminCookie, 'GET', `/admin/properties/${propertyId}`);
    expect(stillPending.json.data.status).toBe('pending_review');

    // Approve
    const approved = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'approved',
    });
    expect(approved.status).toBe(200);
    expect(approved.json.data.status).toBe('approved');

    // Approved — still private
    const ownerProp = await api(ownerCookie, 'GET', `/owner/properties/${propertyId}`);
    expect(ownerProp.json.data.status).toBe('approved');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-approved-hint')).toBeVisible();
    await expect(page.getByTestId('admin-property-publish')).toBeVisible();
    await shot(page, 'ar-1440-admin-approved');

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-approved-hint')).toBeVisible();
    await shot(page, 'ar-390-owner-approved');

    // Publish
    const published = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    expect(published.status).toBe(200);
    expect(published.json.data.status).toBe('published');

    await page.setViewportSize({ width: 1440, height: 900 });
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-unpublish')).toBeVisible();
    await expect(page.getByTestId('admin-property-suspend')).toBeVisible();
    await expect(page.getByTestId('admin-property-approve')).toHaveCount(0);
    await shot(page, 'ar-1440-admin-published');

    // Unpublish → republish
    const unpublished = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'unpublished',
    });
    expect(unpublished.status).toBe(200);
    expect(unpublished.json.data.status).toBe('unpublished');

    const republished = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    expect(republished.status).toBe(200);

    // Request changes from published
    const changes = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'changes_requested',
      reason: CHANGE_REASON,
    });
    expect(changes.status).toBe(200);
    expect(changes.json.data.status).toBe('changes_requested');

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto(`/ar/owner/properties/${propertyId}`);
    await expect(page.getByTestId('owner-property-changes-requested-panel')).toBeVisible({
      timeout: 20_000,
    });
    await page.getByTestId('owner-property-resubmit-cta').click();
    await expect(page.getByTestId('owner-property-submitted-banner')).toBeVisible({
      timeout: 30_000,
    });

    // EN smoke
    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/en/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-approve')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'en-admin-pending-review-after-resubmit');
  });

  test('reject is terminal', async ({ page }) => {
    test.setTimeout(180_000);
    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

    const rejected = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'rejected',
      reason: 'الصور المرفوعة لا توضح المزرعة بشكل كافٍ ولا يمكن اعتماد الإعلان بهذه الجودة.',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.json.data.status).toBe('rejected');

    const reopen = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'approved',
    });
    expect(reopen.status).toBe(400);
    expect(reopen.json.code).toBe('INVALID_PROPERTY_STATUS_TRANSITION');

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-publish')).toHaveCount(0);
    await expect(page.getByTestId('admin-property-approve')).toHaveCount(0);
    await expect(page.getByTestId('admin-property-reject')).toHaveCount(0);
  });

  test('suspend restores as unpublished only', async ({ page }) => {
    test.setTimeout(240_000);
    const propertyId = await createSubmittedProperty();
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

    const approved = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'approved',
    });
    expect(approved.status).toBe(200);

    const published = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    expect(published.status).toBe(200);
    expect(published.json.data.status).toBe('published');

    const suspended = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'suspended',
    });
    expect(suspended.status).toBe(200);
    expect(suspended.json.data.status).toBe('suspended');

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/properties/${propertyId}`);
    await expect(page.getByTestId('admin-property-restore-unpublished')).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('admin-property-publish')).toHaveCount(0);

    const directPublish = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'published',
    });
    expect(directPublish.status).toBe(400);

    const restore = await api(adminCookie, 'PATCH', `/admin/properties/${propertyId}/status`, {
      status: 'unpublished',
    });
    expect(restore.status).toBe(200);
    expect(restore.json.data.status).toBe('unpublished');
  });
});
