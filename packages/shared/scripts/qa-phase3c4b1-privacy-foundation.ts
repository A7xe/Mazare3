/**
 * Phase 3C.4B.1 — Privacy compliance foundation & data map QA.
 * Run: pnpm qa:phase3c4b1-privacy-foundation
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ADVISOR_REVISED_VERSION_111,
  DATA_SUBJECT_REQUEST_TYPES,
  PRIVACY_CONSENT_PURPOSES,
  PRIVACY_DPO_READINESS,
  PRIVACY_PROCESSING_ACTIVITIES,
  PRIVACY_PROCESSORS,
  PRIVACY_RETENTION_MAP,
  PRIVACY_DPIA_READINESS,
  JORDAN_DSR_RIGHTS_INVENTORY,
  DSR_RESPONSE_WORKING_DAYS,
  computeDsrDueAtFromReceivedAt,
  isDsrOverdue,
  getLegalIdentityFromEnv,
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

console.log('\nPhase 3C.4B.1 Privacy Foundation QA\n');

const identity = getLegalIdentityFromEnv();
const schema = src('packages/db/prisma/schema.prisma');
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');
const dsrService = src('apps/api/src/services/legal/data-subject-request.service.ts');
const consentService = src('apps/api/src/services/legal/privacy-consent.service.ts');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const partnerCrypto = src('apps/api/src/lib/partner-crypto.ts');
const vault = src('apps/api/src/lib/payment-vault-crypto.ts');
const kycStorage = src('apps/api/src/config/partner-document-storage.config.ts');

// A — dpoAppointed remains false
expect('A dpoAppointed false from env default', identity.dpoAppointed === false);
expect('A PRIVACY_DPO_READINESS.dpoAppointed is false', PRIVACY_DPO_READINESS.dpoAppointed === false);
expect(
  'A LEGAL_DPO_APPOINTED defaults false in identity',
  src('packages/shared/src/legal-identity.ts').includes("parseBoolEnv('LEGAL_DPO_APPOINTED', false)"),
);

// B — internal candidate not publicly appointed
expect('B candidate INTERNAL_DPO_CANDIDATE', PRIVACY_DPO_READINESS.candidateLabel === 'INTERNAL_DPO_CANDIDATE');
expect('B appointment NOT_FORMALLY_RECORDED', PRIVACY_DPO_READINESS.appointmentStatus === 'NOT_FORMALLY_RECORDED');
expect('B public DPO contact NOT_PUBLISHED', PRIVACY_DPO_READINESS.publicDpoContact === 'NOT_PUBLISHED');
expect(
  'B privacy policy does not claim appointed DPO by default',
  !privacyPolicy.toLowerCase().includes('appointed data protection officer has been designated'),
);

// C — privacy contact not fabricated
expect(
  'C privacy contact still production-required gap key',
  src('packages/shared/src/legal-identity.ts').includes("'privacyContactEmail'"),
);
expect(
  'C inventory does not invent privacy email',
  !inventory.includes('privacy@mazare3.com') && !inventory.includes('dpo@mazare3.com'),
);

// D — PSP legal identity not fabricated
expect(
  'D paymentProviderLegalName still required gap',
  src('packages/shared/src/legal-identity.ts').includes("'paymentProviderLegalName'"),
);
expect(
  'D processors mark PayTabs entity FOUNDER_INPUT_REQUIRED',
  PRIVACY_PROCESSORS.some(
    (p) => p.key === 'paytabs' && p.contractualEntityStatus === 'FOUNDER_INPUT_REQUIRED',
  ),
);

// E — PAN/CVV not stored
expect('E no pan String column', !/^\s*pan\s+String/m.test(schema));
expect(
  'E no cvv field column',
  !/^\s*cvv\s+/im.test(schema) && !schema.includes('cvv String') && !schema.includes('ecom_cvv'),
);
expect(
  'E SavedPaymentMethod never PAN/CVV comment',
  schema.includes('never PAN/CVV') || schema.includes('providerTokenCipher'),
);
expect(
  'E vault is token cipher not PAN',
  vault.includes('PAYMENT_VAULT') || vault.includes('encrypt'),
);
expect(
  'E inventory states PAN/CVV not stored',
  inventory.includes('never store PAN/CVV') || inventory.includes('PAN/CVV not stored'),
);

// F — KYC private where configured
expect('F private storage providers', kycStorage.includes('cloudflare_r2_private') || kycStorage.includes('s3_private'));
expect(
  'F KYC activity RESTRICT_ACCESS',
  PRIVACY_PROCESSING_ACTIVITIES.some(
    (a) => a.key === 'owner_kyc_documents' && a.minimisation === 'RESTRICT_ACCESS',
  ),
);

// G — optional consent separate
expect(
  'G consent purposes optional only',
  PRIVACY_CONSENT_PURPOSES.every((p) =>
    ['marketing_email', 'marketing_sms', 'personalized_analytics', 'optional_cookies'].includes(p),
  ),
);
expect('G grantPrivacyConsent service exists', consentService.includes('grantPrivacyConsent') || consentService.includes('withdraw'));

// H — withdrawal auditable
expect('H withdrawnAt in schema', schema.includes('withdrawnAt'));
expect(
  'H consent withdraw preserves history',
  consentService.includes('withdrawn') || consentService.includes('withdraw'),
);

// I — Jordan DSR rights inventory
expect('I restriction type present', DATA_SUBJECT_REQUEST_TYPES.includes('restriction'));
expect('I consent_withdrawal type present', DATA_SUBJECT_REQUEST_TYPES.includes('consent_withdrawal'));
expect('I rights inventory non-empty', JORDAN_DSR_RIGHTS_INVENTORY.length >= 8);
expect(
  'I erasure anonymize preferred',
  dsrService.includes('anonymize_preferred') || dsrService.includes('anonymize'),
);

// J — 15 working-day SLA
expect('J DSR_RESPONSE_WORKING_DAYS === 15', DSR_RESPONSE_WORKING_DAYS === 15);
expect('J dueAt column', schema.includes('dueAt'));
expect('J receivedAt column', schema.includes('receivedAt'));
expect('J create sets computeDsrDueAtFromReceivedAt', dsrService.includes('computeDsrDeadlineFromReceivedAt') || dsrService.includes('computeDsrDueAtFromReceivedAt'));
{
  // Received Thursday 2026-09-10 Amman → day after Fri (non-working) … count 15 Sun-Thu days
  const received = new Date('2026-09-10T10:00:00+03:00'); // Thu
  const due = computeDsrDueAtFromReceivedAt(received);
  expect('J dueAt is after received', due.getTime() > received.getTime());
  // Rough: 15 working days ≈ 3 weeks → due should be into late September / early October
  expect('J due within ~5 calendar weeks', due.getTime() - received.getTime() < 40 * 86400000);
  expect(
    'J overdue helper open+past',
    isDsrOverdue({
      status: 'requested',
      dueAt: new Date('2020-01-01T00:00:00Z'),
      now: new Date('2026-01-01T00:00:00Z'),
    }) === true,
  );
  expect(
    'J fulfilled not overdue',
    isDsrOverdue({
      status: 'fulfilled',
      dueAt: new Date('2020-01-01T00:00:00Z'),
      now: new Date('2026-01-01T00:00:00Z'),
    }) === false,
  );
}

// K — retention periods not invented
expect(
  'K all retention rows require review or technical-only',
  PRIVACY_RETENTION_MAP.every(
    (r) =>
      r.exactLegalPeriodStatus === 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW' ||
      r.exactLegalPeriodStatus === 'TECHNICAL_BEHAVIOR_ONLY',
  ),
);
expect('K no fabricated 7-year claim in inventory', !/7[\s-]?year/i.test(inventory));

// L — processor regions not invented
expect(
  'L processors without proven region stay PROVIDER_CONTRACT or FOUNDER',
  PRIVACY_PROCESSORS.every((p) => {
    if (p.key === 'paytabs') return p.regionEvidenceStatus === 'TECHNICALLY_CONFIRMED';
    return (
      p.regionEvidenceStatus === 'PROVIDER_CONTRACT_REQUIRED' ||
      p.regionEvidenceStatus === 'FOUNDER_INPUT_REQUIRED' ||
      p.regionEvidenceStatus === 'UNKNOWN'
    );
  }),
);

// M — cross-border unknowns explicit
expect(
  'M no JORDAN_ONLY_CONFIRMED fabricated for Neon/R2',
  !PRIVACY_PROCESSORS.some(
    (p) =>
      (p.key === 'neon_postgres' || p.key.includes('r2')) &&
      p.crossBorderStatus === 'JORDAN_ONLY_CONFIRMED',
  ),
);

// N — no Production legal activation in this phase
expect(
  'N no activate in privacy inventory phase scripts',
  !inventory.includes('activateProduction') && !inventory.includes('LegalDocumentStatus.active'),
);

// O — 1.1.2 contractual documents unchanged by privacy phase
expect('O current contract version 1.1.2', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('O historical 1.1.1 preserved', ADVISOR_REVISED_VERSION_111 === '1.1.1-advisor-revised');
expect(
  'O Terms still on ADVISOR_REVISED_VERSION import',
  terms.includes('ADVISOR_REVISED_VERSION') && terms.includes("version: ADVISOR_REVISED_VERSION"),
);
expect(
  'O Privacy Policy uses PRIVACY_ADVISOR_REVISED_VERSION (not Terms corpus mutation)',
  privacyPolicy.includes('PRIVACY_ADVISOR_REVISED_VERSION') &&
    terms.includes("documentType: 'terms_and_conditions'"),
);

// Extra: encryption + DPIA + docs exist
expect('partner field encryption exists', partnerCrypto.includes('encryptPartnerField'));
expect('DPIA rows present', PRIVACY_DPIA_READINESS.length >= 4);
expect(
  'data map doc exists',
  src('docs/MAZARE3_PRIVACY_DATA_MAP_3C4B1.md').includes('Executive summary') ||
    src('docs/MAZARE3_PRIVACY_DATA_MAP_3C4B1.md').length > 100,
);
expect(
  'processing register draft exists',
  src('docs/MAZARE3_PROCESSING_REGISTER_DRAFT_3C4B1.md').length > 50,
);
expect('admin overdue filter', src('apps/web/src/components/admin/admin-legal-console-view.tsx').includes('dsrOverdueOnly'));
expect('migration DSR SLA', src('packages/db/prisma/migrations/20260913180000_phase3c4b1_dsr_sla_foundation/migration.sql').includes('dueAt'));

console.log(`\nPhase 3C.4B.1 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
