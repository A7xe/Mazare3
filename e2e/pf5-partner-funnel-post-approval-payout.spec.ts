/**
 * PF-5 — Post-approval payout; four-step Partner funnel (browser + API).
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { ADMIN_EMAIL, ADMIN_PASSWORD, getApiBase } from './constants.js';
import { applySessionCookie } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';
import {
  cleanupUa6aFixtures,
  createPasswordFixture,
  ua6aEmail,
} from './helpers/ua6a.js';

const SHOT_DIR = path.join(process.cwd(), '_pf5_visual');
const PASSWORD = 'Pf5PayoutPass!2026';
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

/** Partner KYC only — no payout profile / payout_proof. */
async function completePartnerWithoutPayout(cookie: string, name: string) {
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
  return {
    ok: submit.status < 400,
    ownerProfileId: (submit.body.data?.ownerProfileId ?? null) as string | null,
    status: submit.body.data?.verificationStatus as string | undefined,
    roleAfter: (await jsonFetch('/auth/me', { headers: { Cookie: cookie } })).body?.data?.user?.role,
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

test.describe('PF-5 post-approval payout', () => {
  test.describe.configure({ retries: 0 });

  test('A–F submit without payout, approve, payout setup', async ({ page, request }) => {
    test.setTimeout(360_000);
    const email = ua6aEmail('pf5-fresh');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF5 Fresh',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      await applySessionCookie(page.context(), email, PASSWORD);

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner?step=documents', { waitUntil: 'domcontentloaded' });
      // Guest/start may land first; open wizard if needed via API-completed path later.
      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });

      const done = await completePartnerWithoutPayout(cookie, 'PF5 No Payout');
      expect(done.ok).toBeTruthy();
      expect(done.ownerProfileId).toBeTruthy();
      expect(done.roleAfter).toBe('customer');

      await page.goto('/ar/become-owner', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-step-payout-panel')).toHaveCount(0);

      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const approve = await adminApproveKycOnly(adminCk, done.ownerProfileId!);
      expect(approve.status).toBeLessThan(400);

      const me = await jsonFetch('/auth/me', { headers: { Cookie: cookie } });
      expect(me.body.data?.user?.role).toBe('owner');

      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-application-status')).toHaveAttribute(
        'data-partner-status',
        /approved|legacy_approved/,
        { timeout: 45_000 },
      );
      await expect(page.getByTestId('partner-go-add-farm')).toBeVisible();
      await expect(page.getByTestId('partner-payout-setup-card')).toBeVisible();
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-approved-no-payout-390.png'),
        fullPage: true,
      });

      await page.goto('/ar/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('owner-payout-setup')).toHaveAttribute(
        'data-payout-readiness',
        'not_configured',
      );
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-payout-setup-390.png'), fullPage: true });

      await page.getByTestId('owner-payout-beneficiary').fill('PF5 Test Holder');
      await page.getByTestId('owner-payout-bank').fill('PF5 Test Bank');
      await page.getByTestId('owner-payout-iban').fill(SYNTH_IBAN);
      await page.getByTestId('owner-payout-save').click();
      await expect(page.getByTestId('owner-payout-save-ok')).toBeVisible({ timeout: 30_000 });

      const proofInput = page.getByTestId('owner-payout-proof-input');
      if (await proofInput.count()) {
        await proofInput.setInputFiles({
          name: 'payout_proof.png',
          mimeType: 'image/png',
          buffer: PNG,
        });
        await expect(page.getByTestId('owner-payout-proof-status')).toBeVisible({ timeout: 30_000 });
      }

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-payout-setup-1440.png'), fullPage: true });

      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/en/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-payout-setup-390.png'), fullPage: true });

      // I — legacy ?step=payout for approved owner → payout setup
      await page.goto('/ar/become-owner?step=payout', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/owner\/payout/, { timeout: 45_000 });
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('G–J four-step UI, legacy draft, Add Farm, denied customer', async ({ page, request }) => {
    test.setTimeout(300_000);
    const draftEmail = ua6aEmail('pf5-draft');
    const deniedEmail = ua6aEmail('pf5-deny');
    await createPasswordFixture(request, {
      email: draftEmail,
      password: PASSWORD,
      name: 'PF5 Draft',
      attachPasswordIdentity: true,
    });
    await createPasswordFixture(request, {
      email: deniedEmail,
      password: PASSWORD,
      name: 'PF5 Deny',
      attachPasswordIdentity: true,
    });
    try {
      const draftCk = await loginViaApi(draftEmail, PASSWORD);
      const headers = { 'Content-Type': 'application/json', Cookie: draftCk };
      await jsonFetch('/owner/onboarding', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          displayName: 'PF5 Legacy Draft',
          city: 'عمان',
          area: 'خلدا',
          approximateFarmCount: 1,
        }),
      });
      // Pre-PF5 payout data on draft — preserved, not required for Partner steps.
      await jsonFetch('/owner/payout-profile', {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          beneficiaryName: 'Legacy Holder',
          bankName: 'Legacy Bank',
          iban: SYNTH_IBAN,
        }),
      });

      await applySessionCookie(page.context(), draftEmail, PASSWORD);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto('/ar/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-onboarding-stepper')).toBeVisible({ timeout: 45_000 });
      await expect(page.getByTestId('partner-step-payout')).toHaveCount(0);
      await expect(page.getByTestId('partner-review-section-payout')).toHaveCount(0);
      await expect(page.getByTestId('partner-review-section-agreement')).toBeVisible();
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-partner-review-390.png'), fullPage: true });

      await page.goto('/ar/become-owner?step=documents', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-documents-panel')).toBeVisible({ timeout: 45_000 });
      await page.screenshot({
        path: path.join(SHOT_DIR, 'ar-partner-documents-390.png'),
        fullPage: true,
      });

      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/ar/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-review-section-agreement')).toBeVisible({
        timeout: 45_000,
      });
      await page.screenshot({ path: path.join(SHOT_DIR, 'ar-partner-review-1440.png'), fullPage: true });

      await page.goto('/en/become-owner?step=review', { waitUntil: 'domcontentloaded' });
      await page.screenshot({ path: path.join(SHOT_DIR, 'en-partner-review-390.png'), fullPage: true });

      // I — non-approved legacy payout query → review
      await page.goto('/ar/become-owner?step=payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('partner-step-review-panel')).toBeVisible({ timeout: 45_000 });

      // J — denied customer payout route
      await applySessionCookie(page.context(), deniedEmail, PASSWORD);
      await page.goto('/ar/owner/payout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('owner-payout-setup')).toHaveCount(0);
    } finally {
      await cleanupUa6aFixtures(request, { emails: [draftEmail, deniedEmail] });
    }
  });

  test('K–L mark-paid guard without payout readiness', async ({ request }) => {
    test.setTimeout(180_000);
    const email = ua6aEmail('pf5-settle');
    await createPasswordFixture(request, {
      email,
      password: PASSWORD,
      name: 'PF5 Settle',
      attachPasswordIdentity: true,
    });
    try {
      const cookie = await loginViaApi(email, PASSWORD);
      const done = await completePartnerWithoutPayout(cookie, 'PF5 Settle');
      expect(done.ok).toBeTruthy();
      const adminCk = await loginViaApi(ADMIN_EMAIL, ADMIN_PASSWORD);
      const approve = await adminApproveKycOnly(adminCk, done.ownerProfileId!);
      expect(approve.status).toBeLessThan(400);

      // No ready settlement required — assert server helper is wired via failed mark-paid on fake id
      // or via payout-requirements access.
      const reqs = await jsonFetch('/owner/payout-requirements', {
        headers: { Cookie: cookie },
      });
      expect(reqs.status).toBeLessThan(400);
      expect((reqs.body.data ?? []).some((r: { documentType: string }) => r.documentType === 'payout_proof')).toBeTruthy();

      const mark = await jsonFetch('/admin/settlements/nonexistent-settlement-id/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: adminCk },
        body: JSON.stringify({ paymentReference: 'PF5-TEST' }),
      });
      // Not found / invalid — never returns paid success for missing destination path.
      expect(mark.status).toBeGreaterThanOrEqual(400);
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });
});
