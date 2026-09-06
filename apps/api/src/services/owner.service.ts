import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  PaymentStatus,
  type PropertyStatus,
  type UserRole,
} from '@mazare3/db';
import { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { expireOwnerApprovalIfNeeded } from './owner-approval-expiry.service.js';
import { toPaymentDisplayStatus } from '../mappers/payment.mapper.js';
import { resolveOwnerScope, type OwnerScope } from './owner-access.js';
import { resolvePropertyMediaPublicUrl } from '../lib/property-media-public-url.js';
import { assertOwnerNotPendingReview } from '../lib/owner-property-mutation-guards.js';
import type {
  OwnerAvailabilityQuery,
  OwnerAvailabilitySlotRow,
  OwnerBookingRow,
  OwnerDashboardSummary,
  OwnerPropertyCard,
  OwnerPropertyDetail,
  PatchOwnerAvailabilityInput,
  AvailabilityRuleInput,
  GenerateAvailabilityInput,
  ApplyRuleToFutureInput,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import {
  computePayoutAvailableAt,
  resolvePayoutStatus,
} from './payment-policy.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { mapOwnerSlotRow, occupancyTimes, slotTimesOrNull } from '../lib/availability-times.js';
import { intervalsOverlap } from '@mazare3/shared';
import {
  classifyOwnerInboxGroup,
  formatLocalTime,
  getPlatformTimeZone,
} from '@mazare3/shared';
import {
  listPropertyAvailabilityRules,
  putPropertyAvailabilityRules,
  deletePropertyAvailabilityRule,
  previewApplyRuleToFuture,
  applyRuleToFutureSlots,
  getPropertyAvailabilityHealth,
} from './availability-rules.service.js';
import {
  generateAvailabilityForProperty,
  previewAvailabilityGeneration,
} from './availability-generation.service.js';

function parseDateOnly(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d));
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

function nullableDecimalToNumber(
  value: { toNumber(): number } | number | null | undefined,
): number | null {
  if (value == null) return null;
  return typeof value === 'number' ? value : value.toNumber();
}

function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function propertyWhere(scope: OwnerScope) {
  return scope.isAdmin ? {} : { ownerId: scope.ownerProfileId! };
}

async function assertPropertyAccess(scope: OwnerScope, propertyId: string) {
  const property = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyWhere(scope) },
    select: { id: true, ownerId: true, slug: true, status: true },
  });
  if (!property) {
    throw new AppError(404, 'NOT_FOUND', 'Property not found');
  }
  return property;
}

async function assertOwnerCanMutateAvailability(scope: OwnerScope, propertyId: string) {
  const property = await assertPropertyAccess(scope, propertyId);
  assertOwnerNotPendingReview(property.status as PropertyStatus);
  return property;
}

async function slotHasActiveBooking(slotId: string): Promise<boolean> {
  const active = await prisma.booking.findFirst({
    where: {
      availabilitySlotId: slotId,
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: { id: true },
  });
  return !!active;
}

export async function getOwnerSummary(
  userId: string,
  role: UserRole,
  req?: AuthenticatedRequest,
): Promise<OwnerDashboardSummary> {
  const scope = await resolveOwnerScope(userId, role);
  const today = todayUtc();
  const weekEnd = addDaysUtc(today, 7);
  const monthEnd = addDaysUtc(today, 30);

  const properties = await prisma.property.findMany({
    where: propertyWhere(scope),
    select: { id: true },
  });
  const propertyIds = properties.map((p) => p.id);

  if (propertyIds.length === 0) {
    return {
      propertiesCount: 0,
      upcomingBookingsCount: 0,
      todayBookingsCount: 0,
      weekBookingsCount: 0,
      estimatedRevenueJod: 0,
      occupancyPercent: 0,
    };
  }

  const activeStatuses = [BookingStatus.confirmed];

  const [upcomingBookingsCount, todayBookings, weekBookings, revenueAgg, slotsInRange, bookedSlots] =
    await Promise.all([
      prisma.booking.count({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today } },
        },
      }),
      prisma.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: today },
        },
        include: { slot: { select: { date: true } } },
      }),
      prisma.booking.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today, lte: weekEnd } },
        },
      }),
      prisma.booking.aggregate({
        where: {
          propertyId: { in: propertyIds },
          status: { in: activeStatuses },
          slot: { date: { gte: today } },
        },
        _sum: { totalAmount: true },
      }),
      prisma.availabilitySlot.count({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: today, lte: monthEnd },
        },
      }),
      prisma.availabilitySlot.count({
        where: {
          propertyId: { in: propertyIds },
          date: { gte: today, lte: monthEnd },
          status: AvailabilitySlotStatus.booked,
        },
      }),
    ]);

  await createAuditLog({
    actorUserId: userId,
    action: 'owner.dashboard_accessed',
    entityType: 'owner',
    metadata: { propertiesCount: propertyIds.length },
    req,
  });

  const occupancyPercent =
    slotsInRange > 0 ? Math.round((bookedSlots / slotsInRange) * 100) : 0;

  return {
    propertiesCount: propertyIds.length,
    upcomingBookingsCount,
    todayBookingsCount: todayBookings.length,
    weekBookingsCount: weekBookings.length,
    estimatedRevenueJod: decimalToNumber(revenueAgg._sum.totalAmount ?? 0),
    occupancyPercent,
  };
}

