/**
 * UA-6A — live unified auth E2E (browser + API seams).
 * Process-scoped mocks only; does not mutate real .env.
 */
import { test, expect } from '@playwright/test';
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  CUSTOMER_EMAIL,
  CUSTOMER_PASSWORD,
  OWNER_EMAIL,
  OWNER_PASSWORD,
  getApiBase,
} from './constants.js';
import { applySessionToPage } from './helpers/session.js';
import {
  attachGoogleIdentity,
  attachPhoneIdentity,
  cleanupUa6aFixtures,
  createPasswordFixture,
  fillOtpDigits,
  googleIdTokenAuth,
  latestSmsOtp,
  mockCapabilities,
  resetGoogleOidcMock,
  setGoogleOidcMock,
  storageHasSensitive,
  ua6aEmail,
  ua6aPhone,
} from './helpers/ua6a.js';

const FIXTURE_PASSWORD = 'Ua6aTestPass!2026';

test.describe('UA-6A unified auth acceptance', () => {
  test.describe.configure({ retries: 0 });

  test.afterEach(async ({ request }) => {
    await resetGoogleOidcMock(request);
  });

  test('A email-only capabilities — no phone/google buttons', async ({ page }) => {
    await mockCapabilities(page, { phone: false, google: false });
    await page.goto('/ar/auth');
    await expect(page.getByTestId('auth-chooser')).toBeVisible();
    await expect(page.getByTestId('auth-continue-phone')).toHaveCount(0);
    await expect(page.getByTestId('auth-continue-google')).toHaveCount(0);
    await expect(page.getByTestId('auth-continue-email')).toBeVisible();
    await expect(page.getByTestId('auth-card')).toContainText('أهلاً بك في مزارع');
    await expect(page.getByTestId('authenticated-top-header')).toHaveCount(0);
    await expect(page.getByTestId('marketplace-bottom-nav')).toHaveCount(0);
  });

  test('B phone+email capabilities — order phone then email', async ({ page }) => {
    await mockCapabilities(page, { phone: true, google: false });
    await page.goto('/ar/auth');
    await expect(page.getByTestId('auth-continue-phone')).toBeVisible();
    await expect(page.getByTestId('auth-continue-google')).toHaveCount(0);
    await expect(page.getByTestId('auth-continue-email')).toBeVisible();
    const phoneBox = await page.getByTestId('auth-continue-phone').boundingBox();
    const emailBox = await page.getByTestId('auth-continue-email').boundingBox();
    expect(phoneBox && emailBox && phoneBox.y < emailBox.y).toBeTruthy();
  });

  test('C google+email capabilities', async ({ page }) => {
    await mockCapabilities(page, { phone: false, google: true });
    await page.goto('/en/auth');
    await expect(page.getByTestId('auth-continue-phone')).toHaveCount(0);
    await expect(page.getByTestId('auth-continue-google')).toBeVisible();
    await expect(page.getByTestId('auth-continue-email')).toBeVisible();
    await expect(page.getByTestId('auth-card')).toContainText('Welcome to Mazare3');
  });

  test('D all providers — Phone, Google, Email order', async ({ page }) => {
    await mockCapabilities(page, { phone: true, google: true });
    await page.goto('/ar/auth');
    const phone = page.getByTestId('auth-continue-phone');
    const google = page.getByTestId('auth-continue-google');
    const email = page.getByTestId('auth-continue-email');
    await expect(phone).toBeVisible();
    await expect(google).toBeVisible();
    await expect(email).toBeVisible();
    const pb = await phone.boundingBox();
    const gb = await google.boundingBox();
    const eb = await email.boundingBox();
    expect(pb && gb && eb && pb.y < gb.y && gb.y < eb.y).toBeTruthy();
  });

  test('email login preserves safe returnUrl', async ({ page }) => {
    await page.goto('/ar/auth?mode=email&emailMode=login&returnUrl=%2Faccount%2Fbookings');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/account\/bookings/, { timeout: 30_000 });
  });

  test('email signup fields only — name email password', async ({ page }) => {
    await page.goto('/ar/auth?mode=email&emailMode=signup');
    await expect(page.getByTestId('auth-name')).toBeVisible();
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await expect(page.getByTestId('auth-password')).toBeVisible();
    await expect(page.getByTestId('auth-forgot-password')).toHaveCount(0);
    await expect(page.locator('select, [name="role"]')).toHaveCount(0);
  });

  test('legacy /login and /signup redirect into /auth', async ({ page }) => {
    await page.goto('/ar/login?returnUrl=%2Faccount');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/emailMode=login/);
    await expect(page).toHaveURL(/returnUrl/);

    await page.goto('/ar/signup?returnUrl=%2Faccount');
    await expect(page).toHaveURL(/\/auth/);
    await expect(page).toHaveURL(/emailMode=signup/);
  });

  test('unsafe returnUrl never becomes redirect destination', async ({ page }) => {
    const unsafe = [
      'https://evil.example',
      '//evil.example',
      '/\\\\evil.example',
      '/ar/auth',
      '/ar/login',
      '/ar/signup',
    ];
    for (const raw of unsafe) {
      await page.context().clearCookies();
      await page.goto(`/ar/auth?mode=email&emailMode=login&returnUrl=${encodeURIComponent(raw)}`);
      await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
      await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
      await page.getByTestId('auth-submit').click();
      await expect(page).not.toHaveURL(/evil\.example/, { timeout: 30_000 });
      await expect(page).not.toHaveURL(/\/auth/, { timeout: 30_000 });
    }
  });

  test('Admin returnUrl forces Email Login and hides Phone/Google', async ({ page }) => {
    await mockCapabilities(page, { phone: true, google: true });
    await page.goto('/ar/auth?returnUrl=%2Fadmin%2Fusers');
    await expect(page.getByTestId('auth-email')).toBeVisible();
    await expect(page.getByTestId('auth-continue-phone')).toHaveCount(0);
    await expect(page.getByTestId('auth-continue-google')).toHaveCount(0);
    await expect(page.getByTestId('auth-chooser')).toHaveCount(0);
    await expect(page.getByTestId('auth-email-mode-login')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('auth-back')).toHaveCount(0);
  });

  test('Admin email login returns to admin route', async ({ page }) => {
    await page.goto('/ar/auth?mode=email&emailMode=login&returnUrl=%2Fadmin');
    await page.getByTestId('auth-email').fill(ADMIN_EMAIL);
    await page.getByTestId('auth-password').fill(ADMIN_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
  });

  test('customer on admin returnUrl is not granted admin', async ({ page }) => {
    await page.goto('/ar/auth?mode=email&emailMode=login&returnUrl=%2Fadmin%2Fusers');
    await page.getByTestId('auth-email').fill(CUSTOMER_EMAIL);
    await page.getByTestId('auth-password').fill(CUSTOMER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/admin/, { timeout: 30_000 });
    await expect(page.getByTestId('admin-forbidden')).toBeVisible({ timeout: 20_000 });
    await expect(page).not.toHaveURL(/\/auth/);
  });

  test('authenticated customer/owner visiting /auth redirects away', async ({ page }) => {
    await page.context().clearCookies();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await page.goto('/ar/auth');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });

    await page.context().clearCookies();
    await applySessionToPage(page, OWNER_EMAIL, OWNER_PASSWORD);
    await page.goto('/ar/auth');
    await expect(page).not.toHaveURL(/\/auth/, { timeout: 20_000 });
  });

  test('account identities card + gating without dead actions', async ({ page }) => {
    await page.context().clearCookies();
    await applySessionToPage(page, CUSTOMER_EMAIL, CUSTOMER_PASSWORD);
    await mockCapabilities(page, { phone: false, google: false });
    await page.goto('/ar/account');
    await expect(page.getByTestId('account-identities')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('identity-password')).toBeVisible();
    await expect(page.getByTestId('identity-phone')).toBeVisible();
    await expect(page.getByTestId('identity-google')).toBeVisible();
    await expect(page.getByTestId('identity-add-phone')).toHaveCount(0);
    await expect(page.getByTestId('identity-add-google')).toHaveCount(0);
    const body = await page.locator('[data-testid="account-identities"]').innerText();
    expect(body).not.toMatch(/google-oauth|providerSubject|sub=/i);
  });

  test('phone existing user authenticates same fixture', async ({ page, request }) => {
    const email = ua6aEmail('phone-existing');
    const phone = ua6aPhone();
    try {
      const created = await createPasswordFixture(request, {
        email,
        password: FIXTURE_PASSWORD,
        name: 'UA6A Phone Existing',
      });
      await attachPhoneIdentity(request, email, phone);
      await mockCapabilities(page, { phone: true, google: false });
      await page.goto('/ar/auth?returnUrl=%2Faccount');
      await page.getByTestId('auth-continue-phone').click();
      await page.getByTestId('auth-phone-input').fill(phone);
      await page.getByTestId('auth-phone-submit').click();
      await expect(page.getByTestId('auth-otp')).toBeVisible();
      const otp = await latestSmsOtp(request, phone);
      await fillOtpDigits(page, otp.code);
      await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
      const me = await request.get(`${getApiBase()}/auth/me`, {
        headers: {
          Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
        },
      });
      expect(me.ok()).toBeTruthy();
      const body = (await me.json()) as { data: { user: { id: string; role: string } } };
      expect(body.data.user.id).toBe(created.data.id);
      expect(body.data.user.role).toBe('customer');
      expect(await storageHasSensitive(page)).toEqual([]);
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email], phones: [phone] });
    }
  });

  test('phone new user → PROFILE_REQUIRED → customer', async ({ page, request }) => {
    const phone = ua6aPhone();
    try {
      await mockCapabilities(page, { phone: true, google: false });
      await page.goto('/ar/auth?returnUrl=%2Faccount');
      await page.getByTestId('auth-continue-phone').click();
      await page.getByTestId('auth-phone-input').fill(phone);
      await page.getByTestId('auth-phone-submit').click();
      await expect(page.getByTestId('auth-otp')).toBeVisible();
      const otp = await latestSmsOtp(request, phone);
      expect(page.url()).not.toContain(otp.code);
      await fillOtpDigits(page, otp.code);
      await expect(page.getByTestId('auth-profile')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('auth-email')).toHaveCount(0);
      await expect(page.getByTestId('auth-password')).toHaveCount(0);
      await page.getByTestId('auth-profile-name').fill('مستخدم هاتف جديد');
      await page.getByTestId('auth-profile-submit').click();
      await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
      const me = await request.get(`${getApiBase()}/auth/me`, {
        headers: {
          Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
        },
      });
      const body = (await me.json()) as {
        data: { user: { id: string; role: string; email: string | null } };
      };
      expect(body.data.user.role).toBe('customer');
      expect(body.data.user.email).toBeNull();
      const identities = await request.get(`${getApiBase()}/auth/identities`, {
        headers: {
          Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
        },
      });
      const idBody = (await identities.json()) as {
        data: { phone: { linked: boolean; masked: string | null }; password: { linked: boolean } };
      };
      expect(idBody.data.phone.linked).toBe(true);
      expect(idBody.data.password.linked).toBe(false);
      expect(idBody.data.phone.masked).toBeTruthy();
    } finally {
      await cleanupUa6aFixtures(request, { phones: [phone] });
    }
  });

  test('phone legacy collision → LINK_REQUIRED → same user', async ({ page, request }) => {
    const email = ua6aEmail('phone-collision');
    const phone = ua6aPhone();
    try {
      const created = await createPasswordFixture(request, {
        email,
        password: FIXTURE_PASSWORD,
        name: 'UA6A Collision',
        phone,
      });
      await mockCapabilities(page, { phone: true, google: false });
      await page.goto(`/ar/auth?returnUrl=${encodeURIComponent('/account')}`);
      await page.getByTestId('auth-continue-phone').click();
      await page.getByTestId('auth-phone-input').fill(phone);
      await page.getByTestId('auth-phone-submit').click();
      await expect(page.getByTestId('auth-otp')).toBeVisible({ timeout: 20_000 });
      const otp = await latestSmsOtp(request, phone);
      await fillOtpDigits(page, otp.code);
      await expect(page.getByTestId('auth-link-required')).toBeVisible({ timeout: 20_000 });
      await page.getByTestId('auth-link-email').click();
      await page.getByTestId('auth-email').fill(email);
      await page.getByTestId('auth-password').fill(FIXTURE_PASSWORD);
      await page.getByTestId('auth-submit').click();
      await expect(page).toHaveURL(/\/account/, { timeout: 30_000 });
      const me = await request.get(`${getApiBase()}/auth/me`, {
        headers: {
          Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
        },
      });
      const body = (await me.json()) as { data: { user: { id: string; role: string } } };
      expect(body.data.user.id).toBe(created.data.id);
      expect(body.data.user.role).toBe('customer');
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email], phones: [phone] });
    }
  });

  test('Google existing linked identity → same user', async ({ request }) => {
    const email = ua6aEmail('google-existing');
    const sub = `ua6a-google-existing-${Date.now()}`;
    try {
      const created = await createPasswordFixture(request, {
        email,
        password: FIXTURE_PASSWORD,
        name: 'UA6A Google Existing',
      });
      await attachGoogleIdentity(request, email, sub);
      await setGoogleOidcMock(request, {
        sub,
        email,
        emailVerified: true,
        name: 'UA6A Google Existing',
      });
      const { status, body } = await googleIdTokenAuth(request);
      expect(status).toBe(200);
      const data = body.data as { outcome: string; user: { id: string; role: string } };
      expect(data.outcome).toBe('authenticated');
      expect(data.user.id).toBe(created.data.id);
      expect(data.user.role).toBe('customer');
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('Google new verified identity creates customer', async ({ request }) => {
    const email = ua6aEmail('google-new');
    const sub = `ua6a-google-new-${Date.now()}`;
    try {
      await setGoogleOidcMock(request, {
        sub,
        email,
        emailVerified: true,
        name: 'UA6A Google New',
      });
      const { status, body } = await googleIdTokenAuth(request);
      expect(status).toBe(200);
      const data = body.data as {
        outcome: string;
        user: { id: string; role: string; email: string | null };
      };
      expect(data.outcome).toBe('authenticated');
      expect(data.user.role).toBe('customer');
      expect(data.user.email).toBe(email);
      const idRes = await request.get(`${getApiBase()}/auth/identities`);
      if (idRes.ok()) {
        const idBody = (await idRes.json()) as {
          data: { password: { linked: boolean }; google: { linked: boolean } };
        };
        expect(idBody.data.google.linked).toBe(true);
        expect(idBody.data.password.linked).toBe(false);
      }
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('Google collision → LINK_REQUIRED → explicit link same user', async ({
    page,
    request,
  }) => {
    const email = ua6aEmail('google-collision');
    const sub = `ua6a-google-collision-${Date.now()}`;
    try {
      const created = await createPasswordFixture(request, {
        email,
        password: FIXTURE_PASSWORD,
        name: 'UA6A Google Collision',
      });
      await setGoogleOidcMock(request, {
        sub,
        email,
        emailVerified: true,
        name: 'UA6A Google Collision',
      });
      const first = await googleIdTokenAuth(request);
      expect(first.status).toBe(409);
      expect(first.body.code).toBe('EXISTING_ACCOUNT_LINK_REQUIRED');

      await page.goto('/ar/auth?authError=EXISTING_ACCOUNT_LINK_REQUIRED&returnUrl=%2Faccount');
      await expect(page.getByTestId('auth-link-required')).toBeVisible();

      const again = await googleIdTokenAuth(request);
      expect(again.status).toBe(409);
      const loginRes = await request.post(`${getApiBase()}/auth/login`, {
        data: { email, password: FIXTURE_PASSWORD },
      });
      expect(loginRes.ok()).toBeTruthy();
      const linkRes = await request.post(`${getApiBase()}/auth/identities/link/complete`, {
        data: {},
      });
      expect(linkRes.ok()).toBeTruthy();
      const linked = (await linkRes.json()) as { data: { user: { id: string; role: string } } };
      expect(linked.data.user.id).toBe(created.data.id);
      expect(linked.data.user.role).toBe('customer');
    } finally {
      await cleanupUa6aFixtures(request, { emails: [email] });
    }
  });

  test('Google privileged admin collision rejects without role leak', async ({
    page,
    request,
  }) => {
    const sub = `ua6a-google-admin-${Date.now()}`;
    try {
      await setGoogleOidcMock(request, {
        sub,
        email: ADMIN_EMAIL,
        emailVerified: true,
        name: 'Admin',
      });
      const { status, body } = await googleIdTokenAuth(request);
      expect(status).toBeGreaterThanOrEqual(400);
      const blob = JSON.stringify(body).toLowerCase();
      expect(blob).not.toContain('admin');
      expect(blob).not.toMatch(/userId|user_id/);

      await page.goto(
        '/ar/auth?authError=PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT&returnUrl=%2Faccount',
      );
      await expect(page.getByTestId('auth-error')).toContainText(
        'لا يمكن استخدام هذه الطريقة لهذا الحساب',
      );
      await expect(page.getByTestId('auth-error')).not.toContainText(/admin|مدير|role/i);
    } finally {
      await resetGoogleOidcMock(request);
    }
  });

  test('owner role unchanged after email auth', async ({ page, request }) => {
    await page.context().clearCookies();
    await page.goto('/ar/auth?mode=email&emailMode=login&returnUrl=%2Fowner');
    await page.getByTestId('auth-email').fill(OWNER_EMAIL);
    await page.getByTestId('auth-password').fill(OWNER_PASSWORD);
    await page.getByTestId('auth-submit').click();
    await expect(page).toHaveURL(/\/owner/, { timeout: 30_000 });
    const me = await request.get(`${getApiBase()}/auth/me`, {
      headers: {
        Cookie: (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; '),
      },
    });
    const body = (await me.json()) as { data: { user: { role: string } } };
    expect(body.data.user.role).toBe('owner');
  });
});
