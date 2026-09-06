/**
 * AUTH-1 — auth security + UX regression suite.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-auth-security-ux.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  authHrefWithReturn,
  resolveSafeReturnUrl,
  sanitizeReturnUrl,
  signupSchema,
} from '../src/index.ts';

let passed = 0;
let failed = 0;

function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail: string) {
  failed++;
  console.log(`  ❌ ${name}: ${detail}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail || 'assertion failed');
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const authService = read('apps/api/src/services/auth.service.ts');
const authRoutes = read('apps/api/src/routes/auth.ts');
const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const cookieOpts = read('apps/api/src/lib/cookie-options.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const unifiedAuth = read('apps/web/src/components/auth/unified-auth-view.tsx');
const authShell = read('apps/web/src/components/auth/auth-shell.tsx');
const chrome = read('apps/web/src/components/layout/site-chrome.tsx');
const footer = read('apps/web/src/components/layout/site-footer.tsx');
const apiAuth = read('apps/web/src/lib/api-auth.ts');
const en = JSON.parse(read('apps/web/messages/en.json')) as { auth: Record<string, string> };
const ar = JSON.parse(read('apps/web/messages/ar.json')) as { auth: Record<string, string> };

console.log('\n— Signup role / schema —');
{
  expect('1 signup hardcodes customer', authService.includes("role: 'customer'"));
  expect('2 signup schema has no role', !('role' in (signupSchema.shape as object)));
  const withRole = signupSchema.safeParse({
    email: 'a@b.co',
    password: 'password1',
    role: 'admin',
  } as never);
  expect('3 extra role ignored by zod object', withRole.success === true && !('role' in (withRole.data as object)));
  expect('4 password min 8', signupSchema.safeParse({ email: 'a@b.co', password: 'short' }).success === false);
  expect('5 password ok 8+', signupSchema.safeParse({ email: 'a@b.co', password: 'password' }).success === true);
}

console.log('\n— Login errors / hashing —');
{
  expect('6 shared invalid credentials message', authService.includes("'Invalid email or password'"));
  expect('7 bcrypt rounds 12', authService.includes('BCRYPT_ROUNDS = 12'));
  expect('8 no plaintext password log in service', !/console\.(log|info|debug).*password/i.test(authService));
  expect('9 no password in JSON success path', !authRoutes.includes('passwordHash'));
}

console.log('\n— Rate limit / cookies —');
{
  expect('10 auth rate limiter mounted', authRoutes.includes('authRateLimiter'));
  expect(
    '10b auth-general not router-wide on reads',
    !authRoutes.includes('authRouter.use(authRateLimiter)'),
  );
  expect(
    '10c capabilities/me free of auth-general',
    !/\/capabilities[\s\S]{0,120}authRateLimiter/.test(authRoutes) &&
      !/['"]\/me['"][\s\S]{0,120}authRateLimiter/.test(authRoutes),
  );
  expect('11 rate limit window 15m', rateLimit.includes('15 * 60 * 1000') || rateLimit.includes('15 * 60'));
  expect('12 httpOnly cookie', cookieOpts.includes('httpOnly: true'));
  expect('13 secure production default', cookieOpts.includes('isAppEnvProduction'));
  expect('14 sameSite default lax', cookieOpts.includes("'lax'"));
  expect('15 logout clears with cookie options', authRoutes.includes('clearCookie(COOKIE_NAME, clearOpts)'));
}

console.log('\n— Return URL —');
{
  expect('16 internal path ok', sanitizeReturnUrl('/become-owner') === '/become-owner');
  expect('17 account path ok', sanitizeReturnUrl('/account/bookings') === '/account/bookings');
  expect('18 absolute http rejected', sanitizeReturnUrl('https://evil.example') === null);
  expect('19 protocol-relative rejected', sanitizeReturnUrl('//evil.example') === null);
  expect('20 encoded protocol-relative rejected', sanitizeReturnUrl('%2F%2Fevil.example') === null);
  expect('21 backslash rejected', sanitizeReturnUrl('/\\evil.example') === null);
  expect('22 login path blocked as return', sanitizeReturnUrl('/login') === null);
  expect('22b auth path blocked as return', sanitizeReturnUrl('/auth') === null);
  expect('22c locale auth path blocked', sanitizeReturnUrl('/ar/auth') === null);
  expect('22d locale login path blocked', sanitizeReturnUrl('/en/login') === null);
  expect('23 fallback home', resolveSafeReturnUrl('https://evil.example', '/') === '/');
  expect('24 authHref preserves safe return', authHrefWithReturn('/auth', '/become-owner').includes('returnUrl='));
  expect('25 form uses sanitizeReturnUrl', authForm.includes('sanitizeReturnUrl') || authForm.includes('resolveSafeReturnUrl'));
}

console.log('\n— UX / chrome —');
{
  expect('26 shared AuthShell', authShell.includes('auth-shell') && authShell.includes('logo-main.png'));
  expect('27 password toggle', authForm.includes('auth-password-toggle'));
  expect('28 autocomplete new-password signup', authForm.includes("'new-password'"));
  expect('29 autocomplete current-password login', authForm.includes("'current-password'"));
  expect('30 no auth bottom nav', chrome.includes('isAuthPagePath') && chrome.includes('return null'));
  expect('31 footer hidden on auth', footer.includes('/auth') && footer.includes('return null'));
  expect('32 AuthApiError with code', apiAuth.includes('class AuthApiError'));
  expect('33 authenticated redirect away', unifiedAuth.includes('auth-redirecting') || authForm.includes('auth-redirecting'));
  expect('34 email form has no OTP in legacy auth-form', !authForm.toLowerCase().includes('otp'));
  expect('35 no google/apple social in legacy auth-form', !/google|apple|facebook/i.test(authForm));
  expect(
    '36 forgot password reachable from unified auth',
    unifiedAuth.includes('auth-forgot-password') && unifiedAuth.includes('/forgot-password'),
  );
}

console.log('\n— i18n —');
{
  const required = [
    'loginTitle',
    'signupTitle',
    'loginSubtitle',
    'signupSubtitle',
    'errorInvalidCredentials',
    'errorEmailExists',
    'passwordHint',
    'showPassword',
    'hidePassword',
    'shellPoint1',
  ];
  for (const key of required) {
    expect(`37 AR has ${key}`, typeof ar.auth[key] === 'string' && ar.auth[key]!.length > 0);
    expect(`38 EN has ${key}`, typeof en.auth[key] === 'string' && en.auth[key]!.length > 0);
  }
  expect('39 AR login title', ar.auth.loginTitle === 'مرحباً بعودتك');
  expect('40 AR signup title', ar.auth.signupTitle === 'أنشئ حسابك');
  expect('41 AR invalid credentials safe', ar.auth.errorInvalidCredentials.includes('غير صحيحة'));
  expect('42 no guaranteed booking claim', !ar.auth.shellPoint1.includes('مضمون'));
}

console.log('\n— Assets —');
{
  expect('43 default logo exists', existsSync(join(root, 'apps/web/public/logo/logo-main.png')));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
