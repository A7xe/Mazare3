/**
 * Phase 3C.4B.1.4 — Jordan Prior Consent architecture QA.
 * Run: pnpm qa:phase3c4b1-4-prior-consent
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ADVISOR_REVISED_VERSION_111,
  DATA_PROCESSING_CONSENT_CORPUS_VERSION,
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS,
  DATA_PROCESSING_CONSENT_PURPOSES,
  JORDAN_LEGAL_BASIS_STATUSES,
  PRIVACY_CONSENT_PURPOSES,
  PRIVACY_DPO_READINESS,
  PRIVACY_PROCESSING_ACTIVITIES,
  GOOGLE_OAUTH_PRE_CONSENT_NOTE_EN,
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

console.log('\nPhase 3C.4B.1.4 Jordan Prior Consent Architecture QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');
const prior = src('packages/shared/src/jordan-prior-consent.ts');
const overlay = src('packages/shared/src/privacy-activity-prior-consent-overlay.ts');
const dpcService = src('apps/api/src/services/legal/data-processing-consent.service.ts');
const privacyConsentSvc = src('apps/api/src/services/legal/privacy-consent.service.ts');
const authSvc = src('apps/api/src/services/auth.service.ts');
const partnerSvc = src('apps/api/src/services/partner-onboarding.service.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const meRoutes = src('apps/api/src/routes/me.ts');
const adminLegal = src('apps/api/src/routes/admin-legal.ts');
const checkboxes = src('apps/web/src/components/legal/legal-acceptance-checkboxes.tsx');
const firstRun = src('apps/web/src/components/legal/first-run-legal-gate.tsx');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const terms = src('packages/shared/src/legal-content/terms-and-conditions.ts');
const matrix = src('docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_4.md');
const identity = getLegalIdentityFromEnv();

// A — Privacy Policy acknowledgement != Prior Consent
expect(
  'A Privacy ack context remains separate from DataProcessingConsent',
  authSvc.includes('privacy_ack') && authSvc.includes('grantDataProcessingConsent'),
);
expect(
  'A LegalAcceptance privacy path is acknowledgement not Prior Consent model',
  schema.includes('model LegalAcceptance') && schema.includes('model DataProcessingConsent'),
);

// B — Terms acceptance != Prior Consent
expect(
  'B Terms acceptance recorded separately from Prior Consent',
  authSvc.includes('acceptedTermsVersionId') &&
    authSvc.includes("purposeKey: 'account_registration_and_authentication'"),
);

// C — Prior Consent explicit and separately recorded
expect(
  'C DataProcessingConsent model exists',
  schema.includes('model DataProcessingConsent') &&
    schema.includes('enum DataProcessingConsentPurpose'),
);
expect(
  'C grant requires explicitConsent literal true',
  dpcService.includes('EXPLICIT_CONSENT_REQUIRED') &&
    src('packages/shared/src/schemas/legal.ts').includes('explicitConsent: z.literal(true)'),
);

// D — purpose and version in evidence
expect(
  'D consent stores purposeVersion + consentTextHash',
  schema.includes('purposeVersion') && schema.includes('consentTextHash'),
);
expect(
  'D corpus version constant set',
  DATA_PROCESSING_CONSENT_CORPUS_VERSION === '3c4b1-4-prior-consent-v1',
);

// E — duration architecture
expect(
  'E duration defaults to DURATION_REQUIRES_LEGAL_REVIEW',
  dpcService.includes('DURATION_REQUIRES_LEGAL_REVIEW') &&
    !prior.includes('1 year') &&
    !prior.includes('5 years') &&
    !prior.includes('forever'),
);

// F — optional marketing remains optional
expect(
  'F optional purposes stay on PrivacyConsent enum only',
  PRIVACY_CONSENT_PURPOSES.every((p) =>
    ['marketing_email', 'marketing_sms', 'personalized_analytics', 'optional_cookies'].includes(p),
  ),
);
expect(
  'F marketing not in DataProcessingConsent purposes',
  !DATA_PROCESSING_CONSENT_PURPOSES.includes('marketing_email' as never),
);

// G — no optional consent pre-checked
expect(
  'G marketingEmail defaults false in LegalAcceptanceState',
  checkboxes.includes('marketingEmail: false') && checkboxes.includes('priorConsentAccount: false'),
);

// H — Google first-run cannot bypass
expect(
  'H first-run grants Prior Consent and documents OAuth pre-consent note',
  firstRun.includes('grantPriorConsent') &&
    firstRun.includes('oauthPreConsentNote') &&
    GOOGLE_OAUTH_PRE_CONSENT_NOTE_EN.includes('LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED'),
);
expect(
  'H customerFirstRunLegalRequired includes account Prior Consent',
  src('apps/web/src/components/legal/legal-reacceptance.tsx').includes(
    'accountPriorConsentRequired',
  ),
);

// I — KYC upload gated
expect(
  'I KYC upload asserts owner_identity_and_authority_verification',
  partnerSvc.includes("assertPriorConsentActive(params.userId, 'owner_identity_and_authority_verification')"),
);

// J — payout gated
expect(
  'J payout asserts owner_payout_and_financial_processing',
  partnerSvc.includes("assertPriorConsentActive(userId, 'owner_payout_and_financial_processing')"),
);

// K — PAN/CVV not represented as Mazare3-collected consent data
expect(
  'K Prior Consent texts deny PAN/CVV storage',
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS.some((p) => p.consentTextEn.includes('not PAN/CVV')) &&
    !DATA_PROCESSING_CONSENT_PURPOSE_DEFS.some((p) =>
      p.purposeKey.includes('pan') || p.purposeKey.includes('cvv'),
    ),
);

// L — no fabrication for existing users
expect(
  'L no seed/backfill of DataProcessingConsent for existing users',
  !dpcService.includes('backfill') &&
    !src('packages/db/prisma/migrations/20260914180000_phase3c4b1_4_prior_consent/migration.sql').includes(
      'INSERT INTO "DataProcessingConsent"',
    ),
);

// M — withdrawal history immutable/auditable
expect(
  'M withdraw supersedes/marks withdrawn without erase; audit log',
  dpcService.includes('privacy.prior_consent.withdrawn') &&
    dpcService.includes('status: DataProcessingConsentStatus.withdrawn') &&
    dpcService.includes('superseded'),
);

// N — withdrawal stops future consent-dependent processing
expect(
  'N assertPriorConsentActive rejects withdrawn/missing',
  dpcService.includes('PRIOR_CONSENT_WITHDRAWN') && dpcService.includes('MISSING_PRIOR_CONSENT'),
);

// O — withdrawal does not erase Booking/payment evidence
expect(
  'O withdraw note preserves Booking/payment evidence',
  dpcService.includes('does not erase Booking/payment legal evidence'),
);

// P — admin cannot grant consent on behalf of Data Subject
expect(
  'P adminCannotGrantConsent true + no admin grant route',
  dpcService.includes('adminCannotGrantConsent: true') &&
    !adminLegal.includes('grantDataProcessingConsent') &&
    adminLegal.includes('priorConsentReadiness'),
);

// Q — material purpose/version change can trigger re-consent
expect(
  'Q evaluateConsentValidity returns RECONSENT_REQUIRED on version mismatch',
  dpcService.includes("return 'RECONSENT_REQUIRED'"),
);

// R — no GDPR legitimate interest as a Jordan legal basis status
expect(
  'R no legitimate interest as Jordan legal-basis status',
  !JORDAN_LEGAL_BASIS_STATUSES.some((s) => s.toLowerCase().includes('legitimate')) &&
    !PRIVACY_PROCESSING_ACTIVITIES.some((a) =>
      String(a.jordanLegalBasisStatus).toLowerCase().includes('legitimate'),
    ),
);

// S — contract-performance not falsely asserted as Jordan exception
expect(
  'S no Article 6 exception confirmed on any activity',
  !PRIVACY_PROCESSING_ACTIVITIES.some(
    (a) => a.article6ExceptionStatus === 'ARTICLE_6_EXCEPTION_CONFIRMED',
  ),
);
expect(
  'S Jordan statuses do not include GDPR contract-performance label',
  !JORDAN_LEGAL_BASIS_STATUSES.some((s) => s.toLowerCase().includes('contract')),
);

// T — unresolved Article 6 remain review / legislative-duty-pending statuses
expect(
  'T security/audit mapped to Article 6 pending (not confirmed)',
  (() => {
    const s = PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'security_audit_logs');
    return (
      s?.article6ExceptionStatus === 'ARTICLE_6_EXCEPTION_REVIEW_REQUIRED' ||
      s?.article6ExceptionStatus === 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL'
    );
  })(),
);

// U — dpoAppointed remains false
expect('U dpoAppointed false', identity.dpoAppointed === false && PRIVACY_DPO_READINESS.dpoAppointed === false);

// V — Privacy Policy not finalised / not Production-activated
expect(
  'V Privacy Policy remains DRAFT / not counsel-activated',
  (privacyPolicy.includes('1.1.2-advisor-final') ||
    privacyPolicy.includes('PRIVACY_ADVISOR_REVISED')) &&
    !privacyPolicy.includes('includeInternalBanner: true'),
);

// W — 1.1.2-advisor-final unchanged
expect(
  'W advisor-final version constant intact',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' ||
    ADVISOR_REVISED_VERSION_111 === '1.1.2-advisor-final' ||
    terms.includes('1.1.2-advisor-final'),
);

// X — Production untouched (local architecture only; no prod activation flags flipped)
expect(
  'X no production legal activation auto-true',
  !src('apps/api/src/services/legal/legal-production-guard.ts').includes('FORCE_PRODUCTION_LEGAL_ACTIVE = true'),
);

// Extra architecture checks
expect(
  'Inventory activities all have jordanLegalBasisStatus',
  PRIVACY_PROCESSING_ACTIVITIES.every((a) =>
    JORDAN_LEGAL_BASIS_STATUSES.includes(a.jordanLegalBasisStatus),
  ),
);
expect(
  'Signup requires priorConsentAccount',
  src('packages/shared/src/schemas/auth.ts').includes('priorConsentAccount: z.literal(true)'),
);
expect(
  'Booking create asserts prior consents',
  bookingSvc.includes('marketplace_booking_processing') &&
    bookingSvc.includes('payment_and_refund_processing'),
);
expect(
  'Me routes expose /prior-consents',
  meRoutes.includes("'/prior-consents'") && meRoutes.includes('grantDataProcessingConsent'),
);
expect(
  'Internal matrix doc exists',
  matrix.includes('INTERNAL ONLY') && matrix.includes('DataProcessingConsent'),
);
expect(
  'Optional PrivacyConsent service unchanged for marketing',
  privacyConsentSvc.includes('PrivacyConsentPurpose') &&
    PRIVACY_CONSENT_PURPOSES.includes('marketing_email') &&
    !DATA_PROCESSING_CONSENT_PURPOSES.includes('marketing_email' as never),
);
expect(
  'Checkboxes require priorConsentAccount for isValid',
  checkboxes.includes('partial.priorConsentAccount'),
);

console.log(`\n3C.4B.1.4 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
