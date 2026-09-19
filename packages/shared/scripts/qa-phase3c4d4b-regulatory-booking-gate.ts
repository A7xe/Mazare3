/**
 * Phase 3C.4D.4B — Regulatory publication + NEW paid Booking gate QA.
 * Run: pnpm qa:phase3c4d4b-regulatory-booking-gate
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  resolveCommissionPercentForListing,
  isRequirementSatisfiedForReadiness,
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

console.log('\nPhase 3C.4D.4B Regulatory Booking Gate QA\n');

const bookability = src('apps/api/src/services/property-bookability.service.ts');
const adminSvc = src('apps/api/src/services/admin.service.ts');
const quote = src('apps/api/src/services/booking-quote.service.ts');
const booking = src('apps/api/src/services/booking.service.ts');
const payment = src('apps/api/src/services/payment.service.ts');
const propertySvc = src('apps/api/src/services/property.service.ts');
const mapper = src('apps/api/src/mappers/public-booking.mapper.ts');
const publicMapper = src('apps/api/src/mappers/public-property.mapper.ts');
const adminRoutes = src('apps/api/src/routes/admin.ts');
const regulatory = src('apps/api/src/services/property-regulatory.service.ts');
const en = src('apps/web/messages/en.json');
const ar = src('apps/web/messages/ar.json');
const entryCard = src('apps/web/src/components/marketplace/property-booking-entry-card.tsx');
const adminPanel = src('apps/web/src/components/admin/admin-property-regulatory-panel.tsx');
const ownerPanel = src('apps/web/src/components/owner/property-regulatory-panel.tsx');
const preflight = src('apps/api/scripts/preflight-regulatory-gate-3c4d4b.ts');
const pkg = src('package.json');

expect(
  'A: publish requires assertPropertyEligibleForPublish',
  adminSvc.includes('assertPropertyEligibleForPublish') &&
    /targetStatus === PropertyStatus\.published[\s\S]*assertPropertyEligibleForPublish/.test(
      adminSvc,
    ),
);

expect(
  'B: publish eligibility requires regulatory ready + authority',
  bookability.includes("regulatory.readiness !== 'ready'") &&
    bookability.includes('authorityBlocker') &&
    bookability.includes("| 'publish'"),
);

expect(
  'C: direct publish API path uses server assert (admin.service)',
  adminSvc.includes('assertPropertyEligibleForPublish') &&
    bookability.includes('PROPERTY_NOT_PUBLISHABLE'),
);

expect(
  'D: platform_verified NOT required',
  bookability.includes('platformVerifiedRequired: false') &&
    !bookability.includes("verificationStatus === 'platform_verified'") &&
    !/blockers\.push\(['\"]platform/.test(bookability),
);

expect(
  'E: 18% / unverified may still be bookable (no platform_verified blocker)',
  resolveCommissionPercentForListing('unverified') === 18 &&
    bookability.includes('platformVerifiedRequired: false'),
);

expect(
  'F: new Booking creation gated via resolveBookingPricing',
  quote.includes('assertPropertyEligibleForNewPaidBooking') &&
    quote.includes("'new_booking'"),
);

expect(
  'G: eligible path uses evaluatePropertyBookability SSOT',
  bookability.includes('evaluatePropertyBookability') &&
    bookability.includes("readiness !== 'ready'"),
);

expect(
  'H: Customer UI is not security boundary (server assert exists)',
  quote.includes('assertPropertyEligibleForNewPaidBooking') &&
    payment.includes('assertPropertyEligibleForNewPaidBooking'),
);

expect(
  'I: PROPERTY_NOT_BOOKABLE / customer-safe message',
  bookability.includes('PROPERTY_NOT_BOOKABLE') &&
    bookability.includes('This Property is currently unavailable for Booking.'),
);

expect(
  'J: Owner approval rechecks readiness',
  booking.includes("'owner_accept'") &&
    /acceptOwnerBooking[\s\S]*assertPropertyEligibleForNewPaidBooking/.test(booking),
);

expect(
  'K: owner_accept purpose distinct (recheck during pending window)',
  bookability.includes("'owner_accept'"),
);

expect(
  'L: first deposit checkout rechecks',
  payment.includes('PaymentPurpose.deposit') &&
    payment.includes("'first_payment'") &&
    payment.includes('assertPropertyEligibleForNewPaidBooking'),
);

expect(
  'M: first full-payment checkout rechecks',
  payment.includes('PaymentPurpose.full') &&
    /purpose === PaymentPurpose\.deposit \|\| purpose === PaymentPurpose\.full[\s\S]*assertPropertyEligibleForNewPaidBooking/.test(
      payment,
    ),
);

expect(
  'N: expiry blocks via readiness read (not cron-only)',
  regulatory.includes('reconcileExpiredRegulatoryRequirements') &&
    bookability.includes('evaluatePropertyRegulatoryReadiness') &&
    isRequirementSatisfiedForReadiness({
      applicability: 'applicable',
      complianceStatus: 'verified',
      expiresAt: new Date(Date.now() - 1000),
    }) === false,
);

expect(
  'O: regulatory_confirmation_required blocks readiness helper',
  isRequirementSatisfiedForReadiness({
    applicability: 'regulatory_confirmation_required',
    complianceStatus: 'verified',
    expiresAt: null,
  }) === false,
);

expect(
  'P: reassessmentRequired blocks via bookability',
  bookability.includes('reassessmentRequired') &&
    bookability.includes('regulatory_reassessment_required'),
);

expect(
  'Q: authority-not-approved blocks',
  bookability.includes('authority_not_submitted') &&
    bookability.includes('authority_reassessment_required') &&
    bookability.includes('authority_under_review'),
);

expect(
  'R: public mapper has no regulatory evidence / blockers leak',
  !publicMapper.includes('RegulatoryEvidence') &&
    !publicMapper.includes('blockingReasons') &&
    !publicMapper.includes('regulatoryBlockingReasons') &&
    propertySvc.includes('customerUnavailableBookingMessage') &&
    !propertySvc.includes('regulatoryBlockingReasons'),
);

expect(
  'S: Owner panel shows blockers',
  ownerPanel.includes('owner-bookability-blockers') &&
    ownerPanel.includes('bookability?.blockers'),
);

expect(
  'T: Admin panel shows publication/newBooking eligibility + existing bookings signal',
  adminPanel.includes('admin-bookability') &&
    adminPanel.includes('publicationEligible') &&
    adminPanel.includes('affectsExistingBookings'),
);

expect(
  'U: no mass-unpublish on non-ready (does not set PropertyStatus.unpublished)',
  !bookability.includes('PropertyStatus.unpublished') &&
    !bookability.includes("status: 'unpublished'"),
);

expect(
  'V: published non-ready cannot receive NEW Booking (quote gate)',
  quote.includes('assertPropertyEligibleForNewPaidBooking'),
);

expect(
  'W: no auto-cancel of confirmed Bookings in bookability service',
  !bookability.includes('BookingStatus.cancelled') &&
    !bookability.includes('status: BookingStatus.cancelled'),
);

expect(
  'X: no automatic refund / Owner penalty APIs in bookability',
  !bookability.includes('createRefund') &&
    !bookability.includes('OwnerFinancialAdjustment') &&
    !bookability.includes('applyOwnerPenalty'),
);

expect(
  'Y: no automatic Owner penalty / adjustment creation',
  !bookability.includes('createOwner') && !bookability.includes('recordOwnerReliability'),
);

expect(
  'Z: balance payment NOT gated by new-Booking regulatory check',
  payment.includes('Balance on already-confirmed Booking is intentionally NOT gated') &&
    /PaymentPurpose\.balance[\s\S]{0,200}canPayBalance/.test(payment) &&
    !/purpose === PaymentPurpose\.balance[\s\S]{0,300}assertPropertyEligibleForNewPaidBooking/.test(
      payment,
    ),
);

expect(
  'AA: existing PSP session reuse preserved (no re-block on reuse)',
  payment.includes('Existing PSP session: do not re-block') &&
    payment.includes('reusePaymentId'),
);

expect(
  'AB: webhook/reconcile handlers do not call bookability assert',
  !payment.includes('assertPropertyEligibleForNewPaidBooking(working.propertyId') ||
    (payment.match(/assertPropertyEligibleForNewPaidBooking/g) ?? []).length <= 2,
);

expect(
  'AC: 18%/15% commission unchanged',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'AD: isPropertyCurrentlyBookable remains base gates only (sync helper)',
  /return property\.status === PropertyStatus\.published && property\.owner\.status === OwnerStatus\.approved/.test(
    mapper,
  ) && !mapper.includes('evaluatePropertyRegulatoryReadiness'),
);

expect('AE: Owner Agreement version still advisor-final DRAFT activation unchanged', OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final');
expect('AF: locked legal docs', ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');
expect('AF2: Privacy locked', PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final');

expect(
  'AG: Production untouched (preflight read-only + local docs)',
  preflight.includes('Zero mutations') &&
    bookability.includes('mutation: false') &&
    existsSync(resolve(root, 'docs/MAZARE3_REGULATORY_BOOKING_GATE_3C4D4B.md')) &&
    existsSync(resolve(root, 'docs/MAZARE3_REGULATORY_GATE_PREFLIGHT_3C4D4B.md')),
);

expect(
  'Existing bookings signal REGULATORY_REVIEW_AFFECTS_EXISTING_BOOKINGS',
  bookability.includes('REGULATORY_REVIEW_AFFECTS_EXISTING_BOOKINGS'),
);

expect(
  'Customer EN/AR unavailable wording',
  en.includes('This Property is currently unavailable for Booking.') &&
    ar.includes('هذا العقار غير متاح للحجز حالياً.') &&
    entryCard.includes('bookingUnavailable'),
);

expect(
  'Preflight npm script wired',
  pkg.includes('preflight:regulatory-gate') &&
    pkg.includes('qa:phase3c4d4b-regulatory-booking-gate'),
);

expect(
  'Admin preflight + bookability routes',
  adminRoutes.includes('/regulatory-gate/preflight') &&
    adminRoutes.includes('/properties/:id/bookability'),
);

expect(
  'Public property detail uses evaluatePropertyBookability',
  propertySvc.includes("evaluatePropertyBookability(row.id, 'public_display')"),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
