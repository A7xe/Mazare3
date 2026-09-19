/**
 * Phase 3C.4E.4B — Customer/Owner no-show & access-denied review (financial SSOT unchanged).
 * Owner reports are evidence; admin finalizes. No auto-conviction at +60m.
 */
import {
  prisma,
  BookingIncidentStatus,
  BookingIncidentType,
  BookingStatus,
  BookingVisitOutcome,
  CheckInStatus,
  DisputeStatus,
  OwnerFinancialAdjustmentType,
  OwnerReliabilityCategory,
  PaymentStatus,
  PayoutStatus,
} from '@mazare3/db';
import {
  BOOKING_CANCELLATION_REASON,
  calculateOwnerPenaltyJod,
  isCustomerNoShowEligible,
  isTerminalVisitOutcome,
  resolveBookingPeriodStart,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';
import { resolveOwnerScope } from './owner-access.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '@mazare3/db';
import {
  createOwnerPenaltyAdjustment,
  recordOwnerReliabilityIncident,
} from './owner-reliability.service.js';
import { ensureSystemOwnerFaultRefund } from './refund-request.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import { notifyNoShowReported, notifyArrivalIncidentReported } from './notification.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { filsToJod } from '@mazare3/shared';

const OWNER_FAULT_INCIDENT_TYPES: BookingIncidentType[] = [
  BookingIncidentType.owner_no_show_report,
  BookingIncidentType.access_denied_report,
  BookingIncidentType.property_unavailable_report,
];

async function assertCustomerNoShowFinalizationReady(booking: {
  id: string;
  status: BookingStatus;
  cancellationReasonCode: string | null;
  checkInStatus: CheckInStatus;
  visitOutcome: BookingVisitOutcome | null;
  bookingStartAt: Date | null;
  slot: { date: Date };
}) {
  if (booking.status !== BookingStatus.confirmed) {
    throw new AppError(400, 'BOOKING_NOT_CONFIRMED', 'Only confirmed paid visits can finalize as customer no-show');
  }
  if (booking.cancellationReasonCode === BOOKING_CANCELLATION_REASON.BALANCE_NOT_PAID) {
    throw new AppError(400, 'BALANCE_NOT_PAID', 'Unpaid-balance cancellations cannot become customer no-show');
  }
  if (isTerminalVisitOutcome(booking.visitOutcome)) {
    throw new AppError(409, 'VISIT_ALREADY_RESOLVED', 'Visit outcome already finalized');
  }
  if (booking.checkInStatus === CheckInStatus.verified) {
    throw new AppError(400, 'CHECKIN_VERIFIED', 'Cannot finalize no-show after verified check-in');
  }

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  const config = loadPaymentPolicyConfig();
  if (
    !isCustomerNoShowEligible({
      bookingStartAt: start,
      checkInVerified: false,
      graceMinutes: config.customerNoShowGraceMinutes,
    })
  ) {
    throw new AppError(400, 'GRACE_NOT_ELAPSED', 'Customer no-show grace has not elapsed');
  }

  const blocking = await prisma.bookingIncident.findFirst({
    where: {
      bookingId: booking.id,
      status: { in: [BookingIncidentStatus.open, BookingIncidentStatus.under_review] },
      type: {
        in: [
          ...OWNER_FAULT_INCIDENT_TYPES,
          BookingIncidentType.force_majeure,
          BookingIncidentType.check_in_dispute,
        ],
      },
    },
  });
  if (blocking) {
    throw new AppError(
      409,
      'VISIT_DISPUTE_OPEN',
      'Open owner-fault, force majeure, or check-in dispute blocks customer no-show finalization',
      { incidentType: blocking.type },
    );
  }

  const openDispute = await prisma.dispute.findFirst({
    where: {
      bookingId: booking.id,
      status: { in: [DisputeStatus.open, DisputeStatus.under_review] },
    },
  });
  if (openDispute) {
    throw new AppError(409, 'DISPUTE_OPEN', 'Open dispute blocks customer no-show finalization');
  }
}

/** Owner reports customer no-show — requires admin confirmation to finalize. */
export async function reportCustomerNoShow(params: {
  ownerUserId: string;
  role: UserRole;
  bookingId: string;
  evidence?: string;
  req?: AuthenticatedRequest;
}) {
  const scope = await resolveOwnerScope(params.ownerUserId, params.role);
  const config = loadPaymentPolicyConfig();

  const booking = await prisma.booking.findFirst({
    where: {
      id: params.bookingId,
      status: BookingStatus.confirmed,
      ...(scope.isAdmin ? {} : { property: { ownerId: scope.ownerProfileId! } }),
    },
    include: { slot: true, user: { select: { id: true } } },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  if (isTerminalVisitOutcome(booking.visitOutcome)) {
    throw new AppError(409, 'VISIT_ALREADY_RESOLVED', 'Visit already resolved');
  }

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  if (
    !isCustomerNoShowEligible({
      bookingStartAt: start,
      checkInVerified: booking.checkInStatus === CheckInStatus.verified,
      graceMinutes: config.customerNoShowGraceMinutes,
    })
  ) {
    throw new AppError(400, 'NOT_ELIGIBLE', 'Customer no-show window not yet open or check-in verified');
  }

  const blockingOwnerFault = await prisma.bookingIncident.findFirst({
    where: {
      bookingId: booking.id,
      type: { in: [...OWNER_FAULT_INCIDENT_TYPES, BookingIncidentType.force_majeure] },
      status: {
        in: [
          BookingIncidentStatus.open,
          BookingIncidentStatus.under_review,
          BookingIncidentStatus.confirmed,
        ],
      },
    },
  });
  if (blockingOwnerFault) {
    throw new AppError(
      409,
      'VISIT_DISPUTE_OPEN',
      'Open or confirmed owner-fault / force majeure blocks customer no-show report',
      { incidentType: blockingOwnerFault.type },
    );
  }

  const existing = await prisma.bookingIncident.findFirst({
    where: {
      bookingId: booking.id,
      type: BookingIncidentType.customer_no_show_report,
      status: { in: ['open', 'under_review', 'confirmed'] },
    },
  });
  if (existing) {
    throw new AppError(409, 'INCIDENT_EXISTS', 'No-show report already exists');
  }

  const incident = await prisma.$transaction(async (tx) => {
    const row = await tx.bookingIncident.create({
      data: {
        bookingId: booking.id,
        type: BookingIncidentType.customer_no_show_report,
        openedByUserId: params.ownerUserId,
        evidenceText: params.evidence ?? null,
        reason: 'Owner reported customer no-show',
      },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        visitOutcome: BookingVisitOutcome.disputed,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: 'owner.report_customer_no_show',
      },
    });
    return row;
  });

  await createAuditLog({
    actorUserId: params.ownerUserId,
    action: 'incident.customer_no_show_reported',
    entityType: 'booking_incident',
    entityId: incident.id,
    metadata: { bookingId: booking.id, publicCode: booking.publicCode },
    req: params.req,
  });

  await notifyNoShowReported({
    bookingId: booking.id,
    publicCode: booking.publicCode,
    reportedBy: 'owner',
  });

  return incident;
}

/** Admin confirms customer no-show — no refund, normal payout path. Status stays confirmed. */
export async function adminConfirmCustomerNoShow(params: {
  adminUserId: string;
  incidentId: string;
  adminNote?: string;
  req?: AuthenticatedRequest;
}) {
  const incident = await prisma.bookingIncident.findUnique({
    where: { id: params.incidentId },
    include: {
      booking: { include: { slot: true, payments: true } },
    },
  });
  if (!incident || incident.type !== BookingIncidentType.customer_no_show_report) {
    throw new AppError(404, 'NOT_FOUND', 'No-show incident not found');
  }
  if (incident.status === BookingIncidentStatus.confirmed) {
    return incident; // idempotent
  }

  await assertCustomerNoShowFinalizationReady(incident.booking);

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.bookingIncident.update({
      where: { id: incident.id },
      data: {
        status: BookingIncidentStatus.confirmed,
        adminNote: params.adminNote ?? null,
        resolvedAt: new Date(),
      },
    });
    await tx.booking.update({
      where: { id: incident.booking.id },
      data: {
        cancellationReasonCode: BOOKING_CANCELLATION_REASON.CUSTOMER_NO_SHOW,
        visitOutcome: BookingVisitOutcome.customer_no_show,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: 'admin.confirm_customer_no_show',
        // Booking.status remains confirmed — economics: refund 0, normal owner earnings
      },
    });
    return row;
  });

  for (const p of incident.booking.payments.filter((x) => x.status === PaymentStatus.succeeded)) {
    await syncPayoutStatusForPayment(p.id);
  }

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'incident.customer_no_show_confirmed',
    entityType: 'booking_incident',
    entityId: incident.id,
    metadata: {
      bookingId: incident.booking.id,
      visitOutcome: BookingVisitOutcome.customer_no_show,
      refund: 0,
    },
    req: params.req,
  });

  return updated;
}