export async function listOwnerProperties(
  userId: string,
  role: UserRole,
): Promise<OwnerPropertyCard[]> {
  const scope = await resolveOwnerScope(userId, role);

  const properties = await prisma.property.findMany({
    where: propertyWhere(scope),
    orderBy: { titleAr: 'asc' },
    include: {
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      _count: {
        select: {
          bookings: {
            where: { status: { in: SLOT_HOLDING_STATUSES } },
          },
        },
      },
    },
  });

  return properties.map((p) => ({
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    status: p.status,
    area: p.area,
    city: p.city,
    basePrice: nullableDecimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0] ? resolvePropertyMediaPublicUrl(p.media[0]) : undefined,
  }));
}

export async function getOwnerPropertyById(
  userId: string,
  role: UserRole,
  propertyId: string,
): Promise<OwnerPropertyDetail | null> {
  const scope = await resolveOwnerScope(userId, role);

  const p = await prisma.property.findFirst({
    where: { id: propertyId, ...propertyWhere(scope) },
    include: {
      media: { orderBy: { sortOrder: 'asc' }, take: 1 },
      _count: {
        select: {
          bookings: {
            where: {
              status: { in: SLOT_HOLDING_STATUSES },
              slot: { date: { gte: todayUtc() } },
            },
          },
        },
      },
    },
  });

  if (!p) return null;

  return {
    id: p.id,
    slug: p.slug,
    titleAr: p.titleAr,
    titleEn: p.titleEn ?? p.titleAr,
    status: p.status,
    area: p.area,
    city: p.city,
    basePrice: nullableDecimalToNumber(p.basePrice),
    currency: p.currency,
    bookingsCount: p._count.bookings,
    imageUrl: p.media[0] ? resolvePropertyMediaPublicUrl(p.media[0]) : undefined,
    capacity: p.capacity,
    allowsOvernight: p.allowsOvernight,
    upcomingBookingsCount: p._count.bookings,
    reviewChangeReason: p.reviewChangeReason ?? null,
    reviewRejectionReason: p.reviewRejectionReason ?? null,
    reviewRejectedAt: p.reviewRejectedAt?.toISOString() ?? null,
  };
}

