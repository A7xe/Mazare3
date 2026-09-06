/**
 * Visual QA for AUTH-1 login/signup.
 * Run: node apps/web/scripts/qa-auth-visual.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = process.env.AUTH_WEB_URL ?? 'http://localhost:3000';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../_auth_ux_screenshots');

async function shot(page, name, { width, height, path }) {
  await page.setViewportSize({ width, height });
  await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.getByTestId('auth-card').waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(400);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const bottomNav = await page.getByTestId('marketplace-bottom-nav').count();
  const authHeader = await page.getByTestId('authenticated-top-header').count();
  console.log(`  ${name} ${width}x${height} bottomNav=${bottomNav} authHeader=${authHeader} -> ${file}`);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
try {
  console.log(`Auth visual QA against ${WEB}`);
  await shot(page, 'ar-signup-1440', { width: 1440, height: 900, path: '/ar/signup' });
  await shot(page, 'ar-login-1440', { width: 1440, height: 900, path: '/ar/login' });
  await shot(page, 'ar-signup-390', { width: 390, height: 844, path: '/ar/signup' });
  await shot(page, 'ar-login-390', { width: 390, height: 844, path: '/ar/login' });
  await shot(page, 'en-login-1440', { width: 1440, height: 900, path: '/en/login' });
  await shot(page, 'en-signup-390', { width: 390, height: 844, path: '/en/signup' });
  await shot(page, 'ar-login-1024', { width: 1024, height: 768, path: '/ar/login' });
} finally {
  await browser.close();
}
