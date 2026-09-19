/**
 * Phase 3C.4B.2A — Privacy Policy DRAFT rewrite QA (updated for 2B coexistence).
 * Verifies 1.1.0 historical corpus remains preserved; current corpus may be later DRAFT.
 * Run: pnpm qa:phase3c4b2a-privacy-policy
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  LEGAL_CONTENT_PLACEHOLDERS,
  PRIVACY_ADVISOR_REVISED_VERSION_110,
  PRIVACY_DPO_READINESS,
  findUnresolvedLegalPlaceholders,
  getLaunchLegalDocument,
  getLaunchLegalMarkdown,
  getLegalIdentityFromEnv,
  privacyPolicyAdvisorRevised110,
  privacyPolicyLaunchCandidate,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
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
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4B.2A Privacy Policy DRAFT QA (historical 1.1.0)\n');

const identity = getLegalIdentityFromEnv();
const historical = privacyPolicyAdvisorRevised110;
const en = historical.markdownEn;
const ar = historical.markdownAr;
const readiness = src('apps/api/src/services/legal/legal-activation-readiness.service.ts');
const guard = src('apps/api/src/services/legal/legal-production-guard.ts');
const reviewDoc = src('docs/MAZARE3_PRIVACY_POLICY_3C4B2A_REVIEW.md');
const readinessDoc = src('docs/MAZARE3_PRIVACY_POLICY_3C4B2A_READINESS.md');
const frozenSrc = src('packages/shared/src/legal-content/privacy-policy-1.1.0-advisor-revised.ts');
const termsSrc = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const cancelSrc = src('packages/shared/src/legal-content/cancellation-refund-policy.ts');
const bookingSrc = src('packages/shared/src/legal-content/booking-terms.ts');
const cookieSrc = src('packages/shared/src/legal-content/cookie-policy.ts');

expect('A historical version 1.1.0', historical.version === PRIVACY_ADVISOR_REVISED_VERSION_110);
expect('A frozen file export present', frozenSrc.includes('privacyPolicyAdvisorRevised110'));
expect('A activation readiness still blocks Privacy Policy', readiness.includes('PRIVACY_POLICY_NOT_FINALISED'));
expect('B launch-candidate still frozen', privacyPolicyLaunchCandidate.version === '1.0.1-launch-candidate');
expect(
  'C EN acknowledgement != Prior Consent',
  en.toLowerCase().includes('acknowledging this privacy policy is not prior consent') ||
    en.includes('does not replace Prior Consent'),
);
expect('C AR الإقرار ≠ الموافقة المسبقة', ar.includes('لا يُعدّ موافقة مسبقة') || ar.includes('لا يحل محل الموافقة المسبقة'));
expect('D Terms acceptance separate', en.toLowerCase().includes('terms acceptance is separate') || en.includes('separate from accepting the Terms'));
expect('E optional marketing', en.toLowerCase().includes('optional marketing'));
expect('F financial Sensitive', en.includes('Sensitive Personal Data') && en.toLowerCase().includes('financial'));
expect('G PAN/CVV not stored', en.includes('does not store full payment-card PAN') || (en.includes('does not store') && en.includes('PAN')));
expect('H KYC may contain sensitive', en.includes('may contain Sensitive Personal Data'));
expect('I retention tokens in 1.1.0', en.includes('[[RETENTION_BOOKINGS]]'));
expect('J region tokens', en.includes('[[PROCESSOR_REGION_NEON]]'));
expect('L PAYMENT_PROVIDER token', en.includes(LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_LEGAL_NAME));
expect('N dpoAppointed false', identity.dpoAppointed === false && PRIVACY_DPO_READINESS.dpoAppointed === false);
expect('O Affected Data Subjects', en.includes('Affected Data Subjects') || en.includes('Affected Data Subject'));
expect('P 24h/72h present', en.includes('24') && en.includes('72'));
expect('Q access/copy right language', en.toLowerCase().includes('copy') || en.includes('obtaining a copy') || en.includes('Access'));
expect('R 15 working days', en.includes('15 working days'));
expect('T regulator PDP', en.includes('PDP@modee.gov.jo'));
expect('V cookies reference', en.toLowerCase().includes('cookie') || cookieSrc.includes('Essential'));
expect('X Terms 1.1.2', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' && termsSrc.includes('ADVISOR_REVISED_VERSION'));
expect('X cancel/booking advisor-final', cancelSrc.includes('ADVISOR_REVISED_VERSION') && bookingSrc.includes('ADVISOR_REVISED_VERSION'));
expect('Y production guard', guard.includes('isProductionRuntime'));
expect('review export 2A exists', reviewDoc.includes('1.1.0-advisor-revised'));
expect('readiness 2A exists', readinessDoc.includes('privacyContactEmail'));
expect(
  'current corpus advanced beyond 1.1.0',
  getLaunchLegalDocument('privacy_policy').version !== PRIVACY_ADVISOR_REVISED_VERSION_110,
);
expect('unresolved placeholders in historical', findUnresolvedLegalPlaceholders(en).length > 0);

console.log(`\n3C.4B.2A QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
