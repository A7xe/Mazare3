import {
  prisma,
  AvailabilitySlotStatus,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  type PaymentMethod,
} from '@mazare3/db';
import type { CreatePaymentIntentInput, PaymentSummary } from '@mazare3/shared';
import { PAYMENT_HOLD_MINUTES } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { isDevPaymentSimulateAllowed, SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { toPaymentSummary } from '../mappers/payment.mapper.js';
import { createAuditLog } from './audit.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { loadPaymentConfig, assertProviderCanCreateIntent } from '../config/payment-config.js';
import {
  calculateBookingFinancials,
  computePayoutAvailableAt,
  getPublicPolicySummary,
} from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import {
  getPaymentProviderAdapter,
  resolveProviderForMethod,
  throwPaymentProviderError,
} from './payment/payment-provider.registry.js';

function financialsToPaymentData(fin: ReturnType<typeof calculateBookingFinancials>) {
  return {
    amount: fin.customerPayableAmount,
    bookingTotalAmount: fin.bookingTotalAmount,
    customerPayableAmount: fin.customerPayableAmount,
    platformCommissionAmount: fin.platformCommissionAmount,
    customerServiceFeeAmount: fin.customerServiceFeeAmount,
    ownerGrossAmount: fin.ownerGrossAmount,
    ownerNetPayoutAmount: fin.ownerNetPayoutAmount,
    currency: fin.currency,
  };
}

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.initiated,
  PaymentStatus.pending,
];

function paymentHoldExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + PAYMENT_HOLD_MINUTES);
  return d;
}

async function appendPaymentEvent(
  paymentId: string,
  action: string,
  status?: PaymentStatus,
  metadata?: Record<string, unknown>,
) {
  await prisma.paymentEvent.create({
    data: {
      paymentId,
      action,
      status: status ?? null,
      metadata: metadata ? (metadata as object) : undefined,
    },
  });
}

async function releaseSlot(slotId: string) {
  await prisma.availabilitySlot.update({
    where: { id: slotId },
    data: { status: AvailabilitySlotStatus.available },
  });
}

export async function expirePaymentIfNeeded(paymentId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { slot: true } } },
  });
  if (!payment) return false;
  if (payment.status === PaymentStatus.expired) return false;
  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) return false;
  if (!payment.expiresAt || payment.expiresAt > new Date()) return false;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.expired },
    });
    if (payment.booking.status === BookingStatus.pending_payment) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { status: BookingStatus.expired },
      });
      await tx.availabilitySlot.update({
        where: { id: payment.booking.availabilitySlotId },
        data: { status: AvailabilitySlotStatus.available },
      });
    }
  });

  await appendPaymentEvent(paymentId, 'payment.expired', PaymentStatus.expired);
  await createAuditLog({
    action: 'payment.expired',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { bookingId: payment.bookingId },
  });
  await createAuditLog({
    action: 'booking.expired',
    entityType: 'booking',
    entityId: payment.bookingId,
    metadata: { reason: 'payment_expired' },
  });
  return true;
}

/** Batch-expire pending payments past expiresAt (idempotent). */
export async function expireStalePayments(): Promise<{ processed: number; expired: number }> {
  const candidates = await prisma.payment.findMany({
    where: {
      status: { in: ACTIVE_PAYMENT_STATUSES },
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
  });

  let expired = 0;
  for (const { id } of candidates) {
    const didExpire = await expirePaymentIfNeeded(id);
    if (didExpire) expired++;
  }
  return { processed: candidates.length, expired };
}

/** QA-only: set expiresAt in the past so expire-stale can run. */
export async function backdatePaymentExpiryForQa(paymentId: string): Promise<void> {
  const past = new Date();
  past.setMinutes(past.getMinutes() - 5);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { expiresAt: past },
  });
}

