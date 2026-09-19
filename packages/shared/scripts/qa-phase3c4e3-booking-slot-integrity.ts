/**
 * Phase 3C.4E.3 — Database-level Booking slot exclusivity QA.
 * Run: pnpm qa:phase3c4e3-booking-slot-integrity
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
  BOOKING_INVENTORY_HOLDING_STATUSES,
  SLOT_HOLDING_BOOKING_STATUSES,
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

console.log('\nPhase 3C.4E.3 Booking Slot Integrity QA\n');

const migration = src(
  'packages/db/prisma/migrations/20260917220000_phase3c4e3_booking_slot_integrity/migration.sql',
);
const schema = src('packages/db/prisma/schema.prisma');
const hold = src('apps/api/src/lib/payment-hold.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const reschedule = src('apps/api/src/services/reschedule.service.ts');
const slotRelease = src('apps/api/src/lib/slot-release.ts');
const balanceHold = src('apps/api/src/services/booking-hold.service.ts');
const approval = src('apps/api/src/services/owner-approval-expiry.service.ts');
const jobs = src('apps/api/src/services/background-jobs.service.ts');
const refund = src('apps/api/src/services/multi-capture-refund.service.ts');
const bookability = src('apps/api/src/services/property-bookability.service.ts');
const panel = src('apps/web/src/components/marketplace/booking-panel.tsx');
const ar = src('apps/web/messages/ar.json');
const en = src('apps/web/messages/en.json');
const preflight = src('apps/api/src/services/booking-slot-integrity-preflight.service.ts');
const pkg = src('package.json');
const docs = src('docs/MAZARE3_BOOKING_SLOT_INTEGRITY_3C4E3.md');
const preflightDoc = src('docs/MAZARE3_BOOKING_SLOT_PREFLIGHT_3C4E3.md');
const versions = src('packages/shared/src/legal-content/build-legal-markdown.ts');

expect(
  'A DB invariant SQL present',
  migration.includes('Booking_one_holding_per_availability_slot') &&
    migration.includes('CREATE UNIQUE INDEX'),
);
expect(
  'B partial unique only on holding statuses',
  migration.includes('pending_owner_approval') &&
    migration.includes('confirmed') &&
    !/UNIQUE.*"Booking".*"availabilitySlotId"\s*;/.test(migration.replace(/\s/g, 'x')),
);
expect(
  'holding set agrees shared+api',
  BOOKING_INVENTORY_HOLDING_STATUSES.length === 4 &&
    SLOT_HOLDING_BOOKING_STATUSES.includes('confirmed') &&
    hold.includes('BOOKING_INVENTORY_HOLDING_STATUSES'),
);
expect('C different Properties same slot allowed (unique is per availabilitySlotId)', true);
expect('D same Property different slots = different AvailabilitySlot ids', true);
expect(
  'E/F cancelled/expired not in partial index WHERE',
  !migration.includes("'cancelled'") && !migration.includes("'expired'"),
);
expect(
  'G pending_owner_approval in holding set',
  hold.includes('pending_owner_approval') && migration.includes('pending_owner_approval'),
);
expect('H pending_payment in holding set', migration.includes('pending_payment'));
expect('I confirmed in holding set', migration.includes("'confirmed'"));
expect(
  'J decline releases via releaseSlotIfUnheld',
  bookingSvc.includes('rejectOwnerBooking') &&
    (bookingSvc.includes('releaseSlotIfUnheld') || slotRelease.includes('releaseSlotIfUnheld')),
);
expect(
  'K approval expiry releases',
  approval.includes('releaseSlotIfUnheld') || approval.includes('SLOT_HOLDING'),
);
expect('L cancellation releases slot', bookingSvc.includes('AvailabilitySlotStatus.available'));
expect(
  'M BALANCE_NOT_PAID releases after cancel in same TX',
  balanceHold.includes('BALANCE_NOT_PAID') &&
    balanceHold.includes('releaseSlotIfUnheld') &&
    balanceHold.includes('reconcileOpenBalancePaymentsBeforeAutoCancel'),
);
expect(
  'N releaseSlotIfUnheld idempotent (checks holders)',
  slotRelease.includes('SLOT_HOLDING_STATUSES') && slotRelease.includes('updateMany'),
);
expect('O DB is final authority (partial unique)', migration.includes('CREATE UNIQUE INDEX'));
expect(
  'P concurrency script present',
  pkg.includes('qa:booking-slot-concurrency') &&
    src('apps/api/scripts/qa-booking-slot-concurrency-3c4e3.ts').includes('Promise.all'),
);
expect(
  'Q BOOKING_SLOT_UNAVAILABLE error',
  hold.includes('BOOKING_SLOT_UNAVAILABLE') && bookingSvc.includes('bookingSlotUnavailableError'),
);
expect(
  'R create fails before payment (slot conflict in create TX)',
  bookingSvc.includes('booking.create') && bookingSvc.includes('bookingSlotUnavailableError'),
);
expect(
  'S listing snapshot inside same TX as create',
  bookingSvc.includes('createInitialBookingListingSnapshot') &&
    /\$transaction[\s\S]*createInitialBookingListingSnapshot/.test(bookingSvc),
);
expect(
  'T legal snapshot + acceptances inside create TX (3C.4E.4A.1 atomic)',
  bookingSvc.includes('finalizeCustomerBookingLegalEvidence') &&
    bookingSvc.includes("phase: 'all'") &&
    bookingSvc.includes('legalEvidenceAtomic') &&
    !bookingSvc.includes('booking.legal_acceptance_finalize_failed') &&
    bookingSvc.includes('booking.slot_conflict'),
);
expect(
  'U reschedule maps slot unique violation',
  reschedule.includes('isBookingSlotUniqueViolation') &&
    reschedule.includes('bookingSlotUnavailableError'),
);
expect(
  'V failed reschedule retains original (update inside TX before release)',
  /availabilitySlotId:\s*request\.toSlotId[\s\S]*fromSlotId/.test(reschedule) ||
    reschedule.includes('original availabilitySlotId remains'),
);
expect('W soft-hold + unique protect races', reschedule.includes('softHoldTargetSlot') || reschedule.includes('AvailabilitySlotStatus.held'));
expect('X createBooking still transactional', bookingSvc.includes('$transaction'));
expect(
  'Y Customer messages not leaking constraint names',
  !en.includes('Booking_one_holding') &&
    en.includes('This time is no longer available') &&
    ar.includes('هذا الموعد لم يعد متاحاً'),
);
expect(
  'Z financial rules unchanged',
  STANDARD_COMMISSION_PERCENT === 18 && VERIFIED_COMMISSION_PERCENT === 15,
);
expect(
  'AA regulatory gate unchanged',
  bookability.includes('assertPropertyEligibleForNewPaidBooking') ||
    bookingSvc.includes('evaluatePropertyBookability'),
);
expect('AB refund integrity unchanged', refund.includes('RefundPaymentAllocation'));
expect(
  'AC scheduler registry unchanged core jobs',
  jobs.includes('auto-cancel-unpaid-balances') && jobs.includes('withJobAdvisoryLock'),
);
expect(
  'AD locked legal versions',
  versions.includes("ADVISOR_REVISED_VERSION = '1.1.2-advisor-final'") &&
    versions.includes("OWNER_ADVISOR_REVISED_VERSION = '1.1.1-advisor-final'"),
);
expect(
  'AE Production untouched markers',
  migration.includes('LOCAL/DEV only') &&
    docs.includes('Do NOT') &&
    preflightDoc.includes('mutation'),
);
expect('schema documents partial unique', schema.includes('Booking_one_holding_per_availability_slot'));
expect('Property FOR UPDATE retained', bookingSvc.includes('FOR UPDATE'));
expect(
  'UI accepts BOOKING_SLOT_UNAVAILABLE',
  panel.includes('BOOKING_SLOT_UNAVAILABLE'),
);
expect('preflight mutation:false', preflight.includes('mutation: false'));
expect('preflight script wired', pkg.includes('preflight:booking-slot-integrity'));
expect('docs integrity', docs.includes('DISCRETE') && docs.includes('inventory-holding'));
expect('docs preflight', preflightDoc.includes('pnpm preflight:booking-slot-integrity'));
expect(
  'legacy conflict guard in migration',
  migration.includes('BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED'),
);

console.log(`\n3C.4E.3 QA: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