export async function listOwnerBookings(
  userId: string,
  role: UserRole,
): Promise<OwnerBookingRow[]> {
  const scope = await resolveOwnerScope(userId, role);

  const overdue = await prisma.booking.findMany({
    where: {
      property: propertyWhere(scope),
      status: BookingStatus.pending_owner_approval,
      ownerApprovalExpiresAt: { lte: new Date() },
    },
    select: { id: true },
  });
  for (const row of overdue) {
    await expireOwnerApprovalIfNeeded(row.id);
  }

  const bookings = await prisma.booking.findMany({
    where: {
      property: propertyWhere(scope),
    },
    orderBy: [{ slot: { date: 'desc' } }, { createdAt: 'desc' }],
    include: {
      property: { select: { slug: true, titleAr: true, titleEn: true } },
      slot: { select: { date: true, period: true, startAt: true, endAt: true } },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      user: { select: { name: true } },
    },
  });

  return bookings.map((b) => {
    const pay = b.payments[0];
    let payoutAvailableAt = pay?.payoutAvailableAt ?? null;
    if (pay?.status === PaymentStatus.succeeded && !payoutAvailableAt) {
      payoutAvailableAt = computePayoutAvailableAt(b.slot.date);
    }
    const payoutStatus =
      pay?.status === PaymentStatus.succeeded
        ? resolvePayoutStatus({
            paymentSucceeded: true,
            bookingFullyPaid: b.paymentState === 'fully_paid',
            bookingCancelled: b.status === BookingStatus.cancelled,
            refundStatus: pay.refundStatus,
            payoutAvailableAt,
          })
        : pay?.payoutStatus ?? null;

    const timed = occupancyTimes({
      bookingStartAt: b.bookingStartAt,
      bookingEndAt: b.bookingEndAt,
      slot: b.slot,
    });
    return {
      id: b.id,
      publicCode: b.publicCode,
      status: b.status,
      propertyId: b.propertyId,
      propertySlug: b.property.slug,
      propertyTitleAr: b.property.titleAr,
      propertyTitleEn: b.property.titleEn ?? b.property.titleAr,
      date: formatDateOnly(b.slot.date),
      period: b.slot.period,
      startAtLocal: timed ? formatLocalTime(timed.startAt, getPlatformTimeZone()) : null,
      endAtLocal: timed ? formatLocalTime(timed.endAt, getPlatformTimeZone()) : null,
      timeZone: getPlatformTimeZone(),
      inboxGroup: classifyOwnerInboxGroup({
        status: b.status,
        date: formatDateOnly(b.slot.date),
        timeZone: getPlatformTimeZone(),
      }),
      guestsCount: b.guestsCount,
      totalAmount: decimalToNumber(b.totalAmount),
      currency: b.currency,
      depositAmount: decimalToNumber(b.depositAmount),
      customerName: b.user.name,
      instantBookingEnabled: b.instantBookingEnabled,
      ownerDecisionAt: b.ownerDecisionAt?.toISOString() ?? null,
      ownerDecisionReason: b.ownerDecisionReason,
      ownerApprovalExpiresAt: b.ownerApprovalExpiresAt?.toISOString() ?? null,
      ownerDecisionState: !b.instantBookingEnabled
        ? b.status === BookingStatus.pending_owner_approval
          ? 'pending'
          : b.status === BookingStatus.expired
            ? 'expired'
            : b.status === BookingStatus.cancelled && b.ownerDecisionAt
              ? 'rejected'
              : b.status === BookingStatus.pending_payment || b.status === BookingStatus.confirmed
                ? 'accepted'
                : 'not_applicable'
        : 'not_applicable',
      canAccept: b.status === BookingStatus.pending_owner_approval,
      canReject: b.status === BookingStatus.pending_owner_approval,
      createdAt: b.createdAt.toISOString(),
      paymentStatus: toPaymentDisplayStatus(pay, b.status),
      customerPayableAmount: pay ? decimalToNumber(pay.customerPayableAmount) : null,
      ownerNetPayoutAmount: pay ? decimalToNumber(pay.ownerNetPayoutAmount) : null,
      payoutStatus:
        b.paymentState === 'fully_paid' && pay?.purpose !== 'deposit' ? payoutStatus : 'not_ready',
      payoutAvailableAt:
        b.paymentState === 'fully_paid' ? payoutAvailableAt?.toISOString() ?? null : null,
      paymentState: b.paymentState,
      isFullyPaid: b.paymentState === 'fully_paid',
    };
  });
}

export async function listOwnerAvailability(
  userId: string,
  role: UserRole,
  query: OwnerAvailabilityQuery,
): Promise<OwnerAvailabilitySlotRow[]> {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, query.propertyId);

  const fromDate = parseDateOnly(query.from);
  const toDate = parseDateOnly(query.to);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      propertyId: query.propertyId,
      date: { gte: fromDate, lte: toDate },
    },
    orderBy: [{ date: 'asc' }, { period: 'asc' }],
    include: {
      bookings: {
        where: { status: { in: SLOT_HOLDING_STATUSES } },
        select: { id: true },
        take: 1,
      },
    },
  });

  return slots.map((s) =>
    mapOwnerSlotRow({
      ...s,
      hasActiveBooking: s.bookings.length > 0 || s.status === AvailabilitySlotStatus.booked,
    }),
  );
}

