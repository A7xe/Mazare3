import { prisma, BookingStatus, OwnerDecisionOutcome, Prisma } from '@mazare3/db';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { releaseSlotIfUnheld } from '../lib/slot-release.js';
import { notifyBookingRequestExpired } from './notification.service.js';
import { releaseCouponReservationInTx } from './coupon.service.js';
import { releasePlatformCouponReservationInTx } from './platform-coupon.service.js';

export async function expireOwnerApprovalIfNeeded(bookingId: string): Promise<boolean> {
  const peek = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { status: true, ownerApprovalExpiresAt: true },
  });
  if (!peek) return false;
  if (peek.status !== BookingStatus.pending_owner_approval) return false;
  if (!peek.ownerApprovalExpiresAt || peek.ownerApprovalExpiresAt > new Date()) return false;

  const didExpire = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${bookingId} FOR UPDATE`);
    const now = new Date();
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { titleAr: true, titleEn: true, owner: { select: { userId: true } } } },
      },
    });
    if (!booking) return null;
    if (booking.status !== BookingStatus.pending_owner_approval) return null;
    if (!booking.ownerApprovalExpiresAt || booking.ownerApprovalExpiresAt > now) return null;

    const expired = await tx.booking.updateMany({
      where: {
        id: bookingId,
        status: BookingStatus.pending_owner_approval,
        ownerApprovalExpiresAt: { lte: now },
      },
      data: { status: BookingStatus.expired, ownerDecisionOutcome: OwnerDecisionOutcome.timed_out },
    });
    if (expired.count !== 1) return null;

    await releaseSlotIfUnheld(tx, booking.availabilitySlotId, bookingId);
    await releaseCouponReservationInTx(tx, bookingId);
    await releasePlatformCouponReservationInTx(tx, bookingId);
    return booking;
  });

  if (!didExpire) return false;

  await createAuditLog({
    action: 'booking.owner_approval_expired',
    entityType: 'booking',
    entityId: bookingId,
    metadata: { reason: 'owner_approval_deadline', publicCode: didExpire.publicCode },
  });

  await notifyBookingRequestExpired({
    customerUserId: didExpire.userId,
    ownerUserId: didExpire.property.owner.userId,
    bookingId,
    publicCode: didExpire.publicCode,
    propertyTitleAr: didExpire.property.titleAr,
    propertyTitleEn: didExpire.property.titleEn ?? didExpire.property.titleAr,
  }).catch((err) => console.error('[notifications] booking.request_expired', err));

  return true;
}

export async function expireStaleOwnerApprovals(): Promise<{ processed: number; expired: number }> {
  const candidates = await prisma.booking.findMany({
    where: {
      status: BookingStatus.pending_owner_approval,
      // Inclusive of exact expiry instant (matches expireOwnerApprovalIfNeeded / accept guards).
      ownerApprovalExpiresAt: { lte: new Date() },
    },
    select: { id: true },
    orderBy: { ownerApprovalExpiresAt: 'asc' },
    take: 50,
  });
  let expired = 0;
  for (const { id } of candidates) {
    if (await expireOwnerApprovalIfNeeded(id)) expired++;
  }
  return { processed: candidates.length, expired };
}

export async function backdateOwnerApprovalDeadlineForQa(bookingId: string): Promise<void> {
  const past = new Date(Date.now() - 60_000);
  const updated = await prisma.booking.updateMany({
    where: { id: bookingId, status: BookingStatus.pending_owner_approval },
    data: { ownerApprovalExpiresAt: past },
  });
  if (updated.count !== 1) {
    throw new AppError(409, 'OWNER_DECISION_ALREADY_MADE', 'Booking is not pending owner approval');
  }
}