/** Customer reports owner no-show or access denied. */
export async function reportOwnerArrivalProblem(params: {
  customerUserId: string;
  bookingId: string;
  type: 'owner_no_show_report' | 'access_denied_report' | 'property_unavailable_report';
  description: string;
  req?: AuthenticatedRequest;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, userId: params.customerUserId, status: BookingStatus.confirmed },
    include: {
      slot: true,
      property: { select: { ownerId: true, owner: { select: { userId: true } } } },
      payments: true,
      refundRequests: true,
    },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  if (isTerminalVisitOutcome(booking.visitOutcome)) {
    throw new AppError(409, 'VISIT_ALREADY_RESOLVED', 'Visit already resolved');
  }

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  if (new Date() < start) {
    throw new AppError(400, 'TOO_EARLY', 'Arrival reports open at booking start');
  }

  const incidentType =
    params.type === 'owner_no_show_report'
      ? BookingIncidentType.owner_no_show_report
      : params.type === 'access_denied_report'
        ? BookingIncidentType.access_denied_report
        : BookingIncidentType.property_unavailable_report;

  const incident = await prisma.$transaction(async (tx) => {
    const row = await tx.bookingIncident.create({
      data: {
        bookingId: booking.id,
        type: incidentType,
        openedByUserId: params.customerUserId,
        evidenceText: params.description,
        reason: params.type,
      },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        visitOutcome: BookingVisitOutcome.disputed,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: `customer.report_${params.type}`,
      },
    });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
      data: { payoutStatus: PayoutStatus.blocked },
    });
    return row;
  });

  await createAuditLog({
    actorUserId: params.customerUserId,
    action: 'incident.arrival_reported',
    entityType: 'booking_incident',
    entityId: incident.id,
    metadata: { type: params.type, bookingId: booking.id },
    req: params.req,
  });

  await notifyArrivalIncidentReported({
    ownerUserId: booking.property.owner.userId,
    customerUserId: params.customerUserId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    incidentType: params.type,
  });

  return incident;
}

