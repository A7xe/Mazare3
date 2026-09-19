/**
 * Phase 3C.4B.1.5 — Prior Consent runtime closure & Article 6 basis map QA.
 * Run: pnpm qa:phase3c4b1-5-prior-consent-runtime
 *
 * Live DB smoke: pnpm smoke:phase3c4b1-5-prior-consent
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  ARTICLE_6_EXCEPTION_STATUSES,
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS,
  JORDAN_LEGAL_BASIS_STATUSES,
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX,
  PRIVACY_CONSENT_PURPOSES,
  PRIVACY_DPO_READINESS,
  PRIVACY_PROCESSING_ACTIVITIES,
  priorConsentDurationBlocksProductionActivation,
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

console.log('\nPhase 3C.4B.1.5 Prior Consent Runtime Closure QA\n');

const identity = getLegalIdentityFromEnv();
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const support = src('apps/api/src/services/support.service.ts');
const dispute = src('apps/api/src/services/dispute.service.ts');
const dsr = src('apps/api/src/services/legal/data-subject-request.service.ts');
const dpc = src('apps/api/src/services/legal/data-processing-consent.service.ts');
const readiness = src('apps/api/src/services/legal/legal-activation-readiness.service.ts');
const adminLegal = src('apps/api/src/routes/admin-legal.ts');
const breachSvc = src('apps/api/src/services/legal/personal-data-breach.service.ts');
const matrix5 = src('docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_5.md');
const matrix4 = src('docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_4.md');
const privacyPolicy = src('packages/shared/src/legal-content/privacy-policy.ts');
const jordan = src('packages/shared/src/jordan-prior-consent.ts');
const schema = src('packages/db/prisma/schema.prisma');
const migSql = src(
  'packages/db/prisma/migrations/20260914180000_phase3c4b1_4_prior_consent/migration.sql',
);
const smokePath = 'apps/api/scripts/smoke-phase3c4b1-5-prior-consent-runtime.ts';
const smokeScript = src(smokePath);

expect(
  'A migration SQL creates DataProcessingConsent',
  migSql.includes('CREATE TABLE "DataProcessingConsent"'),
);
expect('A Prisma model DataProcessingConsent', schema.includes('model DataProcessingConsent'));
expect(
  'A local smoke script exists for live grant/withdraw',
  smokeScript.includes('SMOKE_OK') && existsSync(resolve(root, smokePath)),
);

expect(
  'B grant/withdraw service present',
  dpc.includes('grantDataProcessingConsent') && dpc.includes('withdrawDataProcessingConsent'),
);
expect('B me prior-consents routes', src('apps/api/src/routes/me.ts').includes("'/prior-consents'"));
expect('B smoke uses DataProcessingConsentStatus.granted/withdrawn', smokeScript.includes('withdrawn'));

expect(
  'C exact-location assert on create/update',
  ownerProp.includes('assertExactLocationPriorConsentIfNeeded') &&
    ownerProp.includes('property_and_exact_location_processing'),
);
expect(
  'C exact fields include address/coords/arrival',
  ownerProp.includes('exactAddress') &&
    ownerProp.includes('latitudeExact') &&
    ownerProp.includes('arrivalInstructionsAr'),
);

expect(
  'D approx fields called out as not requiring exact-location purpose',
  ownerProp.includes('Approximate city/area/approx coords do not require'),
);

expect(
  'E no backfill INSERT for existing location consent',
  !ownerProp.includes('backfill') && !migSql.includes('INSERT INTO "DataProcessingConsent"'),
);

expect(
  'F support asserts support_and_dispute_processing',
  support.includes('assertPriorConsentActive') &&
    support.includes('support_and_dispute_processing'),
);
expect(
  'F dispute asserts support_and_dispute_processing',
  dispute.includes('support_and_dispute_processing'),
);

const supportActivity = PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'reviews_support_disputes');
expect(
  'F support inventory CONFIRMED_TECHNICAL_GATE',
  supportActivity?.runtimeGateStatus === 'CONFIRMED_TECHNICAL_GATE',
);

expect(
  'G DSR explicitly does not require Prior Consent',
  dsr.includes('Must NOT require Prior Consent') &&
    !dsr.includes("assertPriorConsentActive("),
);

expect(
  'H privacy_complaint supported without prior consent gate',
  schema.includes('privacy_complaint') && dsr.includes('Must NOT require Prior Consent'),
);

expect(
  'I withdraw endpoint remains',
  src('apps/api/src/routes/me.ts').includes('/prior-consents/:purpose/withdraw'),
);
expect(
  'I withdrawal matrix preserves DSR access',
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX.some(
    (r) => r.purposeKey === 'statutory_privacy_rights' && r.preservesDsrPrivacyComplaintAccess,
  ),
);

const breachActivity = PRIVACY_PROCESSING_ACTIVITIES.find(
  (a) => a.key === 'personal_data_breach_response',
);
expect('J breach priorConsentRequired false', breachActivity?.priorConsentRequired === false);
expect(
  'J breach Art. 6(A)(5) pending counsel',
  breachActivity?.jordanLegalBasisStatus === 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
);
expect(
  'J no breach consent checkbox wording in service',
  !breachSvc.toLowerCase().includes('i agree that mazare3 may investigate a breach'),
);

expect(
  'K breach inventory statutory_duty_no_consent',
  breachActivity?.processingStartRelativeToConsent === 'statutory_duty_no_consent',
);

const txn = PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'transactional_notifications');
expect(
  'L/M transactional mapping mentions booking and payment purposes not marketing',
  Boolean(txn?.transactionalNotificationMapping?.includes('marketplace_booking_processing')) &&
    Boolean(txn?.transactionalNotificationMapping?.includes('payment_and_refund_processing')) &&
    Boolean(txn?.transactionalNotificationMapping?.includes('marketing->PrivacyConsent')),
);

const booking = PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'customer_booking');
expect(
  'L booking transactionalNotificationMapping present',
  Boolean(booking?.transactionalNotificationMapping?.includes('not_marketing')),
);

expect(
  'N marketing only on PrivacyConsent purposes',
  PRIVACY_CONSENT_PURPOSES.includes('marketing_email') &&
    !DATA_PROCESSING_CONSENT_PURPOSE_DEFS.some((p) => p.purposeKey.startsWith('marketing')),
);

expect(
  'O no ARTICLE_6_EXCEPTION_CONFIRMED on activities',
  !PRIVACY_PROCESSING_ACTIVITIES.some(
    (a) => a.article6ExceptionStatus === 'ARTICLE_6_EXCEPTION_CONFIRMED',
  ),
);
expect(
  'O ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL is a status',
  JORDAN_LEGAL_BASIS_STATUSES.includes('ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL') &&
    ARTICLE_6_EXCEPTION_STATUSES.includes('ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL'),
);
expect(
  'O DSR mapped to Art. 6(A)(5) pending',
  PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'data_subject_requests')
    ?.jordanLegalBasisStatus === 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
);

expect(
  'P no legitimate-interest / contract-necessity Jordan status',
  !JORDAN_LEGAL_BASIS_STATUSES.some(
    (s) => s.toLowerCase().includes('legitimate') || s.toLowerCase().includes('contract'),
  ),
);

expect(
  'Q booking/KYC/payout still assert Prior Consent',
  src('apps/api/src/services/booking.service.ts').includes('marketplace_booking_processing') &&
    src('apps/api/src/services/partner-onboarding.service.ts').includes(
      'owner_identity_and_authority_verification',
    ) &&
    src('apps/api/src/services/partner-onboarding.service.ts').includes(
      'owner_payout_and_financial_processing',
    ),
);
expect(
  'Q Google pre-consent note remains counsel review',
  jordan.includes('LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED'),
);

expect(
  'R priorConsentDurationBlocksProductionActivation true',
  priorConsentDurationBlocksProductionActivation() === true,
);
expect(
  'R readiness surfaces PRIOR_CONSENT_DURATION_UNRESOLVED',
  readiness.includes('PRIOR_CONSENT_DURATION_UNRESOLVED') &&
    readiness.includes('productionBlockers'),
);

expect('S withdrawal matrix / no forever duration published', !jordan.includes('"forever"'));

expect(
  'T withdraw preserves Booking/payment evidence note',
  dpc.includes('does not erase Booking/payment legal evidence'),
);
expect(
  'T withdrawal matrix preserves financial obligations',
  PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX.every((r) => r.preservesFinancialObligations),
);

expect(
  'U adminCannotGrantConsent + no grant in admin-legal',
  dpc.includes('adminCannotGrantConsent: true') &&
    !adminLegal.includes('grantDataProcessingConsent'),
);

expect(
  'V dpoAppointed false',
  identity.dpoAppointed === false && PRIVACY_DPO_READINESS.dpoAppointed === false,
);

expect(
  'W Privacy Policy DRAFT / not counsel-activated',
  (privacyPolicy.includes('1.1.2-advisor-final') ||
    privacyPolicy.includes('PRIVACY_ADVISOR_REVISED')) &&
    !privacyPolicy.includes('includeInternalBanner: true'),
);
expect(
  'W readiness PRIVACY_POLICY_NOT_FINALISED blocker',
  readiness.includes('PRIVACY_POLICY_NOT_FINALISED'),
);

expect(
  'X ADVISOR_REVISED_VERSION 1.1.2-advisor-final',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final',
);

expect(
  'Y production legal guard still hard-fails production',
  src('apps/api/src/services/legal/legal-production-guard.ts').includes('isProductionRuntime'),
);

expect(
  'matrix 3C4B1_5 exists',
  matrix5.includes('3C.4B.1.5') && matrix5.includes('CONFIRMED TECHNICAL GATE'),
);
expect('matrix 3C4B1_4 superseded banner', matrix4.includes('SUPERSEDED'));

const loc = PRIVACY_PROCESSING_ACTIVITIES.find((a) => a.key === 'exact_property_location');
expect(
  'exact_property_location CONFIRMED_TECHNICAL_GATE',
  loc?.runtimeGateStatus === 'CONFIRMED_TECHNICAL_GATE' &&
    loc?.jordanLegalBasisStatus === 'PRIOR_CONSENT_CONFIRMED',
);

console.log(`\n3C.4B.1.5 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
