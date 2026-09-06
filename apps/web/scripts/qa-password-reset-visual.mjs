/**
 * Visual QA for AUTH-2 forgot/reset password.
 * Run: node apps/web/scripts/qa-password-reset-visual.mjs
 * Optional: AUTH_WEB_URL=http://localhost:3010
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = process.env.AUTH_WEB_URL ?? 'http://localhost:3010';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../_auth_reset_screenshots');

async function shot(page, name, { width, height, path }) {
  await page.setViewportSize({ width, height });
  await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByTestId('auth-shell').waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(400);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const forgotLink = await page.getByTestId('auth-forgot-password').count();
  console.log(`  ${name} ${width}x${height} forgotLink=${forgotLink} -> ${file}`);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  console.log(`Password-reset visual QA against ${WEB}`);
  await shot(page, 'ar-forgot-1440', { width: 1440, height: 900, path: '/ar/forgot-password' });
  await shot(page, 'ar-reset-1440', {
    width: 1440,
    height: 900,
    path: '/ar/reset-password?token=visual-qa-placeholder-token',
  });
  await shot(page, 'ar-forgot-390', { width: 390, height: 844, path: '/ar/forgot-password' });
  await shot(page, 'ar-reset-390', {
    width: 390,
    height: 844,
    path: '/ar/reset-password?token=visual-qa-placeholder-token',
  });
  await shot(page, 'ar-reset-invalid-390', {
    width: 390,
    height: 844,
    path: '/ar/reset-password?token=visual-qa-placeholder-token',
  });
  // Trigger invalid state via submit
  await page.getByTestId('auth-password').fill('ValidPass12');
  await page.getByTestId('auth-password-confirm').fill('ValidPass12');
  await page.getByTestId('auth-submit').click();
  await page.getByTestId('reset-invalid').waitFor({ state: 'visible', timeout: 20_000 });
  await page.waitForTimeout(300);
  await page.screenshot({
    path: join(outDir, 'ar-reset-invalid-390.png'),
    fullPage: false,
  });
  console.log('  ar-reset-invalid-390 captured after submit');

  await shot(page, 'en-forgot-390', { width: 390, height: 844, path: '/en/forgot-password' });
  await shot(page, 'en-reset-1440', {
    width: 1440,
    height: 900,
    path: '/en/reset-password?token=visual-qa-placeholder-token',
  });
  await shot(page, 'ar-login-forgot-link-1440', { width: 1440, height: 900, path: '/ar/login' });
} finally {
  await browser.close();
}
