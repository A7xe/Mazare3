import {
  prisma,
  AvailabilitySlotStatus,
  BookingRescheduleRequestedBy,
  BookingRescheduleRequestStatus,
  BookingStatus,
  PaymentPurpose,
  PaymentStatus,
  Prisma,
} from '@mazare3/db';
import {
  PAYMENT_HOLD_MINUTES,
  RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS,
  computeReschedulePricing,
  filsToJod,
  jodToFils,
  resolveBookingPeriodStart,
  roundPolicyMoney,
  type PendingRescheduleSummary,
  type ReschedulePricingMode,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { createAuditLog } from './audit.service.js';
import { loadPaymentPolicyConfig } from '../config/payment-policy.config.js';
import { resolveOwnerScope } from './owner-access.js';
import { SLOT_HOLDING_STATUSES, bookingSlotUnavailableError, isBookingSlotUniqueViolation } from '../lib/payment-hold.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { UserRole } from '@mazare3/db';
import {
  notifyRescheduleCompleted,
  notifyRescheduleExpired,
  notifyReschedulePaymentRequired,
  notifyRescheduleRefundDifference,
  notifyRescheduleRequested,
  notifyRescheduleResponded,
} from './notification.service.js';
import { ensureSystemOwnerFaultRefund } from './refund-request.service.js';
import { refundableCapturedFils, succeededInstallmentFils } from '../lib/booking-ledger.js';
import { buildBookingFinancialSnapshot } from './payment-policy.service.js';

const ACTIVE_RESCHEDULE_STATUSES: BookingRescheduleRequestStatus[] = [
  BookingRescheduleRequestStatus.pending,
  BookingRescheduleRequestStatus.accepted_pending_payment,
];

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

function counterpartyExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS * 60 * 60 * 1000);
}

