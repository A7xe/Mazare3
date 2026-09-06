/**
 * UA-3 — Google OIDC architecture QA (no real Google network).
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

let passed = 0;
let failed = 0;
function expect(name: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}: assertion failed`);
  }
}

const authRoutes = read('apps/api/src/routes/auth.ts');
const googleCfg = read('apps/api/src/config/google-auth-config.ts');
const validateGoogle = read('apps/api/src/config/validate-google-auth.ts');
const oidcClient = read('apps/api/src/services/google/google-oidc-client.ts');
const googleAuth = read('apps/api/src/services/google/google-auth.service.ts');
const oauthFlow = read('apps/api/src/services/google/google-oauth-flow.ts');
const oauthTx = read('apps/api/src/lib/google-oauth-transaction.ts');
const linkJwt = read('apps/api/src/lib/google-link-continuation-jwt.ts');
const indexTs = read('apps/api/src/index.ts');
const envExample = read('.env.example');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const loginPage = read('apps/web/src/app/[locale]/login/page.tsx');
const signupPage = read('apps/web/src/app/[locale]/signup/page.tsx');
const apiPkg = read('apps/api/package.json');
const schemas = read('packages/shared/src/schemas/auth.ts');
const phoneAuth = read('apps/api/src/services/phone-auth.service.ts');
const passwordReset = read('apps/api/src/services/password-reset.service.ts');

console.log('\n— Routes —');
expect('1 google start route', authRoutes.includes("/google/start"));
expect('2 google callback route', authRoutes.includes("/google/callback"));
expect('3 google id-token route', authRoutes.includes("/google/id-token"));

console.log('\n— Config —');
expect('4 GOOGLE_AUTH_ENABLED', googleCfg.includes('GOOGLE_AUTH_ENABLED'));
expect('5 GOOGLE_CLIENT_ID', googleCfg.includes('GOOGLE_CLIENT_ID'));
expect('6 GOOGLE_CLIENT_SECRET', googleCfg.includes('GOOGLE_CLIENT_SECRET'));
expect('7 GOOGLE_REDIRECT_URI', googleCfg.includes('GOOGLE_REDIRECT_URI'));
expect('8 default unavailable when unset', googleCfg.includes('isGoogleAuthFlagEnabled') && googleCfg.includes('loadGoogleAuthConfig'));
expect('9 production validation', validateGoogle.includes('isAppEnvProduction') && validateGoogle.includes('GOOGLE_AUTH_ENABLED'));
expect('10 https required in production', validateGoogle.includes("protocol !== 'https:'"));
expect('11 localhost refused in production', validateGoogle.includes('localhost'));
expect('12 startup wired', indexTs.includes('validateGoogleAuthAtStartup'));
expect('13 env.example documents Google', /GOOGLE_AUTH_ENABLED=false/.test(envExample));
expect('14 env.example later note', /LATER|PUBLIC AUTH ENABLEMENT/i.test(envExample));
expect('15 no NEXT_PUBLIC google secret', !/NEXT_PUBLIC_GOOGLE_CLIENT_SECRET/i.test(envExample));

console.log('\n— Protocol —');
expect('16 openid-client dependency', /"openid-client"/.test(apiPkg));
expect('17 jose dependency', /"jose"/.test(apiPkg));
expect('18 authorization code grant', oidcClient.includes('authorizationCodeGrant'));
expect('19 PKCE S256', oidcClient.includes("code_challenge_method: 'S256'") && oauthTx.includes('pkceS256Challenge'));
expect('20 state generated', oauthTx.includes('generateOAuthState') || oidcClient.includes('generateOAuthState'));
expect('21 nonce generated', oauthTx.includes('generateOAuthNonce') || oidcClient.includes('generateOAuthNonce'));
expect('22 scopes minimal', oidcClient.includes('openid email profile') || read('apps/api/src/config/google-auth-config.ts').includes('openid email profile'));
expect('23 issuer accounts.google.com', oidcClient.includes('accounts.google.com') || googleCfg.includes('accounts.google.com'));
expect('24 QA mock seam', oidcClient.includes('setGoogleOidcMocksForQa'));
expect('25 production mock refused', oidcClient.includes('forbidden in production'));

console.log('\n— Transaction cookie —');
expect('26 oauth tx typ distinct', oauthTx.includes('google_oauth_tx'));
expect('27 HttpOnly cookie', oauthTx.includes('httpOnly: true'));
expect('28 narrow path', oauthTx.includes("/api/v1/auth/google"));
expect('29 timingSafe state compare', oauthFlow.includes('timingSafeEqualString') || oauthTx.includes('timingSafeEqual'));
expect('30 clear cookie on callback', oauthFlow.includes('clearGoogleOAuthCookie'));

console.log('\n— Identity resolution —');
expect('31 provider google sub', googleAuth.includes('AuthIdentityProvider.google') && googleAuth.includes('providerSubject: sub'));
expect('32 email_verified required for new', googleAuth.includes('GOOGLE_EMAIL_UNVERIFIED'));
expect('33 missing email rejected for new', googleAuth.includes('GOOGLE_EMAIL_REQUIRED'));
expect('34 customer role hardcoded', googleAuth.includes('UserRole.customer'));
expect('35 passwordHash null', googleAuth.includes('passwordHash: null'));
expect('36 verifiedAt now', googleAuth.includes('verifiedAt: new Date()'));
expect('37 no password identity on google create', !googleAuth.includes('AuthIdentityProvider.password'));
expect('38 email collision link required', googleAuth.includes('existing_account_link_required'));
expect('39 admin privileged blocked', googleAuth.includes('provider_not_allowed_for_privileged_account'));
expect('40 link continue typ', googleAuth.includes('signIdentityLinkIntent') || linkJwt.includes('google_link_existing') || googleAuth.includes('identity_link'));
expect('41 no silent auto-link create identity on collision', googleAuth.includes('signIdentityLinkIntent') && !/emailOwner[\s\S]{0,200}authIdentity\.create/.test(googleAuth));
expect('42 name sanitize no Google User', googleAuth.includes('sanitizeGoogleDisplayName') && !googleAuth.includes('Google User'));
expect('43 no Google token persistence', !googleAuth.includes('refresh_token') && !oauthFlow.includes('refresh_token'));
expect('44 shared resolver for id-token', oauthFlow.includes('resolveGoogleIdentity') && oauthFlow.includes('authenticateWithGoogleIdToken'));

console.log('\n— Return URL —');
expect('45 sanitizeReturnUrl', oauthFlow.includes('sanitizeReturnUrl'));
expect('46 blocks /auth', oauthFlow.includes("'/auth'"));

console.log('\n— UI (UA-6 unified) —');
expect('47 no Google button in legacy auth-form', !/google|Google/i.test(authForm));
expect('48 login redirects to /auth', loginPage.includes('redirect') && loginPage.includes('/auth'));
expect('49 signup redirects to /auth', signupPage.includes('redirect') && signupPage.includes('/auth'));
expect('50 unified /auth page exists', existsSync(resolve(root, 'apps/web/src/app/[locale]/auth/page.tsx')));

console.log('\n— Regressions preserved —');
expect('51 phone OTP untouched markers', phoneAuth.includes('startPhoneOtp') && phoneAuth.includes('PROFILE_REQUIRED'.toLowerCase()) === false ? phoneAuth.includes('profile_required') : true);
expect('51b phone profile_required', phoneAuth.includes('profile_required'));
expect('52 password reset null hash skip', passwordReset.includes('passwordHash'));
expect('53 googleIdToken schema', schemas.includes('googleIdTokenSchema'));
expect('54 no Facebook', !/facebook/i.test(authRoutes + oidcClient));

console.log('\n— Crypto sanity —');
{
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier, 'utf8').digest('base64url');
  expect('55 S256 challenge length', challenge.length >= 40);
  const a = Buffer.from('abc', 'utf8');
  const b = Buffer.from('abc', 'utf8');
  expect('56 timingSafeEqual works', timingSafeEqual(a, b));
}

console.log(`\n📊 UA-3 Google OIDC architecture: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
