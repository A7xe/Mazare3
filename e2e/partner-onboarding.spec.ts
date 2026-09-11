import { test, expect } from '@playwright/test';
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

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);

const PASSWORD = 'Mazare3Demo2026!';

async function jsonFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${getApiBase()}${path}`, init);
  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body, headers: res.headers };
}

async function waitWizardStep(page: import('@playwright/test').Page, step: string) {
  await expect(page.getByTestId(`partner-wizard-step-${step}`)).toBeVisible({ timeout: 20_000 });
}

async function clickWizardNext(page: import('@playwright/test').Page) {
  const next = page.getByTestId('partner-wizard-next');
  await expect(next).toBeEnabled({ timeout: 20_000 });
  await next.click();
}

test.describe('Partner onboarding E2E', () => {
  test('Flow A — Arabic mobile partner onboarding wizard', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    const email = `e2e-partner-${Date.now()}@test.mazare3.jo`;
    const api = getApiBase();
    await fetch(`${api}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        name: 'E2E Partner',
        locale: 'ar',
      }),
    });
    await applySessionToPage(page, email, PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('become-owner-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await waitWizardStep(page, 'entity');
    await page.getByTestId('owner-apply-displayName').fill('شريك تجريبي');
    await page.getByTestId('owner-apply-city').fill('عمان');
    await page.getByTestId('owner-apply-area').fill('دابوق');
    await clickWizardNext(page);

    await waitWizardStep(page, 'contact');
    await page.getByTestId('partner-entity-individual').click();
    await page.getByTestId('owner-apply-phone').fill('0791234500');
    await page.getByTestId('owner-apply-bio').fill(
      'نبذة واضحة عن تشغيل المزرعة العائلية وإدارة الحجوزات عبر المنصة بشكل مهني.',
    );
    await clickWizardNext(page);

    await waitWizardStep(page, 'documents');
    const uploads = page.locator('[data-testid^="partner-doc-upload-"]');
    await expect(uploads.first()).toBeAttached({ timeout: 20_000 });
    const count = await uploads.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      await uploads.nth(i).setInputFiles({
        name: `qa-${i}.png`,
        mimeType: 'image/png',
        buffer: PNG,
      });
    }
    await expect(page.getByTestId('partner-wizard-next')).toBeEnabled({ timeout: 25_000 });
    await clickWizardNext(page);

    await waitWizardStep(page, 'payout');
    await page.getByTestId('partner-payout-beneficiary').fill('شريك تجريبي');
    await page.getByTestId('partner-payout-bank').fill('البنك العربي');
    await page.getByTestId('partner-payout-iban').fill('JO94CBJO0010000000000131000302');
    await page.getByTestId('partner-payout-save').click();
    await expect(page.getByTestId('partner-iban-masked')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('partner-iban-masked')).toContainText('••••');
    await expect(page.getByTestId('partner-iban-masked')).not.toContainText(
      'JO94CBJO0010000000000131000302',
    );
    await clickWizardNext(page);

    await waitWizardStep(page, 'review');
    await expect(page.getByTestId('partner-wizard-step-agreement')).toHaveCount(0);
    await expect(page.getByTestId('partner-review-section-agreement')).toBeVisible();
    await page.getByTestId('owner-apply-terms').check();
    await page.getByTestId('partner-agreement-accept').click();
    await expect(page.getByTestId('partner-agreement-accepted')).toBeVisible({ timeout: 20_000 });

    await expect(page.getByTestId('partner-submit')).toBeEnabled({ timeout: 20_000 });
    await page.getByTestId('partner-submit').click();
    await expect(page.getByTestId('partner-status-chip')).not.toHaveText('مسودة', { timeout: 20_000 });
    const chip = await page.getByTestId('partner-status-chip').innerText();
    expect(/مُرسل|قيد المراجعة|submitted|under_review/i.test(chip)).toBeTruthy();

    const html = await page.content();
    expect(html.includes('/uploads/partner-documents')).toBeFalsy();
    expect(html.includes('storageKey')).toBeFalsy();
    expect(html.includes('ibanCipher')).toBeFalsy();
  });
});

