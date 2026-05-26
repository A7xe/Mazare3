import {
  prisma,
  BookingStatus,
  PaymentStatus,
  DisputeStatus,
  PayoutStatus,
  type BookingStatus as BookingStatusType,
} from '@mazare3/db';
import type {
  CreateDisputeInput,
  PatchAdminDisputeInput,
  DisputeSummary,
  AdminDisputeRow,
} from '@mazare3/shared';
import { BLOCKING_DISPUTE_STATUSES } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function bookingDayEnded(slotDate: Date, now = new Date()): boolean {
  const end = new Date(slotDate);
  end.setUTCHours(23, 59, 59, 999);
  return now > end;
}

function toDisputeSummary(
  row: {
    id: string;
    bookingId: string;
    type: DisputeSummary['type'];
    status: DisputeSummary['status'];
    description: string;
    adminNote: string | null;
    createdAt: Date;
    updatedAt: Date;
  },
  extra?: Partial<DisputeSummary>,
): DisputeSummary {
  return {
    id: row.id,
    bookingId: row.bookingId,
    type: row.type,
    status: row.status,
    description: row.description,
    adminNote: row.adminNote,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...extra,
  };
}

export async function createDispute(
  userId: string,
  bookingId: string,
  input: CreateDisputeInput,
  req?: AuthenticatedRequest,
): Promise<DisputeSummary> {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId },
    include: {
      slot: { select: { date: true } },
      payments: {
        where: { status: PaymentStatus.succeeded },
        take: 1,
      },
      property: { select: { slug: true, titleAr: true, titleEn: true } },
    },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }
  if (booking.status !== BookingStatus.confirmed || !booking.payments[0]) {
    throw new AppError(400, 'INVALID_STATUS', 'Disputes require a confirmed paid booking');
  }

  if (!bookingDayEnded(booking.slot.date)) {
    throw new AppError(
      400,
      'DISPUTE_NOT_ALLOWED',
      'Disputes can be opened after the booking date has passed',
    );
  }

  const existing = await prisma.dispute.findFirst({
    where: {
      bookingId,
      status: { in: [...BLOCKING_DISPUTE_STATUSES] as DisputeStatus[] },
    },
  });
  if (existing) {
    throw new AppError(409, 'DISPUTE_EXISTS', 'An open dispute already exists for this booking');
  }

  const row = await prisma.dispute.create({
    data: {
      bookingId,
      openedByUserId: userId,
      type: input.type,
      description: input.description.trim(),
      status: DisputeStatus.open,
    },
  });

  const payment = booking.payments[0]!;
  await prisma.payment.update({
    where: { id: payment.id },
    data: { payoutStatus: PayoutStatus.blocked },
  });
  await syncPayoutStatusForPayment(payment.id);

  await createAuditLog({
    actorUserId: userId,
    action: 'dispute.opened',
    entityType: 'dispute',
    entityId: row.id,
    metadata: { bookingId, type: input.type, publicCode: booking.publicCode },
    req,
  });

  return toDisputeSummary(row, {
    bookingPublicCode: booking.publicCode,
    propertySlug: booking.property.slug,
    propertyTitleAr: booking.property.titleAr,
    propertyTitleEn: booking.property.titleEn ?? booking.property.titleAr,
  });
}

export async function listMyDisputes(userId: string): Promise<DisputeSummary[]> {
  const rows = await prisma.dispute.findMany({
    where: { openedByUserId: userId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      booking: {
        include: {
          property: { select: { slug: true, titleAr: true, titleEn: true } },
        },
      },
    },
  });
  return rows.map((r) =>
    toDisputeSummary(r, {
      bookingPublicCode: r.booking.publicCode,
      propertySlug: r.booking.property.slug,
      propertyTitleAr: r.booking.property.titleAr,
      propertyTitleEn: r.booking.property.titleEn ?? r.booking.property.titleAr,
    }),
  );
}

export async function listAdminDisputes(): Promise<AdminDisputeRow[]> {
  const rows = await prisma.dispute.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: {
        include: {
          property: {
            select: {
              slug: true,
              titleAr: true,
              titleEn: true,
              owner: { select: { displayName: true } },
            },
          },
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    bookingId: r.bookingId,
    publicCode: r.booking.publicCode,
    customerName: r.booking.user.name,
    customerEmail: r.booking.user.email,
    ownerDisplayName: r.booking.property.owner.displayName,
    propertySlug: r.booking.property.slug,
    propertyTitleAr: r.booking.property.titleAr,
    propertyTitleEn: r.booking.property.titleEn ?? r.booking.property.titleAr,
    type: r.type,
    status: r.status,
    description: r.description,
    adminNote: r.adminNote,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function patchAdminDispute(
  adminUserId: string,
  id: string,
  input: PatchAdminDisputeInput,
  req?: AuthenticatedRequest,
): Promise<AdminDisputeRow> {
  const row = await prisma.dispute.findUnique({
    where: { id },
    include: {
      booking: {
        include: {
          payments: { where: { status: PaymentStatus.succeeded }, take: 1 },
        },
      },
    },
  });
  if (!row) {
    throw new AppError(404, 'NOT_FOUND', 'Dispute not found');
  }

  await prisma.dispute.update({
    where: { id },
    data: {
      status: input.status as DisputeStatus,
      adminNote: input.adminNote?.trim() ?? undefined,
    },
  });

  const payment = row.booking.payments[0];
  if (payment) {
    await syncPayoutStatusForPayment(payment.id);
  }

  await createAuditLog({
    actorUserId: adminUserId,
    action: 'dispute.status_updated',
    entityType: 'dispute',
    entityId: id,
    metadata: { status: input.status },
    req,
  });

  const list = await listAdminDisputes();
  const found = list.find((d) => d.id === id);
  if (!found) {
    throw new AppError(500, 'INTERNAL_ERROR', 'Failed to load updated dispute');
  }
  return found;
}

export function canOpenDisputeForBooking(
  status: BookingStatusType,
  hasSucceededPayment: boolean,
  slotDate: Date,
): boolean {
  return (
    status === BookingStatus.confirmed &&
    hasSucceededPayment &&
    bookingDayEnded(slotDate)
  );
}
