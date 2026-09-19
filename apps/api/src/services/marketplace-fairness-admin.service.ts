import { prisma, BookingIncidentStatus } from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { waiveOwnerPenaltyAdjustment } from './owner-reliability.service.js';
import {
  adminConfirmCustomerNoShow,
  adminConfirmOwnerFaultArrival,
  adminRejectIncident,
} from './no-show.service.js';
import { adminClassifyForceMajeure, type ForceMajeureOutcome } from './force-majeure.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

export async function listAdminBookingIncidents(status?: BookingIncidentStatus) {
  return prisma.bookingIncident.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      booking: { select: { publicCode: true, status: true } },
      openedBy: { select: { id: true, email: true, name: true } },
    },
  });
}

export async function listAdminOwnerAdjustments() {
  return prisma.ownerFinancialAdjustment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      booking: { select: { publicCode: true } },
      owner: { select: { displayName: true } },
    },
  });
}

export async function adminApproveExtraReschedule(params: {
  adminUserId: string;
  bookingId: string;
  reason: string;
  req?: AuthenticatedRequest;
}) {
  const reason = params.reason?.trim();
  if (!reason || reason.length < 3) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Admin reason is required');
  }
  const booking = await prisma.booking.findUnique({ where: { id: params.bookingId } });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  await prisma.booking.update({
    where: { id: params.bookingId },
    data: { rescheduleCount: 0 },
  });

  await createAuditLog({
    actorUserId: params.adminUserId,
    action: 'admin.approve_extra_reschedule',
    entityType: 'booking',
    entityId: params.bookingId,
    metadata: {
      reason,
      previousRescheduleCount: booking.rescheduleCount,
    },
    req: params.req,
  });

  return { ok: true };
}

export {
  adminConfirmCustomerNoShow,
  adminConfirmOwnerFaultArrival,
  adminRejectIncident,
  adminClassifyForceMajeure,
  waiveOwnerPenaltyAdjustment,
};

export type { ForceMajeureOutcome };
