import {
  prisma,
  AvailabilitySlotStatus,
  BookingIncidentStatus,
  BookingIncidentType,
  BookingStatus,
  BookingVisitOutcome,
  ForceMajeureCustomerChoice,
  OwnerReliabilityCategory,
  PaymentStatus,
  PayoutStatus,
} from '@mazare3/db';
import { BOOKING_CANCELLATION_REASON } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { recordOwnerReliabilityIncident } from './owner-reliability.service.js';
import { ensureSystemOwnerFaultRefund } from './refund-request.service.js';
import { releaseSlotIfUnheld } from './booking-hold.service.js';
import { refundableCapturedFils } from '../lib/booking-ledger.js';
import { filsToJod } from '@mazare3/shared';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import {
  notifyForceMajeureChoiceRequired,
  notifyForceMajeureRefundProcessing,
  notifyForceMajeureRescheduleProceeding,
  notifyForceMajeureResolved,
} from './notification.service.js';
import {
  createAdminForceMajeureReschedule,
  createCustomerForceMajeureReschedule,
} from './reschedule.service.js';

export type ForceMajeureOutcome =
  | 'confirm_awaiting_customer'
  | 'full_refund'
  | 'approve_reschedule';

export type ForceMajeureCustomerResolutionChoice = 'FULL_REFUND' | 'EQUIVALENT_RESCHEDULE';

export type ForceMajeureResolutionSummary = {
  incidentId: string;
  status: string;
  awaitingCustomerChoice: boolean;
  customerChoice: ForceMajeureCustomerResolutionChoice | null;
  customerChosenTargetSlotId: string | null;
  customerResolutionChosenAt: string | null;
};

function isValidRescheduleElection(incident: {
  bookingId: string;
  customerResolutionChoice: ForceMajeureCustomerChoice | null;
  customerResolutionInvalidatedAt: Date | null;
  customerResolutionChosenByUserId: string | null;
  customerChosenTargetSlotId: string | null;
}): boolean {
  return (
    incident.customerResolutionChoice === ForceMajeureCustomerChoice.EQUIVALENT_RESCHEDULE &&
    incident.customerResolutionInvalidatedAt == null &&
    Boolean(incident.customerResolutionChosenByUserId)
  );
}

async function loadBookingForFm(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      payments: true,
      refundRequests: true,
      property: { select: { ownerId: true, owner: { select: { userId: true } } } },
      user: { select: { id: true } },
    },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  return booking;
}

async function ensureForceMajeureIncident(params: {
  bookingId: string;
  incidentId?: string;
  openedByUserId: string;
  reason: string;
  evidenceText?: string;
  status?: BookingIncidentStatus;
}) {
  if (params.incidentId) {
    const existing = await prisma.bookingIncident.findFirst({
      where: {
        id: params.incidentId,
        bookingId: params.bookingId,
        type: BookingIncidentType.force_majeure,
      },
    });
    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Force majeure case not found');
    }
    return existing;
  }

  const openish = await prisma.bookingIncident.findFirst({
    where: {
      bookingId: params.bookingId,
      type: BookingIncidentType.force_majeure,
      status: {
        in: [
          BookingIncidentStatus.open,
          BookingIncidentStatus.under_review,
          BookingIncidentStatus.confirmed,
        ],
      },
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (openish) return openish;

  return prisma.bookingIncident.create({
    data: {
      bookingId: params.bookingId,
      type: BookingIncidentType.force_majeure,
      openedByUserId: params.openedByUserId,
      reason: params.reason,
      evidenceText: params.evidenceText ?? null,
      status: params.status ?? BookingIncidentStatus.under_review,
    },
  });
}

async function executeFullRefundPath(params: {
  booking: Awaited<ReturnType<typeof loadBookingForFm>>;
  incidentId: string;
  reason: string;
  req?: AuthenticatedRequest;
  actorUserId: string;
  actorKind: 'admin' | 'customer';
}) {
  const { booking, incidentId } = params;
  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundAmount = filsToJod(funds.refundable);

  await prisma.$transaction(async (tx) => {
    await tx.bookingIncident.update({
      where: { id: incidentId },
      data: {
        status: BookingIncidentStatus.confirmed,
        adminNote: params.reason,
        resolvedAt: new Date(),
      },
    });
    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.cancelled,
        cancelledAt: new Date(),
        cancellationReasonCode: BOOKING_CANCELLATION_REASON.FORCE_MAJEURE,
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
        visitOutcome: BookingVisitOutcome.force_majeure,
        visitOutcomeAt: new Date(),
        visitOutcomeSource: 'admin.force_majeure_full_refund',
      },
    });
    await tx.payment.updateMany({
      where: { bookingId: booking.id, status: PaymentStatus.succeeded },
      data: {
        payoutStatus: PayoutStatus.blocked,
        ownerNetPayoutAmount: 0,
        platformCommissionAmount: 0,
        ownerGrossAmount: 0,
        cancellationPenaltyAmount: 0,
        cancellationRefundAmount: refundAmount > 0 ? refundAmount : 0,
      },
    });
    await tx.availabilitySlot.update({
      where: { id: booking.availabilitySlotId },
      data: { status: AvailabilitySlotStatus.available },
    });
    await releaseSlotIfUnheld(tx, booking.availabilitySlotId, booking.id);

    await recordOwnerReliabilityIncident({
      ownerProfileId: booking.property.ownerId,
      bookingId: booking.id,
      category: OwnerReliabilityCategory.force_majeure,
      reason: params.reason,
      tx,
    });
  });

  if (refundAmount > 0) {
    await ensureSystemOwnerFaultRefund({
      bookingId: booking.id,
      customerId: booking.userId,
      refundAmount,
      reasonLabel: 'Force majeure — full refund',
      req: params.req,
    });
  }

  await createAuditLog({
    actorUserId: params.actorUserId,
    action: 'force_majeure.full_refund_finalised',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      incidentId,
      refundAmount,
      actorKind: params.actorKind,
      outcome: 'full_refund',
    },
    req: params.req,
  });

  await notifyForceMajeureRefundProcessing({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });

  return { refundAmount };
}

