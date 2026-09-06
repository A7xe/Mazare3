import { test, expect } from '@playwright/test';
import { createHash, randomBytes } from 'node:crypto';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, getApiBase } from './constants.js';

function uniqueEmail() {
  return `auth5.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

function syntheticKey(): string {
  return createHash('sha256').update(`e2e-${Date.now()}-${randomBytes(8).toString('hex')}`).digest('hex');
}

async function signupViaApi(email: string, password: string) {
  const res = await fetch(`${getApiBase()}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Auth5 User', locale: 'ar' }),
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

async function clearRateNamespace(namespace: string) {
  await fetch(`${getApiBase()}/internal/rate-limit/clear`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namespace }),
  });
}

async function incrementShared(namespace: string, keyHash: string) {
  const res = await fetch(`${getApiBase()}/internal/rate-limit/increment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ namespace, keyHash }),
  });
  const body = (await res.json()) as { data?: { totalHits?: number } };
  return { status: res.status, hits: body.data?.totalHits };
}

async function readHits(namespace: string, keyHash: string) {
  const res = await fetch(
    `${getApiBase()}/internal/rate-limit/hits?namespace=${encodeURIComponent(namespace)}&keyHash=${encodeURIComponent(keyHash)}`,
  );
  const body = (await res.json()) as { data?: { hits?: number | null } };
  return body.data?.hits ?? null;
}

test.describe('AUTH-5 distributed auth IP rate limit', () => {
  test.describe.configure({ retries: 0 });

  test('Scenario B — shared store across logical increments', async () => {
    const key = syntheticKey();
    await clearRateNamespace('auth-general');

    const a = await incrementShared('auth-general', key);
    const b = await incrementShared('auth-general', key);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.hits).toBe(1);
    expect(b.hits).toBe(2);
    expect(await readHits('auth-general', key)).toBe(2);
  });

  test('Scenario C — forgot/reset namespaces stay isolated', async () => {
    const key = syntheticKey();
    await clearRateNamespace('auth-forgot-password');
    await clearRateNamespace('auth-reset-password');

    expect((await incrementShared('auth-forgot-password', key)).hits).toBe(1);
    expect((await incrementShared('auth-reset-password', key)).hits).toBe(1);
    expect(await readHits('auth-forgot-password', key)).toBe(1);
    expect(await readHits('auth-reset-password', key)).toBe(1);
    expect(await readHits('auth-general', key)).toBeNull();
  });

  test('Scenario D — identifier layering still works with many wrong passwords', async () => {
    const email = uniqueEmail();
    await signupViaApi(email, 'Auth5LayerOk!');
    await clearLoginAbuse(email);

    for (let i = 0; i < 3; i++) {
      const res = await loginViaApi(email, 'WrongLayer!');
      expect(res.status).toBe(401);
    }
    const blocked = await loginViaApi(email, 'Auth5LayerOk!');
    expect(blocked.status).toBe(429);
    const body = (await blocked.json()) as { code?: string };
    expect(body.code).toBe('AUTH_RATE_LIMITED');
  });

  test('Forgot password still works while identifier throttled', async () => {
    const email = uniqueEmail();
    await signupViaApi(email, 'Auth5Forgot!');
    await clearLoginAbuse(email);
    for (let i = 0; i < 3; i++) {
      await loginViaApi(email, 'WrongForgot!');
    }
    expect((await loginViaApi(email, 'Auth5Forgot!')).status).toBe(429);

    const forgot = await fetch(`${getApiBase()}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    expect(forgot.status).toBe(200);
  });

  test('demo login regression', async ({ page }) => {
    await page.goto('/ar/login');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  });
});
