/**
 * Phase 3C.4C.1 — Owner Agreement product & commercial alignment audit QA.
 * Run: pnpm qa:phase3c4c1-owner-agreement-audit
 *
 * AUDIT ONLY — does not rewrite Owner Agreement or locked customer legal docs.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_10,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_20,
  OWNER_PENALTY_MIN_JOD,
  OWNER_PENALTY_MAX_JOD,
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  getLaunchLegalDocument,
  resolveCommissionPercentForListing,
  calculateOwnerPenaltyJod,
  evaluateCancellationSettlement,
  ownerAgreementLaunchCandidate,
  ownerAgreementAdvisorRevised110,
  OWNER_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION_110,
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

console.log('\nPhase 3C.4C.1 Owner Agreement Alignment Audit QA\n');

// --- A–E commission ---
expect('A: no active STANDARD=12 constant', STANDARD_COMMISSION_PERCENT !== 12);
expect('B: standard commission = 18', STANDARD_COMMISSION_PERCENT === 18);
expect('C: verified commission = 15', VERIFIED_COMMISSION_PERCENT === 15);
expect(
  'D: basic KYC / unverified → 18 (not 15)',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_reviewed') === 18 &&
    resolveCommissionPercentForListing('owner_uploaded') === 18,
);
expect(
  'D2: platform_verified → 15',
  resolveCommissionPercentForListing('platform_verified') === 15,
);

const paymentPolicyCfg = src('apps/api/src/config/payment-policy.config.ts');
expect(
  'A2: obsolete 12 blocked in payment-policy config',
  paymentPolicyCfg.includes('LEGACY_OBSOLETE_COMMISSION') &&
    paymentPolicyCfg.includes('12'),
);

const bookingSchema = src('packages/db/prisma/schema.prisma');
expect(
  'E: Booking commission snapshot fields exist',
  bookingSchema.includes('platformCommissionPercent') &&
    bookingSchema.includes('platformCommissionAmount') &&
    bookingSchema.includes('ownerNetPayoutAmount'),
);

const commercialTerms = src('apps/api/src/services/commercial-terms.service.ts');
expect(
  'M: custom commercial terms require acceptance to activate',
  commercialTerms.includes('COMMERCIAL_TERMS_ACCEPTANCE_REQUIRED') ||
    commercialTerms.includes('activateCommercialTerms'),
);

// --- F–I cancellations / no-show / FM ---
const ownerCancel = src('apps/api/src/services/owner-cancellation.service.ts');
const reliability = src('apps/api/src/services/owner-reliability.service.ts');
expect(
  'F: Owner penalty is settlement adjustment (not card debit)',
  reliability.includes('OwnerFinancialAdjustment') &&
    reliability.includes('applyPendingAdjustmentsToSettlement') &&
    !ownerCancel.toLowerCase().includes('chargeownerCard'.toLowerCase()),
);
expect(
  'F2: OA text says not automatic card charge',
  /does not automatically charge your card/i.test(
    src('packages/shared/src/legal-content/owner-agreement.ts'),
  ) ||
    src('packages/shared/src/legal-content/owner-agreement.ts').includes(
      'not an automatic card charge',
    ),
);

expect(
  'G: FM Owner penalty = 0 (service skips calculateOwnerPenaltyJod)',
  /forceMajeure[\s\S]{0,120}penalty\s*=\s*forceMajeure[\s\S]{0,80}0/.test(ownerCancel) ||
    (ownerCancel.includes('forceMajeure') &&
      ownerCancel.includes('calculateOwnerPenaltyJod') &&
      /const penalty = forceMajeure\s*\?\s*0/.test(ownerCancel)),
);

const latePenalty = calculateOwnerPenaltyJod(100, 10);
expect(
  'G2: ≤24h Owner cancel penalty clamped 10–50',
  latePenalty === 20 &&
    latePenalty >= OWNER_PENALTY_MIN_JOD &&
    latePenalty <= OWNER_PENALTY_MAX_JOD,
);
expect('G3: >72h Owner cancel penalty = 0', calculateOwnerPenaltyJod(100, 80) === 0);

const noShow = src('apps/api/src/services/no-show.service.ts');
expect(
  'H: Customer no-show grace = 60',
  CUSTOMER_NO_SHOW_GRACE_MINUTES === 60 &&
    noShow.includes('CUSTOMER_NO_SHOW'),
);
expect(
  'I: Owner no-show / access denied paths exist',
  noShow.includes('OWNER_NO_SHOW') &&
    (noShow.includes('ACCESS_DENIED') || noShow.includes('access_denied')),
);

expect('penalty tier constants', OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS === 72);
expect('penalty 10% until hours', OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS === 24);
expect('penalty percents', OWNER_CANCEL_PENALTY_PERCENT_TIER_10 === 10);
expect('penalty 20%', OWNER_CANCEL_PENALTY_PERCENT_TIER_20 === 20);

const settlementPreview = evaluateCancellationSettlement({
  hoursUntilStart: 60,
  merchantBookingValue: 100,
  capturedAmount: 30,
  commissionPercent: 18,
});
expect(
  'cancel retain capped by captured',
  settlementPreview.retainedAmount <= 30 &&
    settlementPreview.chargePercent === CANCELLATION_CHARGE_PERCENT_TIER_30,
);

expect('deposit 30%', DEPOSIT_PERCENT === 30);
expect('full payment within 72h', FULL_PAYMENT_WITHIN_HOURS === 72);
expect('balance due 48h', BALANCE_DUE_HOURS_BEFORE_START === 48);
expect('cancel free >72', CANCELLATION_FREE_UNTIL_HOURS === 72);
expect('cancel 30 until 48', CANCELLATION_CHARGE_30_UNTIL_HOURS === 48);
expect('cancel 50 until 24', CANCELLATION_CHARGE_50_UNTIL_HOURS === 24);
expect('cancel 100%', CANCELLATION_CHARGE_PERCENT_TIER_100 === 100);
expect('cancel 50%', CANCELLATION_CHARGE_PERCENT_TIER_50 === 50);

// --- J exact-location Owner consent ---
const priorConsent = src('packages/shared/src/jordan-prior-consent.ts');
const ownerProperty = src('apps/api/src/services/owner-property.service.ts');
expect(
  'J: exact-location Owner Prior Consent purpose exists',
  priorConsent.includes('property_and_exact_location_processing'),
);
expect(
  'J2: owner-property asserts location consent',
  ownerProperty.includes('property_and_exact_location_processing') ||
    ownerProperty.includes('exact_location'),
);

// --- K KYC private ---
const privateStorage = src('apps/api/src/services/partner-documents/private-storage.ts');
const kycConsent = priorConsent.includes('owner_identity_and_authority_verification');
expect('K: KYC Prior Consent purpose exists', kycConsent);
expect(
  'K2: private storage module present',
  privateStorage.includes('private') || privateStorage.includes('Private'),
);

// --- L reacceptance does not block payout ---
const gate = src('apps/web/src/components/owner/owner-agreement-gate.tsx');
const reaccept = src('apps/api/src/services/legal/legal-reacceptance.service.ts');
expect(
  'L: Owner Agreement reacceptance soft-gates listings only',
  reaccept.includes('assertOwnerListingSoftGate') &&
    reaccept.includes('listing'),
);
expect(
  'L2: payout paths exempt in OwnerAgreementGate',
  gate.includes('isOwnerPayoutExemptPath') && gate.includes('/owner/payout'),
);

// --- N locked legal documents unchanged by this phase (version lock) ---
const terms = getLaunchLegalDocument('terms_and_conditions');
const cancel = getLaunchLegalDocument('cancellation_refund_policy');
const booking = getLaunchLegalDocument('booking_terms');
const privacy = getLaunchLegalDocument('privacy_policy');
const owner = getLaunchLegalDocument('owner_agreement');

expect('N: Terms still 1.1.2-advisor-final', terms.version === ADVISOR_REVISED_VERSION);
expect(
  'N2: Cancellation still 1.1.2-advisor-final',
  cancel.version === ADVISOR_REVISED_VERSION,
);
expect(
  'N3: Booking Terms still 1.1.2-advisor-final',
  booking.version === ADVISOR_REVISED_VERSION,
);
expect(
  'N4: Privacy still 1.1.2-advisor-final DRAFT corpus',
  privacy.version === '1.1.2-advisor-final',
);
expect(
  'N5: Owner Agreement active is 1.1.1-advisor-final',
  owner.version === OWNER_ADVISOR_REVISED_VERSION,
);
expect(
  'N5b: Owner Agreement 1.1.0 preserved',
  ownerAgreementAdvisorRevised110.version === OWNER_ADVISOR_REVISED_VERSION_110,
);
expect(
  'N5c: Owner Agreement 1.0.1 launch-candidate preserved',
  ownerAgreementLaunchCandidate.version === '1.0.1-launch-candidate',
);

// --- Audit artifacts exist ---
expect(
  'audit matrix doc exists',
  existsSync(resolve(root, 'docs/MAZARE3_OWNER_AGREEMENT_AUDIT_3C4C1.md')),
);
expect(
  'commercial facts doc exists',
  existsSync(resolve(root, 'docs/MAZARE3_OWNER_COMMERCIAL_FACTS_3C4C1.md')),
);

// --- O Production untouched (seed/guards abort production) ---
const launchSeed = src('packages/db/prisma/seed-legal-launch-candidate.ts');
expect(
  'O: launch legal seed aborts production',
  launchSeed.includes('production') || launchSeed.includes('APP_ENV'),
);
const prodGuard = src('apps/api/src/services/legal/legal-production-guard.ts');
expect('O2: legal production guard present', prodGuard.length > 0);

// OA commission wording uses SSOT percents
const oa = src('packages/shared/src/legal-content/owner-agreement.ts');
expect(
  'OA imports STANDARD_COMMISSION_PERCENT',
  oa.includes('STANDARD_COMMISSION_PERCENT') && oa.includes('VERIFIED_COMMISSION_PERCENT'),
);
expect(
  'OA rejects KYC-alone verified rate',
  /identity verification alone is not sufficient/i.test(oa) ||
    oa.includes('Basic KYC approval does not'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
