import { test, expect } from '@playwright/test';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, getApiBase } from './constants.js';

function uniqueEmail() {
  return `auth4.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function signupViaApi(email: string, password: string) {
  const res = await fetch(`${getApiBase()}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Auth4 User', locale: 'ar' }),
  });
  if (!res.ok) throw new Error(`signup failed ${res.status}`);
}

async function loginViaApi(email: string, password: string) {
  return fetch(`${getApiBase()}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

async function clearLoginAbuse(email: string) {
  await fetch(`${getApiBase()}/internal/login-abuse/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

test.describe('AUTH-4 login abuse protection', () => {
  test.describe.configure({ retries: 0 });

  test('Scenario A — identifier cooldown then success after expiry', async () => {
    const email = uniqueEmail();
    const password = 'Auth4Correct!';
    await signupViaApi(email, password);
    await clearLoginAbuse(email);

    // Threshold in playwright env is 3.
    for (let i = 0; i < 3; i++) {
      const res = await loginViaApi(email, 'WrongPassAuth4!');
      expect(res.status).toBe(401);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('INVALID_CREDENTIALS');
      expect(JSON.stringify(body)).not.toMatch(/failCount|attempt/i);
    }

    const blocked = await loginViaApi(email, password);
    expect(blocked.status).toBe(429);
    const blockedBody = (await blocked.json()) as { code?: string; details?: unknown };
    expect(blockedBody.code).toBe('AUTH_RATE_LIMITED');
    expect(blockedBody.details).toBeUndefined();
    expect(blocked.headers.get('retry-after')).toBeTruthy();

    // Correct password while blocked must not authenticate.
    const stillBlocked = await loginViaApi(email, password);
    expect(stillBlocked.status).toBe(429);

    // Wait for test cooldown (4s) + buffer.
    await new Promise((r) => setTimeout(r, 4500));

    const ok = await loginViaApi(email, password);
    expect(ok.status).toBe(200);
  });

  test('Scenario B — unknown email still throttles by identifier', async () => {
    const email = uniqueEmail();
    await clearLoginAbuse(email);

    for (let i = 0; i < 3; i++) {
      const res = await loginViaApi(email, 'NopeNope12');
      expect(res.status).toBe(401);
    }
    const blocked = await loginViaApi(email, 'NopeNope12');
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { code?: string };
    expect(body.code).toBe('AUTH_RATE_LIMITED');
  });

  test('Scenario C — casing-normalized identifier shares throttle state', async () => {
    const base = uniqueEmail();
    const password = 'Auth4CaseOk!';
    await signupViaApi(base, password);
    await clearLoginAbuse(base);

    for (let i = 0; i < 3; i++) {
      await loginViaApi(base.toUpperCase(), 'BadCasePass1');
    }
    const blocked = await loginViaApi(base, password);
    expect(blocked.status).toBe(429);
  });

  test('Scenario D — password reset clears login abuse state', async () => {
    const email = uniqueEmail();
    const oldPassword = 'Auth4OldPass!';
    const newPassword = 'Auth4NewPass!';
    await signupViaApi(email, oldPassword);
    await clearLoginAbuse(email);

    for (let i = 0; i < 3; i++) {
      await loginViaApi(email, 'WrongResetGate!');
    }
    expect((await loginViaApi(email, oldPassword)).status).toBe(429);

    await fetch(`${getApiBase()}/internal/email-outbox/clear`, { method: 'POST' });
    const forgot = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.ok).toBeTruthy();

    const outbox = await fetch(`${getApiBase()}/internal/email-outbox`);
    const outboxBody = (await outbox.json()) as {
      data?: { last?: { text?: string } | null };
    };
    const text = outboxBody.data?.last?.text ?? '';
    const match = text.match(/https?:\/\/[^\s]+\/(?:ar|en)\/reset-password\?token=[^\s]+/);
    expect(match).toBeTruthy();
    const token = new URL(match![0]).searchParams.get('token');
    expect(token).toBeTruthy();

    const reset = await fetch(`${getApiBase()}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password: newPassword }),
    });
    expect(reset.ok).toBeTruthy();

    const loginNew = await loginViaApi(email, newPassword);
    expect(loginNew.status).toBe(200);
  });

  test('Forgot password remains available while login identifier is throttled', async () => {
    const email = uniqueEmail();
    await signupViaApi(email, 'Auth4Avail!');
    await clearLoginAbuse(email);
    for (let i = 0; i < 3; i++) {
      await loginViaApi(email, 'WrongAvail!');
    }
    expect((await loginViaApi(email, 'Auth4Avail!')).status).toBe(429);

    const forgot = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.status).toBe(200);
  });

  test('Login UI shows safe rate-limit message', async ({ page }) => {
    const email = uniqueEmail();
    await signupViaApi(email, 'Auth4UiPass!');
    await clearLoginAbuse(email);

    await page.goto('/ar/login');
    await page.getByTestId('auth-email').fill(email);
    for (let i = 0; i < 3; i++) {
      await page.getByTestId('auth-password').fill(`WrongUiPass${i}!`);
      await page.getByTestId('auth-submit').click();
      await expect(page.getByTestId('auth-error')).toContainText(
        /البريد الإلكتروني أو كلمة المرور غير صحيحة|email or password/i,
        { timeout: 15_000 },
      );
    }
    await page.getByTestId('auth-password').fill('WrongUiPassFinal!');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText(/محاولات كثيرة|Too many attempts/, {
      timeout: 15_000,
    });
  });

  test('demo customer login still works', async ({ page }) => {
    await page.goto('/ar/login');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
