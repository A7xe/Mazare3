import { prisma, BookingStatus, BookingVisitOutcome, CheckInStatus } from '@mazare3/db';
import {
  resolveBookingPeriodStart,
  resolveCheckInWindow,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  generateCheckInPin,
  hashCheckInPin,
  newCheckInSalt,
  verifyCheckInPin,
} from '../lib/check-in-crypto.js';
import { resolveOwnerScope } from './owner-access.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '@mazare3/db';
import { notifyCheckInAvailable, notifyCheckInVerified } from './notification.service.js';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

async function loadConfirmedBooking(bookingId: string) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      slot: true,
      property: { select: { ownerId: true, owner: { select: { userId: true } } } },
      user: { select: { id: true } },
    },
  });
  if (!booking || booking.status !== BookingStatus.confirmed) {
    throw new AppError(404, 'NOT_FOUND', 'Confirmed booking not found');
  }
  return booking;
}

/** Opens check-in window and generates hashed PIN when eligible. Returns plaintext once. */
export async function ensureCheckInCodeForCustomer(userId: string, bookingId: string) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, userId, status: BookingStatus.confirmed },
    include: { slot: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  const window = resolveCheckInWindow(start);

  if (window.status === 'not_open') {
    return {
      status: CheckInStatus.not_open,
      opensAt: window.opensAt.toISOString(),
      expiresAt: window.expiresAt.toISOString(),
      code: null as string | null,
    };
  }

  if (booking.checkInStatus === CheckInStatus.verified) {
    return {
      status: CheckInStatus.verified,
      verifiedAt: booking.checkInVerifiedAt?.toISOString() ?? null,
      code: null,
    };
  }

  if (window.status === 'expired' || booking.checkInStatus === CheckInStatus.expired) {
    if (booking.checkInStatus !== CheckInStatus.expired) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { checkInStatus: CheckInStatus.expired },
      });
    }
    return { status: CheckInStatus.expired, code: null };
  }

  let plaintextPin: string | null = null;

  if (!booking.checkInCodeHash || !booking.checkInCodeSalt) {
    const pin = generateCheckInPin();
    const salt = newCheckInSalt();
    const hash = hashCheckInPin(pin, salt);
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        checkInCodeHash: hash,
        checkInCodeSalt: salt,
        checkInStatus: CheckInStatus.available,
        checkInExpiresAt: window.expiresAt,
      },
    });
    plaintextPin = pin;
    await notifyCheckInAvailable({ customerUserId: userId, bookingId, publicCode: booking.publicCode });
  } else if (booking.checkInStatus === CheckInStatus.not_open) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        checkInStatus: CheckInStatus.available,
        checkInExpiresAt: window.expiresAt,
      },
    });
  }

  return {
    status: CheckInStatus.available,
    opensAt: window.opensAt.toISOString(),
    expiresAt: window.expiresAt.toISOString(),
    /** Plaintext returned only on first generation in this session path. */
    code: plaintextPin,
  };
}

export async function verifyCheckInByOwner(params: {
  ownerUserId: string;
  role: UserRole;
  bookingId: string;
  pin: string;
  req?: AuthenticatedRequest;
}) {
  const scope = await resolveOwnerScope(params.ownerUserId, params.role);
  const booking = await loadConfirmedBooking(params.bookingId);

  if (!scope.isAdmin && booking.property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Not your booking');
  }

  if (booking.checkInStatus === CheckInStatus.verified) {
    return { verified: true, alreadyVerified: true };
  }

  if (!booking.checkInCodeHash || !booking.checkInCodeSalt) {
    throw new AppError(400, 'CHECKIN_NOT_READY', 'Check-in code not yet available');
  }

  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  const window = resolveCheckInWindow(start);
  if (window.status === 'expired') {
    throw new AppError(400, 'CHECKIN_EXPIRED', 'Check-in window has expired');
  }

  const ok = verifyCheckInPin(params.pin, booking.checkInCodeSalt, booking.checkInCodeHash);
  if (!ok) {
    throw new AppError(400, 'INVALID_PIN', 'Invalid check-in code');
  }

  const now = new Date();
  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      checkInStatus: CheckInStatus.verified,
      checkInVerifiedAt: now,
      visitOutcome: BookingVisitOutcome.checked_in,
      visitOutcomeAt: now,
      visitOutcomeSource: 'owner.verify_check_in',
    },
  });

  await createAuditLog({
    actorUserId: params.ownerUserId,
    action: 'booking.check_in_verified',
    entityType: 'booking',
    entityId: booking.id,
    metadata: { publicCode: booking.publicCode },
    req: params.req,
  });

  await notifyCheckInVerified({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });

  return { verified: true, verifiedAt: now.toISOString() };
}

export async function getCheckInStatusForOwner(
  ownerUserId: string,
  role: UserRole,
  bookingId: string,
) {
  const scope = await resolveOwnerScope(ownerUserId, role);
  const booking = await loadConfirmedBooking(bookingId);
  if (!scope.isAdmin && booking.property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'Not your booking');
  }
  const start = resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
  const window = resolveCheckInWindow(start);
  return {
    checkInStatus: booking.checkInStatus,
    verifiedAt: booking.checkInVerifiedAt?.toISOString() ?? null,
    windowStatus: window.status,
    expiresAt: window.expiresAt.toISOString(),
    merchantValue: decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount),
  };
}
