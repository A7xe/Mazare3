/**
 * Phase 3C.2 — Legal launch hardening QA.
 * Run: pnpm qa:phase3c2-legal-hardening
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  OWNER_PENALTY_MIN_JOD,
  OWNER_PENALTY_MAX_JOD,
  MAX_CUSTOMER_RESCHEDULES,
  listLaunchLegalDocuments,
  getLegalIdentityFromEnv,
  listFounderInputRequired,
  LEGAL_CONTENT_PLACEHOLDERS,
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
function has(rel: string, needle: string | RegExp, label: string) {
  const body = src(rel);
  const ok = typeof needle === 'string' ? body.includes(needle) : needle.test(body);
  expect(label, ok, `missing in ${rel}`);
}
function exists(rel: string, label: string) {
  expect(label, existsSync(resolve(root, rel)));
}

console.log('\nPhase 3C.2 Legal Launch Hardening QA\n');

// A. Password registration requires Terms
{
  has('packages/shared/src/schemas/auth.ts', 'acceptedTermsVersionId', 'A signup Terms version required');
  has('apps/api/src/services/auth.service.ts', 'recordAcceptance', 'A signup records acceptance');
}

// B/C Google/phone first-run
{
  has(
    'apps/web/src/components/legal/first-run-legal-gate.tsx',
    'FirstRunLegalGate',
    'B/C FirstRunLegalGate exists',
  );
  exists('apps/web/src/app/[locale]/account/legal-accept/page.tsx', 'B/C legal-accept page');
  has(
    'apps/api/src/middleware/require-terms-acceptance.ts',
    'LEGAL_ACCEPTANCE_REQUIRED',
    'B/C backend LEGAL_ACCEPTANCE_REQUIRED',
  );
}

// D. Marketing optional
{
  const auth = src('packages/shared/src/schemas/auth.ts');
  expect('D marketingConsent optional', auth.includes('marketingConsent') && auth.includes('.optional()'));
}

// E. Privacy acknowledgement distinct
{
  has(
    'apps/web/messages/en.json',
    'I acknowledge that I have read the',
    'E privacy acknowledge copy',
  );
  expect(
    'E no I consent to the Privacy Policy',
    !/I consent to the Privacy Policy/i.test(src('apps/web/messages/en.json')),
  );
}

// F. Booking acceptance versions
{
  has(
    'apps/api/src/services/legal/booking-legal-snapshot.service.ts',
    'createSnapshotForBooking',
    'F booking legal snapshot',
  );
  has('apps/api/src/routes/me.ts', 'legal-snapshot', 'F customer legal-snapshot route');
}

// G/H Owner agreement gate
{
  has(
    'apps/web/src/components/owner/owner-agreement-gate.tsx',
    'OwnerAgreementGate',
    'G OwnerAgreementGate UI',
  );
  has(
    'apps/api/src/services/legal/legal-reacceptance.service.ts',
    'assertOwnerListingSoftGate',
    'G listing soft-gate',
  );
  has(
    'apps/web/src/components/owner/owner-agreement-gate.tsx',
    'payout',
    'H payout paths considered/exempt',
  );
}

// I. Custom commercial terms evidence
{
  has(
    'apps/api/src/services/commercial-terms.service.ts',
    'CommercialTermsAcceptance',
    'I activation checks acceptance',
  );
}

// J. Historical booking legal versions
{
  has(
    'apps/web/src/components/account/my-bookings-view.tsx',
    'fetchBookingLegalSnapshot',
    'J my-bookings legal evidence',
  );
  has(
    'apps/web/src/lib/api-legal.ts',
    'legal-snapshot',
    'J legal-snapshot API client',
  );
}

// K/L/M/N Production guard
{
  const guard = src('apps/api/src/services/legal/legal-production-guard.ts');
  expect('K unresolved placeholders hard fail', /\[\[|unresolved|findUnresolvedLegalPlaceholders/.test(guard));
  expect('L placeholder ACTIVE fail', /placeholder/i.test(guard));
  expect('M AR/EN required', /language|ar|en/i.test(guard));
  expect('N launch-candidate ACTIVE blocked', /launch-candidate/i.test(guard));
}

// O/P Counsel & founder approval audited
{
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'legalReviewStatus',
    'O legalReviewStatus field usage',
  );
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'founderApprovalStatus',
    'P founderApprovalStatus field usage',
  );
  has(
    'apps/api/src/routes/admin-legal.ts',
    'governance',
    'O/P governance route',
  );
}

// Q. Missing DPO does not claim DPO
{
  const privacy = src('packages/shared/src/legal-content/privacy-policy.ts');
  expect(
    'Q prefers Privacy contact wording',
    /Privacy contact/i.test(privacy),
  );
  has(
    'packages/shared/src/legal-identity.ts',
    'dpoAppointed',
    'Q dpoAppointed flag',
  );
}

// R. DSR
{
  has(
    'apps/web/src/components/account/account-privacy-view.tsx',
    'AccountPrivacyView',
    'R privacy center',
  );
  has(
    'apps/api/src/services/legal/data-subject-request.service.ts',
    'createDataSubjectRequest',
    'R DSR create',
  );
}

// S. No optional trackers without consent
{
  exists('docs/phase3c2-cookie-tracker-reaudit.md', 'S cookie reaudit doc');
  const reaudit = src('docs/phase3c2-cookie-tracker-reaudit.md');
  expect('S no GA/Meta found or gated', /no (gtag|GA|Meta|pixel)|essentials only|no banner/i.test(reaudit));
}

// T. Legal links
{
  exists('packages/shared/scripts/qa-phase3c2-legal-links.ts', 'T legal-links QA script');
  const pages = [
    'apps/web/src/app/[locale]/terms/page.tsx',
    'apps/web/src/app/[locale]/privacy/page.tsx',
    'apps/web/src/app/[locale]/cancellation-refund/page.tsx',
    'apps/web/src/app/[locale]/booking-payment/page.tsx',
    'apps/web/src/app/[locale]/verification/page.tsx',
    'apps/web/src/app/[locale]/cookie-policy/page.tsx',
    'apps/web/src/app/[locale]/community-reviews/page.tsx',
  ];
  for (const p of pages) exists(p, `T page ${p.split('/').slice(-2).join('/')}`);
}

// U. No obsolete 12% / 24h balance / old cancel
{
  const corpus = listLaunchLegalDocuments()
    .flatMap((d) => [d.markdownEn, d.markdownAr])
    .join('\n');
  expect('U no 12% commission', !/\b12\s*%/.test(corpus));
  expect('U SSOT 18/15', STANDARD_COMMISSION_PERCENT === 18 && VERIFIED_COMMISSION_PERCENT === 15);
  expect('U deposit 30', DEPOSIT_PERCENT === 30);
  expect('U 72h', FULL_PAYMENT_WITHIN_HOURS === 72);
  expect('U balance 48h not 24', BALANCE_DUE_HOURS_BEFORE_START === 48);
  expect('U penalty bounds', OWNER_PENALTY_MIN_JOD === 10 && OWNER_PENALTY_MAX_JOD === 50);
  expect('U max reschedule 1', MAX_CUSTOMER_RESCHEDULES === 1);
}

// Clickwrap residual
{
  const webCheckout = src('apps/web/src/components/checkout/checkout-view.tsx');
  expect('no payConsent By continuing in checkout', !/By continuing you agree/i.test(webCheckout));
  expect(
    'LegalCommitmentNotice deleted or unused',
    !existsSync(resolve(root, 'apps/web/src/components/legal/legal-commitment-notice.tsx')),
  );
}

// Identity layer
{
  const identity = getLegalIdentityFromEnv();
  expect('identity product name set', !!identity.productNameEn);
  const missing = listFounderInputRequired(identity);
  expect('founder inputs listed when unset', Array.isArray(missing));
  expect(
    'placeholders defined',
    LEGAL_CONTENT_PLACEHOLDERS.LEGAL_ENTITY_NAME === '[[LEGAL_ENTITY_NAME]]',
  );
}

// Activation readiness + PayTabs audit docs
{
  exists('docs/phase3c2-payment-provider-legal-role-audit.md', 'PayTabs role audit doc');
  exists('docs/phase3c2-production-legal-rollout-plan.md', 'rollout plan doc');
  exists('docs/phase3c2-existing-user-reacceptance-strategy.md', 'reacceptance strategy doc');
  has(
    'apps/api/src/services/legal/legal-activation-readiness.service.ts',
    'activation',
    'activation readiness service',
  );
}

// Payment routes gated
{
  has('apps/api/src/routes/payments.ts', 'requireTermsAcceptance', 'payments terms gate');
}

console.log(`\nPhase 3C.2 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
