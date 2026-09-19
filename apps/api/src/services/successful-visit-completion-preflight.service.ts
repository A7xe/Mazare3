/**
 * Phase 3C.4E.4C — Read-only successful visit completion preflight.
 * Run: pnpm preflight:successful-visit-completion
 */
import {
  BookingIncidentStatus,
  BookingIncidentType,
  BookingStatus,
  BookingVisitOutcome,
  CheckInStatus,
  DisputeStatus,
  prisma,
} from '@mazare3/db';
import { isAuthoritativeVisitEnded, isSuccessfulVisitCompletionEligible } from '@mazare3/shared';

export type SuccessfulVisitCompletionPreflightReport = {
  phase: '3C.4E.4C';
  mutation: false;
  generatedAt: string;
  counts: {
    checkedInBeforeEnd: number;
    checkedInPastEndEligible: number;
    checkedInPastEndBlocked: number;
    pastConfirmedNoCheckInNoOutcome: number;
    completedVisits: number;
    conflictingTerminalOutcomes: number;
    completedWithOwnerFaultReason: number;
    legacyAmbiguousTimedEndMissing: number;
  };
  notes: string[];
};

export async function runSuccessfulVisitCompletionPreflightReport(): Promise<SuccessfulVisitCompletionPreflightReport> {
  const now = new Date();

  const checkedIn = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      OR: [
        { visitOutcome: BookingVisitOutcome.checked_in },
        { checkInStatus: CheckInStatus.verified, visitOutcome: { not: BookingVisitOutcome.completed } },
      ],
    },
    include: {
      slot: { select: { date: true, endAt: true } },
      incidents: {
        where: {
          status: { in: [BookingIncidentStatus.open, BookingIncidentStatus.under_review] },
          type: {
            in: [
              BookingIncidentType.customer_no_show_report,
              BookingIncidentType.owner_no_show_report,
              BookingIncidentType.access_denied_report,
              BookingIncidentType.property_unavailable_report,
              BookingIncidentType.force_majeure,
              BookingIncidentType.check_in_dispute,
            ],
          },
        },
        select: { id: true },
      },
      disputes: {
        where: { status: { in: [DisputeStatus.open, DisputeStatus.under_review] } },
        select: { id: true },
      },
    },
    take: 2000,
  });

  let beforeEnd = 0;
  let eligible = 0;
  let blocked = 0;
  let legacyAmbiguous = 0;

  for (const b of checkedIn) {
    if (b.visitOutcome === BookingVisitOutcome.completed) continue;
    const ended = isAuthoritativeVisitEnded({
      bookingEndAt: b.bookingEndAt,
      slotEndAt: b.slot.endAt,
      slotDate: b.slot.date,
      now,
    });
    if (!ended) {
      beforeEnd += 1;
      continue;
    }
    if (!b.bookingEndAt && !b.slot.endAt) legacyAmbiguous += 1;
    const hasBlock = b.incidents.length > 0 || b.disputes.length > 0;
    const gate = isSuccessfulVisitCompletionEligible({
      bookingStatus: b.status,
      visitOutcome: b.visitOutcome,
      checkInStatus: b.checkInStatus,
      cancellationReasonCode: b.cancellationReasonCode,
      bookingEndAt: b.bookingEndAt,
      slotEndAt: b.slot.endAt,
      slotDate: b.slot.date,
      hasBlockingIncidentOrDispute: hasBlock,
      now,
    });
    if (gate.eligible) eligible += 1;
    else blocked += 1;
  }

  const pastConfirmedNoEvidence = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      checkInStatus: { not: CheckInStatus.verified },
      visitOutcome: null,
      cancellationReasonCode: null,
    },
    include: { slot: { select: { date: true, endAt: true } } },
    take: 2000,
  });
  let pastNoCheckIn = 0;
  for (const b of pastConfirmedNoEvidence) {
    if (
      isAuthoritativeVisitEnded({
        bookingEndAt: b.bookingEndAt,
        slotEndAt: b.slot.endAt,
        slotDate: b.slot.date,
        now,
      })
    ) {
      pastNoCheckIn += 1;
    }
  }

  const completedVisits = await prisma.booking.count({
    where: { visitOutcome: BookingVisitOutcome.completed },
  });

  const conflicting = await prisma.booking.count({
    where: {
      visitOutcome: BookingVisitOutcome.completed,
      OR: [
        { cancellationReasonCode: { in: ['CUSTOMER_NO_SHOW', 'OWNER_NO_SHOW', 'ACCESS_DENIED', 'FORCE_MAJEURE'] } },
        { status: BookingStatus.cancelled },
      ],
    },
  });

  const completedWithOwnerFaultReason = await prisma.booking.count({
    where: {
      visitOutcome: BookingVisitOutcome.completed,
      cancellationReasonCode: { in: ['OWNER_NO_SHOW', 'ACCESS_DENIED', 'FORCE_MAJEURE'] },
    },
  });

  return {
    phase: '3C.4E.4C',
    mutation: false,
    generatedAt: now.toISOString(),
    counts: {
      checkedInBeforeEnd: beforeEnd,
      checkedInPastEndEligible: eligible,
      checkedInPastEndBlocked: blocked,
      pastConfirmedNoCheckInNoOutcome: pastNoCheckIn,
      completedVisits,
      conflictingTerminalOutcomes: conflicting,
      completedWithOwnerFaultReason,
      legacyAmbiguousTimedEndMissing: legacyAmbiguous,
    },
    notes: [
      'No check-in past visits are not auto-completed (3C.4E.4B review path).',
      'complete-verified-visits job is lifecycle-only — no financial mutation.',
      'No Customer PII included.',
    ],
  };
}