/** Admin confirms owner fault — full refund, zero payout, 20% penalty (existing economics). */
export async function adminConfirmOwnerFaultArrival(params: {
  adminUserId: string;
  incidentId: string;
  adminNote?: string;
  req?: AuthenticatedRequest;
}) {
  const incident = await prisma.bookingIncident.findUnique({
    where: { id: params.incidentId },
    include: {
      booking: {
        include: {
          slot: true,
          payments: true,
          refundRequests: true,
          property: { select: { ownerId: true } },
        },
      },
    },
  });
  if (!incident) throw new AppError(404, 'NOT_FOUND', 'Incident not found');
  if (!OWNER_FAULT_INCIDENT_TYPES.includes(incident.type)) {
    throw new AppError(400, 'INVALID_TYPE', 'Not an owner-fault arrival incident');
  }
  if (incident.status === BookingIncidentStatus.confirmed) {
    return { incident, refundAmount: 0, penalty: 0, idempotent: true };
  }

  const booking = incident.booking;
  if (booking.status === BookingStatus.cancelled && isTerminalVisitOutcome(booking.visitOutcome)) {
    return { incident, refundAmount: 0, penalty: 0, idempotent: true };
  }

  const merchant = Number(booking.merchantBookingValue ?? booking.totalAmount);
  const penalty = calculateOwnerPenaltyJod(merchant, 'owner_no_show');
  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundAmount = filsToJod(funds.refundable);

  const reasonCode =
    incident.type === BookingIncidentType.owner_no_show_report
      ? BOOKING_CANCELLATION_REASON.OWNER_NO_SHOW
      : BOOKING_CANCELLATION_REASON.ACCESS_DENIED;

  const visitOutcome =
    incident.type === BookingIncidentType.owner_no_show_report
      ? BookingVisitOutcome.owner_no_show
      : BookingVisitOutcome.access_denied;

  await prisma.$transaction(async (tx) => {
    await tx.bookingIncident.update({
      where: { id: incident.id },
      data: {
        status: BookingIncidentStatus.confirmed,
        adminNote: params.adminNote ?? null,
        resolvedAt: new Date(),
      },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReasonCode: reasonCode,
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
        visitOutcome,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: 'admin.confirm_owner_fault',
      },
    });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
      data: {
        payoutStatus: PayoutStatus.blocked,
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
        ownerGrossAmount: 0,
      },
    });

    await recordOwnerReliabilityIncident({
      ownerProfileId: booking.property.ownerId,
      bookingId: booking.id,
      category: OwnerReliabilityCategory.owner_no_show,
      reason: incident.type,
      penaltyAmount: penalty,
      tx,
    });

    if (penalty > 0) {
      await createOwnerPenaltyAdjustment({
        ownerProfileId: booking.property.ownerId,
        bookingId: booking.id,
        amount: penalty,
        type:
          incident.type === BookingIncidentType.access_denied_report ||
          incident.type === BookingIncidentType.property_unavailable_report
            ? OwnerFinancialAdjustmentType.access_denied_penalty
            : OwnerFinancialAdjustmentType.owner_no_show_penalty,
        reason: `Admin confirmed ${incident.type}`,
        tx,
      });
    }
  });

  if (refundAmount > 0) {
    await ensureSystemOwnerFaultRefund({
      bookingId: booking.id,
      customerId: booking.userId,
      refundAmount,
      reasonLabel: 'Owner fault arrival — full refund',
      req: params.req,
    });
  }

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'incident.owner_fault_confirmed',
    entityType: 'booking_incident',
    entityId: incident.id,
    metadata: { refundAmount, penalty, bookingId: booking.id, visitOutcome },
    req: params.req,
  });

  return { incident, refundAmount, penalty };
}

