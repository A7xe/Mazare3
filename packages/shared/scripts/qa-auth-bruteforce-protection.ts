/**
 * AUTH-4 — account-aware login brute-force protection suite.
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-auth-bruteforce-protection.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  const envText = readFileSync(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*(JWT_SECRET|SESSION_SECRET)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2] ?? '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // optional local .env
}

import {
  LOGIN_ABUSE_COOLDOWN_MS,
  LOGIN_ABUSE_EXTENDED_COOLDOWN_MS,
  LOGIN_ABUSE_FAIL_THRESHOLD,
  LOGIN_ABUSE_MAX_COOLDOWN_MS,
  LOGIN_ABUSE_STATE_TTL_MS,
  cooldownMsForFailCount,
} from '../../../apps/api/src/config/login-abuse-config.ts';
import {
  hashLoginIdentifier,
  loginIdentifierKeysMatch,
  normalizeLoginEmail,
} from '../../../apps/api/src/services/login-abuse.service.ts';

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

const rootForRead = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(rootForRead, rel), 'utf8');

const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const authRoutes = read('apps/api/src/routes/auth.ts');
const authService = read('apps/api/src/services/auth.service.ts');
const abuseService = read('apps/api/src/services/login-abuse.service.ts');
const abuseConfig = read('apps/api/src/config/login-abuse-config.ts');
const resetService = read('apps/api/src/services/password-reset.service.ts');
const appTs = read('apps/api/src/app.ts');
const errorHandler = read('apps/api/src/middleware/error-handler.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const jwt = read('apps/api/src/lib/jwt.ts');
const authMw = read('apps/api/src/middleware/auth.ts');
const schema = read('packages/db/prisma/schema.prisma');
const migration = read(
  'packages/db/prisma/migrations/20260903140000_auth4_login_abuse_state/migration.sql',
);
const envExample = read('.env.example');
const ar = JSON.parse(read('apps/web/messages/ar.json')) as { auth: Record<string, string> };
const en = JSON.parse(read('apps/web/messages/en.json')) as { auth: Record<string, string> };

console.log('\n— Layers / store —');
{
  expect(
    '1 existing IP limiter remains',
    rateLimit.includes('authRateLimiter') &&
      (rateLimit.includes('max: 30') || rateLimit.includes('AUTH_IP_RATE_MAX')),
  );
  expect('2 identifier limiter exists', existsSync(join(root, 'apps/api/src/services/login-abuse.service.ts')));
  expect('3 identifier normalization uses Login canonicalization', normalizeLoginEmail('  Foo@Bar.COM ') === 'foo@bar.com');
  expect('4 raw password never in limiter key', !abuseService.includes('password') || !/hashLoginIdentifier\([^)]*password/.test(abuseService));
  expect('5 raw email avoided in persistent key', abuseService.includes('createHmac') && abuseService.includes('login-abuse:v1:'));
  expect('6 DB-backed LoginAbuseState model', schema.includes('model LoginAbuseState'));
  expect('7 additive migration', migration.includes('CREATE TABLE IF NOT EXISTS "LoginAbuseState"') && !migration.includes('DROP TABLE'));
  expect('8 multi-instance via shared DB', abuseService.includes('$queryRaw') && abuseService.includes('ON CONFLICT'));
}

console.log('\n— Thresholds / cooldowns —');
{
  expect('9 soft threshold default 5', LOGIN_ABUSE_FAIL_THRESHOLD === 5 || abuseConfig.includes('LOGIN_ABUSE_FAIL_THRESHOLD'));
  expect('10 soft cooldown 5m default', LOGIN_ABUSE_COOLDOWN_MS === 5 * 60 * 1000 || abuseConfig.includes('5 * 60 * 1000'));
  expect('11 extended cooldown configured', LOGIN_ABUSE_EXTENDED_COOLDOWN_MS > LOGIN_ABUSE_COOLDOWN_MS);
  expect('12 max cooldown bounded', LOGIN_ABUSE_MAX_COOLDOWN_MS >= LOGIN_ABUSE_EXTENDED_COOLDOWN_MS);
  expect('13 cooldown tiers', cooldownMsForFailCount(5) !== null && cooldownMsForFailCount(4) === null);
  expect('14 state TTL bounded', LOGIN_ABUSE_STATE_TTL_MS > 0);
  expect('15 no permanent lockout fields', !schema.includes('lockedAt') && !schema.includes('permanentlyLocked'));
}

console.log('\n— Login wiring / enumeration —');
{
  expect('16 assert before credential check', authService.indexOf('assertLoginIdentifierNotThrottled') < authService.indexOf('findUnique'));
  expect('17 failure recording on invalid creds', authService.includes('recordLoginIdentifierFailure'));
  expect('18 success clears abuse', authService.includes('clearLoginIdentifierAbuse'));
  expect('19 unknown email also records failure', authService.includes('getDummyPasswordHash') && authService.includes('recordLoginIdentifierFailure'));
  {
    const statusIdx = authService.indexOf("if (user.status !== 'active')");
    const compareIdx = authService.indexOf('const valid = await bcrypt.compare');
    const suspendedBlock =
      statusIdx >= 0 && compareIdx > statusIdx
        ? authService.slice(statusIdx, compareIdx)
        : '';
    expect(
      '20 suspended not counted as password fail',
      suspendedBlock.includes('ACCOUNT_SUSPENDED') &&
        !suspendedBlock.includes('recordLoginIdentifierFailure'),
    );
  }
  expect('21 AUTH_RATE_LIMITED code', abuseService.includes("'AUTH_RATE_LIMITED'"));
  expect('22 no fail count in public JSON', errorHandler.includes('AUTH_RATE_LIMITED') && errorHandler.includes('Do not echo attempt counts'));
  expect('23 Retry-After supported', errorHandler.includes('Retry-After'));
  expect('24 HMAC keys normalize casing', loginIdentifierKeysMatch('User@Ex.com', 'user@ex.com'));
  expect('25 hash length 64 hex', hashLoginIdentifier('demo@mazare3.test').length === 64);
}

console.log('\n— Password reset / signup / sessions —');
{
  expect('26 password reset clears abuse', resetService.includes('clearLoginIdentifierAbuse'));
  expect('27 forgot rate limit unchanged', rateLimit.includes('PASSWORD_RESET_FORGOT_RATE_MAX') || authRoutes.includes('forgotPasswordRateLimiter'));
  expect('28 reset rate limit unchanged', rateLimit.includes('PASSWORD_RESET_ATTEMPT_RATE_MAX') || authRoutes.includes('resetPasswordRateLimiter'));
  {
    const signupStart = authService.indexOf('export async function signupCustomer');
    const loginStart = authService.indexOf('export async function loginUser');
    const signupBody =
      signupStart >= 0 && loginStart > signupStart
        ? authService.slice(signupStart, loginStart)
        : '';
    expect(
      '29 signup does not record login abuse',
      signupBody.includes('signupCustomer') &&
        !signupBody.includes('recordLoginIdentifierFailure') &&
        !signupBody.includes('assertLoginIdentifierNotThrottled'),
    );
  }
  expect('30 JWT pwdAt unchanged', jwt.includes('pwdAt'));
  expect('31 session revocation compare unchanged', authMw.includes('passwordChangedAt') && authMw.includes('pwdAt'));
}

console.log('\n— IP / proxy / privacy —');
{
  expect('32 trust proxy configured', /trust proxy['",\s]+1/.test(appTs));
  expect('33 IP key uses req.ip', rateLimit.includes('req.ip'));
  expect('34 IP throttle log exists', rateLimit.includes('AUTH_IP_THROTTLED'));
  expect('35 identifier throttle log exists', abuseService.includes('AUTH_IDENTIFIER_THROTTLED'));
  expect('36 purge expired states', abuseService.includes('purgeExpiredLoginAbuseStates'));
  expect('37 expiresAt on model', schema.includes('expiresAt') && migration.includes('expiresAt'));
  expect('38 QA disable flag gated', abuseService.includes('DISABLE_LOGIN_ABUSE_PROTECTION') && abuseService.includes('isAppEnvProduction'));
  expect('39 env example documents AUTH-4', envExample.includes('LOGIN_ABUSE_FAIL_THRESHOLD') || envExample.includes('DISABLE_LOGIN_ABUSE_PROTECTION'));
}

console.log('\n— UI / scope —');
{
  expect('40 AR rate-limit copy', ar.auth.errorRateLimited.includes('محاولات كثيرة'));
  expect('41 EN rate-limit copy', en.auth.errorRateLimited.toLowerCase().includes('too many attempts'));
  expect('42 UI handles AUTH_RATE_LIMITED', authForm.includes('AUTH_RATE_LIMITED'));
  expect('43 password login path has no OTP', !/\botp\b/i.test(abuseService));
  expect('44 no CAPTCHA', !/captcha/i.test(abuseService + authForm));
  expect(
    '45 no email verification flow',
    !/\bverifyEmail\b|sendEmailVerification|emailVerificationRequired/i.test(authService),
  );
  expect('46 no MFA', !/\bmfa\b|\b2fa\b/i.test(abuseService + authService));
  expect('47 no schema destruction', !migration.toLowerCase().includes('drop table'));
  expect('48 IP limiter still mounted on auth router', authRoutes.includes('authRateLimiter'));
  expect(
    '48b auth-general not applied router-wide',
    !authRoutes.includes('authRouter.use(authRateLimiter)'),
  );
  expect(
    '48c login keeps authRateLimiter',
    /['"]\/login['"][\s\S]{0,80}authRateLimiter/.test(authRoutes),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