function paymentHoldExpiresAt(now = new Date()): Date {
  return new Date(now.getTime() + PAYMENT_HOLD_MINUTES * 60 * 1000);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function assertTargetSlotUsable(params: {
  slotId: string;
  propertyId: string;
  exceptBookingId: string;
  allowHeldByRequestId?: string | null;
  tx: Prisma.TransactionClient | typeof prisma;
}) {
  const slot = await params.tx.availabilitySlot.findUnique({ where: { id: params.slotId } });
  if (!slot || slot.propertyId !== params.propertyId) {
    throw new AppError(400, 'INVALID_SLOT', 'Target slot invalid');
  }

  if (slot.status === AvailabilitySlotStatus.available) {
    return slot;
  }

  if (slot.status === AvailabilitySlotStatus.held && params.allowHeldByRequestId) {
    const owner = await params.tx.bookingRescheduleRequest.findFirst({
      where: {
        id: params.allowHeldByRequestId,
        toSlotId: params.slotId,
        status: { in: ACTIVE_RESCHEDULE_STATUSES },
      },
      select: { id: true },
    });
    if (owner) return slot;
  }

  throw bookingSlotUnavailableError('Target slot is not available');
}

async function softHoldTargetSlot(tx: Prisma.TransactionClient, slotId: string) {
  await tx.availabilitySlot.update({
    where: { id: slotId },
    data: { status: AvailabilitySlotStatus.held },
  });
}

async function releaseHeldTargetSlotIfUnused(
  tx: Prisma.TransactionClient,
  slotId: string,
  exceptRequestId: string,
) {
  const otherHold = await tx.bookingRescheduleRequest.findFirst({
    where: {
      id: { not: exceptRequestId },
      toSlotId: slotId,
      status: { in: ACTIVE_RESCHEDULE_STATUSES },
    },
    select: { id: true },
  });
  if (otherHold) return;

  const activeBooking = await tx.booking.findFirst({
    where: {
      availabilitySlotId: slotId,
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: { id: true },
  });
  if (activeBooking) return;

  await tx.availabilitySlot.updateMany({
    where: { id: slotId, status: AvailabilitySlotStatus.held },
    data: { status: AvailabilitySlotStatus.available },
  });
}

function slotSummary(slot: {
  id: string;
  date: Date;
  period: string;
  startAt: Date | null;
  endAt: Date | null;
  price: { toNumber(): number } | number;
}): PendingRescheduleSummary['fromSlot'] {
  return {
    id: slot.id,
    date: formatDateOnly(slot.date),
    period: slot.period as PendingRescheduleSummary['fromSlot']['period'],
    startAt: slot.startAt?.toISOString() ?? null,
    endAt: slot.endAt?.toISOString() ?? null,
    price: decimalToNumber(slot.price),
  };
}

export async function toPendingRescheduleSummary(request: {
  id: string;
  status: string;
  requestedBy: string;
  fromSlotId: string;
  toSlotId: string;
  customerPayableDelta: { toNumber(): number } | number;
  customerContractedValue: { toNumber(): number } | number;
  fromMerchantValue: { toNumber(): number } | number;
  listToMerchantValue?: { toNumber(): number } | number | null;
  toMerchantValue: { toNumber(): number } | number;
  ownerAbsorbsAmount: { toNumber(): number } | number;
  pricingMode: string;
  expiresAt: Date | null;
  targetSlotHeldUntil?: Date | null;
}): Promise<PendingRescheduleSummary> {
  const [fromSlot, toSlot] = await Promise.all([
    prisma.availabilitySlot.findUniqueOrThrow({ where: { id: request.fromSlotId } }),
    prisma.availabilitySlot.findUniqueOrThrow({ where: { id: request.toSlotId } }),
  ]);
  const delta = decimalToNumber(request.customerPayableDelta);
  const listTo =
    request.listToMerchantValue != null
      ? decimalToNumber(request.listToMerchantValue)
      : decimalToNumber(request.toMerchantValue);
  return {
    id: request.id,
    status: request.status,
    requestedBy: request.requestedBy as PendingRescheduleSummary['requestedBy'],
    fromSlot: slotSummary(fromSlot),
    toSlot: slotSummary(toSlot),
    customerPayableDelta: delta,
    customerContractedValue: decimalToNumber(request.customerContractedValue),
    fromMerchantValue: decimalToNumber(request.fromMerchantValue),
    toListMerchantValue: listTo,
    ownerAbsorbsAmount: decimalToNumber(request.ownerAbsorbsAmount),
    pricingMode: request.pricingMode,
    expiresAt: (request.targetSlotHeldUntil ?? request.expiresAt)?.toISOString() ?? null,
    paymentRequired:
      request.status === BookingRescheduleRequestStatus.accepted_pending_payment && delta > 0,
  };
}

export async function previewReschedulePricing(
  bookingId: string,
  toSlotId: string,
  initiatedBy: 'customer' | 'owner' | 'admin',
  opts?: { forceMajeure?: boolean; voluntaryUpgrade?: boolean },
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { slot: true },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const toSlot = await prisma.availabilitySlot.findUnique({ where: { id: toSlotId } });
  if (!toSlot || toSlot.propertyId !== booking.propertyId) {
    throw new AppError(400, 'INVALID_SLOT', 'Target slot invalid');
  }

  const fromMerchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);
  const toList = decimalToNumber(toSlot.price);
  const pricing = computeReschedulePricing({
    fromMerchantValue: fromMerchant,
    toListMerchantValue: toList,
    initiatedBy,
    forceMajeure: opts?.forceMajeure,
    voluntaryUpgrade: opts?.voluntaryUpgrade,
  });

  return {
    bookingId,
    toSlotId,
    fromMerchantValue: fromMerchant,
    toListMerchantValue: toList,
    ...pricing,
  };
}

async function createRescheduleRequestRow(params: {
  bookingId: string;
  requestedBy: BookingRescheduleRequestedBy;
  requestedByUserId: string;
  fromSlotId: string;
  toSlotId: string;
  fromMerchant: number;
  toList: number;
  pricing: ReturnType<typeof computeReschedulePricing>;
  exemptFromRescheduleLimit: boolean;
  exemptFromCancelAnchor: boolean;
  adminNote?: string | null;
  tx: Prisma.TransactionClient;
}) {
  const heldUntil = counterpartyExpiresAt();
  await softHoldTargetSlot(params.tx, params.toSlotId);

  return params.tx.bookingRescheduleRequest.create({
    data: {
      bookingId: params.bookingId,
      requestedBy: params.requestedBy,
      requestedByUserId: params.requestedByUserId,
      fromSlotId: params.fromSlotId,
      toSlotId: params.toSlotId,
      fromMerchantValue: params.fromMerchant,
      toMerchantValue: params.toList,
      priceDelta: params.pricing.priceDelta,
      customerContractedValue: params.pricing.customerContractedValue,
      customerPayableDelta: params.pricing.customerPayableDelta,
      commissionBasisValue: params.pricing.commissionBasisValue,
      listToMerchantValue: params.toList,
      ownerAbsorbsAmount: params.pricing.ownerAbsorbsAmount,
      pricingMode: params.pricing.pricingMode,
      exemptFromRescheduleLimit: params.exemptFromRescheduleLimit,
      exemptFromCancelAnchor: params.exemptFromCancelAnchor,
      adminNote: params.adminNote ?? null,
      expiresAt: heldUntil,
      targetSlotHeldUntil: heldUntil,
      status: BookingRescheduleRequestStatus.pending,
    },
  });
}

export async function requestCustomerReschedule(params: {
  customerUserId: string;
  bookingId: string;
  toSlotId: string;
  req?: AuthenticatedRequest;
}) {
  const config = loadPaymentPolicyConfig();
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, userId: params.customerUserId, status: BookingStatus.confirmed },
    include: { slot: true, property: { select: { slug: true } } },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  if (booking.rescheduleCount >= config.maxCustomerReschedules) {
    throw new AppError(400, 'RESCHEDULE_LIMIT', 'Maximum customer reschedules reached');
  }

  const pending = await prisma.bookingRescheduleRequest.findFirst({
    where: { bookingId: booking.id, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
  });
  if (pending) throw new AppError(409, 'RESCHEDULE_PENDING', 'A reschedule request is already pending');

  const fromMerchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);

  const row = await prisma.$transaction(async (tx) => {
    const toSlot = await assertTargetSlotUsable({
      slotId: params.toSlotId,
      propertyId: booking.propertyId,
      exceptBookingId: booking.id,
      tx,
    });
    const toList = decimalToNumber(toSlot.price);
    const pricing = computeReschedulePricing({
      fromMerchantValue: fromMerchant,
      toListMerchantValue: toList,
      initiatedBy: 'customer',
    });
    return createRescheduleRequestRow({
      bookingId: booking.id,
      requestedBy: BookingRescheduleRequestedBy.customer,
      requestedByUserId: params.customerUserId,
      fromSlotId: booking.availabilitySlotId,
      toSlotId: params.toSlotId,
      fromMerchant,
      toList,
      pricing,
      exemptFromRescheduleLimit: false,
      exemptFromCancelAnchor: false,
      tx,
    });
  });

  await createAuditLog({
    actorUserId: params.customerUserId,
    action: 'booking.reschedule_requested',
    entityType: 'booking_reschedule_request',
    entityId: row.id,
    metadata: {
      bookingId: booking.id,
      priceDelta: decimalToNumber(row.priceDelta),
      customerPayableDelta: decimalToNumber(row.customerPayableDelta),
      pricingMode: row.pricingMode,
      toSlotId: params.toSlotId,
    },
    req: params.req,
  });

  await notifyRescheduleRequested({
    bookingId: booking.id,
    publicCode: booking.publicCode,
    requestedBy: 'customer',
    propertySlug: booking.property.slug,
  });

  return row;
}

