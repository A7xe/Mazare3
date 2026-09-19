/**
 * Phase 3B — Legal architecture & consent evidence QA.
 * Run: pnpm qa:phase3b-legal-consent
 *
 * Does NOT mutate Production. Pure function + static source assertions.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  hashLegalContent,
  buildFinancialPolicySnapshot,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  LEGAL_REVIEW_BANNER,
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

console.log('\nPhase 3B Legal Consent Architecture QA\n');

// A. Active Terms cannot be silently edited
{
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'NOT_DRAFT',
    'A updateDraft NOT_DRAFT gate',
  );
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'Only draft releases can be updated',
    'A cannot edit published content',
  );
}

// B. Publishing creates new version (supersede old)
{
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'LegalDocumentStatus.superseded',
    'B publish supersedes old active',
  );
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'publishRelease',
    'B publishRelease exists',
  );
}

// C. Old acceptance points to immutable hash
{
  has(
    'apps/api/src/services/legal/legal-acceptance.service.ts',
    'documentHash',
    'C acceptance stores documentHash',
  );
  const a = hashLegalContent('Hello Terms');
  const b = hashLegalContent('Hello Terms');
  const c = hashLegalContent('Hello Terms v2');
  expect('C hash deterministic', a === b);
  expect('C hash changes with content', a !== c);
  expect(
    'C hash is sha256 hex',
    a.length === 64 && a === createHash('sha256').update('Hello Terms'.trim(), 'utf8').digest('hex'),
  );
}

// D. Acceptance records exact AR or EN version
{
  has(
    'apps/api/src/services/legal/legal-acceptance.service.ts',
    'language',
    'D stores language',
  );
  has(
    'packages/db/prisma/schema.prisma',
    'language',
    'D schema language on LegalAcceptance',
  );
}

// E. Existing user NOT auto-marked accepted
{
  has(
    'apps/api/src/services/legal/legal-acceptance.service.ts',
    'Never auto-grants',
    'E never auto-grants',
  );
  has(
    'apps/api/src/services/legal/legal-acceptance.service.ts',
    'Never fabricates',
    'E never fabricates',
  );
  const seed = src('packages/db/prisma/seed-legal-bootstrap.ts');
  expect('E seed has no LegalAcceptance create', !seed.includes('legalAcceptance.create'));
}

// F. Reacceptance required support
{
  has(
    'apps/api/src/services/legal/legal-acceptance.service.ts',
    'reacceptance_required',
    'F status reacceptance_required',
  );
  has(
    'apps/api/src/services/legal/legal-reacceptance.service.ts',
    'evaluateCustomerReacceptanceGates',
    'F customer gate evaluator',
  );
}

// G. Marketing not required for registration
{
  has(
    'packages/shared/src/schemas/auth.ts',
    'acceptedTermsVersionId',
    'G terms required on signup',
  );
  has(
    'packages/shared/src/schemas/auth.ts',
    'acknowledgedPrivacyVersionId',
    'G privacy ack separate',
  );
  const authSchema = src('packages/shared/src/schemas/auth.ts');
  expect(
    'G marketingConsent optional',
    authSchema.includes('marketingConsent') && authSchema.includes('.optional()'),
  );
  has(
    'apps/web/src/components/legal/legal-acceptance-checkboxes.tsx',
    'acknowledge',
    'G UI privacy acknowledge phrasing path',
  );
}

// H. Withdrawing marketing does not withdraw Terms
{
  has(
    'apps/api/src/services/legal/privacy-consent.service.ts',
    'withdrawConsent',
    'H withdrawConsent exists',
  );
  const withdraw = src('apps/api/src/services/legal/privacy-consent.service.ts');
  expect(
    'H withdraw does not touch LegalAcceptance',
    !withdraw.includes('legalAcceptance') && !withdraw.includes('recordAcceptance'),
  );
}

// I. Booking records legal/cancellation versions
{
  has(
    'apps/api/src/services/legal/booking-legal-snapshot.service.ts',
    'createSnapshotForBooking',
    'I booking snapshot service',
  );
  has(
    'packages/db/prisma/schema.prisma',
    'model BookingLegalSnapshot',
    'I BookingLegalSnapshot model',
  );
  has(
    'apps/api/src/services/booking.service.ts',
    'createSnapshotForBooking',
    'I wired into booking create',
  );
}

// J. Later policy does not alter historical booking
{
  has(
    'packages/db/prisma/schema.prisma',
    'cancellationRulesJson',
    'J cancellation rules snapshotted on booking',
  );
  has(
    'packages/shared/src/legal-policy.ts',
    'buildFinancialPolicySnapshot',
    'J financial policy snapshot builder',
  );
  const snap = buildFinancialPolicySnapshot();
  expect('J snapshot has default commission 18', snap.commissionPercentDefault === 18);
  expect('J snapshot deposit 30', snap.depositPercent === 30);
  expect('J snapshot has hash', typeof snap.hash === 'string' && snap.hash.length === 64);
}

// K. Owner agreement gate for new contractual actions
{
  has(
    'apps/api/src/services/legal/legal-reacceptance.service.ts',
    'evaluateOwnerReacceptanceGates',
    'K owner reacceptance gates',
  );
  has(
    'apps/api/src/services/legal/legal-reacceptance.service.ts',
    'creating new listings',
    'K soft-gate listings copy',
  );
}

// L. Custom commercial terms acceptance evidence
{
  has(
    'apps/api/src/services/legal/commercial-terms-acceptance.service.ts',
    'recordOwnerAck',
    'L commercial terms acceptance service',
  );
  has(
    'packages/db/prisma/schema.prisma',
    'model CommercialTermsAcceptance',
    'L CommercialTermsAcceptance model',
  );
}

// M. Admin cannot edit published version
{
  has(
    'apps/api/src/services/legal/legal-document.service.ts',
    'Only draft releases can be updated',
    'M draft-only edit',
  );
}

// N. Admin publishing audited
{
  const doc = src('apps/api/src/services/legal/legal-document.service.ts');
  expect('N publishRelease uses createAuditLog', /publishRelease[\s\S]*createAuditLog/.test(doc));
}

// O. Privacy consent purposes independent
{
  has(
    'packages/db/prisma/schema.prisma',
    'marketing_email',
    'O marketing_email purpose',
  );
  has(
    'packages/db/prisma/schema.prisma',
    'optional_cookies',
    'O optional_cookies purpose',
  );
  has(
    'apps/api/src/services/legal/privacy-consent.service.ts',
    'purposeCode',
    'O purpose-specific grant',
  );
}

// P. Consent withdrawal retained as history
{
  has(
    'apps/api/src/services/legal/privacy-consent.service.ts',
    'withdrawnAt',
    'P withdrawnAt retained',
  );
  has(
    'apps/api/src/services/legal/privacy-consent.service.ts',
    'do not erase grant history',
    'P keep grant history',
  );
}

// Q. Account deletion does not destroy financial evidence
{
  has(
    'docs/phase3b-privacy-retention-map.md',
    'Prefer anonymize over hard-delete',
    'Q retention prefers anonymize',
  );
  has(
    'docs/phase3b-privacy-retention-map.md',
    'RETENTION PERIOD REQUIRES LEGAL REVIEW',
    'Q retention marked for legal review',
  );
  has(
    'apps/api/src/services/legal/data-subject-request.service.ts',
    'erasure',
    'Q DSR erasure foundation',
  );
}

// R. Trackers classified / gated
{
  has(
    'docs/phase3b-cookie-tracker-audit.md',
    'ESSENTIAL',
    'R cookie audit ESSENTIAL',
  );
  has(
    'docs/phase3b-cookie-tracker-audit.md',
    'ANALYTICS',
    'R cookie audit ANALYTICS',
  );
  has(
    'apps/api/src/services/legal/cookie-tracker-audit.ts',
    'ESSENTIAL',
    'R code companion audit',
  );
}

// S. AR/EN linked release separate hashes
{
  has(
    'packages/db/prisma/schema.prisma',
    'model LegalRelease',
    'S LegalRelease model',
  );
  has(
    'packages/db/prisma/schema.prisma',
    'model LegalDocumentVersion',
    'S LegalDocumentVersion model',
  );
  has(
    'packages/db/prisma/schema.prisma',
    '@@unique([releaseId, language])',
    'S unique release+language',
  );
  const ar = hashLegalContent('شروط الاستخدام');
  const en = hashLegalContent('Terms of Use');
  expect('S AR/EN hashes differ for different content', ar !== en);
}

// Commission SSOT still correct
{
  expect('standard 18%', STANDARD_COMMISSION_PERCENT === 18);
  expect('verified 15%', VERIFIED_COMMISSION_PERCENT === 15);
  expect('LEGAL_REVIEW_BANNER set', LEGAL_REVIEW_BANNER.includes('REQUIRES JORDANIAN LEGAL REVIEW'));
}

// UI / admin presence
{
  expect(
    'migration exists',
    existsSync(
      resolve(
        root,
        'packages/db/prisma/migrations/20260911200000_phase3b_legal_consent/migration.sql',
      ),
    ),
  );
  has(
    'apps/web/src/components/legal/legal-acceptance-checkboxes.tsx',
    'LegalAcceptanceCheckboxes',
    'UI signup checkboxes',
  );
  has(
    'apps/web/src/components/legal/booking-legal-ack.tsx',
    'BookingLegalAck',
    'UI booking legal ack',
  );
  has(
    'apps/web/src/components/admin/admin-legal-console-view.tsx',
    'AdminLegalConsoleView',
    'UI admin legal console',
  );
  has(
    'apps/web/src/components/account/account-privacy-view.tsx',
    'AccountPrivacyView',
    'UI account privacy / DSR',
  );
}

// No bundled single checkbox for Terms+Privacy+Marketing
{
  const boxes = src('apps/web/src/components/legal/legal-acceptance-checkboxes.tsx');
  expect(
    'no single bundled agree-all checkbox copy',
    !/I agree to Terms, Privacy, Cookies, and Marketing/i.test(boxes),
  );
}

console.log(`\nPhase 3B QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
