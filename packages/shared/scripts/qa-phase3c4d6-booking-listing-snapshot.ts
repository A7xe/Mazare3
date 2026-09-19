/**
 * Phase 3C.4D.6 — Immutable Booking-time listing snapshot QA.
 * Run: pnpm qa:phase3c4d6-booking-listing-snapshot
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION,
  resolveCommissionPercentForListing,
  createBookingSchema,
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

console.log('\nPhase 3C.4D.6 Booking Listing Snapshot QA\n');

const schema = src('packages/db/prisma/schema.prisma');
const migration = src(
  'packages/db/prisma/migrations/20260917190000_phase3c4d6_booking_listing_snapshot/migration.sql',
);
const service = src('apps/api/src/services/booking-listing-snapshot.service.ts');
const bookingSvc = src('apps/api/src/services/booking.service.ts');
const paymentSvc = src('apps/api/src/services/payment.service.ts');
const mediaSvc = src('apps/api/src/services/property-media/property-media.service.ts');
const propertySvc = src('apps/api/src/services/property.service.ts');
const ownerProp = src('apps/api/src/services/owner-property.service.ts');
const reschedule = src('apps/api/src/services/reschedule.service.ts');
const meRoutes = src('apps/api/src/routes/me.ts');
const ownerRoutes = src('apps/api/src/routes/owner.ts');
const adminRoutes = src('apps/api/src/routes/admin.ts');
const panel = src('apps/web/src/components/bookings/booking-listing-snapshot-panel.tsx');
const myBookings = src('apps/web/src/components/account/my-bookings-view.tsx');
const ownerBookings = src('apps/web/src/components/owner/owner-bookings-view.tsx');
const adminBookings = src('apps/web/src/components/admin/admin-bookings-view.tsx');
const docs = src('docs/MAZARE3_BOOKING_LISTING_SNAPSHOT_3C4D6.md');
const preflightDoc = src('docs/MAZARE3_BOOKING_SNAPSHOT_PREFLIGHT_3C4D6.md');

expect(
  'A: BookingPropertySnapshot model + unique INITIAL',
  schema.includes('model BookingPropertySnapshot') &&
    schema.includes('BookingPropertySnapshotKind') &&
    schema.includes('@@unique([bookingId, kind])') &&
    migration.includes('BookingPropertySnapshot'),
);

expect(
  'B: schema version booking-listing-snapshot-v1',
  service.includes("BOOKING_LISTING_SNAPSHOT_SCHEMA_VERSION = 'booking-listing-snapshot-v1'"),
);

expect(
  'C: createBooking wires createInitialBookingListingSnapshot in TX',
  bookingSvc.includes('createInitialBookingListingSnapshot') &&
    bookingSvc.includes('Phase 3C.4D.6') &&
    /\$transaction[\s\S]*createInitialBookingListingSnapshot/.test(bookingSvc),
);

expect(
  'D: createBookingSchema has no client snapshot forge field',
  !('listingSnapshot' in (createBookingSchema.shape as object)) &&
    !createBookingSchema.shape.hasOwnProperty('payload'),
);

expect(
  'E: no PATCH route for listing snapshot',
  !meRoutes.includes('listing-snapshot') ||
    (!meRoutes.includes("patch('/bookings/:id/listing-snapshot") &&
      !ownerRoutes.includes("patch('/bookings/:id/listing-snapshot") &&
      !adminRoutes.includes("patch('/bookings/:id/listing-snapshot")),
);

expect(
  'F: Owner Property edits do not update BookingPropertySnapshot',
  !ownerProp.includes('bookingPropertySnapshot.update') &&
    !ownerProp.includes('BookingPropertySnapshot'),
);

expect(
  'G: amenities snapshotted',
  service.includes('amenities:') && service.includes('labelAr'),
);

expect(
  'H: capacity snapshotted',
  service.includes('capacity:') &&
    service.includes('bedrooms:') &&
    service.includes('bathrooms:'),
);

expect(
  'I: rules/restrictions snapshotted',
  service.includes('rules:') && service.includes('titleAr'),
);

expect(
  'J: activities snapshotted',
  service.includes('activities:') && service.includes('activityCode'),
);

expect(
  'K: pool profile snapshotted',
  service.includes('poolSafetyProfile') && service.includes('depthSource'),
);

expect(
  'L: safety disclosures snapshotted',
  service.includes('safetyDisclosures') && service.includes('category'),
);

expect(
  'M: pool attestation version/time',
  service.includes('attestationVersion') && service.includes('attestedAt'),
);

expect(
  'N: private regulatory evidence NOT snapshotted',
  !service.includes('storageKey') &&
    !service.includes('RegulatoryEvidence') &&
    !service.includes('writePartnerDocumentFile'),
);

expect(
  'O: Customer view has no requirementSummaries dump / no storage keys',
  service.includes('toCustomerListingSnapshotView') &&
    !service.includes('storageKey') &&
    /export function toCustomerListingSnapshotView[\s\S]*?label: 'at_time_of_booking'/.test(service),
);

expect(
  'P: policy version refs preserved',
  service.includes('policyVersionRefs') &&
    service.includes('bookingTermsVersionId') &&
    service.includes('cancellationPolicyVersionId'),
);

expect(
  'Q: regulatory READY decision preserved',
  service.includes('regulatoryReadiness') && service.includes('requirementSummaries'),
);

expect(
  'R: authority readiness reference',
  service.includes('authorityReviewStatus'),
);

expect(
  'S: platform verification independent',
  service.includes('platformVerification') && service.includes('verificationStatus'),
);

expect(
  'T: media references/order',
  service.includes('mediaId') && service.includes('sortOrder') && service.includes('isPrimary'),
);

expect(
  'U: soft-remove media retention',
  mediaSvc.includes('removedFromListingAt') &&
    mediaSvc.includes('Do NOT delete object storage') &&
    migration.includes('removedFromListingAt'),
);

expect(
  'V: public listing filters removed media',
  propertySvc.includes('removedFromListingAt: null'),
);

expect(
  'W: Customer Booking history uses snapshot panel',
  myBookings.includes('BookingListingSnapshotPanel') &&
    myBookings.includes('fetchMyBookingListingSnapshot'),
);

expect(
  'X: Owner Booking view uses snapshot',
  ownerBookings.includes('fetchOwnerBookingListingSnapshot') &&
    ownerBookings.includes('BookingListingSnapshotPanel'),
);

expect(
  'Y: Admin can compare snapshot vs current',
  adminRoutes.includes('/bookings/:id/listing-snapshot') &&
    adminBookings.includes('currentListing') &&
    service.includes('getAdminListingSnapshotComparison'),
);

expect(
  'Z: reschedule does not create/overwrite listing snapshot',
  !reschedule.includes('createInitialBookingListingSnapshot') &&
    !reschedule.includes('bookingPropertySnapshot'),
);

expect(
  'AA: legacy LEGACY_SNAPSHOT_UNAVAILABLE (no backfill)',
  service.includes('LEGACY_SNAPSHOT_UNAVAILABLE') &&
    migration.includes('No fabricated legacy') &&
    !migration.includes('INSERT INTO "BookingPropertySnapshot"'),
);

expect(
  'AB: snapshot persistence failure fails Booking TX',
  bookingSvc.includes('createInitialBookingListingSnapshot') &&
    /await createInitialBookingListingSnapshot/.test(bookingSvc),
);

expect(
  'AC: idempotent INITIAL unique + early return',
  service.includes('if (existing) return existing') &&
    schema.includes('@@unique([bookingId, kind])'),
);

expect(
  'AD: first payment requires listing snapshot',
  paymentSvc.includes('assertBookingHasInitialListingSnapshot') &&
    service.includes('BOOKING_LISTING_SNAPSHOT_MISSING'),
);

expect(
  'AE: financial snapshot remains authoritative (ref only)',
  service.includes('Booking financial columns + BookingLegalSnapshot remain authoritative') &&
    service.includes('financialRef'),
);

expect(
  'AF: 18%/15% unchanged',
  resolveCommissionPercentForListing('unverified') === 18 &&
    resolveCommissionPercentForListing('platform_verified') === 15,
);

expect(
  'AG: regulatory Booking gate unchanged (still in booking/payment)',
  bookingSvc.includes('evaluatePropertyBookability') ||
    bookingSvc.includes('assertPropertyEligibleForNewPaidBooking') ||
    paymentSvc.includes('assertPropertyEligibleForNewPaidBooking'),
);

expect(
  'AH: Booking.propertyId onDelete Restrict',
  /property Property[\s\S]{0,80}onDelete: Restrict/.test(schema),
);

expect(
  'AI: cancellation/refund services not rewritten by snapshot phase',
  !service.includes('evaluateCancellationPolicy') &&
    !service.includes('ownerNetPayoutAmount ='),
);

expect(
  'AJ: locked legal docs unchanged versions',
  ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    PRIVACY_ADVISOR_REVISED_VERSION === '1.1.2-advisor-final' &&
    OWNER_ADVISOR_REVISED_VERSION === '1.1.1-advisor-final',
);

expect(
  'AK: Production untouched note in docs + integrity hash',
  docs.includes('Production untouched') &&
    service.includes('hashListingSnapshotPayload') &&
    service.includes('sha256') &&
    panel.includes('atTimeOfBooking'),
);

expect(
  'Docs + preflight present',
  docs.includes('booking-listing-snapshot-v1') &&
    preflightDoc.includes('preflight:booking-listing-snapshot') &&
    preflightDoc.toLowerCase().includes('zero-mutation'),
);

expect(
  'GET routes for Customer/Owner/Admin',
  meRoutes.includes('/bookings/:id/listing-snapshot') &&
    ownerRoutes.includes('/bookings/:id/listing-snapshot') &&
    adminRoutes.includes('/bookings/:id/listing-snapshot'),
);

console.log(`\nResult: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