export async function requestOwnerReschedule(params: {
  ownerUserId: string;
  role: UserRole;
  bookingId: string;
  toSlotId: string;
  req?: AuthenticatedRequest;
}) {
  const scope = await resolveOwnerScope(params.ownerUserId, params.role);
  const booking = await prisma.booking.findFirst({
    where: {
      id: params.bookingId,
      status: BookingStatus.confirmed,
      ...(scope.isAdmin ? {} : { property: { ownerId: scope.ownerProfileId! } }),
    },
    include: { slot: true, property: { select: { slug: true } }, user: { select: { id: true } } },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const pending = await prisma.bookingRescheduleRequest.findFirst({
    where: { bookingId: booking.id, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
  });
  if (pending) throw new AppError(409, 'RESCHEDULE_PENDING', 'A reschedule request is already pending');

  const fromMerchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);

  const row = await prisma.$transaction(async (tx) => {
    const toSlot = await assertTargetSlotUsable({
      slotId: params.toSlotId,
      propertyId: booking.propertyId,
      exceptBookingId: booking.id,
      tx,
    });
    const toList = decimalToNumber(toSlot.price);
    const pricing = computeReschedulePricing({
      fromMerchantValue: fromMerchant,
      toListMerchantValue: toList,
      initiatedBy: 'owner',
    });
    return createRescheduleRequestRow({
      bookingId: booking.id,
      requestedBy: BookingRescheduleRequestedBy.owner,
      requestedByUserId: params.ownerUserId,
      fromSlotId: booking.availabilitySlotId,
      toSlotId: params.toSlotId,
      fromMerchant,
      toList,
      pricing,
      exemptFromRescheduleLimit: true,
      exemptFromCancelAnchor: false,
      tx,
    });
  });

  await notifyRescheduleRequested({
    bookingId: booking.id,
    publicCode: booking.publicCode,
    requestedBy: 'owner',
    customerUserId: booking.userId,
  });

  return row;
}

/** Admin / FM path — creates a reschedule request with FM pricing modes. */
export async function createAdminForceMajeureReschedule(params: {
  adminUserId: string;
  bookingId: string;
  toSlotId: string;
  voluntaryUpgrade?: boolean;
  adminNote?: string | null;
  req?: AuthenticatedRequest;
}) {
  const booking = await prisma.booking.findFirst({
    where: { id: params.bookingId, status: BookingStatus.confirmed },
    include: { slot: true, property: { select: { slug: true } } },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const pending = await prisma.bookingRescheduleRequest.findFirst({
    where: { bookingId: booking.id, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
  });
  if (pending) throw new AppError(409, 'RESCHEDULE_PENDING', 'A reschedule request is already pending');

  const fromMerchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);

  const row = await prisma.$transaction(async (tx) => {
    const toSlot = await assertTargetSlotUsable({
      slotId: params.toSlotId,
      propertyId: booking.propertyId,
      exceptBookingId: booking.id,
      tx,
    });
    const toList = decimalToNumber(toSlot.price);
    const pricing = computeReschedulePricing({
      fromMerchantValue: fromMerchant,
      toListMerchantValue: toList,
      initiatedBy: 'admin',
      forceMajeure: true,
      voluntaryUpgrade: params.voluntaryUpgrade === true,
    });
    return createRescheduleRequestRow({
      bookingId: booking.id,
      requestedBy: BookingRescheduleRequestedBy.admin,
      requestedByUserId: params.adminUserId,
      fromSlotId: booking.availabilitySlotId,
      toSlotId: params.toSlotId,
      fromMerchant,
      toList,
      pricing,
      exemptFromRescheduleLimit: true,
      exemptFromCancelAnchor: true,
      adminNote: params.adminNote ?? null,
      tx,
    });
  });

  const payableDelta = decimalToNumber(row.customerPayableDelta);
  if (payableDelta > 0) {
    const pendingPay = await prisma.bookingRescheduleRequest.update({
      where: { id: row.id },
      data: {
        status: BookingRescheduleRequestStatus.accepted_pending_payment,
        respondedAt: new Date(),
        targetSlotHeldUntil: paymentHoldExpiresAt(),
      },
    });
    await notifyReschedulePaymentRequired({
      customerUserId: booking.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
      amount: payableDelta,
      currency: booking.currency,
      deadline: pendingPay.targetSlotHeldUntil,
    });
    return {
      request: pendingPay,
      finalized: false,
      paymentRequired: true,
      customerPayableDelta: payableDelta,
    };
  }

  const result = await finalizeReschedule(row.id, params.adminUserId, params.req, {
    allowFromPending: true,
  });
  await notifyRescheduleCompleted({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });
  return { ...result, request: row, finalized: true, paymentRequired: false };
}

/**
 * Phase 3C.4A.3 — Customer-elected FM equivalent/upgrade reschedule.
 * Reuses Phase 3A pricing + exemptions; does not consume normal reschedule allowance.
 */
export async function createCustomerForceMajeureReschedule(params: {
  customerUserId: string;
  bookingId: string;
  toSlotId: string;
  voluntaryUpgrade?: boolean;
  note?: string | null;
  req?: AuthenticatedRequest;
}) {
  const booking = await prisma.booking.findFirst({
    where: {
      id: params.bookingId,
      userId: params.customerUserId,
      status: BookingStatus.confirmed,
    },
    include: { slot: true, property: { select: { slug: true } } },
  });
  if (!booking) throw new AppError(404, 'NOT_FOUND', 'Booking not found');

  const pending = await prisma.bookingRescheduleRequest.findFirst({
    where: { bookingId: booking.id, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
  });
  if (pending) throw new AppError(409, 'RESCHEDULE_PENDING', 'A reschedule request is already pending');

  const fromMerchant = decimalToNumber(booking.merchantBookingValue ?? booking.totalAmount);

  const row = await prisma.$transaction(async (tx) => {
    const toSlot = await assertTargetSlotUsable({
      slotId: params.toSlotId,
      propertyId: booking.propertyId,
      exceptBookingId: booking.id,
      tx,
    });
    const toList = decimalToNumber(toSlot.price);
    const pricing = computeReschedulePricing({
      fromMerchantValue: fromMerchant,
      toListMerchantValue: toList,
      initiatedBy: 'customer',
      forceMajeure: true,
      voluntaryUpgrade: params.voluntaryUpgrade === true,
    });
    return createRescheduleRequestRow({
      bookingId: booking.id,
      requestedBy: BookingRescheduleRequestedBy.customer,
      requestedByUserId: params.customerUserId,
      fromSlotId: booking.availabilitySlotId,
      toSlotId: params.toSlotId,
      fromMerchant,
      toList,
      pricing,
      exemptFromRescheduleLimit: true,
      exemptFromCancelAnchor: true,
      adminNote: params.note ?? null,
      tx,
    });
  });

  const payableDelta = decimalToNumber(row.customerPayableDelta);
  if (payableDelta > 0) {
    const pendingPay = await prisma.bookingRescheduleRequest.update({
      where: { id: row.id },
      data: {
        status: BookingRescheduleRequestStatus.accepted_pending_payment,
        respondedAt: new Date(),
        targetSlotHeldUntil: paymentHoldExpiresAt(),
      },
    });
    await notifyReschedulePaymentRequired({
      customerUserId: booking.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
      amount: payableDelta,
      currency: booking.currency,
      deadline: pendingPay.targetSlotHeldUntil,
    });
    return {
      request: pendingPay,
      finalized: false,
      paymentRequired: true,
      customerPayableDelta: payableDelta,
    };
  }

  const result = await finalizeReschedule(row.id, params.customerUserId, params.req, {
    allowFromPending: true,
  });
  await notifyRescheduleCompleted({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });
  return { ...result, request: row, finalized: true, paymentRequired: false };
}

export async function respondToRescheduleRequest(params: {
  responderUserId: string;
  role: UserRole;
  requestId: string;
  accept: boolean;
  req?: AuthenticatedRequest;
}) {
  const request = await prisma.bookingRescheduleRequest.findUnique({
    where: { id: params.requestId },
    include: {
      booking: {
        include: {
          slot: true,
          payments: true,
          refundRequests: true,
          property: { select: { ownerId: true, owner: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!request || request.status !== BookingRescheduleRequestStatus.pending) {
    throw new AppError(404, 'NOT_FOUND', 'Pending reschedule request not found');
  }

  const booking = request.booking;
  const isCustomerRequest = request.requestedBy === BookingRescheduleRequestedBy.customer;
  const isOwnerRequest = request.requestedBy === BookingRescheduleRequestedBy.owner;
  const isAdminRequest = request.requestedBy === BookingRescheduleRequestedBy.admin;
  const scope = await resolveOwnerScope(params.responderUserId, params.role);

  if (isCustomerRequest) {
    if (!scope.isAdmin && scope.ownerProfileId !== booking.property.ownerId) {
      throw new AppError(403, 'FORBIDDEN', 'Owner must respond to customer reschedule');
    }
  } else if (isOwnerRequest || isAdminRequest) {
    if (booking.userId !== params.responderUserId && params.role !== 'admin') {
      throw new AppError(403, 'FORBIDDEN', 'Customer must respond to owner/admin reschedule');
    }
  }

  if (!params.accept) {
    const rejected = await prisma.$transaction(async (tx) => {
      const updated = await tx.bookingRescheduleRequest.update({
        where: { id: request.id },
        data: {
          status: BookingRescheduleRequestStatus.rejected,
          respondedAt: new Date(),
          targetSlotHeldUntil: null,
        },
      });
      await releaseHeldTargetSlotIfUnused(tx, request.toSlotId, request.id);
      return updated;
    });
    await notifyRescheduleResponded({
      bookingId: booking.id,
      publicCode: booking.publicCode,
      accepted: false,
      notifyUserId: request.requestedByUserId,
    });
    return { request: rejected, finalized: false };
  }

  const payableDelta = decimalToNumber(request.customerPayableDelta);

  // Owner request: NEVER require customer to pay more; finalize immediately.
  if (isOwnerRequest) {
    const result = await finalizeReschedule(request.id, params.responderUserId, params.req, {
      allowFromPending: true,
    });
    await notifyRescheduleResponded({
      bookingId: booking.id,
      publicCode: booking.publicCode,
      accepted: true,
      notifyUserId: request.requestedByUserId,
    });
    await notifyRescheduleCompleted({
      customerUserId: booking.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
    });
    return { ...result, finalized: true, paymentRequired: false };
  }

  // Customer / admin path with positive delta → payment required
  if (payableDelta > 0) {
    const holdUntil = paymentHoldExpiresAt();
    const pendingPay = await prisma.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: BookingRescheduleRequestStatus.accepted_pending_payment,
        respondedAt: new Date(),
        targetSlotHeldUntil: holdUntil,
      },
    });
    await notifyRescheduleResponded({
      bookingId: booking.id,
      publicCode: booking.publicCode,
      accepted: true,
      notifyUserId: request.requestedByUserId,
    });
    await notifyReschedulePaymentRequired({
      customerUserId: booking.userId,
      bookingId: booking.id,
      publicCode: booking.publicCode,
      amount: payableDelta,
      currency: booking.currency,
      deadline: holdUntil,
    });
    return {
      request: pendingPay,
      finalized: false,
      paymentRequired: true,
      priceDelta: payableDelta,
      customerPayableDelta: payableDelta,
      rescheduleRequestId: pendingPay.id,
      message: 'Customer must pay the price difference before reschedule is finalized',
    };
  }

  const result = await finalizeReschedule(request.id, params.responderUserId, params.req, {
    allowFromPending: true,
  });
  await notifyRescheduleResponded({
    bookingId: booking.id,
    publicCode: booking.publicCode,
    accepted: true,
    notifyUserId: request.requestedByUserId,
  });
  await notifyRescheduleCompleted({
    customerUserId: booking.userId,
    bookingId: booking.id,
    publicCode: booking.publicCode,
  });
  return { ...result, finalized: true, paymentRequired: false };
}

/**
 * Atomic slot swap + financial snapshot update.
 * Allow finalize from pending (delta<=0) OR accepted_pending_payment (after payment when delta>0).
 */
export async function finalizeReschedule(
  requestId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
  opts?: {
    allowFromPending?: boolean;
    /** When true, called after delta payment succeeded — skip unpaid guard. */
    afterSuccessfulDeltaPayment?: boolean;
  },
) {
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "BookingRescheduleRequest" WHERE id = ${requestId} FOR UPDATE`,
    );
    const request = await tx.bookingRescheduleRequest.findUnique({
      where: { id: requestId },
      include: { booking: { include: { slot: true, payments: true, refundRequests: true } } },
    });
    if (!request) {
      throw new AppError(404, 'NOT_FOUND', 'Reschedule request not available');
    }

    if (request.status === BookingRescheduleRequestStatus.accepted) {
      return {
        bookingId: request.bookingId,
        priceDelta: decimalToNumber(request.priceDelta),
        alreadyFinalized: true as const,
      };
    }

    const payableDelta = decimalToNumber(request.customerPayableDelta);

    if (
      request.status !== BookingRescheduleRequestStatus.pending &&
      request.status !== BookingRescheduleRequestStatus.accepted_pending_payment
    ) {
      throw new AppError(404, 'NOT_FOUND', 'Reschedule request not available');
    }

    if (request.status === BookingRescheduleRequestStatus.pending) {
      if (payableDelta > 0 && !opts?.afterSuccessfulDeltaPayment) {
        throw new AppError(
          409,
          'PAYMENT_REQUIRED',
          'Customer must pay the price difference before reschedule is finalized',
        );
      }
      if (!opts?.allowFromPending && !opts?.afterSuccessfulDeltaPayment) {
        throw new AppError(404, 'NOT_FOUND', 'Reschedule request not available');
      }
    }

    if (
      request.status === BookingRescheduleRequestStatus.accepted_pending_payment &&
      payableDelta > 0 &&
      !opts?.afterSuccessfulDeltaPayment
    ) {
      const succeededDelta = await tx.payment.findFirst({
        where: {
          OR: [
            { id: request.deltaPaymentId ?? '__none__' },
            { rescheduleRequestId: request.id },
          ],
          purpose: PaymentPurpose.reschedule_difference,
          status: PaymentStatus.succeeded,
        },
      });
      if (!succeededDelta) {
        throw new AppError(409, 'PAYMENT_REQUIRED', 'Reschedule difference payment required');
      }
    }

    const booking = request.booking;
    if (booking.status !== BookingStatus.confirmed) {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Booking is not confirmed');
    }

    const toSlot = await assertTargetSlotUsable({
      slotId: request.toSlotId,
      propertyId: booking.propertyId,
      exceptBookingId: booking.id,
      allowHeldByRequestId: request.id,
      tx,
    });

    const fromSlotId = booking.availabilitySlotId;
    const contracted = decimalToNumber(request.customerContractedValue);
    const commissionBasis = decimalToNumber(request.commissionBasisValue);
    const delta = decimalToNumber(request.priceDelta);

    const originalStart =
      booking.originalBookingStartAt ??
      resolveBookingPeriodStart(booking.bookingStartAt, booking.slot.date);
    const isCustomerRequest = request.requestedBy === BookingRescheduleRequestedBy.customer;
    const incrementRescheduleCount = isCustomerRequest && !request.exemptFromRescheduleLimit;
    const applyCancelAnchor = isCustomerRequest && !request.exemptFromCancelAnchor;

    const snap = buildBookingFinancialSnapshot({
      bookingTotalAmount: commissionBasis,
      propertyDepositPercent: decimalToNumber(booking.depositPercent),
      platformCommissionPercent: decimalToNumber(booking.platformCommissionPercent),
      fullPayment: booking.paymentState === 'fully_paid',
      slotDate: toSlot.date,
      bookingStartAt: toSlot.startAt,
    });

    const contractedSnap = buildBookingFinancialSnapshot({
      bookingTotalAmount: contracted,
      propertyDepositPercent: decimalToNumber(booking.depositPercent),
      platformCommissionPercent: decimalToNumber(booking.platformCommissionPercent),
      fullPayment: booking.paymentState === 'fully_paid',
      slotDate: toSlot.date,
      bookingStartAt: toSlot.startAt,
    });

    await tx.availabilitySlot.update({
      where: { id: request.toSlotId },
      data: { status: AvailabilitySlotStatus.booked },
    });

    // Move Booking to target slot BEFORE releasing fromSlotId.
    // Partial unique enforces exclusivity; on conflict TX rolls back and
    // original availabilitySlotId remains (no half-reschedule).
    const paid = succeededInstallmentFils(booking.payments);
    const newPayableFils = jodToFils(contractedSnap.customerPayableTotal);
    let nextPaymentState = booking.paymentState;
    if (paid.total >= newPayableFils && booking.paymentState !== 'refunded') {
      nextPaymentState = 'fully_paid';
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        availabilitySlotId: request.toSlotId,
        bookingStartAt: toSlot.startAt,
        bookingEndAt: toSlot.endAt,
        usesLegacyTiming: !toSlot.startAt,
        originalBookingStartAt: applyCancelAnchor ? originalStart : booking.originalBookingStartAt,
        latestRescheduledAt: new Date(),
        rescheduleCount: incrementRescheduleCount ? { increment: 1 } : booking.rescheduleCount,
        merchantBookingValue: contracted,
        totalAmount: contracted,
        ownerNetPayoutAmount: snap.ownerNetPayoutAmount,
        platformCommissionAmount: snap.platformCommissionAmount,
        customerPayableTotal: contractedSnap.customerPayableTotal,
        depositAmount: contractedSnap.depositAmount,
        remainingAmount: Math.max(
          0,
          roundPolicyMoney(contractedSnap.customerPayableTotal - filsToJod(paid.total)),
        ),
        balanceDueAt: snap.balanceDueAt,
        paymentState: nextPaymentState,
        fullyPaidAt:
          nextPaymentState === 'fully_paid' ? (booking.fullyPaidAt ?? new Date()) : booking.fullyPaidAt,
      },
    });

    await tx.availabilitySlot.updateMany({
      where: {
        id: fromSlotId,
        status: { in: [AvailabilitySlotStatus.booked, AvailabilitySlotStatus.held] },
      },
      data: { status: AvailabilitySlotStatus.available },
    });

    await tx.bookingRescheduleRequest.update({
      where: { id: request.id },
      data: {
        status: BookingRescheduleRequestStatus.accepted,
        respondedAt: request.respondedAt ?? new Date(),
        completedAt: new Date(),
        targetSlotHeldUntil: null,
      },
    });

    return {
      bookingId: booking.id,
      priceDelta: delta,
      customerPayableDelta: payableDelta,
      customerUserId: booking.userId,
      publicCode: booking.publicCode,
      currency: booking.currency,
      alreadyFinalized: false as const,
      payments: booking.payments,
      refundRequests: booking.refundRequests,
    };
  }, { timeout: 20_000, maxWait: 10_000 });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isBookingSlotUniqueViolation(err)) {
      await createAuditLog({
        actorUserId,
        action: 'booking.slot_conflict',
        entityType: 'booking_reschedule_request',
        entityId: requestId,
        metadata: { context: 'reschedule.finalize', reason: 'unique_violation' },
        req,
      });
      throw bookingSlotUnavailableError();
    }
    throw err;
  }

  if (result.alreadyFinalized) {
    return { bookingId: result.bookingId, priceDelta: result.priceDelta, alreadyFinalized: true };
  }

  if (result.customerPayableDelta < 0) {
    const funds = refundableCapturedFils(result.payments, result.refundRequests);
    const refundDue = Math.min(Math.abs(result.customerPayableDelta), filsToJod(funds.refundable));
    if (refundDue > 0) {
      await ensureSystemOwnerFaultRefund({
        bookingId: result.bookingId,
        customerId: result.customerUserId,
        refundAmount: refundDue,
        reasonLabel: 'Reschedule price difference refund',
        req,
      });
      await notifyRescheduleRefundDifference({
        customerUserId: result.customerUserId,
        bookingId: result.bookingId,
        publicCode: result.publicCode,
        amount: refundDue,
        currency: result.currency,
      });
    }
  }

  await createAuditLog({
    actorUserId,
    action: 'booking.reschedule_finalized',
    entityType: 'booking',
    entityId: result.bookingId,
    metadata: {
      requestId,
      priceDelta: result.priceDelta,
      customerPayableDelta: result.customerPayableDelta,
    },
    req,
  });

  return {
    bookingId: result.bookingId,
    priceDelta: result.priceDelta,
    customerPayableDelta: result.customerPayableDelta,
    alreadyFinalized: false,
  };
}

export async function expireRescheduleRequestsForBooking(
  bookingId: string,
): Promise<{ expired: number }> {
  const now = new Date();
  const due = await prisma.bookingRescheduleRequest.findMany({
    where: {
      bookingId,
      status: { in: ACTIVE_RESCHEDULE_STATUSES },
      OR: [{ expiresAt: { lte: now } }, { targetSlotHeldUntil: { lte: now } }],
    },
    include: {
      booking: { select: { id: true, publicCode: true, userId: true, currency: true } },
    },
    take: 20,
  });

  let expired = 0;
  for (const request of due) {
    try {
      let didExpire = false;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BookingRescheduleRequest" WHERE id = ${request.id} FOR UPDATE`,
        );
        const fresh = await tx.bookingRescheduleRequest.findUnique({ where: { id: request.id } });
        if (!fresh || !ACTIVE_RESCHEDULE_STATUSES.includes(fresh.status)) return;

        const pastExpiry =
          (fresh.expiresAt != null && fresh.expiresAt <= now) ||
          (fresh.targetSlotHeldUntil != null && fresh.targetSlotHeldUntil <= now);
        if (!pastExpiry) return;

        await tx.bookingRescheduleRequest.update({
          where: { id: fresh.id },
          data: {
            status: BookingRescheduleRequestStatus.expired,
            targetSlotHeldUntil: null,
          },
        });

        await tx.payment.updateMany({
          where: {
            rescheduleRequestId: fresh.id,
            purpose: PaymentPurpose.reschedule_difference,
            status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
          },
          data: { status: PaymentStatus.expired, failedAt: now },
        });

        await releaseHeldTargetSlotIfUnused(tx, fresh.toSlotId, fresh.id);
        didExpire = true;
        expired += 1;
      });

      if (didExpire) {
        await notifyRescheduleExpired({
          customerUserId: request.booking.userId,
          bookingId: request.booking.id,
          publicCode: request.booking.publicCode,
        });
      }
    } catch (err) {
      console.error('[reschedule] expire-for-booking failed', request.id, err);
    }
  }

  return { expired };
}

export async function expireRescheduleRequests(): Promise<{ processed: number; expired: number }> {
  const now = new Date();
  const due = await prisma.bookingRescheduleRequest.findMany({
    where: {
      status: { in: ACTIVE_RESCHEDULE_STATUSES },
      OR: [{ expiresAt: { lte: now } }, { targetSlotHeldUntil: { lte: now } }],
    },
    include: {
      booking: { select: { id: true, publicCode: true, userId: true, currency: true } },
    },
    take: 100,
  });

  let expired = 0;
  for (const request of due) {
    try {
      let didExpire = false;
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM "BookingRescheduleRequest" WHERE id = ${request.id} FOR UPDATE`,
        );
        const fresh = await tx.bookingRescheduleRequest.findUnique({ where: { id: request.id } });
        if (!fresh || !ACTIVE_RESCHEDULE_STATUSES.includes(fresh.status)) return;

        const pastExpiry =
          (fresh.expiresAt != null && fresh.expiresAt <= now) ||
          (fresh.targetSlotHeldUntil != null && fresh.targetSlotHeldUntil <= now);
        if (!pastExpiry) return;

        await tx.bookingRescheduleRequest.update({
          where: { id: fresh.id },
          data: {
            status: BookingRescheduleRequestStatus.expired,
            targetSlotHeldUntil: null,
          },
        });

        await tx.payment.updateMany({
          where: {
            rescheduleRequestId: fresh.id,
            purpose: PaymentPurpose.reschedule_difference,
            status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
          },
          data: { status: PaymentStatus.expired, failedAt: now },
        });

        await releaseHeldTargetSlotIfUnused(tx, fresh.toSlotId, fresh.id);
        didExpire = true;
        expired += 1;
      });

      if (didExpire) {
        await notifyRescheduleExpired({
          customerUserId: request.booking.userId,
          bookingId: request.booking.id,
          publicCode: request.booking.publicCode,
        });
      }
    } catch (err) {
      console.error('[reschedule] expire failed', request.id, err);
    }
  }

  return { processed: due.length, expired };
}

export async function listRescheduleRequestsForBooking(bookingId: string) {
  return prisma.bookingRescheduleRequest.findMany({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getActivePendingRescheduleForBooking(
  bookingId: string,
): Promise<PendingRescheduleSummary | null> {
  const request = await prisma.bookingRescheduleRequest.findFirst({
    where: { bookingId, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
  if (!request) return null;
  return toPendingRescheduleSummary(request);
}

export async function mapPendingRescheduleByBookingIds(
  bookingIds: string[],
): Promise<Map<string, PendingRescheduleSummary>> {
  const map = new Map<string, PendingRescheduleSummary>();
  if (bookingIds.length === 0) return map;
  const rows = await prisma.bookingRescheduleRequest.findMany({
    where: { bookingId: { in: bookingIds }, status: { in: ACTIVE_RESCHEDULE_STATUSES } },
    orderBy: { createdAt: 'desc' },
  });
  const seen = new Set<string>();
  for (const row of rows) {
    if (seen.has(row.bookingId)) continue;
    seen.add(row.bookingId);
    map.set(row.bookingId, await toPendingRescheduleSummary(row));
  }
  return map;
}

export type { ReschedulePricingMode };
