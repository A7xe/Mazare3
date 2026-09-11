import type { Page } from '@playwright/test';
import {
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
} from '../constants.js';

export async function loginOnPage(
  page: Page,
  creds: { email: string; password: string } = {
    email: CUSTOMER_EMAIL,
    password: CUSTOMER_PASSWORD,
  },
) {
  const email = page.getByTestId('auth-email');
  const emailContinue = page.getByTestId('auth-continue-email');
  // Unified `/auth` may land on the method chooser (guest book) or email form (`/login` redirect).
  await Promise.race([
    email.waitFor({ state: 'visible', timeout: 30_000 }),
    emailContinue.waitFor({ state: 'visible', timeout: 30_000 }),
  ]);
  if (await emailContinue.isVisible().catch(() => false)) {
    await emailContinue.click();
    await email.waitFor({ state: 'visible', timeout: 15_000 });
  }
  await email.fill(creds.email);
  await page.getByTestId('auth-password').fill(creds.password);
  await page.getByTestId('auth-submit').click();
  await page.waitForResponse(
    (res) => res.url().includes('/auth/login') && res.status() === 200,
    { timeout: 25_000 },
  );
}

export async function ensureOwnerLoggedIn(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/login`);
  await loginOnPage(page, { email: OWNER_EMAIL, password: OWNER_PASSWORD });
  await page.goto(`/${locale}`);
}

/** UI login when tests need an authenticated browser session. */
export async function ensureCustomerLoggedIn(page: Page, locale: 'ar' | 'en' = 'ar') {
  await page.goto(`/${locale}/login`);
  await loginOnPage(page);
  await page.goto(`/${locale}`);
}
