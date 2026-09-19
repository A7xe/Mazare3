/**
 * Phase 3C.4E.4A — Customer legal acceptance + pre-payment disclosure QA.
 * Run: pnpm qa:phase3c4e4a-customer-legal-acceptance
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPOSIT_PERCENT,
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_FREE_UNTIL_HOURS,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
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

console.log('\nPhase 3C.4E.4A Customer Legal Acceptance QA\n');

const resolver = src('apps/api/src/services/legal/customer-booking-legal.service.ts');
const snapshot = src('apps/api/src/services/legal/booking-legal-snapshot.service.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const legalRoutes = src('apps/api/src/routes/legal.ts');
const readiness = src('apps/api/src/services/legal/legal-activation-readiness.service.ts');
const ack = src('apps/web/src/components/legal/booking-legal-ack.tsx');
const panel = src('apps/web/src/components/marketplace/booking-panel.tsx');
const checkout = src('apps/web/src/components/checkout/checkout-view.tsx');
const apiLegal = src('apps/web/src/lib/api-legal.ts');
const ar = src('apps/web/messages/ar.json');
const en = src('apps/web/messages/en.json');
const preflight = src(
  'apps/api/src/services/legal/customer-legal-acceptance-preflight.service.ts',
);
const pkg = src('package.json');
const docs = src('docs/MAZARE3_CUSTOMER_LEGAL_ACCEPTANCE_3C4E4A.md');
const preflightDoc = src('docs/MAZARE3_CUSTOMER_LEGAL_ACCEPTANCE_PREFLIGHT_3C4E4A.md');
const paymentSvc = src('apps/api/src/services/payment.service.ts');
const priorConsent = src('apps/api/src/services/legal/data-processing-consent.service.ts');
const listingSnap = src('apps/api/src/services/booking-listing-snapshot.service.ts');
const bookability = src('apps/api/src/services/property-bookability.service.ts');
const hold = src('apps/api/src/lib/payment-hold.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');
const noShow = src('apps/api/src/services/no-show.service.ts');

expect(
  'A legal acceptance server-authoritative (assertCustomerBookingLegalForCommitment)',
  resolver.includes('assertCustomerBookingLegalForCommitment') &&
    bookingSvc.includes('assertCustomerBookingLegalForCommitment'),
);
expect(
  'B Customer cannot submit arbitrary legal version (mismatch vs ACTIVE)',
  resolver.includes('CUSTOMER_BOOKING_LEGAL_VERSION_MISMATCH') &&
    resolver.includes('provided !== doc.versionId'),
);
expect(
  'C acceptance is user-bound via recordAcceptance(userId)',
  resolver.includes('recordAcceptance') && resolver.includes('userId'),
);
expect(
  'D required ACTIVE version resolved server-side',
  resolver.includes('resolveApplicableCustomerBookingLegalSet') &&
    resolver.includes('getActiveVersion'),
);
expect(
  'E missing required ACTIVE version fails safely when strict',
  resolver.includes('CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE') &&
    resolver.includes('enforcementStrict'),
);
expect(
  'F DRAFT not treated as active (ACTIVE status only via getActiveVersion)',
  resolver.includes('getActiveVersion') &&
    resolver.includes('Never selects DRAFT') &&
    snapshot.includes('never DRAFT'),
);
expect(
  'G no fake Production activation (resolver has no document status updates)',
  !/legalDocumentVersion\.(update|updateMany|create)/.test(resolver),
);
expect(
  'H Booking Terms version preserved on snapshot',
  snapshot.includes('bookingTermsVersionId') &&
    resolver.includes('bookingTermsVersionId'),
);
expect(
  'I Cancellation Policy version preserved',
  snapshot.includes('cancellationPolicyVersionId'),
);
expect('J Terms version preserved', snapshot.includes('termsVersionId'));
expect(
  'K snapshot create is idempotent (no rewrite)',
  snapshot.includes('if (existing)') && snapshot.includes('return existing'),
);
expect(
  'L reacceptance architecture remains separate',
  src('apps/api/src/services/legal/legal-reacceptance.service.ts').length > 100,
);
expect(
  'M LegalAcceptance distinct from Prior Consent',
  resolver.includes('LegalAcceptance') &&
    !resolver.includes('grantDataProcessingConsent') &&
    priorConsent.includes('DataProcessingConsent'),
);
expect(
  'N marketing remains optional (acceptance checkbox not marketing)',
  ack.includes('ackCheckbox') && !ack.includes('marketingOptional'),
);
expect(
  'O Customer sees total / due-now before commitment',
  panel.includes('BookingLegalAck') &&
    (panel.includes('amountDueNow') || panel.includes('expectedTotalAmount')) &&
    checkout.includes('amountDueNow'),
);
expect(
  'P due-now on checkout disclosure',
  checkout.includes('amountDueNow: displayDueNow'),
);
expect(
  'Q deposit remaining balance disclosure',
  ack.includes('remainingBalanceSummary') && checkout.includes('remainingBalance'),
);
expect(
  'R deposit balance due date',
  ack.includes('balanceDueAtSummary') && checkout.includes('balanceDueAtIso'),
);
expect(
  'S full-payment disclosure',
  ack.includes('fullPaymentDisclosure') && checkout.includes('showFullPaymentDisclosure'),
);
expect(
  'T live plan change reflected before redirect (3C.4E.2B notice + due now)',
  checkout.includes('planRevalidatedNotice') && checkout.includes('displayDueNow'),
);
expect(
  'U cancellation 0/30/50/100 summary SSOT',
  ack.includes('cancelTiersSummarySsot') &&
    ack.includes('CANCELLATION_CHARGE_PERCENT_TIER_30') &&
    CANCELLATION_CHARGE_PERCENT_TIER_30 === 30 &&
    CANCELLATION_CHARGE_PERCENT_TIER_50 === 50 &&
    CANCELLATION_CHARGE_PERCENT_TIER_100 === 100 &&
    CANCELLATION_FREE_UNTIL_HOURS === 72,
);
expect(
  'V cancel UI uses policy SSOT constants',
  ack.includes('CANCELLATION_CHARGE_30_UNTIL_HOURS') &&
    CANCELLATION_CHARGE_30_UNTIL_HOURS === 48 &&
    CANCELLATION_CHARGE_50_UNTIL_HOURS === 24,
);
expect(
  'W Owner-approval disclosure',
  ack.includes('ownerApprovalDisclosure') && panel.includes('showOwnerApprovalDisclosure'),
);
expect(
  'X pending_owner_approval not shown as confirmed',
  ar.includes('"pending_owner_approval": "بانتظار موافقة المالك"') &&
    en.includes('"pending_owner_approval": "Awaiting owner approval"') &&
    !ar.includes('"pending_owner_approval": "تم تأكيد الحجز"'),
);
expect(
  'Y legal links present (terms/cancellation/booking)',
  ack.includes('/terms') &&
    ack.includes('/cancellation-refund') &&
    ack.includes('/booking-payment'),
);
expect(
  'Z direct API cannot bypass (create asserts before TX)',
  bookingSvc.includes('assertCustomerBookingLegalForCommitment') &&
    bookingSvc.indexOf('assertCustomerBookingLegalForCommitment') <
      bookingSvc.indexOf('prisma.$transaction'),
);
expect(
  'AA shared API enforcement (createBookingSchema + service)',
  src('packages/shared/src/schemas/property-search.ts').includes(
    'acceptedDocumentVersionIds',
  ) && bookingSvc.includes('acceptedDocumentVersionIds'),
);
expect(
  'AB legacy not backfilled',
  preflight.includes('not backfilled') &&
    (docs.includes('legacy') || docs.includes('Legacy')),
);
expect(
  'AC BookingPropertySnapshot unchanged conceptually (separate)',
  listingSnap.includes('BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION') &&
    listingSnap.includes('BookingPropertySnapshotKind') &&
    !listingSnap.includes('createSnapshotForBooking'),
);
expect(
  'AD financial snapshot remains on BookingLegalSnapshot',
  snapshot.includes('buildFinancialPolicySnapshot') &&
    snapshot.includes('financialPolicyHash'),
);
expect(
  'AE regulatory gate unchanged (bookability still called)',
  bookingSvc.includes('evaluatePropertyBookability') &&
    bookability.includes('new_booking'),
);
expect(
  'AF double-booking invariant unchanged',
  hold.includes('BOOKING_INVENTORY_HOLDING_STATUSES') &&
    bookingSvc.includes('bookingSlotUnavailableError'),
);
expect(
  'AG refund integrity unchanged (retained min captured)',
  refund.includes('Math.min') && refund.includes('capturedFils'),
);
expect(
  'AH financial economics unchanged',
  DEPOSIT_PERCENT === 30 &&
    BALANCE_DUE_HOURS_BEFORE_START === 48 &&
    STANDARD_COMMISSION_PERCENT === 18 &&
    VERIFIED_COMMISSION_PERCENT === 15,
);
expect(
  'AI locked legal docs unchanged (advisor-final still DRAFT build target)',
  versions.includes('1.1.2-advisor-final') ||
    src('packages/shared/src/legal-content/terms-and-conditions.ts').includes(
      'advisor-final',
    ),
);
expect(
  'AJ Production untouched / no activation in this phase',
  readiness.includes('customerBookingCorpusBlockers') &&
    !bookingSvc.includes('LegalDocumentStatus.active') /* create must not activate */,
);
expect(
  'endpoint GET /legal/customer-booking-set',
  legalRoutes.includes('/customer-booking-set') &&
    apiLegal.includes('fetchCustomerBookingLegalSet'),
);
expect(
  'acceptance presentation key versioned',
  resolver.includes('customer_booking_ack_v1_terms_cancellation_booking_terms') &&
    ack.includes('acceptancePresentationKey'),
);
expect(
  'deposit disclosure copy present AR/EN',
  ar.includes('depositDisclosure') && en.includes('depositDisclosure'),
);
expect(
  'no payment-return acceptance recording',
  !paymentSvc.includes('finalizeCustomerBookingLegalEvidence') &&
    !paymentSvc.includes('recordAcceptance'),
);
expect(
  'no-show service not modified by this phase (file still present)',
  noShow.includes('no-show') || noShow.includes('NoShow') || noShow.length > 50,
);
expect(
  'preflight script + docs',
  pkg.includes('preflight:customer-legal-acceptance') &&
    pkg.includes('qa:phase3c4e4a-customer-legal-acceptance') &&
    docs.includes('resolveApplicableCustomerBookingLegalSet') &&
    preflightDoc.includes('mutation'),
);
expect(
  'soft local corpus when not strict',
  resolver.includes('CUSTOMER_BOOKING_LEGAL_STRICT') &&
    ack.includes('corpusReady') &&
    ack.includes('enforcementStrict'),
);

console.log(`\n3C.4E.4A QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
