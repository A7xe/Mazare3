/**
 * UA-4 — Identity linking architecture QA (no network).
 */
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

const linkSvc = read('apps/api/src/services/identity-link.service.ts');
const intent = read('apps/api/src/lib/identity-link-intent.ts');
const authRoutes = read('apps/api/src/routes/auth.ts');
const phoneAuth = read('apps/api/src/services/phone-auth.service.ts');
const googleAuth = read('apps/api/src/services/google/google-auth.service.ts');
const oauthTx = read('apps/api/src/lib/google-oauth-transaction.ts');
const oauthFlow = read('apps/api/src/services/google/google-oauth-flow.ts');
const authForm = read('apps/web/src/components/auth/auth-form.tsx');
const schemas = read('packages/shared/src/schemas/auth.ts');

console.log('\n— Shared link service —');
expect('1 IdentityLinkService completeIdentityLink', linkSvc.includes('completeIdentityLink'));
expect('2 linkProviderToAuthenticatedUser', linkSvc.includes('linkProviderToAuthenticatedUser'));
expect('3 admin denied', linkSvc.includes('PROVIDER_NOT_ALLOWED_FOR_PRIVILEGED_ACCOUNT'));
expect('4 account mismatch', linkSvc.includes('IDENTITY_LINK_ACCOUNT_MISMATCH'));
expect('5 already linked conflict', linkSvc.includes('IDENTITY_ALREADY_LINKED'));
expect('6 already_linked same user', linkSvc.includes("'already_linked'"));
expect('7 no User merge/delete ops', !/\.user\.delete\(|tx\.user\.delete|mergeUsers|merge User/i.test(linkSvc));
expect('8 no role change', !/role:\s*['"]admin|role:\s*input/.test(linkSvc));
expect('9 null-email Google populate policy', linkSvc.includes('current.email == null'));
expect('10 no silent email rewrite when set', linkSvc.includes('current.email == null'));

console.log('\n— Link intent —');
expect('11 typ identity_link', intent.includes("identity_link"));
expect('12 audience distinct', intent.includes('IDENTITY_LINK_INTENT_TYP'));
expect('13 TTL ~10m', intent.includes('10 * 60 * 1000'));
expect('14 cookie mazare3_identity_link', intent.includes('mazare3_identity_link'));
expect('15 HttpOnly cookie', intent.includes('httpOnly: true'));
expect('16 consumed jti', intent.includes('markIdentityLinkIntentConsumed'));
expect('17 not session typ', !intent.includes('signSession'));

console.log('\n— Routes —');
expect('18 link complete route', authRoutes.includes("/identities/link/complete"));
expect('19 phone link start', authRoutes.includes("/identities/phone/start"));
expect('20 phone link verify', authRoutes.includes("/identities/phone/verify"));
expect('21 google link start', authRoutes.includes("/identities/google/start"));
expect('22 complete requires auth', /identities\/link\/complete[\s\S]{0,200}requireAuth/.test(authRoutes));
expect('23 no unlink route', !/identities\/.*unlink|unlink.*identity/i.test(authRoutes));

console.log('\n— Phone —');
expect('24 link_phone purpose', phoneAuth.includes('link_phone'));
expect('25 auth_continue separate', phoneAuth.includes('auth_continue'));
expect('26 purpose separation in consume', phoneAuth.includes('challenge.purpose !== input.purpose') || phoneAuth.includes('purpose: LINK_PURPOSE'));
expect('27 legacy collision intent', phoneAuth.includes("provider: 'phone'") && phoneAuth.includes('signIdentityLinkIntent'));
expect('28 Partner phones unused', !phoneAuth.includes('OwnerProfile') && !phoneAuth.includes('operatingPhone'));

console.log('\n— Google —');
expect('29 collision IdentityLinkIntent', googleAuth.includes('signIdentityLinkIntent'));
expect('30 OAuth mode link', oauthTx.includes("mode: 'link'") || oauthTx.includes('GoogleOAuthMode'));
expect('31 linkUserId bound', oauthTx.includes('linkUserId'));
expect('32 callback link mode branch', oauthFlow.includes("tx.mode === 'link'"));
expect('33 link mode skips resolveGoogleIdentity', /mode === 'link'[\s\S]{0,800}linkProviderToAuthenticatedUser/.test(oauthFlow));
expect('34 authenticate mode still resolves', oauthFlow.includes('resolveGoogleIdentity'));

console.log('\n— Schemas / UI —');
expect('35 identityLinkCompleteSchema', schemas.includes('identityLinkCompleteSchema'));
expect('36 phone link schemas', schemas.includes('identityPhoneLinkStartSchema'));
expect('37 no Google button in legacy auth-form', !/google|Google/i.test(authForm));
expect('38 unified /auth page exists', existsSync(resolve(root, 'apps/web/src/app/[locale]/auth/page.tsx')));
expect('39 no CEQUENS', !/cequens/i.test(authRoutes + phoneAuth + linkSvc));
expect('40 no passwordHash write on link', !/passwordHash:\s*null|passwordHash:\s*['"`]|data:\s*\{[^}]*passwordHash/.test(linkSvc));

console.log(`\n📊 UA-4 identity linking architecture: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
