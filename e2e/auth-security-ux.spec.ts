import { test, expect } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';

function uniqueEmail() {
  return `auth1.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
}

test.describe('AUTH-1 security UX', () => {
  test.describe.configure({ retries: 0 });

  test('signup creates customer and lands safely', async ({ page, request }) => {
    const email = uniqueEmail();
    const password = 'Auth1TestPass!';

    await page.goto('/ar/signup');
    await expect(page.getByTestId('auth-shell')).toBeVisible();
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
    await expect(page.getByTestId('marketplace-bottom-nav')).toHaveCount(0);
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await expect(page.getByTestId('auth-email-mode-signup')).toHaveAttribute('aria-selected', 'true');

    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-email')).toBeVisible();

    await page.getByTestId('auth-email').fill(email);
    await page.getByTestId('auth-password').fill('short');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText(/8/);

    await page.getByTestId('auth-password').fill(password);
    await page.getByTestId('auth-name').fill('مستخدم اختبار');
    await page.getByTestId('auth-submit').click();

    await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
    await expect(page.getByTestId('marketplace-bottom-nav')).toBeVisible({ timeout: 20_000 });

    const me = await request.get(`${getApiBase()}/auth/me`, {
      headers: {
        Cookie: (await page.context().cookies())
          .map((c) => `${c.name}=${c.value}`)
          .join('; '),
      },
    });
    expect(me.ok()).toBeTruthy();
    const body = (await me.json()) as { data: { user: { role: string } } };
    expect(body.data.user.role).toBe('customer');
  });

  test('login wrong credentials show safe generic error then succeed', async ({ page }) => {
    await page.goto('/ar/login');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await page.getByTestId('auth-email').fill('nobody-auth1@example.com');
    await page.getByTestId('auth-password').fill('WrongPass999!');
    await page.getByTestId('auth-submit').click();
    await expect(page.getByTestId('auth-error')).toContainText('البريد الإلكتروني أو كلمة المرور غير صحيحة');

    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
  });

  test('partner returnUrl preserved through email mode switch and login', async ({ page }) => {
    await page.goto('/ar/signup?returnUrl=%2Fbecome-owner');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/returnUrl/);
    await page.getByTestId('auth-email-mode-login').click();
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/become-owner/, { timeout: 30_000 });
  });

  test('external returnUrl is sanitized after login', async ({ page }) => {
    await page.goto('/ar/login?returnUrl=https%3A%2F%2Fevil.example%2Fphish');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).not.toHaveURL(/evil\.example/, { timeout: 30_000 });
    await expect(page).toHaveURL(/\/(ar)?\/?$/, { timeout: 30_000 });
  });

  test('already authenticated user is redirected away from auth', async ({ page }) => {
    await page.context().clearCookies();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/auth');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
  });
});