test.describe('Admin partner review', () => {
  test('Flow B — change request, replace, approve, refresh session', async ({ page }) => {
    test.setTimeout(180_000);
    const email = `e2e-admin-flow-${Date.now()}@test.mazare3.jo`;
    const cookie = await (async () => {
      await fetch(`${getApiBase()}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: PASSWORD, name: 'E2E Admin Flow', locale: 'ar' }),
      });
      return loginViaApi(email, PASSWORD);
    })();
    const headers = { 'Content-Type': 'application/json', Cookie: cookie };
    await jsonFetch('/owner/onboarding/profile', {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        entityType: 'individual',
        displayName: 'شريك تجريبي',
        phone: '0791234500',
        city: 'amman',
        area: 'dabouq',
        bio: 'نبذة واضحة عن تشغيل المزرعة العائلية وإدارة الحجوزات عبر المنصة بشكل مهني.',
        legalName: 'شريك تجريبي',
        operatingPhone: '0791234500',
        operatingCity: 'amman',
        operatingArea: 'dabouq',
      }),
    });
    const reqs = await jsonFetch('/owner/onboarding/requirements', { headers: { Cookie: cookie } });
    for (const r of (reqs.body.data ?? []).filter((x: { required: boolean }) => x.required)) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), `${r.documentType}.png`);
      form.append('requirementId', r.id);
      await fetch(`${getApiBase()}/owner/onboarding/documents`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form,
      });
    }
    await jsonFetch('/owner/payout-profile', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        beneficiaryName: 'E2E Partner',
        bankName: 'Arab Bank',
        iban: 'JO94CBJO0010000000000131000302',
      }),
    });
    const agr = await jsonFetch('/owner/partner-agreement', { headers: { Cookie: cookie } });
    await jsonFetch('/owner/partner-agreement/accept', {
      method: 'POST',
      headers,
      body: JSON.stringify({ agreementId: agr.body.data?.current?.id, acceptedLocale: 'ar' }),
    });
    const submitted = await jsonFetch('/owner/onboarding/submit', { method: 'POST', headers });
    expect(submitted.status).toBe(200);
    const ownerId = submitted.body.data.ownerProfileId as string;
    const rejectDoc = (submitted.body.data.documents ?? []).find(
      (d: { documentType: string }) => d.documentType === 'identity',
    );
    const rejectReason = 'يرجى استبدال وثيقة الهوية بصورة أوضح للتحقق';

    await applySessionToPage(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    await page.goto(`/ar/admin/owners/${ownerId}`);
    await expect(page.getByTestId('admin-partner-detail')).toBeVisible({ timeout: 30_000 });
    if (rejectDoc) {
      await page.getByTestId(`admin-doc-reason-${rejectDoc.id}`).fill(rejectReason);
      await page.getByTestId(`admin-reject-doc-${rejectDoc.id}`).click();
    }

    await applySessionToPage(page, email, PASSWORD);
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('partner-change-reason')).toContainText('وثيقة', { timeout: 20_000 });
    const identUpload = page.locator('[data-testid^="partner-doc-upload-"]').first();
    if ((await identUpload.count()) === 0) {
      for (let i = 0; i < 6; i++) {
        const next = page.getByTestId('partner-wizard-next');
        if (await next.isEnabled()) await next.click();
        if ((await page.locator('[data-testid^="partner-doc-upload-"]').count()) > 0) break;
        await page.waitForTimeout(400);
      }
    }
    if ((await page.locator('[data-testid^="partner-doc-upload-"]').count()) > 0) {
      await page.locator('[data-testid^="partner-doc-upload-"]').first().setInputFiles({
        name: 'id-replace.png',
        mimeType: 'image/png',
        buffer: PNG,
      });
      await page.waitForTimeout(800);
    } else {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'id-replace.png');
      form.append('requirementId', 'req_identity_all');
      await fetch(`${getApiBase()}/owner/onboarding/documents`, {
        method: 'POST',
        headers: { Cookie: await loginViaApi(email, PASSWORD) },
        body: form,
      });
    }
    const ownerCookie = await loginViaApi(email, PASSWORD);
    const resub = await jsonFetch('/owner/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: ownerCookie },
    });
    expect(resub.status).toBe(200);
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('partner-status-chip')).toBeVisible({ timeout: 20_000 });

    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie };
    const detail = await jsonFetch(`/admin/partners/${ownerId}`, { headers: { Cookie: adminCookie } });
    for (const d of detail.body.data?.documents ?? []) {
      await jsonFetch(`/admin/partners/${ownerId}/documents/${d.id}`, {
        method: 'PATCH',
        headers: adminHeaders,
        body: JSON.stringify({ status: 'approved' }),
      });
    }
    await jsonFetch(`/admin/partners/${ownerId}/payout-review`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'reviewed' }),
    });
    await jsonFetch(`/admin/partners/${ownerId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ usePlatformDefaultCommission: true }),
    });

    await applySessionToPage(page, email, PASSWORD);
    await page.goto('/ar/become-owner');
    await page.evaluate(async () => {
      await fetch('/api/v1/auth/refresh-session', { method: 'POST', credentials: 'include' }).catch(() => undefined);
    });
    const refresh = await jsonFetch('/auth/refresh-session', {
      method: 'POST',
      headers: { Cookie: await loginViaApi(email, PASSWORD) },
    });
    expect(refresh.body.data?.user?.role).toBe('owner');
  });
});

