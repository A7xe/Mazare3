import { test, expect } from '@playwright/test';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

const SHOT_DIR = path.join(process.cwd(), 'test-results', 'partner-status-acceptance-po6');
const PASSWORD = 'Mazare3Demo2026!';
const SYNTH_IBAN = 'JO93CBJO0010000000000131000411';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(24, 1),
]);

function assertSafeMutatingEnv() {
  const env = readFileSync(path.join(process.cwd(), '.env'), 'utf8');
  const appEnv = /APP_ENV=(\w+)/.exec(env)?.[1];
  const nodeEnv = /NODE_ENV=(\w+)/.exec(env)?.[1];
  const ok =
    appEnv === 'local' ||
    appEnv === 'development' ||
    nodeEnv === 'development' ||
    process.env.APP_ENV === 'local' ||
    process.env.NODE_ENV === 'development';
  if (!ok) {
    throw new Error(
      `MUTATING_ACCEPTANCE_SKIPPED_FOR_SAFETY (APP_ENV=${appEnv} NODE_ENV=${nodeEnv})`,
    );
  }
}

async function jsonFetch(apiPath: string, init: RequestInit = {}) {
  const res = await fetch(`${getApiBase()}${apiPath}`, init);
  const text = await res.text();
  let body: Record<string, any>;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text };
  }
  return { status: res.status, body };
}

async function completeAndSubmit(cookie: string) {
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  await jsonFetch('/owner/onboarding/profile', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      entityType: 'individual',
      displayName: 'شريك PO6',
      phone: '0791234611',
      city: 'amman',
      area: 'abdoun',
      bio: 'نبذة واضحة لقبول دورة حياة طلب الشراكة في مزارع للاختبار المحلي فقط.',
      legalName: 'شريك PO6',
      operatingPhone: '0791234611',
      operatingCity: 'amman',
      operatingArea: 'abdoun',
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
      beneficiaryName: 'PO6 Synthetic Holder',
      bankName: 'PO6 Synthetic Bank',
      iban: SYNTH_IBAN,
    }),
  });
  const agr = await jsonFetch('/owner/partner-agreement', { headers: { Cookie: cookie } });
  await jsonFetch('/owner/partner-agreement/accept', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agreementId: agr.body.data?.current?.id,
      acceptedLocale: 'ar',
    }),
  });
  return jsonFetch('/owner/onboarding/submit', { method: 'POST', headers });
}

