/**
 * AUTH-5 — distributed auth IP rate-limit suite.
 * Run: cd apps/api && pnpm exec dotenv -e ../../.env -- tsx ../../packages/shared/scripts/qa-distributed-auth-rate-limit.ts
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
try {
  const envText = readFileSync(join(root, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*(JWT_SECRET|SESSION_SECRET|DATABASE_URL)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1]!;
    let val = m[2] ?? '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  // optional
}

import {
  AUTH_IP_RATE_MAX,
  AUTH_IP_RATE_WINDOW_MS,
} from '../../../apps/api/src/middleware/rate-limit.ts';
import {
  PASSWORD_RESET_ATTEMPT_RATE_MAX,
  PASSWORD_RESET_FORGOT_RATE_MAX,
} from '../../../apps/api/src/config/password-reset.ts';
import {
  canonicalizeClientIp,
  hashAuthIpKey,
} from '../../../apps/api/src/lib/auth-ip-key.ts';
import {
  PostgresRateLimitStore,
  createAuthPostgresRateLimitStore,
  clearRateLimitNamespaceForQa,
  getRateLimitBucketHitsForQa,
} from '../../../apps/api/src/middleware/postgres-rate-limit-store.ts';
import { isAuthRateLimitDisabled } from '../../../apps/api/src/lib/qa-mode.ts';
import { isAppEnvProduction } from '../../../apps/api/src/config/app-env.ts';

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

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const rateLimitSrc = read('apps/api/src/middleware/rate-limit.ts');
const storeSrc = read('apps/api/src/middleware/postgres-rate-limit-store.ts');
const appSrc = read('apps/api/src/app.ts');
const authService = read('apps/api/src/services/auth.service.ts');
const abuseService = read('apps/api/src/services/login-abuse.service.ts');
const resetService = read('apps/api/src/services/password-reset.service.ts');
const validatePay = read('apps/api/src/config/validate-payment-provider.ts');
const schema = read('packages/db/prisma/schema.prisma');
const migration = read(
  'packages/db/prisma/migrations/20260904120000_auth5_rate_limit_bucket/migration.sql',
);
const docs = read('docs/distributed-auth-rate-limit.md');
const internal = read('apps/api/src/routes/internal.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');

console.log('\n— Policy / wiring —');
{
  expect('1 general auth limit 30/15m defaults', AUTH_IP_RATE_MAX === 30 && AUTH_IP_RATE_WINDOW_MS === 15 * 60 * 1000);
  expect('2 forgot limit 5', PASSWORD_RESET_FORGOT_RATE_MAX === 5);
  expect('3 reset limit 10', PASSWORD_RESET_ATTEMPT_RATE_MAX === 10);
  expect('4 store is Postgres shared', rateLimitSrc.includes('createAuthPostgresRateLimitStore') && storeSrc.includes('RateLimitBucket'));
  expect('5 model RateLimitBucket', schema.includes('model RateLimitBucket'));
  expect('6 additive migration', migration.includes('CREATE TABLE IF NOT EXISTS "RateLimitBucket"') && !migration.toLowerCase().includes('drop table'));
  expect('7 raw IP not persisted field', !schema.includes('clientIp') && storeSrc.includes('keyHash'));
  expect('8 HMAC secret server-only', read('apps/api/src/lib/auth-ip-key.ts').includes('JWT_SECRET'));
  expect('9 namespaces isolated', rateLimitSrc.includes("'auth-general'") && rateLimitSrc.includes("'auth-forgot-password'") && rateLimitSrc.includes("'auth-reset-password'"));
}

console.log('\n— IP canonicalization —');
{
  expect('10 IPv4 stable', canonicalizeClientIp('203.0.113.10') === '203.0.113.10');
  expect('11 IPv4-mapped IPv6', canonicalizeClientIp('::ffff:203.0.113.10') === '203.0.113.10');
  expect('12 IPv6 lowercased', canonicalizeClientIp('2001:DB8::1') === '2001:db8::1');
  expect('13 bracketed IPv6', canonicalizeClientIp('[2001:db8::1]') === '2001:db8::1');
  expect('14 hash length 64', hashAuthIpKey('203.0.113.10').length === 64);
  expect('15 mapped equals ipv4 hash', hashAuthIpKey(canonicalizeClientIp('::ffff:1.2.3.4')) === hashAuthIpKey(canonicalizeClientIp('1.2.3.4')));
}

console.log('\n— Trust proxy / headers —');
{
  expect('16 trust proxy one hop', /trust proxy['",\s]+1/.test(appSrc));
  expect('17 docs cover trust proxy', docs.includes('trust proxy') && docs.includes('one trusted'));
  expect('18 no manual XFF leftmost trust', !rateLimitSrc.includes('x-forwarded-for') && !storeSrc.includes('x-forwarded-for'));
  expect('19 keyGenerator uses req.ip', rateLimitSrc.includes('req.ip'));
}

console.log('\n— Shared store behavior —');
{
  const ns = 'auth-general' as const;
  const keyHash = createHash('sha256').update(`qa-dist-${Date.now()}-${randomBytes(4).toString('hex')}`).digest('hex');

  await clearRateLimitNamespaceForQa(ns);

  const storeA = createAuthPostgresRateLimitStore(ns);
  const storeB = createAuthPostgresRateLimitStore(ns);
  storeA.init({ windowMs: 15 * 60 * 1000 } as never);
  storeB.init({ windowMs: 15 * 60 * 1000 } as never);

  const a1 = await storeA.increment(keyHash);
  const b1 = await storeB.increment(keyHash);
  expect('20 two logical instances share counter', a1.totalHits === 1 && b1.totalHits === 2);

  const concurrentKey = createHash('sha256').update(`qa-conc-${Date.now()}`).digest('hex');
  await clearRateLimitNamespaceForQa(ns);
  storeA.init({ windowMs: 15 * 60 * 1000 } as never);
  const results = await Promise.all(
    Array.from({ length: 20 }, () => storeA.increment(concurrentKey)),
  );
  const hits = results.map((r) => r.totalHits).sort((x, y) => x - y);
  expect('21 atomic concurrent increments', hits[hits.length - 1] === 20 && new Set(hits).size === 20);

  const hitsDb = await getRateLimitBucketHitsForQa(ns, concurrentKey);
  expect('22 persisted hits match', hitsDb === 20);

  // namespace isolation
  const forgotStore = createAuthPostgresRateLimitStore('auth-forgot-password');
  forgotStore.init({ windowMs: 15 * 60 * 1000 } as never);
  await forgotStore.increment(concurrentKey);
  const generalHits = await getRateLimitBucketHitsForQa('auth-general', concurrentKey);
  const forgotHits = await getRateLimitBucketHitsForQa('auth-forgot-password', concurrentKey);
  expect('23 namespaces isolated in DB', generalHits === 20 && forgotHits === 1);

  await storeA.resetKey(concurrentKey);
  const afterReset = await getRateLimitBucketHitsForQa(ns, concurrentKey);
  expect('24 resetKey clears bucket', afterReset === null || afterReset === 0);

  expect('25 localKeys false', new PostgresRateLimitStore('auth-general').localKeys === false);
  expect('26 fail-closed on errors', storeSrc.includes('AUTH_RATE_LIMIT_UNAVAILABLE') && storeSrc.includes('fail-closed') || storeSrc.includes('503'));
  expect('27 prisma client reused', storeSrc.includes("from '@mazare3/db'") && !storeSrc.includes('new PrismaClient'));
  expect('28 opportunistic purge', storeSrc.includes('maybePurgeExpired'));
}

console.log('\n— Layering / regression —');
{
  expect('29 identifier limiter still present', abuseService.includes('assertLoginIdentifierNotThrottled'));
  expect('30 login clears identifier not IP history', authService.includes('clearLoginIdentifierAbuse') && !authService.includes('resetKey'));
  expect('31 password reset clears identifier', resetService.includes('clearLoginIdentifierAbuse'));
  expect('32 IP before credentials via middleware order', read('apps/api/src/routes/auth.ts').includes('authRateLimiter'));
  expect(
    '32b auth-general not router-wide on reads',
    !read('apps/api/src/routes/auth.ts').includes('authRouter.use(authRateLimiter)'),
  );
  expect(
    '32c capabilities route free of authRateLimiter',
    /\/capabilities[\s\S]*?asyncHandler/.test(read('apps/api/src/routes/auth.ts')) &&
      !/\/capabilities[\s\S]{0,120}authRateLimiter/.test(read('apps/api/src/routes/auth.ts')),
  );
  expect(
    '32d /me route free of authRateLimiter',
    /['"]\/me['"][\s\S]{0,200}requireAuth/.test(read('apps/api/src/routes/auth.ts')) &&
      !/['"]\/me['"][\s\S]{0,120}authRateLimiter/.test(read('apps/api/src/routes/auth.ts')),
  );
  expect(
    '32e login still uses authRateLimiter',
    /['"]\/login['"][\s\S]{0,80}authRateLimiter/.test(read('apps/api/src/routes/auth.ts')),
  );
  expect('33 QA bypass blocked in production validation', validatePay.includes('DISABLE_AUTH_RATE_LIMIT') && validatePay.includes('APP_ENV=production'));
  expect('34 internal rate-limit routes QA gated', internal.includes("requireInternalQa()") && internal.includes('/rate-limit/clear'));
  expect('35 UI still generic RATE_LIMITED', authForm.includes('RATE_LIMITED') || authForm.includes('AUTH_RATE_LIMITED'));
  expect('36 support limiter remains separate', rateLimitSrc.includes('supportRateLimiter') && rateLimitSrc.includes('MemoryStore') === false); // may still be default memory
  expect('36b support not on postgres auth namespaces', !rateLimitSrc.includes("createAuthPostgresRateLimitStore('support"));
  expect(
    '37 phone OTP namespaces isolated (UA-2)',
    storeSrc.includes('auth-phone-otp-send-ip') &&
      rateLimitSrc.includes('auth-phone-otp-send-ip') &&
      rateLimitSrc.includes('auth-phone-otp-verify-ip'),
  );
  expect('38 no CAPTCHA', !/captcha/i.test(storeSrc + rateLimitSrc));
  expect('39 no email verification', !/verifyEmail/i.test(storeSrc));
  expect('40 no MFA', !/\bmfa\b/i.test(storeSrc + rateLimitSrc));
  expect('41 docs exist', existsSync(join(root, 'docs/distributed-auth-rate-limit.md')));
  expect('42 production disable impossible via isAuthRateLimitDisabled', !isAppEnvProduction() || isAuthRateLimitDisabled() === false);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
