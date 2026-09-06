/**
 * UA-6A — capture acceptance screenshots into _ua6_acceptance_visual/.
 */
import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { CUSTOMER_EMAIL, CUSTOMER_PASSWORD, getApiBase } from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import { mockCapabilities, ua6aPhone, latestSmsOtp, fillOtpDigits, cleanupUa6aFixtures } from './helpers/ua6a.js';

const outDir = join(process.cwd(), '_ua6_acceptance_visual');
mkdirSync(outDir, { recursive: true });

async function shot(page: import('@playwright/test').Page, name: string) {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: false });
}

test.describe('UA-6A visual artifacts', () => {
  test.describe.configure({ retries: 0 });

  test('capture required auth screenshots', async ({ page, request }) => {
    // AR auth viewports
    for (const [w, h, tag] of [
      [390, 844, '390'],
      [768, 1024, '768'],
      [1024, 768, '1024'],
      [1440, 900, '1440'],
    ] as const) {
      await page.setViewportSize({ width: w, height: h });
      await mockCapabilities(page, { phone: false, google: false });
      await page.goto('/ar/auth');
      await expect(page.getByTestId('auth-card')).toBeVisible();
      await shot(page, `ar-auth-${tag}`);
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await mockCapabilities(page, { phone: false, google: false });
    await page.goto('/en/auth');
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await shot(page, 'en-auth-390');

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/en/auth');
    await expect(page.getByTestId('auth-card')).toBeVisible();
    await shot(page, 'en-auth-1440');

    // Capability variants
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [phone, google, name] of [
      [false, false, 'caps-a-email'],
      [true, false, 'caps-b-phone'],
      [false, true, 'caps-c-google'],
      [true, true, 'caps-d-all'],
    ] as const) {
      await mockCapabilities(page, { phone, google });
      await page.goto('/ar/auth');
      await expect(page.getByTestId('auth-card')).toBeVisible();
      await shot(page, `ar-${name}-390`);
    }

    // Phone input
    await mockCapabilities(page, { phone: true, google: false });
    await page.goto('/ar/auth');
    await page.getByTestId('auth-continue-phone').click();
    await expect(page.getByTestId('auth-phone')).toBeVisible();
    await shot(page, 'ar-phone-390');

    // OTP + profile (new phone)
    const phone = ua6aPhone();
    try {
      await page.getByTestId('auth-phone-input').fill(phone);
      await page.getByTestId('auth-phone-submit').click();
      await expect(page.getByTestId('auth-otp')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'ar-otp-390');
      const otp = await latestSmsOtp(request, phone);
      await fillOtpDigits(page, otp.code);
      await expect(page.getByTestId('auth-profile')).toBeVisible({ timeout: 20_000 });
      await shot(page, 'ar-phone-profile-390');
    } finally {
      await cleanupUa6aFixtures(request, { phones: [phone] });
    }

    // Email login / signup
    await mockCapabilities(page, { phone: false, google: false });
    await page.goto('/ar/auth?mode=email&emailMode=login');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await shot(page, 'ar-email-login-390');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/auth?mode=email&emailMode=login');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await shot(page, 'ar-email-login-1440');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/en/auth?mode=email&emailMode=login');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await shot(page, 'en-email-login-390');
    await page.goto('/ar/auth?mode=email&emailMode=signup');
    await expect(page.getByTestId('auth-name')).toBeVisible();
    await shot(page, 'ar-email-signup-390');

    // Link required
    await page.goto('/ar/auth?authError=EXISTING_ACCOUNT_LINK_REQUIRED');
    await expect(page.getByTestId('auth-link-required')).toBeVisible();
    await shot(page, 'ar-phone-link-required-390');
    await shot(page, 'ar-google-link-required-390');

    // Account identities
    await page.context().clearCookies();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await mockCapabilities(page, { phone: false, google: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-identities')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'ar-account-identities-390');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-identities')).toBeVisible({ timeout: 20_000 });
    await shot(page, 'ar-account-identities-1440');

    // Sensitive storage check on auth page
    await page.context().clearCookies();
    await page.goto('/ar/auth?mode=email&emailMode=login');
    const hits = await page.evaluate(() => {
      const bad: string[] = [];
      for (const store of [localStorage, sessionStorage]) {
        for (let i = 0; i < store.length; i++) {
          const k = store.key(i) ?? '';
          const v = store.getItem(k) ?? '';
          if (/otp|id_token|pkce|identity_link|provider_subject/i.test(`${k}=${v}`)) bad.push(k);
        }
      }
      return bad;
    });
    expect(hits).toEqual([]);
    expect(page.url()).not.toMatch(/otp=|id_token|code_verifier/i);
    void getApiBase;
  });
});
