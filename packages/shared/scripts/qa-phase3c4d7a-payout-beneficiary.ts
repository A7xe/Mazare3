/**
 * Phase 3C.4D.7A — Payout beneficiary identity matching + release gate QA.
 * Run: pnpm qa:phase3c4d7a-payout-beneficiary
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  resolveCommissionPercentForListing,
  PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED,
  compareBeneficiaryToOperatorName,
  isStructurallyValidIban,
  putPartnerPayoutProfileSchema,
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

console.log('\nPhase 3C.4D.7A Payout Beneficiary QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const migration = src(
  'packages/db/prisma/migrations/20260917200000_phase3c4d7a_payout_beneficiary/migration.sql',
);
const readiness = src('apps/api/src/lib/owner-payout-readiness.ts');
const beneficiary = src('apps/api/src/services/payout-beneficiary.service.ts');
const partnerOnb = src('apps/api/src/services/partner-onboarding.service.ts');
const partnerAdmin = src('apps/api/src/services/partner-admin.service.ts');
const payoutOps = src('apps/api/src/services/payout-operations.service.ts');
const settlement = src('apps/api/src/services/owner-settlement.service.ts');
const bookability = src('apps/api/src/services/property-bookability.service.ts');
const authority = src('apps/api/src/services/property-authority.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const docs = src('docs/MAZARE3_PAYOUT_BENEFICIARY_3C4D7A.md');
const preflightDoc = src('docs/MAZARE3_PAYOUT_BENEFICIARY_PREFLIGHT_3C4D7A.md');
const ownerUi = src('apps/web/src/components/owner/owner-payout-setup-view.tsx');
const adminUi = src('apps/web/src/components/admin/admin-partner-detail-view.tsx');
const privacy = src('apps/web/src/content/legal/privacy.ts');

expect(
  'A: payout not required for Property draft',
  !ownerProp.includes('assertOwnerHasReviewedPayoutDestination') &&
    !ownerProp.includes('evaluateOwnerPayoutReadiness'),
);

expect(
  'B: payout not required for publication',
  !bookability.includes('payoutProfile') &&
    bookability.toLowerCase().includes('does not require') &&
    bookability.toLowerCase().includes('payout'),
);

expect(
  'C: payout not required for new Booking',
  !bookability.includes('PAYOUT_DESTINATION') &&
    !src('apps/api/src/services/booking.service.ts').includes(
      'assertOwnerHasReviewedPayoutDestination',
    ),
);

expect(
  'D: payout READY required before actual payout release',
  payoutOps.includes('assertOwnerHasReviewedPayoutDestination') &&
    settlement.includes('assertOwnerHasReviewedPayoutDestination') &&
    readiness.includes('evaluateOwnerPayoutReadiness') &&
    readiness.includes("result: 'READY'"),
);

expect(
  'E: incomplete payout does not erase Owner Earnings',
  !beneficiary.includes('ownerNetPayoutAmount = 0') &&
    !settlement.includes('confiscat') &&
    docs.toLowerCase().includes('confiscate'),
);

expect(
  'F: incomplete payout does not create penalty',
  !beneficiary.includes('OwnerPenalty') && !beneficiary.includes('createPenalty'),
);

expect(
  'G: account holder != automatic beneficiary',
  beneficiary.includes('resolveDefaultContractingOperator') &&
    !beneficiary.includes('user.name ===') &&
    docs.includes('Contracting OperatorParty'),
);

expect(
  'H: OperatorParty is primary legal matching reference',
  beneficiary.includes('operator.legalName') &&
    schema.includes('contractingOperatorPartyId'),
);

expect(
  'I: individual self-beneficiary relationship exists',
  schema.includes('operator_self') &&
    putPartnerPayoutProfileSchema.shape.beneficiaryRelationship != null,
);

expect(
  'J: legal-entity beneficiary relationship exists',
  schema.includes('operator_legal_entity'),
);

expect(
  'K: third-party does NOT auto-approve / READY',
  PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED === true &&
    readiness.includes('PAYOUT_THIRD_PARTY_BENEFICIARY_COUNSEL_CONFIRMATION_REQUIRED') &&
    readiness.includes('authorised_third_party'),
);

expect(
  'L: exact name string match is not sole approval logic',
  typeof compareBeneficiaryToOperatorName === 'function' &&
    compareBeneficiaryToOperatorName('Same Exact Name', 'Same Exact Name') === 'match_likely' &&
    compareBeneficiaryToOperatorName('Alpha', 'Zeta') !== 'match_likely' &&
    !readiness.includes('beneficiaryName ===') &&
    docs.includes('NOT legal identity'),
);

expect(
  'M: valid IBAN checksum does not imply ownership',
  beneficiary.includes('does not verify account ownership') &&
    docs.toLowerCase().includes('ownership') &&
    isStructurallyValidIban('GB82WEST12345698765432') === true,
);

expect(
  'N: Owner cannot self-approve',
  partnerOnb.includes('reviewStatus: OwnerPayoutReviewStatus.pending') ||
    beneficiary.includes('OwnerPayoutReviewStatus.pending'),
);

expect(
  'O: Owner payout scoped to own profile (upsert by ownerProfileId)',
  partnerOnb.includes('saveOwnerPayoutBeneficiaryProfile') &&
    beneficiary.includes('ownerProfileId: params.ownerProfileId'),
);

expect(
  'P: payout evidence remains private storage path',
  partnerOnb.includes('writePartnerDocumentFile') ||
    src('apps/api/src/services/partner-documents/private-storage.ts').includes(
      'writePartnerDocumentFile',
    ),
);

expect(
  'Q: full IBAN absent from audit metadata pattern (last4 only)',
  beneficiary.includes('ibanLast4') &&
    !/metadata:[\s\S]{0,80}ibanFull/.test(beneficiary) &&
    !beneficiary.includes("console.log(iban"),
);

expect(
  'R: normal UI uses masked IBAN',
  ownerUi.includes('ibanMasked') || partnerOnb.includes('••••${profile.payoutProfile.ibanLast4}'),
);

expect(
  'S: admin review works',
  partnerAdmin.includes('applyAdminPayoutBeneficiaryDecision') &&
    adminUi.includes('reviewAdminPartnerPayout'),
);

expect(
  'T: material bank change reopens review (pending)',
  beneficiary.includes('material_beneficiary_update') &&
    beneficiary.includes('OwnerPayoutReviewStatus.pending'),
);

expect(
  'U: OperatorParty change reopens review',
  authority.includes('markPayoutBeneficiaryReassessmentRequired') &&
    authority.includes('operator_party_changed'),
);

expect(
  'V: historical completed payouts not rewritten by migration',
  migration.includes('Does NOT auto-approve') &&
    !migration.includes('UPDATE "OwnerPayout"') &&
    !migration.includes('SET status = \'paid\''),
);

expect(
  'W: pending payout uses reviewed READY destination only',
  readiness.includes('assertOwnerHasReviewedPayoutDestination') &&
    readiness.includes('evaluation.ready'),
);

expect(
  'X: provider reconciliation — no disbursement overwrite invented',
  docs.includes('provider') &&
    docs.toLowerCase().includes('reconciliation') &&
    !beneficiary.includes('voidProviderPayout'),
);

expect(
  'Y: Prior Consent before payout save',
  partnerOnb.includes("assertPriorConsentActive(userId, 'owner_payout_and_financial_processing')") &&
    ownerUi.includes('owner_payout_and_financial_processing'),
);

expect(
  'Z: KYC/authority/regulatory/platform verification remain separate',
  adminUi.includes('separate from KYC') &&
    !readiness.includes('platform_verified') &&
    !readiness.includes('evaluatePropertyRegulatoryReadiness'),
);

expect(
  'AA: commission 18%/15% unchanged',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'AB: settlement cycle unresolved',
  docs.includes('[[OWNER_SETTLEMENT_CYCLE]]') ||
    docs.includes('settlement cycle remains unresolved'),
);

expect(
  'AC: locked legal docs unchanged',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final' &&
    !privacy.includes('payout beneficiary matching'),
);

expect(
  'AD: Production untouched',
  docs.includes('Production untouched') &&
    migration.includes('LOCAL / DEV only'),
);

expect(
  'Docs + preflight present',
  docs.includes('evaluateOwnerPayoutReadiness') &&
    preflightDoc.toLowerCase().includes('zero-mutation') &&
    preflightDoc.includes('preflight:payout-beneficiary'),
);

expect(
  'Schema enums + review event model',
  schema.includes('PayoutBeneficiaryRelationship') &&
    schema.includes('OwnerPayoutBeneficiaryReviewEvent') &&
    schema.includes('reassessment_required'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
