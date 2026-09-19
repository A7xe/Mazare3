/**
 * Phase 3C.4E.3 — Read-only Booking slot integrity preflight.
 * No mutations. No Personal Data dump.
 */
import { prisma, Prisma } from '@mazare3/db';
import { BOOKING_INVENTORY_HOLDING_STATUSES } from '../lib/payment-hold.js';

const HOLDING = BOOKING_INVENTORY_HOLDING_STATUSES;

const INDEX_NAME = 'Booking_one_holding_per_availability_slot';

export async function runBookingSlotIntegrityPreflightReport() {
  const holdingWhere = { status: { in: HOLDING } };

  const [
    inventoryHoldingCount,
    duplicateRows,
    confirmedConflicts,
    pendingVsConfirmed,
    pendingVsPending,
    missingSlotFk,
    legacyUntimedHolding,
    indexRows,
  ] = await Promise.all([
    prisma.booking.count({ where: holdingWhere }),
    prisma.$queryRaw<
      Array<{
        availabilitySlotId: string;
        holders: number;
        statuses: string;
      }>
    >(Prisma.sql`
      SELECT
        b."availabilitySlotId",
        COUNT(*)::int AS holders,
        string_agg(DISTINCT b.status::text, ',' ORDER BY b.status::text) AS statuses
      FROM "Booking" b
      WHERE b.status IN (
        'pending_owner_approval'::"BookingStatus",
        'pending_payment'::"BookingStatus",
        'pending'::"BookingStatus",
        'confirmed'::"BookingStatus"
      )
      GROUP BY b."availabilitySlotId"
      HAVING COUNT(*) > 1
      ORDER BY holders DESC
      LIMIT 100
    `),
    prisma.$queryRaw<Array<{ availabilitySlotId: string; n: number }>>(Prisma.sql`
      SELECT b."availabilitySlotId", COUNT(*)::int AS n
      FROM "Booking" b
      WHERE b.status = 'confirmed'::"BookingStatus"
      GROUP BY b."availabilitySlotId"
      HAVING COUNT(*) > 1
      LIMIT 50
    `),
    prisma.$queryRaw<Array<{ availabilitySlotId: string }>>(Prisma.sql`
      SELECT DISTINCT a."availabilitySlotId"
      FROM "Booking" a
      INNER JOIN "Booking" b
        ON a."availabilitySlotId" = b."availabilitySlotId"
        AND a.id <> b.id
      WHERE a.status = 'confirmed'::"BookingStatus"
        AND b.status IN (
          'pending_owner_approval'::"BookingStatus",
          'pending_payment'::"BookingStatus",
          'pending'::"BookingStatus"
        )
      LIMIT 50
    `),
    prisma.$queryRaw<Array<{ availabilitySlotId: string }>>(Prisma.sql`
      SELECT DISTINCT a."availabilitySlotId"
      FROM "Booking" a
      INNER JOIN "Booking" b
        ON a."availabilitySlotId" = b."availabilitySlotId"
        AND a.id <> b.id
      WHERE a.status IN (
          'pending_owner_approval'::"BookingStatus",
          'pending_payment'::"BookingStatus",
          'pending'::"BookingStatus"
        )
        AND b.status IN (
          'pending_owner_approval'::"BookingStatus",
          'pending_payment'::"BookingStatus",
          'pending'::"BookingStatus"
        )
      LIMIT 50
    `),
    prisma.booking.count({
      where: {
        ...holdingWhere,
        OR: [{ availabilitySlotId: '' }],
      },
    }).catch(() => 0),
    prisma.booking.count({
      where: {
        ...holdingWhere,
        usesLegacyTiming: true,
        bookingStartAt: null,
      },
    }),
    prisma.$queryRaw<Array<{ indexname: string }>>(Prisma.sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'Booking'
        AND indexname = ${INDEX_NAME}
    `),
  ]);

  // Orphan: holding Booking whose slot row is missing (should be FK-impossible)
  const orphanSlotRefs = await prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM "Booking" b
    LEFT JOIN "AvailabilitySlot" s ON s.id = b."availabilitySlotId"
    WHERE b.status IN (
      'pending_owner_approval'::"BookingStatus",
      'pending_payment'::"BookingStatus",
      'pending'::"BookingStatus",
      'confirmed'::"BookingStatus"
    )
      AND s.id IS NULL
  `);

  const cancelledOrExpiredOnSharedSlots = await prisma.$queryRaw<Array<{ n: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS n
    FROM "Booking" b
    WHERE b.status IN ('cancelled'::"BookingStatus", 'expired'::"BookingStatus")
      AND EXISTS (
        SELECT 1 FROM "Booking" h
        WHERE h."availabilitySlotId" = b."availabilitySlotId"
          AND h.status IN (
            'pending_owner_approval'::"BookingStatus",
            'pending_payment'::"BookingStatus",
            'pending'::"BookingStatus",
            'confirmed'::"BookingStatus"
          )
      )
  `);

  const activeConflicts = duplicateRows.length;
  const legacyManualReviewRequired = activeConflicts > 0;

  return {
    phase: '3C.4E.3',
    mutation: false,
    generatedAt: new Date().toISOString(),
    inventoryHoldingStatuses: [...HOLDING],
    slotModel: 'DISCRETE_AVAILABILITY_SLOT',
    counts: {
      inventoryHoldingBookings: inventoryHoldingCount,
      duplicateActiveCanonicalSlots: activeConflicts,
      confirmedVsConfirmedConflicts: confirmedConflicts.length,
      pendingVsConfirmedConflicts: pendingVsConfirmed.length,
      pendingVsPendingConflicts: pendingVsPending.length,
      legacyUntimedHoldingBookings: legacyUntimedHolding,
      orphanSlotReferences: orphanSlotRefs[0]?.n ?? 0,
      cancelledOrExpiredSharingSlotWithHolder: cancelledOrExpiredOnSharedSlots[0]?.n ?? 0,
      bookingsMissingCanonicalSlotData: missingSlotFk,
    },
    duplicateActiveSlotsSample: duplicateRows.map((r) => ({
      availabilitySlotIdPrefix: r.availabilitySlotId.slice(0, 8),
      holders: r.holders,
      statuses: r.statuses,
    })),
    constraint: {
      indexName: INDEX_NAME,
      present: indexRows.length > 0,
      definition:
        'UNIQUE (availabilitySlotId) WHERE status IN (pending_owner_approval, pending_payment, pending, confirmed)',
    },
    legacy: {
      BOOKING_SLOT_LEGACY_CONFLICT_MANUAL_REVIEW_REQUIRED: legacyManualReviewRequired,
      note: legacyManualReviewRequired
        ? 'Do not apply Production uniqueness over conflicting active holders without remediation.'
        : 'No active duplicate holders detected in this database.',
    },
  };
}
