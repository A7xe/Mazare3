import { test, expect, type Page } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { loginViaApi } from './helpers/api.js';

const IGNORE_CONSOLE = [
  /Download the React DevTools/i,
  /favicon\.ico/i,
  /Failed to load resource/i,
  /net::ERR_/i,
];

function collectRuntimeIssues(page: Page) {
  const issues: string[] = [];
  page.on('pageerror', (err) => {
    issues.push(`pageerror: ${err.message}`);
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORE_CONSOLE.some((re) => re.test(text))) return;
    issues.push(`console: ${text}`);
  });
  return issues;
}

test.describe('Customer account profile landing', () => {
  test.describe.configure({ retries: 0 });

  test('guest is gated away from /account', async ({ page }) => {
    await page.goto('/ar/account');
    await page.waitForURL(/\/ar\/auth\?returnUrl=/, { timeout: 20_000 });
    expect(page.url()).toContain('returnUrl');
  });

  test('Arabic and English account pages show session profile data', async ({ page }) => {
    const issues = collectRuntimeIssues(page);
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);

    await page.goto('/ar');
    await expect(page.getByTestId('nav-account')).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('nav-account').click();
    await expect(page).toHaveURL(/\/ar\/account(?:\/)?$/);
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('account-profile')).toBeVisible();
    await expect(page.getByTestId('account-profile-email')).toHaveText(CUSTOMER_EMAIL);
    await expect(page.getByTestId('account-profile-name')).toHaveText('زبون تجريبي');
    await expect(page.getByTestId('account-profile-role')).toHaveText('عميل');

    await page.goto('/en/account');
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('account-profile-email')).toHaveText(CUSTOMER_EMAIL);
    await expect(page.getByTestId('account-profile-role')).toHaveText('Customer');
    expect(issues, issues.join('\n')).toEqual([]);
  });

  test('section links and logout still work', async ({ page }) => {
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-home')).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('account-home-bookings').click();
    await expect(page).toHaveURL(/\/ar\/account\/bookings/);
    await expect(page.getByTestId('my-bookings')).toBeVisible({ timeout: 20_000 });

    await page.goto('/ar/account');
    await page.getByTestId('account-home-favorites').click();
    await expect(page).toHaveURL(/\/ar\/account\/favorites/);

    await page.goto('/ar/account');
    await page.getByTestId('account-home-notifications').click();
    await expect(page).toHaveURL(/\/ar\/account\/notifications/);

    await page.goto('/ar/account');
    await page.getByTestId('account-home').getByTestId('nav-logout').click();
    await page.waitForURL((url) => !url.pathname.includes('/account'), { timeout: 20_000 });
    await expect(page.getByTestId('nav-login')).toBeVisible({ timeout: 20_000 });
  });

  test('session profile is own-user only; another account cannot see customer fields', async ({
    page,
  }) => {
    const customerCookie = await loginViaApi(CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    const ownerCookie = await loginViaApi(OWNER_EMAIL, OWNER_PASSWORD);

    const customerMe = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Cookie: customerCookie },
    });
    const ownerMe = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Cookie: ownerCookie },
    });
    expect(customerMe.ok).toBeTruthy();
    expect(ownerMe.ok).toBeTruthy();
    const customerBody = (await customerMe.json()) as { data?: { user?: { email?: string } } };
    const ownerBody = (await ownerMe.json()) as { data?: { user?: { email?: string } } };
    expect(customerBody.data?.user?.email).toBe(CUSTOMER_EMAIL);
    expect(ownerBody.data?.user?.email).toBe(OWNER_EMAIL);
    expect(ownerBody.data?.user?.email).not.toBe(CUSTOMER_EMAIL);

    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-profile-email')).toHaveText(OWNER_EMAIL, {
      timeout: 20_000,
    });
    await expect(page.getByTestId('account-profile-email')).not.toHaveText(CUSTOMER_EMAIL);
  });
});
