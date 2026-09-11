/**
 * PF-4 — Partner tracking + changes_requested UX (browser).
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { ADMIN_EMAIL, ADMIN_PASSWORD, getApiBase } from './constants.js';
import { applySessionCookie, applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const SHOT_DIR = path.join(process.cwd(), '_pf4_visual');
const PASSWORD = 'Pf4TrackPass!2026';
const SYNTH_IBAN = 'JO93CBJO0010000000000131000311';
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(48, 1),
]);

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

async function completeOnboarding(cookie: string, name: string) {
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  await jsonFetch('/owner/onboarding', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      displayName: name,
      city: 'عمان',
      area: 'خلدا',
      approximateFarmCount: 1,
    }),
  });
  await jsonFetch('/owner/onboarding', {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      entityType: 'individual',
      bio: 'نبذة تشغيلية واضحة لطلب شراكة مزارع تغطي أكثر من عشرين حرفاً للتحقق.',
      phone: `079${String(Date.now()).slice(-7)}`,
      legalName: name,
      operatingPhone: `079${String(Date.now()).slice(-7)}`,
    }),
  });
  const reqs = await jsonFetch('/owner/onboarding/requirements', { headers: { Cookie: cookie } });
  for (const r of reqs.body.data ?? []) {
    if (!r.required) continue;
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
      beneficiaryName: 'PF4 Holder',
      bankName: 'PF4 Bank',
      iban: SYNTH_IBAN,
    }),
  });
  const agr = await jsonFetch('/owner/partner-agreement', { headers: { Cookie: cookie } });
  const agreementId = agr.body.data?.current?.id;
  if (agreementId) {
    await jsonFetch('/owner/partner-agreement/accept', {
      method: 'POST',
      headers,
      body: JSON.stringify({ agreementId, acceptedLocale: 'ar' }),
    });
  }
  const submit = await jsonFetch('/owner/onboarding/submit', { method: 'POST', headers });
  return {
    ok: submit.status < 400,
    ownerProfileId: (submit.body.data?.ownerProfileId ?? null) as string | null,
    status: submit.body.data?.verificationStatus as string | undefined,
  };
}

async function adminUnlockAndApprove(adminCk: string, ownerProfileId: string) {
  const headers = { 'Content-Type': 'application/json', Cookie: adminCk };
  const detail = await jsonFetch(`/admin/partners/${ownerProfileId}`, {
    headers: { Cookie: adminCk },
  });
  for (const d of detail.body.data?.documents ?? []) {
    if (d.superseded) continue;
    await jsonFetch(`/admin/partners/${ownerProfileId}/documents/${d.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' }),
    });
  }
  await jsonFetch(`/admin/partners/${ownerProfileId}/payout-review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ status: 'reviewed' }),
  });
  const approve = await jsonFetch(`/admin/partners/${ownerProfileId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ usePlatformDefaultCommission: true }),
  });
  return approve;
}

test.describe('PF-4 partner tracking', () => {
  test.describe.configure({ retries: 0 });

  test('A–B submitted + under_review tracking', async ({ page, request }) => {
    test.setTimeout(240_000);
    const email = ua6aEmail('pf4-sub');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF4 Sub',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      const done = await completeOnboarding(cookie, 'PF4 Submitted');
      expect(done.ok).toBeTruthy();
      expect(done.ownerProfileId).toBeTruthy();

      await applySessionCookie(page.context(), email, PASSWORD);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'submitted',
      );
      await expect(page.getByTestId('partner-tracking-timeline')).toBeVisible();
      await expect(page.getByTestId('partner-timeline-received')).toHaveAttribute(
        'data-timeline-state',
        'current',
      );
      await expect(page.getByTestId('partner-wizard-step-entity')).toHaveCount(0);
      await expect(page.getByTestId('partner-go-add-farm')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-submitted-390.png'), fullPage: true });

      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const detail = await jsonFetch(`/admin/partners/${done.ownerProfileId}`, {
        headers: { Cookie: adminCk },
      });
      const firstDoc = (detail.body.data?.documents ?? [])[0];
      if (firstDoc?.id) {
        await jsonFetch(`/admin/partners/${done.ownerProfileId}/documents/${firstDoc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: adminCk },
          body: JSON.stringify({ status: 'approved' }),
        });
      }

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'under_review',
      );
      await expect(page.getByTestId('partner-timeline-under_review')).toHaveAttribute(
        'data-timeline-state',
        'current',
      );
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-under_review-390.png'), fullPage: true });

      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-submitted-390.png'), fullPage: true });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('C–F changes_requested multi-action, deep links', async ({ page, request }) => {
    test.setTimeout(300_000);
    const email = ua6aEmail('pf4-chg');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF4 Chg',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      const done = await completeOnboarding(cookie, 'PF4 Changes');
      expect(done.ownerProfileId).toBeTruthy();
      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

      const detail = await jsonFetch(`/admin/partners/${done.ownerProfileId}`, {
        headers: { Cookie: adminCk },
      });
      const identity = (detail.body.data?.documents ?? []).find(
        (d: { documentType: string }) => d.documentType === 'identity',
      );
      if (identity?.id) {
        await jsonFetch(`/admin/partners/${done.ownerProfileId}/documents/${identity.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: adminCk },
          body: JSON.stringify({ status: 'rejected', reason: 'يرجى رفع صورة أوضح للهوية.' }),
        });
      }
      await jsonFetch(`/admin/partners/${done.ownerProfileId}/request-changes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCk },
        body: JSON.stringify({
          reason: 'يرجى مراجعة بيانات التحويل والمستندات المطلوبة.',
          fieldKeys: ['payout_profile', 'agreement'],
        }),
      });

      await applySessionCookie(page.context(), email, PASSWORD);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'changes_requested',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-correction-list')).toBeVisible();
      await expect(page.getByTestId('partner-continue-correction')).toBeVisible();
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-changes_requested-390.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-changes_requested-multi-action-1440.png'),
        fullPage: true,
      });

      const docCta = page.getByTestId('partner-correction-cta-documents');
      if (await docCta.count()) {
        await docCta.first().click();
        await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 30_000 });
        await page.getByTestId('partner-back-to-tracking').click();
      }

      await expect(page.getByTestId('partner-correction-list')).toBeVisible({ timeout: 20_000 });
      const agrCta = page.getByTestId('partner-correction-cta-review');
      if (await agrCta.count()) {
        await agrCta.first().click();
        await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('partner-wizard-step-agreement')).toHaveCount(0);
      }

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({
        path: path.join(SHOT_DIR, 'en-changes_requested-390.png'),
        fullPage: true,
      });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('G–J approved / rejected / suspended + reload', async ({ page, request }) => {
    test.setTimeout(360_000);
    const email = ua6aEmail('pf4-term');
    const emailR = ua6aEmail('pf4-rej');
    const emailS = ua6aEmail('pf4-sus');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF4 Term',
      attachPasswordIdentity: true,
    });
    await createPasswordFixture(request, {
      email: emailR,
      password: PASSWORD,
      name: 'PF4 Rej',
      attachPasswordIdentity: true,
    });
    await createPasswordFixture(request, {
      email: emailS,
      password: PASSWORD,
      name: 'PF4 Sus',
      attachPasswordIdentity: true,
    });
    try {
      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);

      // Approved
      const cookie = await loginViaApi(email, PASSWORD);
      const done = await completeOnboarding(cookie, 'PF4 Approved');
      const approve = await adminUnlockAndApprove(adminCk, done.ownerProfileId!);
      expect(approve.status).toBe(200);
      await applySessionToPage(page, email, PASSWORD);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        /approved|legacy_approved/,
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-go-add-farm')).toBeVisible();
      await expect(page.getByTestId('partner-approval-not-listing')).toBeVisible();
      await expect(page.getByTestId('add-farm-wizard')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-approved-390.png'), fullPage: true });
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-approved-1440.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-go-add-farm')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-approved-390.png'), fullPage: true });

      // Rejected
      const cookieR = await loginViaApi(emailR, PASSWORD);
      const doneR = await completeOnboarding(cookieR, 'PF4 Rejected');
      await jsonFetch(`/admin/partners/${doneR.ownerProfileId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCk },
        body: JSON.stringify({ reason: 'لا يستوفي متطلبات الانضمام الحالية.' }),
      });
      await applySessionCookie(page.context(), emailR, PASSWORD);
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'rejected',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-go-add-farm')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-rejected-390.png'), fullPage: true });
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'rejected',
        { timeout: 45_000 },
      );

      // Suspended
      const cookieS = await loginViaApi(emailS, PASSWORD);
      const doneS = await completeOnboarding(cookieS, 'PF4 Suspended');
      const approveS = await adminUnlockAndApprove(adminCk, doneS.ownerProfileId!);
      expect(approveS.status).toBe(200);
      await jsonFetch(`/admin/partners/${doneS.ownerProfileId}/suspend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCk },
        body: JSON.stringify({ reason: 'إيقاف مؤقت للاختبار المحلي فقط.' }),
      });
      await applySessionCookie(page.context(), emailS, PASSWORD);
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'suspended',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-go-add-farm')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-suspended-390.png'), fullPage: true });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email, emailR, emailS] });
    }
  });
});
