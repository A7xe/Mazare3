/**
 * PF-6 — Final Partner funnel acceptance (browser + API).
 * Integrated journey: guest → auth → four steps → submit → correction → approve → payout.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { ADMIN_EMAIL, ADMIN_PASSWORD, getApiBase } from './constants.js';
import { applySessionCookie } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const SHOT_DIR = path.join(process.cwd(), '_pf6_visual');
const PASSWORD = 'Pf6AcceptPass!2026';
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

async function completePartnerWithoutPayout(cookie: string, name: string) {
  const headers = { 'Content-Type': 'application/json', Cookie: cookie };
  // Lazy GET — no draft yet
  for (let i = 0; i < 2; i++) {
    const g = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
    expect(g.status).toBeLessThan(400);
    expect(g.body.data?.started).toBe(false);
    expect(g.body.data?.ownerProfileId == null).toBeTruthy();
  }

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
  const types = (reqs.body.data ?? []).map((r: { documentType: string }) => r.documentType);
  expect(types).not.toContain('payout_proof');

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
  const me = await jsonFetch('/auth/me', { headers: { Cookie: cookie } });
  return {
    ok: submit.status < 400,
    ownerProfileId: (submit.body.data?.ownerProfileId ?? null) as string | null,
    status: submit.body.data?.verificationStatus as string | undefined,
    role: me.body?.data?.user?.role as string | undefined,
    payoutComplete: Boolean(submit.body.data?.payout?.complete),
  };
}

async function adminApproveKycOnly(adminCk: string, ownerProfileId: string) {
  const headers = { 'Content-Type': 'application/json', Cookie: adminCk };
  const detail = await jsonFetch(`/admin/partners/${ownerProfileId}`, {
    headers: { Cookie: adminCk },
  });
  for (const d of detail.body.data?.documents ?? []) {
    if (d.superseded || d.documentType === 'payout_proof') continue;
    await jsonFetch(`/admin/partners/${ownerProfileId}/documents/${d.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'approved' }),
    });
  }
  return jsonFetch(`/admin/partners/${ownerProfileId}/approve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ usePlatformDefaultCommission: true }),
  });
}

test.describe('PF-6 Partner funnel acceptance', () => {
  test.describe.configure({ retries: 0 });

  test.beforeAll(() => {
    mkdirSync(SHOT_DIR, { recursive: true });
  });

  test('A visuals — guest landing AR/EN + four-step Review', async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('partner-acquisition-hero')).toBeVisible({ timeout: 45_000 });
    await expect(page.getByTestId('partner-auth-bridge')).toHaveCount(0);
    await expect(page.getByTestId('partner-start-login')).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-guest-landing-390.png'), fullPage: true });

    await page.getByTestId('partner-start-application').click();
    await expect(page).toHaveURL(/\/ar\/auth/);
    const url = new URL(page.url());
    expect(url.searchParams.get('returnUrl')).toMatch(/become-owner/);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
    await page.screenshot({ path: path.join(SHOT_DIR, 'ar-guest-landing-1440.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('partner-acquisition-hero')).toBeVisible({ timeout: 45_000 });
    await page.screenshot({ path: path.join(SHOT_DIR, 'en-guest-landing-390.png'), fullPage: true });
  });

  test('B–E full journey: submit without payout → correction → approve → payout', async ({
    page,
    request,
  }) => {
    test.setTimeout(420_000);
    const email = ua6aEmail('pf6-full');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF6 Full',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      await applySessionCookie(page.context(), email, PASSWORD);

      const done = await completePartnerWithoutPayout(cookie, 'PF6 Full Partner');
      expect(done.ok).toBeTruthy();
      expect(done.ownerProfileId).toBeTruthy();
      expect(done.status).toBe('submitted');
      expect(done.role).toBe('customer');
      expect(done.payoutComplete).toBeFalsy();

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'submitted',
      );
      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-submitted-390.png'), fullPage: true });

      await page.goto('/en/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-tracking-390.png'), fullPage: true });

      // Changes requested: section + document
      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCk };
      const detail = await jsonFetch(`/admin/partners/${done.ownerProfileId}`, {
        headers: { Cookie: adminCk },
      });
      const firstDoc = (detail.body.data?.documents ?? []).find(
        (d: { documentType: string; superseded?: boolean }) =>
          !d.superseded && d.documentType !== 'payout_proof',
      );
      if (firstDoc?.id) {
        await jsonFetch(`/admin/partners/${done.ownerProfileId}/documents/${firstDoc.id}`, {
          method: 'PATCH',
          headers: adminHeaders,
          body: JSON.stringify({
            status: 'rejected',
            reason: 'PF6 document needs clearer scan for acceptance.',
          }),
        });
      }
      await jsonFetch(`/admin/partners/${done.ownerProfileId}/request-changes`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({
          reason: 'PF6 please update About you display name slightly.',
          fieldKeys: ['about', firstDoc ? `document:${firstDoc.documentType}` : 'documents'],
        }),
      });

      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        'changes_requested',
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-continue-correction')).toBeVisible();
      await expect(page.getByTestId('partner-correction-list')).toBeVisible();
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-changes_requested-390.png'),
        fullPage: true,
      });

      // Fix: re-patch about + re-upload docs + resubmit
      const headers = { 'Content-Type': 'application/json', Cookie: cookie };
      await jsonFetch('/owner/onboarding', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          displayName: 'PF6 Full Partner Fixed',
          city: 'عمان',
          area: 'خلدا',
        }),
      });
      const reqs = await jsonFetch('/owner/onboarding/requirements', {
        headers: { Cookie: cookie },
      });
      for (const r of reqs.body.data ?? []) {
        if (!r.required) continue;
        const form = new FormData();
        form.append(
          'file',
          new Blob([new Uint8Array(PNG)], { type: 'image/png' }),
          `${r.documentType}-fix.png`,
        );
        form.append('requirementId', r.id);
        await fetch(`${getApiBase()}/owner/onboarding/documents`, {
          method: 'POST',
          headers: { Cookie: cookie },
          body: form,
        });
      }
      const resubmit = await jsonFetch('/owner/onboarding/submit', { method: 'POST', headers });
      expect(resubmit.status).toBeLessThan(400);

      const approve = await adminApproveKycOnly(adminCk, done.ownerProfileId!);
      expect(approve.status).toBeLessThan(400);

      const me = await jsonFetch('/auth/me', { headers: { Cookie: cookie } });
      expect(me.body.data?.user?.role).toBe('owner');

      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        /approved|legacy_approved/,
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-go-add-farm')).toBeVisible();
      await expect(page.getByTestId('partner-payout-setup-card')).toBeVisible();
      await expect(page.getByTestId('partner-approval-not-listing')).toBeVisible();
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-approved-no-payout-390.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-approved-1440.png'), fullPage: true });

      // Post-approval payout
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-payout-setup-390.png'), fullPage: true });

      await page.getByTestId('owner-payout-beneficiary').fill('PF6 Test Holder');
      await page.getByTestId('owner-payout-bank').fill('PF6 Test Bank');
      await page.getByTestId('owner-payout-iban').fill(SYNTH_IBAN);
      await page.getByTestId('owner-payout-save').click();
      await expect(page.getByTestId('owner-payout-save-ok')).toBeVisible({ timeout: 30_000 });
      await expect(page.getByTestId('owner-payout-iban-masked')).toContainText('••••');

      const proofInput = page.getByTestId('owner-payout-proof-input');
      if (await proofInput.count()) {
        await proofInput.setInputFiles({
          name: 'payout_proof.png',
          mimeType: 'image/png',
          buffer: PNG,
        });
      }

      const onboard = await jsonFetch('/owner/onboarding', { headers: { Cookie: cookie } });
      expect(onboard.body.data?.verificationStatus).toMatch(/approved|legacy_approved/);

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/owner/payout', { waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-payout-setup-1440.png'), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-payout-setup-390.png'), fullPage: true });

      // Add Farm accessible without payout-ready (pending_review is fine)
      await page.goto('/ar/owner/properties/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('add-farm-wizard').or(page.locator('[data-testid*="add-farm"]')).first()).toBeVisible({
        timeout: 45_000,
      });

      // Legacy aliases
      await page.goto('/ar/become-owner?step=agreement', { waitUntil: 'domcontentloaded' });
      // Approved owners see status, not wizard — still must not crash
      await expect(page.getByTestId('owner-application-status').or(page.getByTestId('partner-step-review-panel'))).toBeVisible({
        timeout: 45_000,
      });
      await page.goto('/ar/become-owner?step=payout', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/owner\/payout/, { timeout: 45_000 });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('F draft wizard four steps + legacy ?step=payout → review', async ({ page, request }) => {
    test.setTimeout(240_000);
    const email = ua6aEmail('pf6-draft');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF6 Draft',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      const headers = { 'Content-Type': 'application/json', Cookie: cookie };
      await jsonFetch('/owner/onboarding', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          displayName: 'PF6 Draft Partner',
          city: 'عمان',
          area: 'خلدا',
          approximateFarmCount: 1,
        }),
      });
      await applySessionCookie(page.context(), email, PASSWORD);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner?step=entity', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-entity-panel')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-step-payout')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-about-390.png'), fullPage: true });

      await page.goto('/ar/become-owner?step=details', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-contact-panel')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-details-390.png'), fullPage: true });

      await page.goto('/ar/become-owner?step=documents', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-documents-390.png'), fullPage: true });

      await page.goto('/ar/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-review-section-agreement')).toBeVisible({
        timeout: 45_000,
      });
      await expect(page.getByTestId('partner-review-section-payout')).toHaveCount(0);
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-review-390.png'), fullPage: true });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-review-1440.png'), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-review-390.png'), fullPage: true });

      await page.goto('/ar/become-owner?step=payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);

      await page.goto('/ar/become-owner?step=agreement', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('G settlement mark-paid guard code path via admin API', async ({ request }) => {
    test.setTimeout(120_000);
    const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
    const mark = await jsonFetch('/admin/settlements/pf6-nonexistent/mark-paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCk },
      body: JSON.stringify({ paymentReference: 'PF6-TEST' }),
    });
    expect(mark.status).toBeGreaterThanOrEqual(400);
    // Must never succeed as paid
    expect(mark.body?.data?.status).not.toBe('paid');
  });
});