export async function createPaymentIntent(
  userId: string,
  input: CreatePaymentIntentInput,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const booking = await prisma.booking.findFirst({
    where: { id: input.bookingId, userId },
    include: { payments: { orderBy: { createdAt: 'desc' } } },
  });

  if (!booking) {
    throw new AppError(404, 'NOT_FOUND', 'Booking not found');
  }

  if (
    booking.status === BookingStatus.cancelled ||
    booking.status === BookingStatus.expired
  ) {
    throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Booking cannot be paid');
  }

  if (booking.status === BookingStatus.confirmed) {
    const succeeded = booking.payments.find((p) => p.status === PaymentStatus.succeeded);
    if (succeeded) {
      throw new AppError(400, 'ALREADY_PAID', 'Booking is already paid');
    }
  }

  if (booking.status !== BookingStatus.pending_payment) {
    throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Booking is not awaiting payment');
  }

  const activePayment = booking.payments.find((p) =>
    ACTIVE_PAYMENT_STATUSES.includes(p.status),
  );
  if (activePayment) {
    await expirePaymentIfNeeded(activePayment.id);
    const refreshed = await prisma.payment.findUnique({ where: { id: activePayment.id } });
    if (refreshed && ACTIVE_PAYMENT_STATUSES.includes(refreshed.status)) {
      return toPaymentSummary(refreshed);
    }
  }

  if (input.idempotencyKey) {
    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && existing.bookingId === booking.id) {
      return toPaymentSummary(existing);
    }
  }

  const providerName = resolveProviderForMethod(input.method as PaymentMethod);
  try {
    assertProviderCanCreateIntent(providerName);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  let adapter;
  try {
    adapter = getPaymentProviderAdapter(providerName);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  const bookingTotal = Number(booking.totalAmount);
  const fin = calculateBookingFinancials(bookingTotal);

  const payment = await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId,
      ...financialsToPaymentData(fin),
      method: input.method as PaymentMethod,
      provider: providerName,
      status: PaymentStatus.initiated,
      payoutStatus: PayoutStatus.not_ready,
      idempotencyKey: input.idempotencyKey ?? null,
      expiresAt: paymentHoldExpiry(),
    },
  });

  let intent;
  try {
    intent = await adapter.createIntent({
      paymentId: payment.id,
      bookingId: booking.id,
      amount: fin.customerPayableAmount,
      currency: fin.currency,
      method: input.method as PaymentMethod,
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.failed, failedAt: new Date() },
    });
    throwPaymentProviderError(err);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.pending,
      provider: intent.provider,
      providerRef: intent.providerRef,
    },
  });

  await appendPaymentEvent(payment.id, 'payment.intent_created', PaymentStatus.pending, {
    method: input.method,
    provider: intent.provider,
    customerPayableAmount: fin.customerPayableAmount,
    platformCommissionAmount: fin.platformCommissionAmount,
    ownerNetPayoutAmount: fin.ownerNetPayoutAmount,
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'payment.intent_created',
    entityType: 'payment',
    entityId: payment.id,
    metadata: {
      bookingId: booking.id,
      method: input.method,
      bookingTotalAmount: fin.bookingTotalAmount,
      customerPayableAmount: fin.customerPayableAmount,
      platformCommissionAmount: fin.platformCommissionAmount,
      ownerNetPayoutAmount: fin.ownerNetPayoutAmount,
    },
    req,
  });

  return toPaymentSummary(updated);
}

export async function getPaymentForUser(
  userId: string,
  paymentId: string,
): Promise<PaymentSummary | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) return null;
  await expirePaymentIfNeeded(payment.id);
  const refreshed = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!refreshed) return null;
  if (refreshed.status === PaymentStatus.succeeded) {
    await syncPayoutStatusForPayment(refreshed.id);
    const synced = await prisma.payment.findUnique({ where: { id: paymentId } });
    return synced ? toPaymentSummary(synced) : null;
  }
  return toPaymentSummary(refreshed);
}

