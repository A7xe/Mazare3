/**
 * UA-6A visual acceptance screenshots.
 * Prefer Playwright webServer ports (3010). Falls back to AUTH_WEB_URL.
 *
 * Run (with stack up):
 *   node apps/web/scripts/qa-ua6-acceptance-visual.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const WEB = process.env.AUTH_WEB_URL ?? process.env.PLAYWRIGHT_WEB_URL ?? 'http://localhost:3010';
const API = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:4010/api/v1';
const outDir = join(dirname(fileURLToPath(import.meta.url)), '../../../_ua6_acceptance_visual');

mkdirSync(outDir, { recursive: true });

async function fulfillCaps(page, phone, google) {
  await page.route('**/api/v1/auth/capabilities', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          phone: { available: phone },
          google: { available: google },
          emailPassword: { available: true },
        },
      }),
    });
  });
}

async function shot(page, name) {
  const file = join(outDir, `${name}.png`);
  await page.waitForTimeout(350);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name} -> ${file}`);
  return file;
}

async function reviewNotes(page, label) {
  const card = page.getByTestId('auth-card');
  const box = (await card.count()) ? await card.boundingBox() : null;
  const overflowX = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth > el.clientWidth + 1;
  });
  const bottomNav = await page.getByTestId('marketplace-bottom-nav').count();
  const authHeader = await page.getByTestId('authenticated-top-header').count();
  console.log(
    `  review[${label}] cardW=${box ? Math.round(box.width) : 'n/a'} overflowX=${overflowX} bottomNav=${bottomNav} authHeader=${authHeader}`,
  );
}

const browser = await chromium.launch();
const page = await browser.newPage();

try {
  console.log(`UA-6A visual against ${WEB}`);

  // Default AR viewports
  for (const [w, h, tag] of [
    [390, 844, '390'],
    [768, 1024, '768'],
    [1024, 768, '1024'],
    [1440, 900, '1440'],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await fulfillCaps(page, false, false);
    await page.goto(`${WEB}/ar/auth`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await page.getByTestId('auth-card').waitFor({ state: 'visible', timeout: 45_000 });
    await shot(page, `ar-auth-${tag}`);
    await reviewNotes(page, `ar-auth-${tag}`);
  }

  // EN
  await page.setViewportSize({ width: 390, height: 844 });
  await fulfillCaps(page, false, false);
  await page.goto(`${WEB}/en/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-card').waitFor({ state: 'visible' });
  await shot(page, 'en-auth-390');
  await reviewNotes(page, 'en-auth-390');

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${WEB}/en/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-card').waitFor({ state: 'visible' });
  await shot(page, 'en-auth-1440');

  // Capability variants
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [phone, google, name] of [
    [false, false, 'caps-email-only'],
    [true, false, 'caps-phone-email'],
    [false, true, 'caps-google-email'],
    [true, true, 'caps-all'],
  ]) {
    await fulfillCaps(page, phone, google);
    await page.goto(`${WEB}/ar/auth`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('auth-card').waitFor({ state: 'visible' });
    await shot(page, `ar-${name}-390`);
  }

  // Phone input
  await fulfillCaps(page, true, false);
  await page.goto(`${WEB}/ar/auth`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-continue-phone').click();
  await page.getByTestId('auth-phone').waitFor({ state: 'visible' });
  await shot(page, 'ar-phone-390');
  await reviewNotes(page, 'ar-phone-390');

  // Email login
  await fulfillCaps(page, false, false);
  await page.goto(`${WEB}/ar/auth?mode=email&emailMode=login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-email').waitFor({ state: 'visible' });
  await shot(page, 'ar-email-login-390');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${WEB}/ar/auth?mode=email&emailMode=login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-email').waitFor({ state: 'visible' });
  await shot(page, 'ar-email-login-1440');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${WEB}/en/auth?mode=email&emailMode=login`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-email').waitFor({ state: 'visible' });
  await shot(page, 'en-email-login-390');

  // Email signup
  await page.goto(`${WEB}/ar/auth?mode=email&emailMode=signup`, { waitUntil: 'domcontentloaded' });
  await page.getByTestId('auth-name').waitFor({ state: 'visible' });
  await shot(page, 'ar-email-signup-390');

  // LINK_REQUIRED (Google-equivalent query)
  await page.goto(`${WEB}/ar/auth?authError=EXISTING_ACCOUNT_LINK_REQUIRED`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('auth-link-required').waitFor({ state: 'visible' });
  await shot(page, 'ar-phone-link-required-390');
  await shot(page, 'ar-google-link-required-390');

  // OTP / profile / account screens need live API — best-effort
  try {
    const health = await fetch(`${API}/health`);
    if (!health.ok) throw new Error('API down');

    await fulfillCaps(page, true, false);
    await page.goto(`${WEB}/ar/auth`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('auth-continue-phone').click();
    const phone = `+962799${String(Math.floor(100000 + Math.random() * 900000))}`;
    await page.getByTestId('auth-phone-input').fill(phone);
    await page.getByTestId('auth-phone-submit').click();
    await page.getByTestId('auth-otp').waitFor({ state: 'visible', timeout: 15_000 });
    await shot(page, 'ar-otp-390');

    const otpRes = await fetch(
      `${API}/internal/sms-otp-outbox/latest?phone=${encodeURIComponent(phone)}`,
    );
    if (otpRes.ok) {
      const otpBody = await otpRes.json();
      const code = String(otpBody.data.code);
      for (let i = 0; i < 6; i++) {
        await page.getByTestId(`auth-otp-digit-${i}`).fill(code[i]);
      }
      await page.getByTestId('auth-profile').waitFor({ state: 'visible', timeout: 15_000 });
      await shot(page, 'ar-phone-profile-390');

      // cleanup new user if completed later — leave profile screen shot only
      await fetch(`${API}/internal/qa/users/cleanup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: [phone] }),
      }).catch(() => undefined);
    }
  } catch (e) {
    console.warn('  (skip live OTP/profile shots)', e.message ?? e);
  }

  // Account identities (seed customer)
  try {
    const login = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@mazare3.jo',
        password: 'Mazare3Demo2026!',
      }),
    });
    const setCookie = login.headers.getSetCookie?.() ?? [];
    const session = setCookie
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('mazare3_session='));
    if (session) {
      const ctx = await browser.newContext();
      await ctx.addCookies([
        {
          name: 'mazare3_session',
          value: session.slice('mazare3_session='.length),
          domain: 'localhost',
          path: '/',
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ]);
      const ap = await ctx.newPage();
      await ap.setViewportSize({ width: 390, height: 844 });
      await ap.goto(`${WEB}/ar/account`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await ap.getByTestId('account-identities').waitFor({ state: 'visible', timeout: 30_000 });
      await ap.screenshot({
        path: join(outDir, 'ar-account-identities-390.png'),
        fullPage: false,
      });
      console.log('  ✓ ar-account-identities-390');
      await ap.setViewportSize({ width: 1440, height: 900 });
      await ap.goto(`${WEB}/ar/account`, { waitUntil: 'domcontentloaded' });
      await ap.getByTestId('account-identities').waitFor({ state: 'visible', timeout: 30_000 });
      await ap.screenshot({
        path: join(outDir, 'ar-account-identities-1440.png'),
        fullPage: false,
      });
      console.log('  ✓ ar-account-identities-1440');
      await ctx.close();
    }
  } catch (e) {
    console.warn('  (skip account identities shots)', e.message ?? e);
  }

  console.log(`\nScreenshots written to ${outDir}`);
} finally {
  await browser.close();
}
