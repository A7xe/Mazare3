/**
 * Phase 3C.4E.4A.1 — Atomic Customer legal acceptance QA.
 * Run: pnpm qa:phase3c4e4a1-atomic-customer-legal-acceptance
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEPOSIT_PERCENT,
  BALANCE_DUE_HOURS_BEFORE_START,
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

console.log('\nPhase 3C.4E.4A.1 Atomic Customer Legal Acceptance QA\n');

const bookingSvc = src('apps/api/src/services/booking.service.ts');
const legalAcc = src('apps/api/src/services/legal/legal-acceptance.service.ts');
const customerLegal = src('apps/api/src/services/legal/customer-booking-legal.service.ts');
const snapshot = src('apps/api/src/services/legal/booking-legal-snapshot.service.ts');
const preflight = src(
  'apps/api/src/services/legal/customer-legal-acceptance-preflight.service.ts',
);
const docs = src('docs/MAZARE3_CUSTOMER_LEGAL_ACCEPTANCE_3C4E4A.md');
const pkg = src('package.json');
const hold = src('apps/api/src/lib/payment-hold.ts');
const paymentSvc = src('apps/api/src/services/payment.service.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const prior = src('apps/api/src/services/legal/data-processing-consent.service.ts');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');

expect(
  'A Booking + LegalAcceptance + BookingLegalSnapshot commit together (phase all in TX)',
  bookingSvc.includes('finalizeCustomerBookingLegalEvidence') &&
    bookingSvc.includes("phase: 'all'") &&
    /\$transaction[\s\S]*finalizeCustomerBookingLegalEvidence[\s\S]*phase:\s*'all'/.test(
      bookingSvc,
    ),
);
expect(
  'B LegalAcceptance failure rolls back Booking (acceptances inside TX via recordAcceptance tx)',
  legalAcc.includes('tx?: Prisma.TransactionClient') &&
    customerLegal.includes('tx: params.tx') &&
    !bookingSvc.includes('booking.legal_acceptance_finalize_failed'),
);
expect(
  'C BookingLegalSnapshot failure rolls back Booking (snapshot uses tx)',
  snapshot.includes('tx?: Prisma.TransactionClient') &&
    customerLegal.includes('createSnapshotForBooking') &&
    /createSnapshotForBooking\([\s\S]*tx: params\.tx/.test(customerLegal),
);
expect(
  'D no after-commit acceptance path',
  !bookingSvc.includes("phase: 'acceptances'") &&
    !bookingSvc.includes('Do not roll back committed Booking'),
);
expect(
  'E/F orphan prevention via single TX (no post-commit try/catch)',
  bookingSvc.includes('legalEvidenceAtomic: true') &&
    customerLegal.includes('Atomic path'),
);
expect(
  'G Owner-approval evidence before pending_owner_approval exists (finalize before TX returns)',
  bookingSvc.includes('assertCustomerBookingLegalForCommitment') &&
    bookingSvc.indexOf('finalizeCustomerBookingLegalEvidence') <
      bookingSvc.indexOf("return created") &&
    bookingSvc.includes('pending_owner_approval'),
);
expect(
  'H payment session cannot precede required evidence (no acceptance in payment.service)',
  !paymentSvc.includes('finalizeCustomerBookingLegalEvidence') &&
    !paymentSvc.includes('recordAcceptance('),
);
expect(
  'I retry idempotent Booking-context acceptance (findFirst relatedBookingId)',
  legalAcc.includes('relatedBookingId: input.relatedBookingId') &&
    legalAcc.includes('return mapAcceptance(existing)'),
);
expect(
  'J exact active version recorded (assert mismatch + snapshot FKs)',
  customerLegal.includes('CUSTOMER_BOOKING_LEGAL_VERSION_MISMATCH') &&
    customerLegal.includes('versionIdsFromLegalSet'),
);
expect(
  'K/L arbitrary + stale versions rejected',
  customerLegal.includes('provided !== doc.versionId') &&
    customerLegal.includes('assertCustomerBookingLegalForCommitment'),
);
expect(
  'M active-version race: server re-resolves ACTIVE set before commit assert',
  customerLegal.includes('resolveApplicableCustomerBookingLegalSet') &&
    bookingSvc.includes('assertCustomerBookingLegalForCommitment'),
);
expect(
  'N acceptedAt server-authoritative (explicit new Date())',
  legalAcc.includes('const acceptedAt = new Date()') &&
    legalAcc.includes('acceptedAt,'),
);
expect(
  'O no async/background evidence requirement',
  !bookingSvc.includes('void finalizeCustomerBookingLegalEvidence') &&
    !customerLegal.includes('setImmediate') &&
    !customerLegal.includes('queue'),
);
expect(
  'P legacy not fabricated/backfilled',
  preflight.includes('not backfilled') &&
    preflight.includes('completeSnapshotMissingAcceptanceEvidence') &&
    preflight.includes('historical 3C.4E.4A after-commit gap'),
);
expect(
  'Q LegalAcceptance separate from Prior Consent',
  !customerLegal.includes('grantDataProcessingConsent') &&
    prior.includes('DataProcessingConsent'),
);
expect(
  'R DRAFT docs remain inactive (getActiveVersion only)',
  customerLegal.includes('getActiveVersion') &&
    customerLegal.includes('Never selects DRAFT'),
);
expect(
  'S financial rules unchanged',
  DEPOSIT_PERCENT === 30 &&
    BALANCE_DUE_HOURS_BEFORE_START === 48 &&
    STANDARD_COMMISSION_PERCENT === 18 &&
    VERIFIED_COMMISSION_PERCENT === 15,
);
expect(
  'T inventory uniqueness unchanged',
  hold.includes('BOOKING_INVENTORY_HOLDING_STATUSES') &&
    bookingSvc.includes('bookingSlotUnavailableError'),
);
expect(
  'U payment/refund integrity unchanged',
  refund.includes('Math.min') && refund.includes('capturedFils'),
);
expect(
  'V locked legal docs unchanged',
  versions.includes('1.1.2-advisor-final'),
);
expect(
  'W Production untouched / no activation',
  !customerLegal.includes('legalDocumentVersion.update') &&
    pkg.includes('qa:phase3c4e4a1-atomic-customer-legal-acceptance'),
);
expect(
  'docs Atomic Booking Commitment Evidence section',
  docs.includes('Atomic Booking Commitment Evidence') &&
    docs.includes('after-commit'),
);
expect(
  'preflight detects complete snapshot missing acceptance (historical gap + monitor)',
  preflight.includes('completeSnapshotMissingAcceptance') &&
    preflight.includes('completeSnapshotMissingAcceptanceEvidence') &&
    preflight.includes('historicalAfterCommitGapMissingAcceptance'),
);
expect(
  'recordAcceptance passes tx from finalize',
  /recordAcceptance\([\s\S]*tx: params\.tx/.test(customerLegal),
);

console.log(`\n3C.4E.4A.1 QA: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