async function finalizePaymentSuccess(
  paymentId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { include: { slot: { select: { date: true } } } } },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }

  if (payment.status === PaymentStatus.succeeded) {
    return toPaymentSummary(payment);
  }

  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Payment cannot be completed');
  }

  const bookingTotal = Number(payment.booking.totalAmount);
  const fin = calculateBookingFinancials(bookingTotal);
  const payoutAvailableAt = computePayoutAvailableAt(payment.booking.slot.date);

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.succeeded,
        succeededAt: new Date(),
        ...financialsToPaymentData(fin),
        payoutStatus: PayoutStatus.pending,
        payoutAvailableAt,
      },
    });
    await tx.booking.update({
      where: { id: payment.bookingId },
      data: { status: BookingStatus.confirmed },
    });
  });

  await appendPaymentEvent(paymentId, 'payment.succeeded', PaymentStatus.succeeded, {
    platformCommissionAmount: fin.platformCommissionAmount,
    ownerNetPayoutAmount: fin.ownerNetPayoutAmount,
    payoutAvailableAt: payoutAvailableAt.toISOString(),
  });
  await createAuditLog({
    actorUserId,
    action: 'payment.succeeded',
    entityType: 'payment',
    entityId: paymentId,
    metadata: {
      bookingId: payment.bookingId,
      customerPayableAmount: fin.customerPayableAmount,
      platformCommissionAmount: fin.platformCommissionAmount,
      ownerNetPayoutAmount: fin.ownerNetPayoutAmount,
      payoutAvailableAt: payoutAvailableAt.toISOString(),
    },
    req,
  });
  await createAuditLog({
    actorUserId,
    action: 'booking.confirmed_after_payment',
    entityType: 'booking',
    entityId: payment.bookingId,
    metadata: { paymentId },
    req,
  });

  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  return toPaymentSummary(updated);
}

async function finalizePaymentFailure(
  paymentId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }

  if (payment.status === PaymentStatus.failed) {
    return toPaymentSummary(payment);
  }

  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) {
    throw new AppError(400, 'INVALID_STATUS', 'Payment cannot be failed');
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.failed,
        failedAt: new Date(),
      },
    });
    if (payment.booking.status === BookingStatus.pending_payment) {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: BookingStatus.cancelled,
          cancelledAt: new Date(),
        },
      });
      await tx.availabilitySlot.update({
        where: { id: payment.booking.availabilitySlotId },
        data: { status: AvailabilitySlotStatus.available },
      });
    }
  });

  await appendPaymentEvent(paymentId, 'payment.failed', PaymentStatus.failed);
  await createAuditLog({
    actorUserId,
    action: 'payment.failed',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { bookingId: payment.bookingId },
    req,
  });

  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  return toPaymentSummary(updated);
}

export async function simulatePaymentSuccess(
  userId: string,
  paymentId: string,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  if (!isDevPaymentSimulateAllowed()) {
    throw new AppError(403, 'FORBIDDEN', 'Payment simulation is not available');
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }

  return finalizePaymentSuccess(paymentId, userId, req);
}

export async function simulatePaymentFailure(
  userId: string,
  paymentId: string,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  if (!isDevPaymentSimulateAllowed()) {
    throw new AppError(403, 'FORBIDDEN', 'Payment simulation is not available');
  }

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }

  return finalizePaymentFailure(paymentId, userId, req);
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

export async function listAdminPayments(): Promise<
  import('@mazare3/shared').AdminPaymentRow[]
> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: {
        select: { publicCode: true },
      },
      user: { select: { name: true, email: true } },
    },
  });

  return rows.map((p) => ({
    id: p.id,
    bookingId: p.bookingId,
    publicCode: p.booking.publicCode,
    customerName: p.user.name,
    customerEmail: p.user.email,
    method: p.method,
    provider: p.provider,
    amount: decimalToNumber(p.customerPayableAmount),
    currency: p.currency,
    status: p.status,
    bookingTotalAmount: decimalToNumber(p.bookingTotalAmount),
    customerPayableAmount: decimalToNumber(p.customerPayableAmount),
    platformCommissionAmount: decimalToNumber(p.platformCommissionAmount),
    ownerNetPayoutAmount: decimalToNumber(p.ownerNetPayoutAmount),
    payoutStatus: p.payoutStatus,
    payoutAvailableAt: p.payoutAvailableAt?.toISOString() ?? null,
    refundStatus: p.refundStatus,
    cancellationRefundAmount:
      p.cancellationRefundAmount != null
        ? decimalToNumber(p.cancellationRefundAmount)
        : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }));
}

export function getPublicPaymentConfig(): import('@mazare3/shared').PaymentPublicConfig {
  const c = loadPaymentConfig();
  return {
    provider: c.provider,
    currency: c.currency,
    simulateEnabled: c.simulateEnabled,
    livePaymentsEnabled: c.livePaymentsEnabled,
    policy: getPublicPolicySummary(),
  };
}

export { SLOT_HOLDING_STATUSES };
