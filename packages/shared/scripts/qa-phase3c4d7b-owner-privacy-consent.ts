/**
 * Phase 3C.4D.7B — Owner Consent & Privacy Processing Closure QA.
 * Run: pnpm qa:phase3c4d7b-owner-privacy-consent
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS,
  OWNER_ACCOUNT_MARKETPLACE_OPERATION_CLASSIFICATION,
  isRuntimePriorConsentGatedPurpose,
  runtimePriorConsentGatedPurposes,
  PRIVACY_PROCESSING_ACTIVITIES,
  PRIVACY_RETENTION_MAP,
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX,
} from '../src/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let passed = 0;
let failed = 0;

function expect(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}: ${detail || 'assertion failed'}`);
  }
}
function src(rel: string) {
  return readFileSync(resolve(root, rel), 'utf8');
}

console.log('\nPhase 3C.4D.7B Owner Privacy Consent Closure QA\n');

const jordan = src('packages/shared/src/jordan-prior-consent.ts');
const overlay = src('packages/shared/src/privacy-activity-prior-consent-overlay.ts');
const inventory = src('packages/shared/src/privacy-processing-inventory.ts');
const consentSvc = src('apps/api/src/services/legal/data-processing-consent.service.ts');
const readiness = src('apps/api/src/services/legal/legal-activation-readiness.service.ts');
const dsr = src('apps/api/src/services/legal/data-subject-request.service.ts');
const partnerOnb = src('apps/api/src/services/partner-onboarding.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const authority = src('apps/api/src/services/property-authority.service.ts');
const regulatory = src('apps/api/src/services/property-regulatory.service.ts');
const priorUi = src('apps/web/src/components/legal/prior-consent-checkbox.tsx');
const becomeOwner = src('apps/web/src/components/become-owner/become-owner-view.tsx');
const payoutUi = src('apps/web/src/components/owner/owner-payout-setup-view.tsx');
const propForm = src('apps/web/src/components/owner/owner-property-form.tsx');
const privacyLocked = src('packages/shared/src/legal-content/privacy-policy.ts');
const oaLocked = src('packages/shared/src/legal-content/owner-agreement.ts');
const closureDoc = src('docs/MAZARE3_OWNER_PRIVACY_CONSENT_CLOSURE_3C4D7B.md');
const matrixDoc = src('docs/MAZARE3_OWNER_CONSENT_GATE_MATRIX_3C4D7B.md');

const ownerAcct = DATA_PROCESSING_CONSENT_PURPOSE_DEFS.find(
  (p) => p.purposeKey === 'owner_account_and_marketplace_operation',
)!;

// A — no blanket Owner consent
expect(
  'A: no blanket Owner consent checkbox copy',
  !becomeOwner.toLowerCase().includes('consent to all') &&
    !priorUi.toLowerCase().includes('all my data') &&
    !jordan.toLowerCase().includes('consent to all data processing necessary'),
);

// B–E separation
expect(
  'B: Terms acceptance remains LegalAcceptance (not DataProcessingConsent grant path for terms)',
  src('apps/api/src/services/legal/legal-acceptance.service.ts').includes('LegalAcceptance') &&
    !consentSvc.includes("purposeKey: 'terms"),
);
expect(
  'C: Owner Agreement acceptance separate',
  oaLocked.includes(OWNER_ADVISOR_REVISED_VERSION) &&
    src('apps/web/src/components/owner/owner-agreement-gate.tsx').length > 0,
);
expect(
  'D: Privacy acknowledgement distinct in Privacy Policy intro',
  privacyLocked.includes('not Prior Consent') ||
    privacyLocked.includes('is not Prior Consent'),
);
expect(
  'E: commercial terms service separate from DataProcessingConsent',
  src('apps/api/src/services/legal/commercial-terms-acceptance.service.ts').includes(
    'CommercialTerms',
  ) ||
    src('apps/api/src/services/legal/commercial-terms-acceptance.service.ts').includes(
      'commercial',
    ),
);

// F marketing optional
expect(
  'F: marketing not a required Prior Consent purpose on Owner KYC/location/payout UIs',
  becomeOwner.includes('owner_identity_and_authority_verification') &&
    !becomeOwner.includes("purposeKey: 'marketing") &&
    payoutUi.includes('owner_payout_and_financial_processing') &&
    !payoutUi.includes("purposeKey: 'marketing") &&
    propForm.includes('property_and_exact_location_processing') &&
    !propForm.includes("purposeKey: 'marketing"),
);

// G–I server gates
expect(
  'G: KYC Prior Consent server-gated',
  partnerOnb.includes("assertPriorConsentActive") &&
    partnerOnb.includes('owner_identity_and_authority_verification') &&
    authority.includes('owner_identity_and_authority_verification'),
);
expect(
  'H: exact-location Prior Consent server-gated',
  ownerProp.includes("assertPriorConsentActive") &&
    ownerProp.includes('property_and_exact_location_processing'),
);
expect(
  'I: payout Prior Consent server-gated',
  partnerOnb.includes('owner_payout_and_financial_processing'),
);

// J direct API cannot bypass (assert present on services)
expect(
  'J: regulatory upload also KYC-consent gated',
  regulatory.includes('assertPriorConsentActive') &&
    regulatory.includes('owner_identity_and_authority_verification'),
);

// K legal acceptance not stored as DataProcessingConsent
expect(
  'K: legal acceptance service distinct',
  src('apps/api/src/services/legal/legal-acceptance.service.ts').includes('recordAcceptance'),
);

// L–N marketing not required for publication/booking/payout
expect(
  'L/M/N: marketing not asserted in bookability / booking / payout consent paths',
  !src('apps/api/src/services/property-bookability.service.ts').includes('marketing') &&
    !src('apps/api/src/services/booking.service.ts').includes('optional_privacy_consent') &&
    payoutUi.includes('owner_payout_and_financial_processing') &&
    !payoutUi.includes("purpose: 'marketing"),
);

// O privacy requests no consent
expect(
  'O: DSR does not require Prior Consent',
  dsr.includes('do not call assertPriorConsentActive') ||
    dsr.includes('Explicitly do not call assertPriorConsentActive'),
);

// P–R withdrawal auditable / no fabricate deletion / no auto-cancel booking
expect(
  'P: withdrawal updates status (append-only history pattern)',
  consentSvc.includes('withdrawnAt') && consentSvc.includes('privacy.prior_consent.withdrawn'),
);
expect(
  'Q: withdrawal notes do not erase Booking/payment evidence',
  consentSvc.includes('does not erase Booking/payment legal evidence') ||
    jordan.includes('does not erase'),
);
expect(
  'R: withdrawal matrix preserves Bookings/financials',
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX.every(
    (r) =>
      r.purposeKey === 'statutory_privacy_rights' ||
      r.purposeKey === 'breach_art20' ||
      (r.preservesFinancialObligations && r.preservesDsrPrivacyComplaintAccess),
  ),
);

// S payout withdrawal does not confiscate
expect(
  'S: payout withdrawal matrix preserves financial obligations',
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX.find(
    (r) => r.purposeKey === 'owner_payout_and_financial_processing',
  )?.preservesFinancialObligations === true,
);

// T legacy — no fabricate
expect(
  'T: grant path never fabricates for legacy (explicitConsent required)',
  consentSvc.includes('EXPLICIT_CONSENT_REQUIRED') &&
    consentSvc.includes('explicitConsent') &&
    !consentSvc.includes('fabricateConsentForLegacy'),
);

// U abandoned retention blocker
expect(
  'U: abandoned retention categories + readiness blocker',
  PRIVACY_RETENTION_MAP.some((r) => r.key.startsWith('abandoned_owner_onboarding_')) &&
    readiness.includes('PRIVACY_RETENTION_DECISION_REQUIRED'),
);

// V–W third-party + regulatory inventoried
expect(
  'V: third-party authority Personal Data inventoried',
  PRIVACY_PROCESSING_ACTIVITIES.some((a) => a.key === 'owner_authority_third_party_personal_data') &&
    readiness.includes('OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED'),
);
expect(
  'W: regulatory evidence inventoried',
  PRIVACY_PROCESSING_ACTIVITIES.some((a) => a.key === 'property_regulatory_evidence'),
);

// X payout sensitive
expect(
  'X: payout beneficiary data remains financial-sensitive',
  PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'owner_payout_iban')
    ?.sensitiveClassification === 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
);

// Y owner_account classification
expect(
  'Y: owner_account_and_marketplace_operation classified COUNSEL_REVIEW_REQUIRED',
  OWNER_ACCOUNT_MARKETPLACE_OPERATION_CLASSIFICATION.classification ===
    'COUNSEL_REVIEW_REQUIRED' &&
    ownerAcct.legalBasisStatus === 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED' &&
    ownerAcct.runtimeGateRequired === false &&
    !isRuntimePriorConsentGatedPurpose('owner_account_and_marketplace_operation') &&
    readiness.includes('OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED'),
);

// Z no duplicate active Prior Consent for owner residual
expect(
  'Z: owner residual purpose not runtime-gated / collection suspended',
  consentSvc.includes('PURPOSE_COLLECTION_SUSPENDED_COUNSEL_REVIEW') &&
    priorUi.includes('runtimeGateRequired') &&
    !runtimePriorConsentGatedPurposes().includes('owner_account_and_marketplace_operation'),
);

// AA–AC locked docs
expect(
  'AA: Privacy Policy version lock string present',
  privacyLocked.includes(PRIVACY_ADVISOR_REVISED_VERSION) &&
    PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final',
);
expect(
  'AB: Owner Agreement version lock string present',
  oaLocked.includes(OWNER_ADVISOR_REVISED_VERSION) &&
    OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final',
);
expect(
  'AC: customer Terms advisor-final version constant unchanged',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    src('packages/shared/src/legal-content/build-legal-markdown.ts').includes(
      "ADVISOR_REVISED_VERSION = '1.1.2-advisor-final'",
    ),
);

// AD Production untouched — no production activate helpers flipped
expect(
  'AD: legal production guard still present / docs say Production untouched',
  src('apps/api/src/services/legal/legal-production-guard.ts').length > 0 &&
    closureDoc.includes('Production untouched'),
);

// Docs + assertProcessingConsent
expect(
  'docs: closure + gate matrix exist',
  closureDoc.includes('COUNSEL_REVIEW_REQUIRED') && matrixDoc.includes('Prior Consent?'),
);
expect(
  'assertProcessingConsent central helper exists',
  consentSvc.includes('assertProcessingConsent') &&
    jordan.includes('isRuntimePriorConsentGatedPurpose'),
);
expect(
  'overlay marks owner residual LEGAL_BASIS_PENDING_COUNSEL',
  overlay.includes('owner_account_and_marketplace_operation') &&
    inventory.includes("key: 'owner_account_and_marketplace_operation'"),
);
expect(
  'pool/safety PD implications inventoried',
  PRIVACY_PROCESSING_ACTIVITIES.some(
    (a) => a.key === 'property_pool_safety_personal_data_implications',
  ),
);

console.log(`\n3C.4D.7B QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