test.describe('Private document security', () => {
  test('Flow C — unauthenticated, other owner, admin audit, no key leakage', async ({ request }) => {
    const api = getApiBase();
    const unauth = await request.get(`${api}/owner/onboarding/documents/not-a-real-id/file`);
    expect(unauth.status()).toBe(401);

    const email = `e2e-sec-${Date.now()}@test.mazare3.jo`;
    await fetch(`${api}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD, name: 'Sec', locale: 'ar' }),
    });
    const cookie = await loginViaApi(email, PASSWORD);
    await jsonFetch('/owner/onboarding/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({
        entityType: 'individual',
        displayName: 'شريك أمني',
        phone: '0791234599',
        city: 'amman',
        area: 'dabouq',
        bio: 'نبذة واضحة عن تشغيل المزرعة العائلية وإدارة الحجوزات عبر المنصة بشكل مهني.',
        legalName: 'شريك أمني',
        operatingPhone: '0791234599',
        operatingCity: 'amman',
        operatingArea: 'dabouq',
      }),
    });
    const reqs = await jsonFetch('/owner/onboarding/requirements', { headers: { Cookie: cookie } });
    const firstReq = (reqs.body.data ?? []).find((x: { required: boolean }) => x.required);
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'id.png');
    form.append('requirementId', firstReq.id);
    await fetch(`${api}/owner/onboarding/documents`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    });
    const onboarding = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
    const dumped = JSON.stringify(onboarding.body);
    expect(dumped.includes('storageKey')).toBeFalsy();
    expect(dumped.includes('JO94')).toBeFalsy();
    const docId = onboarding.body.data?.documents?.[0]?.id as string;
    const ownerId = onboarding.body.data?.ownerProfileId as string;

    const otherCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);
    const other = await fetch(`${api}/owner/onboarding/documents/${docId}/file`, {
      headers: { Cookie: otherCookie },
    });
    expect([403, 404]).toContain(other.status);

    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminFile = await fetch(`${api}/admin/partners/${ownerId}/documents/${docId}/file`, {
      headers: { Cookie: adminCookie },
    });
    expect(adminFile.status).toBe(200);
    const audits = await jsonFetch('/admin/audit-logs?limit=30', { headers: { Cookie: adminCookie } });
    expect(JSON.stringify(audits.body)).toContain('admin.partner_document_viewed');

    const customerCookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const customer = await fetch(`${api}/owner/onboarding/documents/${docId}/file`, {
      headers: { Cookie: customerCookie },
    });
    expect([401, 403, 404]).toContain(customer.status);
  });
});
