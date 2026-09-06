/**
 * Visual QA screenshots for the authenticated header against local `pnpm dev`.
 * Run from repo root:
 *   node --experimental-strip-types apps/web/scripts/qa-auth-header-visual.mjs
 * or: pnpm exec playwright test --config=playwright.config.ts is NOT used here.
 *
 *   node apps/web/scripts/qa-auth-header-visual.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = process.env.AUTH_HEADER_WEB_URL ?? 'http://localhost:3000';
const API = process.env.AUTH_HEADER_API_URL ?? 'http://localhost:4000/api/v1';
const CUSTOMER = { email: 'customer@mazare3.jo', password: 'Mazare3Demo2026!' };
const OWNER = { email: 'owner1@mazare3.jo', password: 'Mazare3Demo2026!' };

const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../_auth_header_screenshots');

async function loginCookie(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status} for ${email} via ${API}`);
  const cookies = res.headers.getSetCookie?.() ?? [];
  const session = cookies
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('mazare3_session='));
  if (!session) throw new Error('session cookie missing');
  return session.slice('mazare3_session='.length);
}

async function withSession(browser, creds, fn) {
  const value = await loginCookie(creds.email, creds.password);
  const context = await browser.newContext();
  await context.addCookies([
    {
      name: 'mazare3_session',
      value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
  const page = await context.newPage();
  try {
    await fn(page);
  } finally {
    await context.close();
  }
}

async function shot(page, name, { width, height, path }) {
  await page.setViewportSize({ width, height });
  await page.goto(`${WEB}${path}`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  const header = page.getByTestId('authenticated-top-header');
  await header.waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForTimeout(500);
  const file = join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  const box = await header.boundingBox();
  const breadcrumb = (await page.getByTestId('auth-header-breadcrumb').textContent().catch(() => '')) || '';
  const mobile = (await page.getByTestId('auth-header-mobile-context').textContent().catch(() => '')) || '';
  const unread = await page.getByTestId('auth-header-unread-badge').count();
  console.log(
    `  ${name} ${width}x${height} headerH=${box ? Math.round(box.height) : '?'} crumbs="${(breadcrumb || mobile || '').trim()}" unreadBadge=${unread} -> ${file}`,
  );
}

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  console.log(`Visual QA against ${WEB} (API ${API})`);
  await withSession(browser, CUSTOMER, async (page) => {
    await shot(page, 'ar-account-1440', { width: 1440, height: 900, path: '/ar/account' });
    await shot(page, 'ar-bookings-1440', { width: 1440, height: 900, path: '/ar/account/bookings' });
    await shot(page, 'ar-become-owner-1440', { width: 1440, height: 900, path: '/ar/become-owner' });
    await shot(page, 'ar-home-1440', { width: 1440, height: 900, path: '/ar' });
    await shot(page, 'ar-explore-1440', { width: 1440, height: 900, path: '/ar/search' });
    await shot(page, 'ar-search-1440', { width: 1440, height: 900, path: '/ar/search?q=مزرعة' });
    await shot(page, 'ar-property-1440', {
      width: 1440,
      height: 900,
      path: '/ar/properties/chalet-emerald-dead-sea',
    });
    await shot(page, 'ar-account-1024', { width: 1024, height: 768, path: '/ar/account' });
    await shot(page, 'ar-account-390', { width: 390, height: 844, path: '/ar/account' });
    await shot(page, 'ar-home-390', { width: 390, height: 844, path: '/ar' });
    await shot(page, 'ar-explore-390', { width: 390, height: 844, path: '/ar/search' });
    await shot(page, 'ar-property-390', {
      width: 390,
      height: 844,
      path: '/ar/properties/chalet-emerald-dead-sea',
    });
    await shot(page, 'ar-become-owner-390', { width: 390, height: 844, path: '/ar/become-owner' });
    await shot(page, 'en-account-1440', { width: 1440, height: 900, path: '/en/account' });
    await shot(page, 'en-home-1440', { width: 1440, height: 900, path: '/en' });
    await shot(page, 'en-explore-390', { width: 390, height: 844, path: '/en/search' });
    await shot(page, 'en-account-390', { width: 390, height: 844, path: '/en/account' });
  });
  await withSession(browser, OWNER, async (page) => {
    await shot(page, 'ar-owner-properties-1440', { width: 1440, height: 900, path: '/ar/owner/properties' });
    await shot(page, 'ar-owner-add-farm-1440', { width: 1440, height: 900, path: '/ar/owner/properties/new' });
    await shot(page, 'ar-owner-properties-1024', { width: 1024, height: 768, path: '/ar/owner/properties' });
    await shot(page, 'ar-owner-properties-390', { width: 390, height: 844, path: '/ar/owner/properties' });
  });
} finally {
  await browser.close();
}
