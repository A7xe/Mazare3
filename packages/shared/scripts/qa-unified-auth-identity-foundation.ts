/**
 * UA-1 — Unified Auth identity foundation QA.
 * Run: pnpm --filter @mazare3/api exec tsx ../../packages/shared/scripts/qa-unified-auth-identity-foundation.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signupSchema, loginSchema, forgotPasswordSchema } from '../src/schemas/auth.ts';
import {
  findNormalizedEmailCollisions,
  normalizeLoginEmail,
} from '../../../scripts/ua1-password-identity-backfill.mjs';

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
  'packages/db/prisma/migrations/20260905120000_ua1_auth_identity_foundation/migration.sql',
);
const authService = read('apps/api/src/services/auth.service.ts');
const authRoutes = read('apps/api/src/routes/auth.ts');
const jwt = read('apps/api/src/lib/jwt.ts');
const loginAbuse = read('apps/api/src/services/login-abuse.service.ts');
const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const passwordReset = read('apps/api/src/services/password-reset.service.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const loginPage = read('apps/web/src/app/[locale]/login/page.tsx');
const signupPage = read('apps/web/src/app/[locale]/signup/page.tsx');
const envExample = existsSafe('.env.example');
const apiAuth = read('apps/web/src/lib/api-auth.ts');

function existsSafe(rel: string) {
  try {
    return read(rel);
  } catch {
    return '';
  }
}

console.log('\n— Schema / AuthIdentity —');
{
  expect('1 AuthIdentity model', schema.includes('model AuthIdentity'));
  expect('2 User authIdentities relation', schema.includes('authIdentities'));
  expect('3 provider+subject unique', schema.includes('@@unique([provider, providerSubject])'));
  expect('4 password provider enum', schema.includes('password') && schema.includes('AuthIdentityProvider'));
  expect('5 phone provider', /enum AuthIdentityProvider[\s\S]*phone/.test(schema));
  expect('6 google provider', /enum AuthIdentityProvider[\s\S]*google/.test(schema));
  expect('7 User.email nullable', /email\s+String\?\s+@unique/.test(schema));
  expect('8 passwordHash nullable', schema.includes('passwordHash     String?'));
  expect('9 verifiedAt optional', schema.includes('verifiedAt      DateTime?'));
  expect('10 legacy externalAuth unchanged', schema.includes('externalAuthId') && schema.includes('externalProvider'));
  expect('11 no User.phone unique', !/phone\s+String[^\n]*@unique/.test(schema));
}

console.log('\n— OtpChallenge foundation —');
{
  const otpBlock = schema.match(/model OtpChallenge \{[\s\S]*?\n\}/)?.[0] ?? '';
  expect('12 OtpChallenge model', schema.includes('model OtpChallenge'));
  expect('13 no plaintext code column', !/\bcode\s+String\b/.test(otpBlock));
  expect('13b codeHash only', otpBlock.includes('codeHash'));
  expect('14 expiresAt', otpBlock.includes('expiresAt'));
  expect('15 consumedAt', otpBlock.includes('consumedAt'));
  expect('16 attempts', otpBlock.includes('attempts'));
  expect('17 purpose enum', schema.includes('OtpChallengePurpose') && schema.includes('auth_continue'));
  expect('18 identifierHash', otpBlock.includes('identifierHash'));
  expect('19 no raw phone field on challenge', !/\bphone\s+String\b/.test(otpBlock));
}

console.log('\n— Migration safety —');
{
  expect('20 additive migration', migration.includes('AuthIdentity') && migration.includes('OtpChallenge'));
  expect('21 DROP NOT NULL email', migration.includes('ALTER COLUMN "email" DROP NOT NULL'));
  expect('22 no DROP TABLE', !/\bDROP\s+TABLE\b/i.test(migration));
  expect('23 no role mutation', !/\bALTER\s+TYPE\s+"UserRole"/i.test(migration));
}

console.log('\n— Signup / password identity —');
{
  expect('24 signup requires email', !signupSchema.safeParse({ password: 'password1' }).success);
  expect('25 signup requires password', !signupSchema.safeParse({ email: 'a@b.co' }).success);
  expect(
    '26 signup customer-only in service',
    authService.includes("role: 'customer'") && !authService.includes('role: input'),
  );
  expect(
    '27 password identity on signup',
    authService.includes('authIdentity.create') && authService.includes('AuthIdentityProvider.password'),
  );
  expect('28 verifiedAt null on signup identity', authService.includes('verifiedAt: null'));
  expect('29 ensurePasswordAuthIdentity helper', authService.includes('ensurePasswordAuthIdentity'));
  expect('30 no silent userId reassignment', !authService.includes('update: {\n      userId'));
}

console.log('\n— Session / AuthUser null email —');
{
  expect('31 SessionPayload email null', jwt.includes('email: string | null'));
  expect('32 AuthUser email null', apiAuth.includes('email: string | null'));
  expect('33 login schema still requires email', loginSchema.safeParse({ email: 'a@b.co', password: 'x' }).success);
}

console.log('\n— Phone + Google backends exist; unified UI not yet —');
{
  expect(
    '34 phone OTP routes exist post-UA-2',
    authRoutes.includes('/phone/start') &&
      authRoutes.includes('/phone/verify') &&
      authRoutes.includes('/phone/complete'),
  );
  expect(
    '35 google OIDC routes exist post-UA-3',
    authRoutes.includes('/google/start') && authRoutes.includes('/google/callback'),
  );
  expect('36 login redirects to unified auth', loginPage.includes('redirect') && loginPage.includes('/auth'));
  expect('37 signup redirects to unified auth', signupPage.includes('redirect') && signupPage.includes('/auth'));
  expect('38 unified /auth page exists (UA-6)', (() => {
    try {
      read('apps/web/src/app/[locale]/auth/page.tsx');
      return true;
    } catch {
      return false;
    }
  })());
  expect(
    '39 Google env documented disabled by default',
    /GOOGLE_AUTH_ENABLED=false/.test(envExample) && /GOOGLE_CLIENT_ID/.test(envExample),
  );
  expect(
    '40 no paid SMS vendor env',
    !/TWILIO|MSG91|VONAGE|NEXMO|MESSAGEBIRD/i.test(envExample) && /SMS_OTP_PROVIDER/i.test(envExample),
  );
}

console.log('\n— Partner phones not auth —');
{
  expect('41 OwnerProfile.phone remains contact', schema.includes('phone                String // never exposed'));
  expect('42 operatingPhone remains', schema.includes('operatingPhone'));
  expect('43 backfill script ignores partner phones', (() => {
    const bf = read('scripts/ua1-password-identity-backfill.mjs');
    return !bf.includes('OwnerProfile') && !bf.includes('operatingPhone');
  })());
}

console.log('\n— AUTH-4 / AUTH-5 preserved —');
{
  expect('44 normalizeLoginEmail trim+lower', loginAbuse.includes('toLowerCase().trim()'));
  expect('45 AUTH-4 LoginAbuseState', schema.includes('model LoginAbuseState'));
  expect('46 AUTH-5 RateLimitBucket', schema.includes('model RateLimitBucket'));
  expect('47 authRateLimiter present', rateLimit.includes('authRateLimiter'));
  expect('48 forgot password generic', passwordReset.includes('If an account exists'));
}

console.log('\n— Collision preflight helper —');
{
  const collide = findNormalizedEmailCollisions([
    { id: '1', email: 'User@Example.com' },
    { id: '2', email: 'user@example.com' },
  ]);
  expect('49 detects normalized collision', !collide.ok && collide.collisionGroupCount === 1);
  const clean = findNormalizedEmailCollisions([
    { id: '1', email: 'a@example.com' },
    { id: '2', email: 'b@example.com' },
  ]);
  expect('50 clean set passes', clean.ok);
  expect('51 normalize matches login', normalizeLoginEmail('  Foo@Bar.COM ') === 'foo@bar.com');
}

console.log('\n— Auth form still email/password —');
{
  expect('52 auth form has email field', authForm.includes('email') && authForm.includes('password'));
  expect('53 no google button in auth form', !/google|apple|facebook/i.test(authForm));
}

console.log(`\n📊 UA-1 foundation: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