/**
 * Admin classifies / resolves a force majeure case.
 * approve_reschedule requires a durable Customer EQUIVALENT_RESCHEDULE election.
 */
export async function adminClassifyForceMajeure(params: {
  adminUserId: string;
  bookingId: string;
  incidentId?: string;
  outcome: ForceMajeureOutcome;
  reason: string;
  evidenceText?: string;
  toSlotId?: string;
  voluntaryUpgrade?: boolean;
  req?: AuthenticatedRequest;
}) {
  const booking = await loadBookingForFm(params.bookingId);
  const incident = await ensureForceMajeureIncident({
    bookingId: booking.id,
    incidentId: params.incidentId,
    openedByUserId: params.adminUserId,
    reason: params.reason,
    evidenceText: params.evidenceText,
  });

  if (incident.resolvedAt) {
    throw new AppError(409, 'FORCE_MAJEURE_ALREADY_RESOLVED', 'This force majeure case is already resolved');
  }

  const funds = refundableCapturedFils(booking.payments, booking.refundRequests);
  const refundAmountPreview = filsToJod(funds.refundable);

  if (params.outcome === 'confirm_awaiting_customer') {
    await prisma.bookingIncident.update({
      where: { id: incident.id },
      data: {
        status: BookingIncidentStatus.confirmed,
        adminNote: params.reason,
        evidenceText: params.evidenceText ?? incident.evidenceText,
        resolvedAt: null,
      },
    });
    await recordOwnerReliabilityIncident({
      ownerProfileId: booking.property.ownerId,
      bookingId: booking.id,
      category: OwnerReliabilityCategory.force_majeure,
      reason: params.reason,
    });

    await createAuditLog({
      actorUserId: params.adminUserId,
      action: 'force_majeure.confirmed_awaiting_customer',
      entityType: 'booking',
      entityId: booking.id,
      metadata: {
        incidentId: incident.id,
        outcome: params.outcome,
        openedByUserId: incident.openedByUserId,
      },
      req: params.req,
    });

    await notifyForceMajeureChoiceRequired({
      customerUserId: booking.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
    });

    return {
      incidentId: incident.id,
      outcome: params.outcome,
      refundAmount: 0,
      reschedule: null,
      awaitingCustomerChoice: true,
    };
  }

  if (params.outcome === 'full_refund') {
    // Confirm genuine FM if not already confirmed, then refund (default entitlement).
    if (incident.status !== BookingIncidentStatus.confirmed) {
      await prisma.bookingIncident.update({
        where: { id: incident.id },
        data: {
          status: BookingIncidentStatus.confirmed,
          adminNote: params.reason,
          evidenceText: params.evidenceText ?? incident.evidenceText,
        },
      });
    }

    const { refundAmount } = await executeFullRefundPath({
      booking,
      incidentId: incident.id,
      reason: params.reason,
      req: params.req,
      actorUserId: params.adminUserId,
      actorKind: 'admin',
    });

    await createAuditLog({
      actorUserId: params.adminUserId,
      action: 'booking.force_majeure_classified',
      entityType: 'booking',
      entityId: booking.id,
      metadata: {
        outcome: params.outcome,
        incidentId: incident.id,
        refundAmount,
      },
      req: params.req,
    });

    await notifyForceMajeureResolved({
      customerUserId: booking.userId,
      ownerUserId: booking.property.owner.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
      outcome: 'full_refund',
    });

    return {
      incidentId: incident.id,
      outcome: params.outcome,
      refundAmount,
      reschedule: null,
      awaitingCustomerChoice: false,
    };
  }

  // approve_reschedule — Customer election required (server-enforced).
  const fresh = await prisma.bookingIncident.findUniqueOrThrow({ where: { id: incident.id } });
  if (!isValidRescheduleElection(fresh) || fresh.bookingId !== booking.id) {
    throw new AppError(
      409,
      'FORCE_MAJEURE_CUSTOMER_CHOICE_REQUIRED',
      'Customer has not chosen rescheduling. Confirmed force majeure must resolve to full refund.',
    );
  }

  if (!params.toSlotId) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Target slot is required to approve reschedule');
  }

  if (
    fresh.customerChosenTargetSlotId &&
    fresh.customerChosenTargetSlotId !== params.toSlotId
  ) {
    throw new AppError(
      409,
      'FORCE_MAJEURE_SLOT_MISMATCH',
      'The selected slot does not match the Customer’s accepted choice.',
    );
  }

  if (incident.status !== BookingIncidentStatus.confirmed) {
    await prisma.bookingIncident.update({
      where: { id: incident.id },
      data: {
        status: BookingIncidentStatus.confirmed,
        adminNote: params.reason,
      },
    });
  }

  await recordOwnerReliabilityIncident({
    ownerProfileId: booking.property.ownerId,
    bookingId: booking.id,
    category: OwnerReliabilityCategory.force_majeure,
    reason: params.reason,
  });

  const rescheduleResult = await createAdminForceMajeureReschedule({
    adminUserId: params.adminUserId,
    bookingId: booking.id,
    toSlotId: params.toSlotId,
    voluntaryUpgrade: params.voluntaryUpgrade === true,
    adminNote: params.reason,
    req: params.req,
  });

  await prisma.bookingIncident.update({
    where: { id: incident.id },
    data: {
      status: BookingIncidentStatus.resolved,
      adminNote: `${params.reason} — reschedule approved`,
      resolvedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'force_majeure.reschedule_finalised',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      incidentId: incident.id,
      outcome: 'approve_reschedule',
      toSlotId: params.toSlotId,
      voluntaryUpgrade: params.voluntaryUpgrade === true,
      rescheduleRequestId: rescheduleResult.request?.id ?? null,
      rescheduleFinalized: rescheduleResult.finalized ?? null,
      customerElectionAt: fresh.customerResolutionChosenAt?.toISOString() ?? null,
      customerElectionByUserId: fresh.customerResolutionChosenByUserId,
    },
    req: params.req,
  });

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'booking.force_majeure_classified',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      outcome: params.outcome,
      incidentId: incident.id,
      refundAmount: refundAmountPreview,
      toSlotId: params.toSlotId,
      rescheduleRequestId: rescheduleResult.request?.id ?? null,
    },
    req: params.req,
  });

  await notifyForceMajeureRescheduleProceeding({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });

  await notifyForceMajeureResolved({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    outcome: 'approve_reschedule',
  });

  return {
    incidentId: incident.id,
    outcome: params.outcome,
    refundAmount: 0,
    reschedule: rescheduleResult,
    awaitingCustomerChoice: false,
  };
}

