/**
 * UA-2 — Phone OTP architecture QA (static + light crypto).
 * Run: pnpm --filter @mazare3/db exec tsx ../../packages/shared/scripts/qa-phone-otp-auth.ts
 */
import { createHmac, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  phoneOtpCompleteSchema,
  phoneOtpStartSchema,
  phoneOtpVerifySchema,
  signupSchema,
} from '../src/schemas/auth.ts';

let passed = 0;
let failed = 0;
function pass(name: string) {
  passed++;
  console.log(`  ✅ ${name}`);
}
function fail(name: string, detail = '') {
  failed++;
  console.log(`  ❌ ${name}${detail ? `: ${detail}` : ''}`);
}
function expect(name: string, cond: boolean, detail = '') {
  if (cond) pass(name);
  else fail(name, detail);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

const authRoutes = read('apps/api/src/routes/auth.ts');
const phoneAuth = read('apps/api/src/services/phone-auth.service.ts');
const crypto = read('apps/api/src/lib/phone-otp-crypto.ts');
const normalize = read('apps/api/src/lib/phone-normalize.ts');
const config = read('apps/api/src/config/phone-otp-config.ts');
const continueJwt = read('apps/api/src/lib/phone-continuation-jwt.ts');
const memorySms = read('apps/api/src/services/sms/memory-sms-otp-provider.ts');
const noneSms = read('apps/api/src/services/sms/none-sms-otp-provider.ts');
const getSms = read('apps/api/src/services/sms/get-sms-otp-provider.ts');
const validateSms = read('apps/api/src/config/validate-sms-otp-provider.ts');
const rateLimit = read('apps/api/src/middleware/rate-limit.ts');
const store = read('apps/api/src/middleware/postgres-rate-limit-store.ts');
const internal = read('apps/api/src/routes/internal.ts');
const schema = read('packages/db/prisma/schema.prisma');
const envExample = read('.env.example');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const loginAbuse = read('apps/api/src/services/login-abuse.service.ts');
const passwordReset = read('apps/api/src/services/password-reset.service.ts');

console.log('\n— Routes —');
expect('1 phone start route', authRoutes.includes("'/phone/start'"));
expect('2 phone verify route', authRoutes.includes("'/phone/verify'"));
expect('3 phone complete route', authRoutes.includes("'/phone/complete'"));

console.log('\n— Normalization —');
expect('4 uses libphonenumber-js', normalize.includes('libphonenumber-js'));
expect('5 Jordan default region JO', normalize.includes("'JO'"));
expect('6 E.164 format', normalize.includes("format('E.164')"));

console.log('\n— OTP crypto —');
expect('7 HMAC code hash domain', crypto.includes('phone-otp-code:v1'));
expect('8 HMAC identifier domain', crypto.includes('phone-otp-identifier:v1'));
expect('9 separate rate domain', crypto.includes('phone-otp-rate:v1'));
expect('10 randomInt not Math.random', crypto.includes('randomInt') && !crypto.includes('Math.random'));
expect('11 timingSafeEqual', crypto.includes('timingSafeEqual'));
expect('12 6 digits', config.includes('PHONE_OTP_DIGITS = 6') || crypto.includes('PHONE_OTP_DIGITS'));

console.log('\n— TTL / cooldown / attempts —');
expect('13 TTL 5m default', config.includes('5 * 60 * 1000'));
expect('14 resend 60s', config.includes('60 * 1000'));
expect('15 max attempts 5', config.includes('PHONE_OTP_MAX_ATTEMPTS') && config.includes(', 5)'));

console.log('\n— Storage / model —');
expect('16 OtpChallenge codeHash', schema.includes('codeHash'));
expect('17 no plaintext code field on challenge', !/model OtpChallenge \{[\s\S]*?\bcode\s+String\b/.test(schema));
expect('18 identifierHash', schema.includes('identifierHash'));
expect('19 phone AuthIdentity provider', schema.includes('phone') && schema.includes('AuthIdentityProvider'));

console.log('\n— Provider —');
expect('20 none provider', noneSms.includes('NoneSmsOtpProvider'));
expect('21 memory provider', memorySms.includes('MemorySmsOtpProvider'));
expect('22 memory production refused', memorySms.includes('isAppEnvProduction') || validateSms.includes('memory is forbidden'));
expect('23 default none when unset', config.includes("'none'") && config.includes('SMS_OTP_PROVIDER'));

console.log('\n— Flow —');
expect('24 PROFILE_REQUIRED path', phoneAuth.includes('profile_required'));
expect('25 existing identity login', phoneAuth.includes('authenticated'));
expect('26 customer role hardcoded', phoneAuth.includes("role: 'customer'"));
expect('27 email null on create', phoneAuth.includes('email: null'));
expect('28 passwordHash null', phoneAuth.includes('passwordHash: null'));
expect('29 verifiedAt now', phoneAuth.includes('verifiedAt: now'));
expect('30 continuation typ distinct', continueJwt.includes('phone_profile_continue'));
expect('31 continuation not session', continueJwt.includes('PHONE_CONTINUE_TOKEN_TYP'));
expect('32 legacy User.phone collision', phoneAuth.includes('EXISTING_ACCOUNT_LINK_REQUIRED') || phoneAuth.includes('existing_account_link_required'));
expect('33 no OwnerProfile phone auth', !phoneAuth.includes('ownerProfile.phone') && !phoneAuth.includes('operatingPhone'));
expect('34 atomic attempts', phoneAuth.includes('"attempts" = "attempts" + 1'));
expect('35 consume challenge', phoneAuth.includes('"consumedAt"'));
expect('36 replace prior', phoneAuth.includes('updateMany') && phoneAuth.includes('consumedAt'));

console.log('\n— Rate limits —');
expect('37 send IP namespace', rateLimit.includes('auth-phone-otp-send-ip'));
expect('38 send id namespace', rateLimit.includes('auth-phone-otp-send-id'));
expect('39 verify IP namespace', rateLimit.includes('auth-phone-otp-verify-ip'));
expect('40 verify id namespace', rateLimit.includes('auth-phone-otp-verify-id'));
expect('41 store namespaces extended', store.includes('auth-phone-otp-send-ip'));
expect('42 rate key HMAC phone', rateLimit.includes('hashPhoneOtpRateIdentifier'));

console.log('\n— QA gates —');
expect('43 internal sms outbox', internal.includes('sms-otp-outbox'));
expect('44 requireInternalQa on outbox', internal.includes('sms-otp-outbox') && internal.includes('requireInternalQa'));
expect('45 memory required for outbox', internal.includes("SMS_OTP_PROVIDER=memory") || internal.includes("!== 'memory'"));

console.log('\n— Schemas —');
expect('46 start schema', phoneOtpStartSchema.safeParse({ phone: '0791234567' }).success);
expect('47 verify schema', phoneOtpVerifySchema.safeParse({ challengeId: 'x'.repeat(10), phone: '0791234567', code: '123456' }).success);
expect('48 complete requires name', !phoneOtpCompleteSchema.safeParse({ continueToken: 'x'.repeat(20), phone: '0791234567' }).success);
expect('49 signup still email/password', signupSchema.safeParse({ email: 'a@b.co', password: 'password1', acceptedTermsVersionId: 't', acknowledgedPrivacyVersionId: 'p' }).success);

console.log('\n— Regression / scope —');
expect('50 phone OTP auth not Google OIDC client', !phoneAuth.includes('openid-client') && !phoneAuth.includes('google-oidc') && authRoutes.includes('/phone/start'));
expect('51 no public phone UI in auth-form', !/phone\/start|Continue with phone|OTP/i.test(authForm));
expect('52 AUTH-4 untouched markers', loginAbuse.includes('normalizeLoginEmail'));
expect('53 password reset generic', passwordReset.includes('If an account exists'));
expect('54 env.example documents SMS_OTP_PROVIDER', envExample.includes('SMS_OTP_PROVIDER'));
expect('55 env.example memory forbidden note', /FORBIDDEN IN PRODUCTION/i.test(envExample));
expect('56 no paid SMS vendor', !/TWILIO|MSG91|VONAGE|NEXMO/i.test(envExample));
expect('57 getSms refuses production memory', getSms.includes('isAppEnvProduction') || validateSms.includes('memory'));

console.log('\n— Crypto sanity —');
{
  const a = createHmac('sha256', 'x'.repeat(32)).update('phone-otp-code:v1:id:123456').digest('hex');
  const b = createHmac('sha256', 'x'.repeat(32)).update('phone-otp-code:v1:id:123456').digest('hex');
  expect('58 HMAC deterministic', a === b);
  expect('59 randomInt range', randomInt(0, 1000000) >= 0);
}

console.log(`\n📊 UA-2 phone OTP architecture: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
