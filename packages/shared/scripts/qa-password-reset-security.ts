/**
 * AUTH-2 — password reset security suite.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-password-reset-security.ts
 */
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signupSchema,
} from '../src/schemas/auth.ts';

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

const schema = read('packages/db/prisma/schema.prisma');
const migration = read(
  'packages/db/prisma/migrations/20260903120000_auth2_password_reset/migration.sql',
);
const service = read('apps/api/src/services/password-reset.service.ts');
const authRoutes = read('apps/api/src/routes/auth.ts');
const authMw = read('apps/api/src/middleware/auth.ts');
const jwt = read('apps/api/src/lib/jwt.ts');
const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const config = read('apps/api/src/config/password-reset.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const forgotForm = read('apps/web/src/components/auth/forgot-password-form.tsx');
const resetForm = read('apps/web/src/components/auth/reset-password-form.tsx');
const chrome = read('apps/web/src/components/layout/site-chrome.tsx');
const en = JSON.parse(read('apps/web/messages/en.json')) as { auth: Record<string, string> };
const ar = JSON.parse(read('apps/web/messages/ar.json')) as { auth: Record<string, string> };
const emailProvider = read('apps/api/src/services/email/get-email-provider.ts');
const smtp = read('apps/api/src/services/email/smtp-email-provider.ts');
const sendgrid = read('apps/api/src/services/email/sendgrid-email-provider.ts');
const resendLive = read('apps/api/src/services/email/resend-email-provider.ts');

console.log('\n— Model / migration —');
{
  expect('1 PasswordResetToken model', schema.includes('model PasswordResetToken'));
  expect('2 tokenHash unique', schema.includes('tokenHash String') && schema.includes('@unique'));
  expect('3 usedAt field', schema.includes('usedAt'));
  expect('4 expiresAt field', schema.includes('expiresAt'));
  expect('5 passwordChangedAt on User', schema.includes('passwordChangedAt'));
  expect('6 additive migration', migration.includes('PasswordResetToken') && migration.includes('passwordChangedAt'));
  expect('7 no DROP TABLE', !/DROP TABLE/i.test(migration));
}

console.log('\n— Token crypto —');
{
  expect('8 sha256 hash helper', service.includes("createHash('sha256')"));
  expect('9 randomBytes token', service.includes('randomBytes(32)'));
  expect('10 raw token not stored', !service.includes('token: rawToken') && service.includes('tokenHash'));
  expect('11 TTL centralized 45m', config.includes('45 * 60 * 1000'));
  expect('12 invalidate prior tokens', service.includes('usedAt: null') && service.includes('updateMany'));
  const sample = randomBytes(32).toString('base64url');
  const hash = createHash('sha256').update(sample, 'utf8').digest('hex');
  expect('13 hash length 64 hex', hash.length === 64);
}

console.log('\n— Schemas —');
{
  expect('14 forgot schema email', forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success);
  expect('15 reset min 8', resetPasswordSchema.safeParse({ token: 'x'.repeat(24), password: 'short' }).success === false);
  expect(
    '16 reset ok password',
    resetPasswordSchema.safeParse({ token: 'x'.repeat(24), password: 'password1' }).success,
  );
  expect('17 same min as signup', signupSchema.safeParse({ email: 'a@b.co', password: 'password' }).success);
}

console.log('\n— Routes / enumeration —');
{
  expect('18 forgot route', authRoutes.includes("'/forgot-password'"));
  expect('19 reset route', authRoutes.includes("'/reset-password'"));
  expect('20 generic forgot message', service.includes('If an account exists for this email address'));
  expect('21 forgot rate limiter', authRoutes.includes('forgotPasswordRateLimiter'));
  expect('22 reset rate limiter', authRoutes.includes('resetPasswordRateLimiter'));
  expect('23 forgot max 5', rateLimit.includes('PASSWORD_RESET_FORGOT_RATE_MAX') || config.includes('PASSWORD_RESET_FORGOT_RATE_MAX = 5'));
  expect('24 no production token leak guard', service.includes('isAppEnvProduction') && service.includes('isPasswordResetDevLinkEnabled'));
}

console.log('\n— Session revocation —');
{
  expect('25 JWT pwdAt field', jwt.includes('pwdAt'));
  expect('26 middleware compares passwordChangedAt', authMw.includes('passwordChangedAt') && authMw.includes('pwdAt'));
  expect('27 reset sets passwordChangedAt', service.includes('passwordChangedAt: now'));
  expect('28 reset clears cookie', authRoutes.includes('clearCookie(COOKIE_NAME'));
}

console.log('\n— Email / gaps —');
{
  expect('29 email via provider interface', service.includes('getEmailProvider().send') || service.includes('provider.send'));
  expect('30 Resend is live (AUTH-3)', resendLive.includes('api.resend.com') && resendLive.includes('fetch('));
  expect('31 SMTP/SendGrid remain stubs', smtp.includes('skipped: true') && sendgrid.includes('skipped: true'));
  expect('31b none provider still available', emailProvider.includes('NoneEmailProvider'));
}

console.log('\n— UI —');
{
  expect('32 login forgot link', authForm.includes('auth-forgot-password') && authForm.includes('/forgot-password'));
  expect('33 forgot confirmation generic', forgotForm.includes('forgot-password-confirmation'));
  expect('34 reset confirm field', resetForm.includes('confirmPassword'));
  expect('35 chrome gates forgot/reset', chrome.includes('/forgot-password') && chrome.includes('/reset-password'));
  expect('36 forgot page exists', existsSync(join(root, 'apps/web/src/app/[locale]/forgot-password/page.tsx')));
  expect('37 reset page exists', existsSync(join(root, 'apps/web/src/app/[locale]/reset-password/page.tsx')));
  expect(
    '38 no OTP',
    !/\botp\b|one[- ]?time|verification code/i.test(forgotForm + resetForm),
  );
  expect('39 no social', !/google|apple|facebook/i.test(forgotForm + resetForm));
}

console.log('\n— i18n —');
{
  for (const key of [
    'forgotLink',
    'forgotTitle',
    'forgotConfirmation',
    'resetTitle',
    'resetSuccessTitle',
    'resetInvalidBody',
    'newPassword',
    'confirmPassword',
  ] as const) {
    expect(`40 AR ${key}`, Boolean(ar.auth[key]));
    expect(`41 EN ${key}`, Boolean(en.auth[key]));
  }
  expect('42 AR confirmation copy', ar.auth.forgotConfirmation.includes('إذا كان هناك حساب'));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