/**
 * Explicit Customer force-majeure resolution election (auditable; Customer actor only).
 */
export async function customerElectForceMajeureResolution(params: {
  customerUserId: string;
  bookingId: string;
  choice: ForceMajeureCustomerResolutionChoice;
  toSlotId?: string;
  voluntaryUpgrade?: boolean;
  source?: string;
  req?: AuthenticatedRequest;
}) {
  const booking = await loadBookingForFm(params.bookingId);
  if (booking.userId !== params.customerUserId) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  const incident = await prisma.bookingIncident.findFirst({
    where: {
      bookingId: booking.id,
      type: BookingIncidentType.force_majeure,
      status: BookingIncidentStatus.confirmed,
      resolvedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (!incident) {
    throw new AppError(
      409,
      'FORCE_MAJEURE_NOT_AWAITING_CHOICE',
      'No confirmed force majeure case is awaiting your choice for this booking.',
    );
  }

  if (params.choice === 'EQUIVALENT_RESCHEDULE' && !params.toSlotId) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Please select an available replacement slot to continue with rescheduling.',
    );
  }

  const source = (params.source ?? 'customer_my_bookings').slice(0, 120);
  const choiceEnum =
    params.choice === 'FULL_REFUND'
      ? ForceMajeureCustomerChoice.FULL_REFUND
      : ForceMajeureCustomerChoice.EQUIVALENT_RESCHEDULE;

  const updated = await prisma.bookingIncident.update({
    where: { id: incident.id },
    data: {
      customerResolutionChoice: choiceEnum,
      customerResolutionChosenAt: new Date(),
      customerResolutionChosenByUserId: params.customerUserId,
      customerResolutionSource: source,
      customerChosenTargetSlotId: params.toSlotId ?? null,
      customerResolutionInvalidatedAt: null,
    },
  });

  await createAuditLog({
    actorUserId: params.customerUserId,
    action: 'force_majeure.customer_resolution_selected',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      incidentId: incident.id,
      selectedResolution: params.choice,
      source,
      targetSlotId: params.toSlotId ?? null,
      actorKind: 'customer',
    },
    req: params.req,
  });

  if (params.choice === 'FULL_REFUND') {
    const { refundAmount } = await executeFullRefundPath({
      booking,
      incidentId: incident.id,
      reason: incident.adminNote ?? incident.reason ?? 'Force majeure — customer elected full refund',
      req: params.req,
      actorUserId: params.customerUserId,
      actorKind: 'customer',
    });

    await notifyForceMajeureResolved({
      customerUserId: booking.userId,
      ownerUserId: booking.property.owner.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
      outcome: 'full_refund',
    });

    return {
      incidentId: incident.id,
      choice: params.choice,
      refundAmount,
      reschedule: null,
    };
  }

  const rescheduleResult = await createCustomerForceMajeureReschedule({
    customerUserId: params.customerUserId,
    bookingId: booking.id,
    toSlotId: params.toSlotId!,
    voluntaryUpgrade: params.voluntaryUpgrade === true,
    note: 'Force majeure — customer elected equivalent reschedule',
    req: params.req,
  });

  await prisma.bookingIncident.update({
    where: { id: incident.id },
    data: {
      status: BookingIncidentStatus.resolved,
      resolvedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId: params.customerUserId,
    action: 'force_majeure.reschedule_finalised',
    entityType: 'booking',
    entityId: booking.id,
    metadata: {
      incidentId: incident.id,
      selectedResolution: 'EQUIVALENT_RESCHEDULE',
      targetSlotId: params.toSlotId,
      rescheduleRequestId: rescheduleResult.request?.id ?? null,
      rescheduleFinalized: rescheduleResult.finalized ?? null,
      actorKind: 'customer',
    },
    req: params.req,
  });

  await notifyForceMajeureRescheduleProceeding({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });

  await notifyForceMajeureResolved({
    customerUserId: booking.userId,
    ownerUserId: booking.property.owner.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
    outcome: 'approve_reschedule',
  });

  return {
    incidentId: updated.id,
    choice: params.choice,
    refundAmount: 0,
    reschedule: rescheduleResult,
  };
}

export async function mapForceMajeureResolutionByBookingIds(
  bookingIds: string[],
): Promise<Map<string, ForceMajeureResolutionSummary>> {
  const out = new Map<string, ForceMajeureResolutionSummary>();
  if (bookingIds.length === 0) return out;

  const rows = await prisma.bookingIncident.findMany({
    where: {
      bookingId: { in: bookingIds },
      type: BookingIncidentType.force_majeure,
      status: {
        in: [BookingIncidentStatus.confirmed, BookingIncidentStatus.resolved],
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  for (const row of rows) {
    if (out.has(row.bookingId)) continue;
    const awaitingCustomerChoice =
      row.status === BookingIncidentStatus.confirmed &&
      row.resolvedAt == null &&
      row.customerResolutionChoice == null;
    out.set(row.bookingId, {
      incidentId: row.id,
      status: row.status,
      awaitingCustomerChoice,
      customerChoice: row.customerResolutionChoice,
      customerChosenTargetSlotId: row.customerChosenTargetSlotId,
      customerResolutionChosenAt: row.customerResolutionChosenAt?.toISOString() ?? null,
    });
  }
  return out;
}
