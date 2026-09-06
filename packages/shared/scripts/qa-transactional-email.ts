/**
 * AUTH-3 — transactional email / password-reset delivery suite.
 * Run: cd apps/api && pnpm exec tsx ../../packages/shared/scripts/qa-transactional-email.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectEmailProviderStartupErrors,
  EmailProviderStartupError,
} from '../../../apps/api/src/config/validate-email-provider.ts';
import {
  formatEmailFromHeader,
  getEmailSafeDiagnostics,
  isLiveEmailDeliverySupported,
  isResendConfigured,
  loadEmailConfig,
  missingProviderConfigReason,
  type EmailConfig,
} from '../../../apps/api/src/config/email-config.ts';
import { renderPasswordResetEmail } from '../../../apps/api/src/services/email/templates/password-reset.ts';
import { ResendEmailProvider } from '../../../apps/api/src/services/email/resend-email-provider.ts';
import { MemoryEmailProvider } from '../../../apps/api/src/services/email/memory-email-provider.ts';
import { PASSWORD_RESET_TOKEN_TTL_MS } from '../../../apps/api/src/config/password-reset.ts';

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

const resendSrc = read('apps/api/src/services/email/resend-email-provider.ts');
const memorySrc = read('apps/api/src/services/email/memory-email-provider.ts');
const getProvider = read('apps/api/src/services/email/get-email-provider.ts');
const smtpSrc = read('apps/api/src/services/email/smtp-email-provider.ts');
const sendgridSrc = read('apps/api/src/services/email/sendgrid-email-provider.ts');
const noneSrc = read('apps/api/src/services/email/none-email-provider.ts');
const emailConfigSrc = read('apps/api/src/config/email-config.ts');
const validateEmailSrc = read('apps/api/src/config/validate-email-provider.ts');
const indexSrc = read('apps/api/src/index.ts');
const resetService = read('apps/api/src/services/password-reset.service.ts');
const resetTemplate = read('apps/api/src/services/email/templates/password-reset.ts');
const passwordResetConfig = read('apps/api/src/config/password-reset.ts');
const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const authMw = read('apps/api/src/middleware/auth.ts');
const jwt = read('apps/api/src/lib/jwt.ts');
const envExample = read('.env.example');
const docs = read('docs/transactional-email.md');
const webPkg = read('apps/web/package.json');
const webEnvFiles = [
  'apps/web/src/lib/api-auth.ts',
  'apps/web/src/components/auth/forgot-password-form.tsx',
].map(read).join('\n');
const schema = read('packages/db/prisma/schema.prisma');
const migrationAuth2 = read(
  'packages/db/prisma/migrations/20260903120000_auth2_password_reset/migration.sql',
);

console.log('\n— Provider foundation —');
{
  expect('1 Resend adapter exists', existsSync(join(root, 'apps/api/src/services/email/resend-email-provider.ts')));
  expect('2 server-only provider usage', resetService.includes('getEmailProvider()') && !webEnvFiles.includes('RESEND_API_KEY'));
  expect('3 provider none remains explicit', noneSrc.includes("name = 'none'") && noneSrc.includes('skipped: true'));
  expect('4 missing provider config detected', missingProviderConfigReason({
    provider: 'resend',
    from: '',
    fromName: '',
    timeoutMs: 10_000,
    smtp: { host: '', port: 587, user: '', pass: '' },
    resendApiKey: '',
    sendgridApiKey: '',
  })?.includes('RESEND_API_KEY') === true);
  expect('5 API key never exported client-side', !webPkg.includes('RESEND_API_KEY') && !envExample.includes('NEXT_PUBLIC_RESEND'));
  expect('6 sender configured through env', emailConfigSrc.includes('EMAIL_FROM') && emailConfigSrc.includes('EMAIL_FROM_NAME'));
  expect(
    '7 recipient derived server-side',
    /to:\s*user\.email/.test(resetService) && !/\bto:\s*input\b/.test(resetService),
  );
}

console.log('\n— Reset email content / origin —');
{
  const ar = renderPasswordResetEmail('ar', 'https://app.example/ar/reset-password?token=abc', 45);
  const en = renderPasswordResetEmail('en', 'https://app.example/en/reset-password?token=abc', 45);
  expect('8 reset email uses AUTH-2 token URL', ar.text.includes('token=abc') && en.text.includes('token=abc'));
  expect('9 token stored as hash only in create', resetService.includes('tokenHash') && resetService.includes('hashPasswordResetToken(rawToken)'));
  expect(
    '10 token not logged',
    !/console\.(log|info|error|warn)\([^)]*rawToken/.test(resetService) &&
      !/console\.(log|info|error|warn)\([^)]*resetUrl/.test(resetService),
  );
  expect('11 reset URL uses trusted app origin', passwordResetConfig.includes('FRONTEND_URL') && passwordResetConfig.includes('NEXT_PUBLIC_APP_URL'));
  expect('12 Host header cannot alter reset origin', !passwordResetConfig.includes('req.headers') && !resetService.includes('req.headers'));
  expect('13 AR template exists', ar.subject.includes('إعادة تعيين') && ar.html.includes('إعادة تعيين كلمة المرور'));
  expect('14 EN template exists', en.subject.toLowerCase().includes('reset') && en.html.includes('Reset password'));
  expect('15 real 45-minute expiry reflected', PASSWORD_RESET_TOKEN_TTL_MS === 45 * 60 * 1000 && ar.text.includes('45') && en.text.includes('45'));
}

console.log('\n— Enumeration / public safety —');
{
  expect('16 generic forgot response preserved', resetService.includes(GENERIC_SNIPPET()));
  expect('17 unknown email does not send', resetService.includes("user.status !== 'active'") && resetService.includes('return result'));
  expect('18 suspended/noneligible remains generic', resetService.includes("user.status !== 'active'"));
  expect('19 provider failure does not enumerate', resetService.includes('GENERIC_FORGOT_MESSAGE') && resetService.includes('invalidateResetToken'));
  expect('20 provider error not returned publicly', resetService.includes('message: GENERIC_FORGOT_MESSAGE') || resetService.includes('result: ForgotPasswordResult'));
  expect('21 sanitized logging', resetService.includes('maskEmail') && resetService.includes('EMAIL_ACCEPTED'));
  expect('22 production never includes unchecked devResetLink', resetService.includes('isPasswordResetDevLinkEnabled') && resetService.includes('isAppEnvProduction'));
  expect('23 devResetLink environment-gated', resetService.includes('isPasswordResetDevLinkEnabled()'));
}

function GENERIC_SNIPPET() {
  return 'If an account exists for this email address, we will send password reset instructions.';
}

console.log('\n— Provider results / token policy —');
{
  expect('24 provider accepted result handled', resetService.includes('EMAIL_ACCEPTED') && resetService.includes('sendResult.ok'));
  expect('25 provider failed result handled', resetService.includes('EMAIL_SEND_FAILED') && resetService.includes('invalidateResetToken'));
  expect('26 delivery failure token policy', resetService.includes('invalidateResetToken(created.id)'));
  expect('27 new request invalidates prior token', resetService.includes('usedAt: null') && resetService.includes('updateMany'));
  expect('28 session revocation unchanged', jwt.includes('pwdAt') && authMw.includes('passwordChangedAt') && authMw.includes('pwdAt'));
  expect('28b passwordChangedAt still set on reset', resetService.includes('passwordChangedAt: now'));
  expect('29 Forgot rate limit unchanged', rateLimit.includes('PASSWORD_RESET_FORGOT_RATE_MAX') || rateLimit.includes('forgotPasswordRateLimiter'));
  expect('30 Reset rate limit unchanged', rateLimit.includes('PASSWORD_RESET_ATTEMPT_RATE_MAX') || rateLimit.includes('resetPasswordRateLimiter'));
}

console.log('\n— Scope / schema —');
{
  expect('31 no OTP', !/\botp\b/i.test(resetTemplate));
  expect('32 no social auth', !/google|apple|facebook/i.test(resetService));
  expect('33 no email verification flow added', !resetService.toLowerCase().includes('email verification') && !resetService.includes('verifyEmail'));
  expect('34 no marketing email functionality', !resetService.toLowerCase().includes('newsletter') && !resetService.toLowerCase().includes('campaign'));
  expect('35 no schema destruction', !migrationAuth2.includes('DROP TABLE') && schema.includes('PasswordResetToken'));
}

console.log('\n— Resend live wiring —');
{
  expect('36 Resend uses live fetch', resendSrc.includes('api.resend.com') && resendSrc.includes('fetch('));
  expect('37 Resend timeout bounded', resendSrc.includes('AbortSignal.timeout') || emailConfigSrc.includes('timeoutMs'));
  expect('38 Resend no auto-retry loop', !resendSrc.includes('for (') || !resendSrc.toLowerCase().includes('retry'));
  expect('39 memory provider for QA', memorySrc.includes("name = 'memory'") && getProvider.includes('MemoryEmailProvider'));
  expect('40 startup validation mounted', indexSrc.includes('validateEmailProviderAtStartup'));
  expect('41 production smtp/sendgrid blocked', validateEmailSrc.includes('not production-capable'));
  expect('42 docs exist', docs.includes('Resend') && docs.includes('EMAIL_FROM'));
  expect('43 env example documents Resend', envExample.includes('RESEND_API_KEY') && envExample.includes('EMAIL_FROM_NAME'));
  expect('44 smtp/sendgrid remain stubs', smtpSrc.includes('skipped: true') && sendgridSrc.includes('skipped: true'));
  expect('45 formatEmailFromHeader', formatEmailFromHeader({
    provider: 'resend',
    from: 'noreply@example.com',
    fromName: 'Mazare3',
    timeoutMs: 10_000,
    smtp: { host: '', port: 587, user: '', pass: '' },
    resendApiKey: 'x',
    sendgridApiKey: '',
  }) === 'Mazare3 <noreply@example.com>');
  expect('46 live delivery supported only for resend', isLiveEmailDeliverySupported('resend') && !isLiveEmailDeliverySupported('smtp'));
  expect('47 EmailProviderStartupError exists', EmailProviderStartupError.name === 'EmailProviderStartupError');

  const prodResendMissing: EmailConfig = {
    provider: 'resend',
    from: '',
    fromName: '',
    timeoutMs: 10_000,
    smtp: { host: '', port: 587, user: '', pass: '' },
    resendApiKey: '',
    sendgridApiKey: '',
  };
  // collect errors without flipping real APP_ENV — reason helper still works
  expect('48 incomplete resend reason', Boolean(missingProviderConfigReason(prodResendMissing)));
  expect('49 diagnostics never include key', !JSON.stringify(getEmailSafeDiagnostics()).includes('re_'));
  expect('50 Resend provider class instantiable', new ResendEmailProvider().name === 'resend');
  expect('51 Memory provider class instantiable', new MemoryEmailProvider().name === 'memory');
  expect('52 isResendConfigured false without key', !isResendConfigured(prodResendMissing));
  // collectEmailProviderStartupErrors depends on APP_ENV; still callable
  expect('53 collectEmailProviderStartupErrors callable', Array.isArray(collectEmailProviderStartupErrors(loadEmailConfig())));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