/**
 * Admin rejects incident / records customer arrived (no customer no-show).
 * Re-syncs payout eligibility after open blocking incidents clear.
 */
export async function adminRejectIncident(params: {
  adminUserId: string;
  incidentId: string;
  adminNote: string;
  markCheckedIn?: boolean;
  req?: AuthenticatedRequest;
}) {
  const existing = await prisma.bookingIncident.findUnique({
    where: { id: params.incidentId },
    include: { booking: { include: { payments: true } } },
  });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Incident not found');

  const incident = await prisma.$transaction(async (tx) => {
    const row = await tx.bookingIncident.update({
      where: { id: params.incidentId },
      data: {
        status: BookingIncidentStatus.rejected,
        adminNote: params.adminNote,
        resolvedAt: new Date(),
      },
    });

    if (
      !isTerminalVisitOutcome(existing.booking.visitOutcome) &&
      existing.booking.status === BookingStatus.confirmed
    ) {
      await tx.booking.update({
        where: { id: existing.booking.id },
        data: params.markCheckedIn
          ? {
              visitOutcome: BookingVisitOutcome.checked_in,
              visitOutcomeAt: new Date(),
              visitOutcomeSource: 'admin.reject_incident_customer_arrived',
              checkInStatus: CheckInStatus.verified,
              checkInVerifiedAt: existing.booking.checkInVerifiedAt ?? new Date(),
            }
          : {
              visitOutcome: BookingVisitOutcome.pending_visit,
              visitOutcomeAt: new Date(),
              visitOutcomeSource: 'admin.reject_incident',
            },
      });
    }
    return row;
  });

  for (const p of existing.booking.payments.filter((x) => x.status === PaymentStatus.succeeded)) {
    await syncPayoutStatusForPayment(p.id);
  }

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'incident.rejected',
    entityType: 'booking_incident',
    entityId: params.incidentId,
    metadata: { adminNote: params.adminNote, markCheckedIn: params.markCheckedIn ?? false },
    req: params.req,
  });

  return incident;
}

/** Soft marker: Bookings past grace without terminal outcome (no financial auto-finalize). */
export async function markVisitReviewEligibleBatch(limit = 50): Promise<{ scanned: number; eligible: number }> {
  const config = loadPaymentPolicyConfig();
  const now = new Date();
  const graceMs = config.customerNoShowGraceMinutes * 60 * 1000;

  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.confirmed,
      visitOutcome: null,
      checkInStatus: { not: CheckInStatus.verified },
    },
    include: { slot: true },
    take: limit * 3,
    orderBy: { createdAt: 'asc' },
  });

  let eligible = 0;
  for (const b of candidates) {
    if (eligible >= limit) break;
    const start = resolveBookingPeriodStart(b.bookingStartAt, b.slot.date);
    if (now.getTime() < start.getTime() + graceMs) continue;
    eligible += 1;
    await createAuditLog({
      action: 'booking.visit_review_eligible',
      entityType: 'booking',
      entityId: b.id,
      metadata: {
        graceMinutes: config.customerNoShowGraceMinutes,
        bookingStartAt: start.toISOString(),
        note: 'Advisory only — no financial finalization',
      },
    });
  }

  return { scanned: candidates.length, eligible };
}