export async function patchOwnerAvailabilitySlot(
  userId: string,
  role: UserRole,
  slotId: string,
  input: PatchOwnerAvailabilityInput,
  req?: AuthenticatedRequest,
): Promise<OwnerAvailabilitySlotRow> {
  const scope = await resolveOwnerScope(userId, role);

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    include: {
      property: { select: { id: true, ownerId: true, status: true } },
      bookings: {
        where: { status: { in: SLOT_HOLDING_STATUSES } },
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!slot) {
    throw new AppError(404, 'NOT_FOUND', 'Availability slot not found');
  }

  if (!scope.isAdmin && slot.property.ownerId !== scope.ownerProfileId) {
    throw new AppError(403, 'FORBIDDEN', 'You do not own this property');
  }

  assertOwnerNotPendingReview(slot.property.status);

  const hasActive =
    slot.bookings.length > 0 || slot.status === AvailabilitySlotStatus.booked;

  if (hasActive) {
    throw new AppError(
      409,
      'SLOT_HAS_ACTIVE_BOOKING',
      'Cannot modify a slot with an active booking',
    );
  }

  const prevStatus = slot.status;
  const prevPrice = decimalToNumber(slot.price);

  const data: {
    status?: AvailabilitySlotStatus;
    price?: number;
    priceOverridden?: boolean;
  } = {};
  if (input.status !== undefined) {
    data.status =
      input.status === 'blocked'
        ? AvailabilitySlotStatus.blocked
        : AvailabilitySlotStatus.available;
  }
  if (input.status === 'available' && slot.status === AvailabilitySlotStatus.blocked) {
    const interval = slotTimesOrNull(slot);
    if (interval) {
      const holdings = await prisma.booking.findMany({
        where: {
          propertyId: slot.propertyId,
          status: { in: SLOT_HOLDING_STATUSES },
        },
        select: {
          availabilitySlotId: true,
          bookingStartAt: true,
          bookingEndAt: true,
          slot: { select: { startAt: true, endAt: true } },
        },
      });
      const conflict = holdings.some((h) => {
        if (h.availabilitySlotId === slot.id) return false;
        const occ = occupancyTimes(h);
        return occ ? intervalsOverlap(occ.startAt, occ.endAt, interval.startAt, interval.endAt) : false;
      });
      if (conflict) {
        throw new AppError(
          409,
          'SLOT_OVERLAP_CONFLICT',
          'Cannot reopen this slot while another overlapping booking is active',
        );
      }
    }
  }
  if (input.price !== undefined) {
    data.price = input.price;
    data.priceOverridden = true;
  }

  const updated = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data,
  });

  if (input.status === 'blocked' && prevStatus !== AvailabilitySlotStatus.blocked) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_blocked',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: { propertyId: slot.propertyId, date: formatDateOnly(slot.date), period: slot.period },
      req,
    });
  } else if (
    input.status === 'available' &&
    prevStatus === AvailabilitySlotStatus.blocked
  ) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_unblocked',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: { propertyId: slot.propertyId, date: formatDateOnly(slot.date), period: slot.period },
      req,
    });
  }

  if (input.price !== undefined && input.price !== prevPrice) {
    await createAuditLog({
      actorUserId: userId,
      action: 'owner.availability_price_updated',
      entityType: 'availability_slot',
      entityId: slotId,
      metadata: {
        propertyId: slot.propertyId,
        previousPrice: prevPrice,
        newPrice: input.price,
      },
      req,
    });
  }

  return mapOwnerSlotRow({
    ...updated,
    hasActiveBooking: false,
  });
}

export async function listOwnerAvailabilityRules(
  userId: string,
  role: UserRole,
  propertyId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, propertyId);
  return listPropertyAvailabilityRules(propertyId);
}

export async function putOwnerAvailabilityRules(
  userId: string,
  role: UserRole,
  propertyId: string,
  rules: AvailabilityRuleInput[],
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertOwnerCanMutateAvailability(scope, propertyId);
  return putPropertyAvailabilityRules(propertyId, rules, userId, req);
}

export async function deleteOwnerAvailabilityRule(
  userId: string,
  role: UserRole,
  propertyId: string,
  ruleId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertOwnerCanMutateAvailability(scope, propertyId);
  await deletePropertyAvailabilityRule(propertyId, ruleId);
}

export async function previewOwnerAvailabilityGeneration(
  userId: string,
  role: UserRole,
  propertyId: string,
  input: GenerateAvailabilityInput,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, propertyId);
  return previewAvailabilityGeneration(propertyId, input);
}

export async function generateOwnerAvailability(
  userId: string,
  role: UserRole,
  propertyId: string,
  input: GenerateAvailabilityInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertOwnerCanMutateAvailability(scope, propertyId);
  const result = await generateAvailabilityForProperty(propertyId, input);
  await createAuditLog({
    actorUserId: userId,
    action: 'owner.availability_generated',
    entityType: 'property',
    entityId: propertyId,
    metadata: { ...result },
    req,
  });
  return result;
}

export async function previewOwnerApplyRuleToFuture(
  userId: string,
  role: UserRole,
  propertyId: string,
  ruleId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, propertyId);
  return previewApplyRuleToFuture(propertyId, ruleId);
}

export async function applyOwnerRuleToFuture(
  userId: string,
  role: UserRole,
  propertyId: string,
  ruleId: string,
  input: ApplyRuleToFutureInput,
  req?: AuthenticatedRequest,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertOwnerCanMutateAvailability(scope, propertyId);
  return applyRuleToFutureSlots(propertyId, ruleId, input, userId, req);
}

export async function getOwnerAvailabilityHealth(
  userId: string,
  role: UserRole,
  propertyId: string,
) {
  const scope = await resolveOwnerScope(userId, role);
  await assertPropertyAccess(scope, propertyId);
  return getPropertyAvailabilityHealth(propertyId);
}
