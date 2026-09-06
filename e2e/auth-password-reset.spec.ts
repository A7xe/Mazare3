import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';

function uniqueEmail() {
  return `auth3.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signupViaApi(email: string, password: string, locale = 'ar') {
  const res = await fetch(`${getApiBase()}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Auth3 User', locale }),
  });
  if (!res.ok) throw new Error(`signup failed ${res.status}`);
  return res;
}

async function clearEmailOutbox() {
  await fetch(`${getApiBase()}/internal/email-outbox/clear`, { method: 'POST' });
}

async function readLastEmail() {
  const res = await fetch(`${getApiBase()}/internal/email-outbox`);
  if (!res.ok) throw new Error(`email-outbox ${res.status}`);
  const body = (await res.json()) as {
    data?: {
      last?: { to?: string; subject?: string; text?: string; html?: string } | null;
    };
  };
  return body.data?.last ?? null;
}

function extractResetUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+\/(?:ar|en)\/reset-password\?token=[^\s]+/);
  return match?.[0] ?? null;
}

test.describe('AUTH-2/3 password reset', () => {
  test.describe.configure({ retries: 0 });

  test('Scenario A — memory mailer capture → reset → login', async ({ page }) => {
    const email = uniqueEmail();
    const oldPassword = 'OldPassAuth3!';
    const newPassword = 'NewPassAuth3!';
    await signupViaApi(email, oldPassword, 'ar');
    await clearEmailOutbox();

    await page.goto('/ar/login');
    await expect(page.getByTestId('auth-forgot-password')).toBeVisible();
    await page.getByTestId('auth-forgot-password').click();
    await expect(page).toHaveURL(/forgot-password/);

    await page.getByTestId('auth-email').fill(email);
    const forgotResPromise = page.waitForResponse((r) => r.url().includes('/auth/forgot-password'));
    await page.getByTestId('auth-submit').click();
    const forgotRes = await forgotResPromise;
    const forgotBody = (await forgotRes.json()) as {
      data?: { message?: string; devResetLink?: string };
    };
    await expect(page.getByTestId('forgot-password-confirmation')).toBeVisible();
    expect(forgotBody.data?.message).toBeTruthy();
    // Public body must not be the only place we rely on — prefer captured mail
    expect(JSON.stringify(forgotBody)).not.toMatch(/RESEND_API_KEY|Bearer /i);

    const captured = await readLastEmail();
    expect(captured?.to).toBe(email);
    expect(captured?.subject).toMatch(/إعادة تعيين|Reset/i);
    expect(captured?.text).toBeTruthy();
    const link = extractResetUrl(captured!.text!);
    expect(link).toBeTruthy();
    expect(link).toContain('/ar/reset-password?token=');
    expect(link!.startsWith('http://localhost:3010/') || link!.includes('/ar/reset-password')).toBeTruthy();

    const token = new URL(link!).searchParams.get('token');
    expect(token).toBeTruthy();
    // Token should not appear outside the mail payload / reset URL flow
    expect(JSON.stringify(forgotBody.data ?? {})).not.toContain(token!);

    await page.goto(`/ar/reset-password?token=${encodeURIComponent(token!)}`);
    await page.getByTestId('auth-password').fill(newPassword);
    await page.getByTestId('auth-password-confirm').fill(newPassword);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('reset-success')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar/login');
    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill(oldPassword);
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toBeVisible({ timeout: 15_000 });

    await page.getByTestId('auth-password').fill(newPassword);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });

  test('Scenario B — unknown email same confirmation', async ({ page }) => {
    await clearEmailOutbox();
    await page.goto('/ar/forgot-password');
    await page.getByTestId('auth-email').fill('nobody-auth3@example.com');
    const resPromise = page.waitForResponse((r) => r.url().includes('/auth/forgot-password'));
    await page.getByTestId('auth-submit').click();
    const res = await resPromise;
    const body = (await res.json()) as { data?: { message?: string; devResetLink?: string } };
    await expect(page.getByTestId('forgot-password-confirmation')).toBeVisible();
    expect(body.data?.devResetLink).toBeFalsy();
    const captured = await readLastEmail();
    expect(captured).toBeNull();
  });

  test('Scenario C — invalid token UX', async ({ page }) => {
    await page.goto('/ar/reset-password?token=not-a-valid-reset-token-value');
    await page.getByTestId('auth-password').fill('ValidPass12');
    await page.getByTestId('auth-password-confirm').fill('ValidPass12');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('reset-invalid')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/طلب رابط جديد|Request a new link/)).toBeVisible();
  });

  test('Scenario D — token single use', async ({ page }) => {
    const email = uniqueEmail();
    const password = 'SingleUseAuth3!';
    await signupViaApi(email, password);
    await clearEmailOutbox();

    const forgot = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.ok).toBeTruthy();
    const captured = await readLastEmail();
    const token = new URL(extractResetUrl(captured!.text!)!).searchParams.get('token')!;

    const first = await fetch(`${getApiBase()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'SingleUseAuth3b!' }),
    });
    expect(first.ok).toBeTruthy();

    const second = await fetch(`${getApiBase()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'SingleUseAuth3c!' }),
    });
    expect(second.status).toBe(400);
    const secondBody = (await second.json()) as { code?: string };
    expect(secondBody.code).toBe('INVALID_RESET_TOKEN');

    await page.goto('/ar/login');
  });

  test('Scenario E — old session invalidated after reset', async ({ browser }) => {
    const email = uniqueEmail();
    const password = 'SessionRevoke1!';
    await signupViaApi(email, password);
    await clearEmailOutbox();

    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await applySessionToPage(pageA, email, password);
    await pageA.goto('/ar/account');
    await expect(pageA.getByTestId('account-home').or(pageA.getByTestId('authenticated-top-header'))).toBeVisible({
      timeout: 20_000,
    });

    const forgot = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.ok).toBeTruthy();
    const captured = await readLastEmail();
    const token = new URL(extractResetUrl(captured!.text!)!).searchParams.get('token')!;
    const reset = await fetch(`${getApiBase()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: 'SessionRevoke2!' }),
    });
    expect(reset.ok).toBeTruthy();

    await pageA.goto('/ar/account');
    await expect(pageA).toHaveURL(/login/, { timeout: 20_000 });
    await contextA.close();
  });

  test('Login forgot link + mobile forgot shell', async ({ page }) => {
    await page.goto('/ar/login');
    await expect(page.getByTestId('auth-forgot-password')).toHaveAttribute('href', /forgot-password/);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/forgot-password');
    await expect(page.getByTestId('auth-shell')).toBeVisible();
    await expect(page.getByTestId('marketplace-bottom-nav')).toHaveCount(0);
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
  });

  test('customer demo login still works (AUTH-1 regression)', async ({ page }) => {
    await page.goto('/ar/login');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
