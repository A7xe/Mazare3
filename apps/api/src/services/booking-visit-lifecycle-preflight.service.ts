/**
 * Phase 3C.4E.4B — Read-only Booking visit / no-show lifecycle preflight.
 * No mutations. No Customer PII dump.
 */
import {
  BookingIncidentStatus,
  BookingIncidentType,
  BookingStatus,
  BookingVisitOutcome,
  CheckInStatus,
  prisma,
} from '@mazare3/db';
import {
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  resolveBookingPeriodStart,
} from '@mazare3/shared';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';

export type BookingVisitLifecyclePreflightReport = {
  phase: '3C.4E.4B';
  mutation: false;
  generatedAt: string;
  graceMinutes: number;
  counts: {
    confirmedFutureStart: number;
    confirmedInVisitOrGraceWindow: number;
    confirmedPastGraceNoTerminalOutcome: number;
    staleHistoricalConfirmed: number;
    customerNoShowOutcomes: number;
    ownerNoShowOutcomes: number;
    accessDeniedOutcomes: number;
    unresolvedVisitIncidents: number;
    terminalOutcomeInconsistentFinancial: number;
    duplicateConfirmedCustomerNoShowIncidents: number;
  };
  notes: string[];
};

export async function runBookingVisitLifecyclePreflightReport(): Promise<BookingVisitLifecyclePreflightReport> {
  const now = new Date();
  const graceMinutes =
    loadPaymentPolicyConfig().customerNoShowGraceMinutes || CUSTOMER_NO_SHOW_GRACE_MINUTES;
  const graceMs = graceMinutes * 60 * 1000;
  const staleMs = 7 * 24 * 60 * 60 * 1000;

  const confirmed = await prisma.booking.findMany({
    where: { status: BookingStatus.confirmed },
    select: {
      id: true,
      bookingStartAt: true,
      visitOutcome: true,
      cancellationReasonCode: true,
      checkInStatus: true,
      slot: { select: { date: true } },
      payments: {
        where: { status: 'succeeded' },
        select: { ownerNetPayoutAmount: true, platformCommissionAmount: true },
      },
    },
    take: 3000,
  });

  let future = 0;
  let inWindow = 0;
  let pastGraceNoTerminal = 0;
  let stale = 0;

  for (const b of confirmed) {
    const start = resolveBookingPeriodStart(b.bookingStartAt, b.slot.date);
    const graceEnd = new Date(start.getTime() + graceMs);
    const terminal =
      b.visitOutcome === BookingVisitOutcome.customer_no_show ||
      b.visitOutcome === BookingVisitOutcome.owner_no_show ||
      b.visitOutcome === BookingVisitOutcome.access_denied ||
      b.visitOutcome === BookingVisitOutcome.force_majeure ||
      b.visitOutcome === BookingVisitOutcome.completed ||
      b.visitOutcome === BookingVisitOutcome.resolved_other ||
      b.cancellationReasonCode === 'CUSTOMER_NO_SHOW';

    if (now < start) future += 1;
    else if (now < graceEnd) inWindow += 1;
    else if (!terminal && b.checkInStatus !== CheckInStatus.verified) {
      pastGraceNoTerminal += 1;
      if (now.getTime() - graceEnd.getTime() > staleMs) stale += 1;
    }
  }

  const [
    customerNoShowOutcomes,
    ownerNoShowOutcomes,
    accessDeniedOutcomes,
    unresolvedVisitIncidents,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        OR: [
          { visitOutcome: BookingVisitOutcome.customer_no_show },
          { cancellationReasonCode: 'CUSTOMER_NO_SHOW' },
        ],
      },
    }),
    prisma.booking.count({
      where: {
        OR: [
          { visitOutcome: BookingVisitOutcome.owner_no_show },
          { cancellationReasonCode: 'OWNER_NO_SHOW' },
        ],
      },
    }),
    prisma.booking.count({
      where: {
        OR: [
          { visitOutcome: BookingVisitOutcome.access_denied },
          { cancellationReasonCode: 'ACCESS_DENIED' },
        ],
      },
    }),
    prisma.bookingIncident.count({
      where: {
        status: { in: [BookingIncidentStatus.open, BookingIncidentStatus.under_review] },
        type: {
          in: [
            BookingIncidentType.customer_no_show_report,
            BookingIncidentType.owner_no_show_report,
            BookingIncidentType.access_denied_report,
            BookingIncidentType.property_unavailable_report,
            BookingIncidentType.check_in_dispute,
          ],
        },
      },
    }),
  ]);

  // Customer no-show should keep owner nets (not zeroed); owner-fault zeros nets.
  let inconsistent = 0;
  const customerNoShows = await prisma.booking.findMany({
    where: {
      OR: [
        { visitOutcome: BookingVisitOutcome.customer_no_show },
        { cancellationReasonCode: 'CUSTOMER_NO_SHOW' },
      ],
    },
    select: {
      status: true,
      ownerNetPayoutAmount: true,
      platformCommissionAmount: true,
    },
    take: 500,
  });
  for (const b of customerNoShows) {
    if (b.status !== BookingStatus.confirmed) inconsistent += 1;
  }

  const ownerFaults = await prisma.booking.findMany({
    where: {
      OR: [
        { visitOutcome: BookingVisitOutcome.owner_no_show },
        { visitOutcome: BookingVisitOutcome.access_denied },
        { cancellationReasonCode: { in: ['OWNER_NO_SHOW', 'ACCESS_DENIED'] } },
      ],
    },
    select: {
      ownerNetPayoutAmount: true,
      platformCommissionAmount: true,
    },
    take: 500,
  });
  for (const b of ownerFaults) {
    const owner = Number(b.ownerNetPayoutAmount);
    const plat = Number(b.platformCommissionAmount);
    if (owner !== 0 || plat !== 0) inconsistent += 1;
  }

  const confirmedIncidents = await prisma.bookingIncident.groupBy({
    by: ['bookingId'],
    where: {
      type: BookingIncidentType.customer_no_show_report,
      status: BookingIncidentStatus.confirmed,
    },
    _count: { _all: true },
  });
  const duplicateConfirmedCustomerNoShowIncidents = confirmedIncidents.filter(
    (g) => g._count._all > 1,
  ).length;

  return {
    phase: '3C.4E.4B',
    mutation: false,
    generatedAt: now.toISOString(),
    graceMinutes,
    counts: {
      confirmedFutureStart: future,
      confirmedInVisitOrGraceWindow: inWindow,
      confirmedPastGraceNoTerminalOutcome: pastGraceNoTerminal,
      staleHistoricalConfirmed: stale,
      customerNoShowOutcomes,
      ownerNoShowOutcomes,
      accessDeniedOutcomes,
      unresolvedVisitIncidents,
      terminalOutcomeInconsistentFinancial: inconsistent,
      duplicateConfirmedCustomerNoShowIncidents,
    },
    notes: [
      'Stale historical confirmed Bookings are not mass-classified as no-show.',
      'mark-visit-review-eligible job is advisory only — no auto financial finalization.',
      'No Customer PII included.',
    ],
  };
}
