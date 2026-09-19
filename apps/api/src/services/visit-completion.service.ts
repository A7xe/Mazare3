/**
 * Phase 3C.4E.4C — Successful visit completion (checked_in → completed).
 * Does not change economics, settlement cycle, or auto-complete without check-in.
 */
import {
  prisma,
  BookingIncidentStatus,
  BookingIncidentType,
  BookingStatus,
  BookingVisitOutcome,
  CheckInStatus,
  DisputeStatus,
} from '@mazare3/db';
import { isSuccessfulVisitCompletionEligible } from '@mazare3/shared';
import { createAuditLog } from './audit.service.js';

const BLOCKING_INCIDENT_TYPES: BookingIncidentType[] = [
  BookingIncidentType.customer_no_show_report,
  BookingIncidentType.owner_no_show_report,
  BookingIncidentType.access_denied_report,
  BookingIncidentType.property_unavailable_report,
  BookingIncidentType.force_majeure,
  BookingIncidentType.check_in_dispute,
];

async function hasBlockingIncidentOrDispute(bookingId: string): Promise<boolean> {
  const [incident, dispute] = await Promise.all([
    prisma.bookingIncident.findFirst({
      where: {
        bookingId,
        status: { in: [BookingIncidentStatus.open, BookingIncidentStatus.under_review] },
        type: { in: BLOCKING_INCIDENT_TYPES },
      },
      select: { id: true },
    }),
    prisma.dispute.findFirst({
      where: {
        bookingId,
        status: { in: [DisputeStatus.open, DisputeStatus.under_review] },
      },
      select: { id: true },
    }),
  ]);
  return Boolean(incident || dispute);
}

/**
 * Persist checked_in → completed when eligible.
 * Idempotent: already-completed returns without duplicate material transition.
 */
export async function completeVerifiedVisitIfEligible(bookingId: string): Promise<{
  completed: boolean;
  reason: string | null;
}> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: { select: { date: true, endAt: true } } },
  });
  if (!booking) return { completed: false, reason: 'not_found' };

  if (booking.visitOutcome === BookingVisitOutcome.completed) {
    return { completed: false, reason: 'already_completed' };
  }

  const blocked = await hasBlockingIncidentOrDispute(booking.id);
  const gate = isSuccessfulVisitCompletionEligible({
    bookingStatus: booking.status,
    visitOutcome: booking.visitOutcome,
    checkInStatus: booking.checkInStatus,
    cancellationReasonCode: booking.cancellationReasonCode,
    bookingEndAt: booking.bookingEndAt,
    slotEndAt: booking.slot.endAt,
    slotDate: booking.slot.date,
    hasBlockingIncidentOrDispute: blocked,
  });
  if (!gate.eligible) {
    return { completed: false, reason: gate.reason };
  }

  // Conditional update — concurrent workers cannot double-complete.
  const updated = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      status: BookingStatus.confirmed,
      visitOutcome: BookingVisitOutcome.checked_in,
      checkInStatus: CheckInStatus.verified,
    },
    data: {
      visitOutcome: BookingVisitOutcome.completed,
      visitOutcomeAt: new Date(),
      visitOutcomeSource: 'job.complete_verified_visits',
    },
  });

  if (updated.count === 0) {
    // Also accept verified check-in with null/pending visitOutcome edge cases
    const alt = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        status: BookingStatus.confirmed,
        checkInStatus: CheckInStatus.verified,
        OR: [{ visitOutcome: null }, { visitOutcome: BookingVisitOutcome.pending_visit }],
      },
      data: {
        visitOutcome: BookingVisitOutcome.completed,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: 'job.complete_verified_visits',
      },
    });
    if (alt.count === 0) {
      return { completed: false, reason: 'race_or_ineligible' };
    }
  }

  await createAuditLog({
    action: 'booking.visit_completed',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      source: 'job.complete_verified_visits',
      visitOutcome: BookingVisitOutcome.completed,
      bookingEndAt: booking.bookingEndAt?.toISOString() ?? null,
      slotEndAt: booking.slot.endAt?.toISOString() ?? null,
      note: 'Lifecycle only — no financial mutation',
    },
  });

  return { completed: true, reason: null };
}

/** Bounded batch for background job. Multi-instance safe via conditional updates. */
export async function completeVerifiedVisitsBatch(limit = 50): Promise<{
  scanned: number;
  completed: number;
  skipped: number;
}> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      checkInStatus: CheckInStatus.verified,
      OR: [
        { visitOutcome: BookingVisitOutcome.checked_in },
        { visitOutcome: null },
        { visitOutcome: BookingVisitOutcome.pending_visit },
      ],
    },
    include: { slot: { select: { date: true, endAt: true } } },
    take: Math.max(limit * 3, 50),
    orderBy: { updatedAt: 'asc' },
  });

  let completed = 0;
  let skipped = 0;
  let scanned = 0;

  for (const b of candidates) {
    if (completed >= limit) break;
    scanned += 1;
    const result = await completeVerifiedVisitIfEligible(b.id);
    if (result.completed) completed += 1;
    else skipped += 1;
  }

  return { scanned, completed, skipped };
}