test.describe('PO-6 partner status acceptance', () => {
  test.beforeAll(() => {
    assertSafeMutatingEnv();
  });

  test('full lifecycle: submit → review → changes → resubmit → approve → Add Farm', async ({
    page,
  }) => {
    test.setTimeout(420_000);
    const email = `e2e-po6-${Date.now()}@test.mazare3.jo`;

    await fetch(`${getApiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        name: 'E2E PO6',
        locale: 'ar',
      }),
    });
    let cookie = await loginViaApi(email, PASSWORD);
    const submitted = await completeAndSubmit(cookie);
    expect(submitted.status).toBe(200);
    expect(submitted.body.data?.verificationStatus).toBe('submitted');
    const ownerId = submitted.body.data.ownerProfileId as string;
    const profileIdBefore = ownerId;

    // Role still customer; owner API blocked
    const me1 = await jsonFetch('/auth/me', { headers: { Cookie: cookie } });
    expect(me1.body.data?.user?.role).toBe('customer');
    const propsBlocked = await jsonFetch('/owner/properties', { headers: { Cookie: cookie } });
    expect([401, 403]).toContain(propsBlocked.status);

    // Submitted locked: PATCH rejected
    const locked = await jsonFetch('/owner/onboarding/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ displayName: 'Should Not Save' }),
    });
    expect([400, 409]).toContain(locked.status);

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
      'data-partner-status',
      'submitted',
    );
    await expect(page.getByTestId('partner-onboarding-shell')).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-submitted.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-submitted.png'), fullPage: true }).catch(() => undefined);

    // Deep link before approval → become-owner (UX); API still blocked
    await page.goto('/ar/owner/properties/new');
    await expect(page).toHaveURL(/become-owner/, { timeout: 25_000 });
    await expect(page.getByTestId('add-farm-wizard')).toHaveCount(0);

    // Admin: start under_review via document review, then request changes
    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie };
    const detail0 = await jsonFetch(`/admin/partners/${ownerId}`, {
      headers: { Cookie: adminCookie },
    });
    const firstDoc = (detail0.body.data?.documents ?? [])[0];
    expect(firstDoc?.id).toBeTruthy();
    await jsonFetch(`/admin/partners/${ownerId}/documents/${firstDoc.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'approved' }),
    });

    cookie = await loginViaApi(email, PASSWORD);
    const under = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
    expect(under.body.data?.verificationStatus).toBe('under_review');

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
      'data-partner-status',
      'under_review',
      { timeout: 20_000 },
    );
    await expect(page.getByTestId('partner-onboarding-shell')).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-under-review.png'), fullPage: true }).catch(() => undefined);

    // under_review edit blocked server-side
    const underEdit = await jsonFetch('/owner/onboarding/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ displayName: 'Blocked Under Review' }),
    });
    expect([400, 409]).toContain(underEdit.status);

    const changeReason = 'يرجى استبدال وثيقة الهوية بصورة أوضح للتحقق من الطلب.';
    await jsonFetch(`/admin/partners/${ownerId}/request-changes`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ reason: changeReason }),
    });

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('partner-change-reason')).toContainText('وثيقة', {
      timeout: 25_000,
    });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-changes-requested.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1024, height: 768 });
    if (await page.getByTestId('partner-continue-correction').isVisible().catch(() => false)) {
      await page.getByTestId('partner-continue-correction').click();
    }
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1024-correction.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-changes-requested.png'), fullPage: true }).catch(() => undefined);

    // Preserve data + same application
    cookie = await loginViaApi(email, PASSWORD);
    const afterChanges = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
    expect(afterChanges.body.data?.ownerProfileId).toBe(profileIdBefore);
    expect(afterChanges.body.data?.displayName).toContain('PO6');
    expect(afterChanges.body.data?.payout?.ibanMasked).toContain('••••');
    expect(String(afterChanges.body.data?.payout?.ibanMasked ?? '')).not.toContain(SYNTH_IBAN);
    expect(afterChanges.body.data?.acceptedAgreement).toBeTruthy();
    const html = await page.content();
    expect(html.includes('ibanCipher')).toBeFalsy();
    expect(html.includes('storageKey')).toBeFalsy();

    // Replace a document then resubmit via same endpoint
    const reqs = await jsonFetch('/owner/onboarding/requirements', {
      headers: { Cookie: cookie },
    });
    const identity = (reqs.body.data ?? []).find(
      (r: { documentType: string }) => r.documentType === 'identity',
    );
    if (identity) {
      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(PNG)], { type: 'image/png' }), 'id-replace-po6.png');
      form.append('requirementId', identity.id);
      const up = await fetch(`${getApiBase()}/owner/onboarding/documents`, {
        method: 'POST',
        headers: { Cookie: cookie },
        body: form,
      });
      expect([200, 201]).toContain(up.status);
    }
    const resub = await jsonFetch('/owner/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
    expect(resub.status).toBe(200);
    expect(resub.body.data?.ownerProfileId).toBe(profileIdBefore);
    expect(['submitted', 'under_review']).toContain(resub.body.data?.verificationStatus);

    // Double resubmit safe
    const resub2 = await jsonFetch('/owner/onboarding/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
    });
    expect([400, 409]).toContain(resub2.status);

    // Admin complete gates + approve
    const detail = await jsonFetch(`/admin/partners/${ownerId}`, {
      headers: { Cookie: adminCookie },
    });
    for (const d of detail.body.data?.documents ?? []) {
      if (d.superseded) continue;
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
    const approve = await jsonFetch(`/admin/partners/${ownerId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ usePlatformDefaultCommission: true }),
    });
    expect(approve.status).toBe(200);
    expect(approve.body.data?.verificationStatus).toBe('approved');

    // Double approve according to domain
    const approve2 = await jsonFetch(`/admin/partners/${ownerId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ usePlatformDefaultCommission: true }),
    });
    expect([400, 409]).toContain(approve2.status);

    // Session refresh → owner
    const refresh = await jsonFetch('/auth/refresh-session', {
      method: 'POST',
      headers: { Cookie: await loginViaApi(email, PASSWORD) },
    });
    expect(refresh.body.data?.user?.role).toBe('owner');
    expect(refresh.body.data?.user?.ownerProfileStatus).toBe('approved');

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    // Either redirect to Add Farm or show approved CTA briefly
    await expect
      .poll(async () => page.url(), { timeout: 30_000 })
      .toMatch(/owner\/properties\/new|become-owner/);
    if (/become-owner/.test(page.url())) {
      const go = page.getByTestId('partner-go-add-farm');
      if (await go.isVisible().catch(() => false)) {
        await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-approved.png'), fullPage: true }).catch(() => undefined);
        await go.click();
      } else {
        await page.goto('/ar/owner/properties/new');
      }
    }
    await expect(page.getByTestId('add-farm-wizard')).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-add-farm.png'), fullPage: true }).catch(() => undefined);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-1440-add-farm.png'), fullPage: true }).catch(() => undefined);

    // No auto Property
    const props = await jsonFetch('/owner/properties', {
      headers: { Cookie: await loginViaApi(email, PASSWORD) },
    });
    expect(props.status).toBe(200);
    const list = props.body.data ?? props.body ?? [];
    const arr = Array.isArray(list) ? list : list.items ?? list.properties ?? [];
    expect(Array.isArray(arr) ? arr.length : 0).toBe(0);

    // EN smoke
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner');
    await expect(page).toHaveURL(/owner\/properties\/new|become-owner/, { timeout: 20_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'en-390-approved-or-redirect.png'), fullPage: true }).catch(() => undefined);
  });

  test('reject path: applicant stays non-owner; Add Farm blocked', async ({ page }) => {
    test.setTimeout(240_000);
    assertSafeMutatingEnv();
    const email = `e2e-po6-reject-${Date.now()}@test.mazare3.jo`;
    await fetch(`${getApiBase()}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: PASSWORD,
        name: 'E2E PO6 Reject',
        locale: 'ar',
      }),
    });
    const cookie = await loginViaApi(email, PASSWORD);
    const submitted = await completeAndSubmit(cookie);
    expect(submitted.status).toBe(200);
    const ownerId = submitted.body.data.ownerProfileId as string;

    const adminCookie = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const reject = await jsonFetch(`/admin/partners/${ownerId}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ reason: 'طلب تجريبي مرفوض لأغراض قبول دورة الحياة فقط.' }),
    });
    expect(reject.status).toBe(200);

    const me = await jsonFetch('/auth/me', {
      headers: { Cookie: await loginViaApi(email, PASSWORD) },
    });
    expect(me.body.data?.user?.role).toBe('customer');

    await applySessionToPage(page, email, PASSWORD);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner');
    await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
      'data-partner-status',
      'rejected',
      { timeout: 20_000 },
    );
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-390-rejected.png'), fullPage: true }).catch(() => undefined);

    await page.goto('/ar/owner/properties/new');
    await expect(page).toHaveURL(/become-owner/, { timeout: 20_000 });
    await expect(page.getByTestId('add-farm-wizard')).toHaveCount(0);

    const props = await jsonFetch('/owner/properties', {
      headers: { Cookie: await loginViaApi(email, PASSWORD) },
    });
    expect([401, 403]).toContain(props.status);
  });
});
