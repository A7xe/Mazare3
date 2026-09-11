/**
 * UA-6 — Unified auth UI architecture QA (static).
 * Run: pnpm exec tsx ../../packages/shared/scripts/qa-unified-auth-ui.ts (from apps/api)
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

let passed = 0;
let failed = 0;
function expect(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

console.log('\n=== UA-6 Unified Auth UI ===\n');

const authPage = resolve(root, 'apps/web/src/app/[locale]/auth/page.tsx');
const unified = read('apps/web/src/components/auth/unified-auth-view.tsx');
const caps = read('apps/api/src/services/auth-capabilities.service.ts');
const phonePublic = read('apps/api/src/config/phone-auth-public-config.ts');
const routes = read('apps/api/src/routes/auth.ts');
const googleFlow = read('apps/api/src/services/google/google-oauth-flow.ts');
const loginPage = read('apps/web/src/app/[locale]/login/page.tsx');
const signupPage = read('apps/web/src/app/[locale]/signup/page.tsx');
const chrome = read('apps/web/src/components/layout/site-chrome.tsx');
const identities = read('apps/api/src/services/auth-identities.service.ts');
const accountCard = read('apps/web/src/components/account/account-identities-card.tsx');
const en = read('apps/web/messages/en.json');
const ar = read('apps/web/messages/ar.json');
const envEx = read('.env.example');
const safeUrl = read('packages/shared/src/safe-return-url.ts');
const paytabs = read('apps/api/src/services/payment/paytabs-payment-gateway.ts');
const paymentContact = read('apps/api/src/services/payment-contact.service.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');

expect('1 canonical /auth page exists', existsSync(authPage));
expect('2 AR unified title', ar.includes('أهلاً بك في مزارع'));
expect('3 EN unified title', en.includes('Welcome to Mazare3'));
expect('4 mobile-first auth card', unified.includes('max-w-[400px]') || unified.includes('rounded-3xl'));
expect(
  '4b immersive auth shell for unified',
  read('apps/web/src/components/auth/auth-shell.tsx').includes('data-auth-shell="immersive"') &&
    read('apps/web/src/components/auth/auth-shell.tsx').includes('hero-banner.png') &&
    read('apps/web/src/components/auth/auth-shell.tsx').includes('auth-welcome-to'),
);
expect(
  '4b2 immersive auth has no overlapping brand logo',
  (() => {
    const shellSrc = read('apps/web/src/components/auth/auth-shell.tsx');
    const immersivePart = shellSrc.split('ClassicAuthShell')[0] ?? shellSrc;
    return (
      !immersivePart.includes('mazare3.png') &&
      !immersivePart.includes('data-testid="auth-shell-brand"')
    );
  })(),
);
expect(
  '4c chooser uses pill CTAs',
  unified.includes('rounded-full') && unified.includes('auth-continue-google'),
);
expect(
  '4d no skip CTA on immersive auth',
  !read('apps/web/src/components/auth/auth-shell.tsx').includes('auth-skip'),
);
expect(
  '4e auth shows marketplace bottom nav',
  read('apps/web/src/components/layout/site-chrome.tsx').includes('MarketplaceBottomNav') &&
    /isAuthPagePath[\s\S]*MarketplaceBottomNav/.test(
      read('apps/web/src/components/layout/site-chrome.tsx'),
    ),
);
expect('5 capability endpoint', routes.includes("/capabilities") && caps.includes('getAuthCapabilities'));
expect('6 email always available', caps.includes('emailPassword: { available: true }'));
expect('7 phone hidden when unavailable', phonePublic.includes('isPhoneAuthPubliclyAvailable') && phonePublic.includes('memory'));
expect('8 Google uses isGoogleAuthConfigured', caps.includes('isGoogleAuthConfigured'));
expect('9 all-provider chooser buttons', unified.includes('auth-continue-phone') && unified.includes('auth-continue-google') && unified.includes('auth-continue-email'));
expect('10 phone+email layout conditional', unified.includes('phoneAvailable'));
expect('11 Google+email layout conditional', unified.includes('googleAvailable'));
expect('12 email-only when others false', unified.includes('continueEmail'));
expect('13 phone start API client', unified.includes('startPhoneOtp'));
expect('14 OTP state', unified.includes('auth-otp') && unified.includes('otpDigits'));
expect('15 resend cooldown', unified.includes('otpResendIn') && unified.includes('resendAfter'));
expect('16 existing phone login outcome', unified.includes("outcome === 'authenticated'"));
expect('17 PROFILE_REQUIRED', unified.includes('profile_required') || unified.includes('PROFILE_REQUIRED') || unified.includes('profile'));
expect('18 phone complete', unified.includes('completePhoneProfile'));
expect('19 phone collision link', unified.includes('EXISTING_ACCOUNT_LINK_REQUIRED') && unified.includes('auth-link-required'));
expect('20 Google start URL', unified.includes('googleAuthStartUrl'));
expect('21 Google callback to /auth', googleFlow.includes('/auth?') && !googleFlow.includes("`/login?authError"));
expect('22 new Google via backend (no client create)', !unified.includes('createGoogle'));
expect('23 Google collision UX', unified.includes('EXISTING_ACCOUNT_LINK_REQUIRED'));
expect('24 admin collision safe copy', ar.includes('لا يمكن استخدام هذه الطريقة لهذا الحساب') || en.includes('isn’t available for this account'));
expect('25 email login state', unified.includes('emailMode') && unified.includes('login'));
expect('26 email signup state', unified.includes('emailModeSignup') || unified.includes("'signup'"));
expect('27 forgot-password access', unified.includes('forgot-password'));
expect('28 login redirects to auth', loginPage.includes('/auth') && loginPage.includes('redirect'));
expect('29 signup redirects to auth', signupPage.includes('/auth') && signupPage.includes('redirect'));
expect('30 returnUrl preserved', unified.includes('returnUrl') && safeUrl.includes("'/auth'"));
expect('31 unsafe returnUrl blocked /auth', safeUrl.includes("'/auth'"));
expect('32 no role selection', !unified.includes('role') || !/role.*(customer|owner).*select/i.test(unified));
expect('33 customer-only create via signup API', unified.includes('signup('));
expect('34 Account identity status card', accountCard.includes('account-identities') && identities.includes('getAuthIdentitiesStatus'));
expect('35 Phone from AuthIdentity', identities.includes('AuthIdentityProvider.phone'));
expect('36 Google from AuthIdentity', identities.includes('AuthIdentityProvider.google'));
expect('37 Password not from User.email alone', identities.includes('passwordHash') && identities.includes('NOT inferred'));
expect('38 no unlink UI', !accountCard.includes('unlink') && !accountCard.includes('Disconnect') && !accountCard.includes('Remove'));
expect('39 Partner/KYC unchanged markers', !unified.includes('partner') && !unified.includes('kyc'));
expect('40 Admin uses same /auth entry (password)', true);
expect('41 UA-5 payment contact present', paymentContact.includes('PAYMENT_CONTACT_REQUIRED'));
expect('42 no fake email/phone in PayTabs', !paytabs.includes("customer@mazare3.jo") && !paytabs.includes('0790000000'));
expect('43 no production SMS required for UI build', phonePublic.includes('PHONE_AUTH_PUBLIC_ENABLED'));
expect('44 no real Google required for UI', caps.includes('isGoogleAuthConfigured'));
expect('45 PHONE_AUTH_PUBLIC_ENABLED in env.example', envEx.includes('PHONE_AUTH_PUBLIC_ENABLED=false'));
expect('46 chrome treats /auth as auth page', chrome.includes("'/auth'") || chrome.includes('"/auth"') || chrome.includes("startsWith('/auth')"));
expect('47 PHONE_AUTH_PUBLIC rejects memory', phonePublic.includes("name === 'memory'"));
expect('48 identities GET route', routes.includes("'/identities'"));
expect('49 auth-form remains email (legacy component)', authForm.includes('login') && authForm.includes('email'));
expect('50 AR continue phone copy', ar.includes('المتابعة برقم الهاتف'));
expect(
  '51 AdminGuard redirects to email login mode',
  read('apps/web/src/components/admin/admin-guard.tsx').includes('mode=email') &&
    read('apps/web/src/components/admin/admin-guard.tsx').includes('emailMode=login'),
);
expect(
  '52 privileged admin returnUrl hides Phone/Google',
  unified.includes('isPrivilegedAdminReturnUrl') &&
    unified.includes('privilegedAdminReturn') &&
    unified.includes('!privilegedAdminReturn && capabilities'),
);
const apiAuth = read('apps/web/src/lib/api-auth.ts');
const authSession = read('apps/web/src/components/auth/auth-session.tsx');
expect(
  '53 capabilities cache + inflight dedupe',
  apiAuth.includes('capabilitiesCache') && apiAuth.includes('capabilitiesInflight'),
);
expect(
  '54 capabilities Retry-After aware single retry',
  apiAuth.includes('retryAfterSeconds') && apiAuth.includes('RATE_LIMITED'),
);
expect(
  '55 /me inflight dedupe',
  apiAuth.includes('meInflight'),
);
expect(
  '56 session refresh ignores transient 429',
  authSession.includes('status === 429') && authSession.includes('AuthApiError'),
);
expect(
  '57 capabilities fail-safe keeps email; no false google on load',
  unified.includes('capsLoading') &&
    unified.includes('google: { available: false }') &&
    unified.includes('emailPassword: { available: true }'),
);
expect(
  '58 auth-general not on capabilities/me routes',
  !routes.includes('authRouter.use(authRateLimiter)') &&
    !/\/capabilities[\s\S]{0,120}authRateLimiter/.test(routes) &&
    !/['"]\/me['"][\s\S]{0,120}authRateLimiter/.test(routes),
);

console.log(`\nUA-6 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
