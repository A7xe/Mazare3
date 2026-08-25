import {
  prisma,
  AvailabilitySlotStatus,
  BookingPaymentState,
  BookingStatus,
  PaymentPurpose,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  type PaymentMethod,
  type PaymentProvider,
} from '@mazare3/db';
import type { CreatePaymentIntentInput, PaymentSummary } from '@mazare3/shared';
import {
  PAYMENT_HOLD_MINUTES,
  assertPaymentStateTransition,
  jodToFils,
  paymentStateAfterCapture,
} from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { isDevPaymentSimulateAllowed, SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
import { derivePayFlags, succeededInstallmentFils } from '../lib/booking-ledger.js';
import { toPaymentSummary } from '../mappers/payment.mapper.js';
import { createAuditLog } from './audit.service.js';
import {
  notifyBookingConfirmed,
  notifyDepositPaid,
  notifyPaymentSucceeded,
} from './notification.service.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { loadPaymentConfig, assertProviderCanCreateIntent } from '../config/payment-config.js';
import { loadPaytabsConfig } from '../config/paytabs-config.js';
import {
  computePayoutAvailableAt,
  getPublicPolicySummary,
} from './payment-policy.service.js';
import { syncPayoutStatusForPayment } from './payment-payout.service.js';
import {
  expireStaleBookingHolds,
  expireUnpaidBookingHoldIfNeeded,
  markStaleBalanceOverdue,
  refreshBookingPaymentLifecycle,
} from './booking-hold.service.js';
import { expireStaleOwnerApprovals } from './owner-approval-expiry.service.js';
import { redeemCouponInTx } from './coupon.service.js';
import { redeemPlatformCouponInTx } from './platform-coupon.service.js';
import {
  getPaymentGateway,
  resolveProviderForMethod,
  throwPaymentProviderError,
} from './payment/payment-provider.registry.js';
import {
  providerIdempotencyKey,
  type NormalizedGatewayEvent,
} from './payment/payment-provider.interface.js';

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  return typeof value === 'number' ? value : value.toNumber();
}

const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = [
  PaymentStatus.initiated,
  PaymentStatus.pending,
];

/** Hold-clock expiry must not block a verified capture of an unpaid payment. */
const CAPTURABLE_PAYMENT_STATUSES: PaymentStatus[] = [
  ...ACTIVE_PAYMENT_STATUSES,
  PaymentStatus.expired,
];

function paymentHoldExpiry(cap?: Date | null): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + PAYMENT_HOLD_MINUTES);
  if (cap && cap < d) return cap;
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

export async function expirePaymentIfNeeded(paymentId: string): Promise<boolean> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment) return false;
  if (payment.status === PaymentStatus.expired) return false;
  if (!ACTIVE_PAYMENT_STATUSES.includes(payment.status)) return false;
  if (!payment.expiresAt || payment.expiresAt > new Date()) return false;

  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: PaymentStatus.expired },
  });

  if (payment.booking.status === BookingStatus.pending_payment) {
    if (
      payment.booking.paymentState === BookingPaymentState.deposit_pending ||
      payment.booking.paymentState === BookingPaymentState.unpaid
    ) {
      await prisma.booking.update({
        where: { id: payment.bookingId },
        data: { paymentState: BookingPaymentState.unpaid },
      });
    }
    await expireUnpaidBookingHoldIfNeeded(payment.bookingId);
  } else if (
    payment.purpose === PaymentPurpose.balance &&
    payment.booking.paymentState === BookingPaymentState.balance_pending
  ) {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentState:
          payment.booking.balanceDueAt && payment.booking.balanceDueAt <= new Date()
            ? BookingPaymentState.balance_overdue
            : BookingPaymentState.deposit_paid,
      },
    });
  }

  await appendPaymentEvent(paymentId, 'payment.expired', PaymentStatus.expired);
  await createAuditLog({
    action: 'payment.expired',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { bookingId: payment.bookingId, purpose: payment.purpose },
  });
  return true;
}

export async function expireStalePaymentIntents(): Promise<{ processed: number; expired: number }> {
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

export async function expireStaleUnpaidBookingHolds(): Promise<{
  paymentsProcessed: number;
  paymentsExpired: number;
  holdsProcessed: number;
  holdsExpired: number;
}> {
  const payments = await expireStalePaymentIntents();
  const holds = await expireStaleBookingHolds();
  return {
    paymentsProcessed: payments.processed,
    paymentsExpired: payments.expired,
    holdsProcessed: holds.processed,
    holdsExpired: holds.expired,
  };
}

export async function expireStalePayments(): Promise<{
  processed: number;
  expired: number;
  holdsExpired: number;
  overdueMarked: number;
  ownerApprovalsExpired: number;
}> {
  const payments = await expireStalePaymentIntents();
  const holds = await expireStaleBookingHolds();
  const overdue = await markStaleBalanceOverdue();
  const approvals = await expireStaleOwnerApprovals();
  return {
    processed: payments.processed,
    expired: payments.expired,
    holdsExpired: holds.expired,
    overdueMarked: overdue.marked,
    ownerApprovalsExpired: approvals.expired,
  };
}

export async function backdatePaymentExpiryForQa(paymentId: string): Promise<void> {
  const past = new Date();
  past.setMinutes(past.getMinutes() - 5);
  await prisma.payment.update({
    where: { id: paymentId },
    data: { expiresAt: past },
  });
}

export async function backdateBookingHoldForQa(bookingId: string): Promise<void> {
  const past = new Date();
  past.setMinutes(past.getMinutes() - 5);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { holdExpiresAt: past },
  });
}

export async function backdateBalanceDueForQa(bookingId: string): Promise<void> {
  const past = new Date();
  past.setHours(past.getHours() - 1);
  await prisma.booking.update({
    where: { id: bookingId },
    data: { balanceDueAt: past },
  });
}

function installmentForPurpose(
  purpose: PaymentPurpose,
  booking: {
    depositAmount: { toNumber(): number } | number;
    remainingAmount: { toNumber(): number } | number;
    customerServiceFeeAmount: { toNumber(): number } | number;
    customerPayableTotal: { toNumber(): number } | number;
  },
): number {
  if (purpose === PaymentPurpose.full) {
    return decimalToNumber(booking.customerPayableTotal);
  }
  if (purpose === PaymentPurpose.deposit) {
    return decimalToNumber(booking.depositAmount) + decimalToNumber(booking.customerServiceFeeAmount);
  }
  return decimalToNumber(booking.remainingAmount);
}

export async function createPaymentIntent(
  userId: string,
  input: CreatePaymentIntentInput,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  await refreshBookingPaymentLifecycle(input.bookingId);

  const prepared = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "Booking" WHERE id = ${input.bookingId} FOR UPDATE`);

    const booking = await tx.booking.findFirst({
      where: { id: input.bookingId, userId },
      include: { payments: true, slot: { select: { date: true } } },
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

    if (booking.status === BookingStatus.pending_owner_approval) {
      throw new AppError(
        409,
        'OWNER_APPROVAL_REQUIRED',
        'Deposit payment is available after the owner accepts this request',
      );
    }

    if (
      (booking.status === BookingStatus.pending_payment ||
        booking.paymentCollectionMode !== 'full') &&
      booking.holdExpiresAt &&
      booking.holdExpiresAt <= new Date() &&
      booking.status === BookingStatus.pending_payment
    ) {
      throw new AppError(400, 'HOLD_EXPIRED', 'Payment hold has expired');
    }

    const flags = derivePayFlags({
      status: booking.status,
      collectionMode: booking.paymentCollectionMode,
      paymentState: booking.paymentState,
      payments: booking.payments,
      customerPayableTotal: booking.customerPayableTotal,
      remainingSnapshotFils: 0,
    });

    if (flags.isFullyPaid) {
      throw new AppError(400, 'ALREADY_PAID', 'Booking is already paid in full');
    }

    let purpose: PaymentPurpose;
    if (input.purpose) {
      purpose = input.purpose as PaymentPurpose;
    } else if (flags.duePurpose) {
      purpose = flags.duePurpose as PaymentPurpose;
    } else {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Booking is not awaiting payment');
    }

    if (booking.paymentCollectionMode === 'full' && purpose !== PaymentPurpose.full) {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Full payment is not available for this booking');
    }
    if (booking.paymentCollectionMode !== 'full' && purpose === PaymentPurpose.full) {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Full payment is not available for this booking');
    }

    if (purpose === PaymentPurpose.deposit && !flags.canPayDeposit) {
      throw new AppError(400, 'DEPOSIT_ALREADY_PAID', 'Deposit is already paid or not due');
    }
    if (purpose === PaymentPurpose.balance && !flags.canPayBalance) {
      if (flags.canPayDeposit) {
        throw new AppError(400, 'BALANCE_BEFORE_DEPOSIT', 'Pay the deposit before the remaining balance');
      }
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Remaining balance is not payable');
    }
    if (purpose === PaymentPurpose.full && !flags.canPayFull) {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Full payment is not available for this booking');
    }

    const installment = installmentForPurpose(purpose, booking);
    const paid = succeededInstallmentFils(booking.payments);
    const payableFils = jodToFils(decimalToNumber(booking.customerPayableTotal));
    if (paid.total + jodToFils(installment) > payableFils) {
      throw new AppError(400, 'PAYMENT_EXCEEDS_BALANCE', 'Payment would exceed the amount due');
    }

    const succeededSamePurpose = booking.payments.find(
      (p) => p.status === PaymentStatus.succeeded && p.purpose === purpose,
    );
    if (succeededSamePurpose) {
      throw new AppError(400, 'ALREADY_PAID', 'This installment is already paid');
    }

    const activePayment = booking.payments.find(
      (p) => ACTIVE_PAYMENT_STATUSES.includes(p.status) && p.purpose === purpose,
    );
    if (activePayment) {
      if (!activePayment.expiresAt || activePayment.expiresAt > new Date()) {
        return { reusePaymentId: activePayment.id };
      }
      await tx.payment.update({
        where: { id: activePayment.id },
        data: { status: PaymentStatus.expired },
      });
    }

    if (input.idempotencyKey) {
      const existing = await tx.payment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing && existing.bookingId === booking.id) {
        return { reusePaymentId: existing.id };
      }
    }

    const providerName = resolveProviderForMethod(input.method as PaymentMethod);
    try {
      assertProviderCanCreateIntent(providerName);
    } catch (err) {
      throwPaymentProviderError(err);
    }

    const serviceFee =
      purpose === PaymentPurpose.deposit || purpose === PaymentPurpose.full
        ? decimalToNumber(booking.customerServiceFeeAmount)
        : 0;

    const expiresAt =
      purpose === PaymentPurpose.deposit || purpose === PaymentPurpose.full
        ? paymentHoldExpiry(booking.holdExpiresAt)
        : paymentHoldExpiry();

    let payment;
    try {
      payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          userId,
          amount: installment,
          bookingTotalAmount: decimalToNumber(booking.totalAmount),
          customerPayableAmount: installment,
          platformCommissionAmount: decimalToNumber(booking.platformCommissionAmount),
          customerServiceFeeAmount: serviceFee,
          ownerGrossAmount: decimalToNumber(booking.totalAmount),
          ownerNetPayoutAmount: decimalToNumber(booking.ownerNetPayoutAmount),
          currency: booking.currency,
          method: input.method as PaymentMethod,
          purpose,
          provider: providerName,
          status: PaymentStatus.initiated,
          payoutStatus: PayoutStatus.not_ready,
          idempotencyKey: input.idempotencyKey ?? null,
          expiresAt,
        },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'P2002' && input.idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
        });
        if (existing && existing.bookingId === booking.id) {
          return { reusePaymentId: existing.id };
        }
      }
      throw err;
    }

    if (purpose === PaymentPurpose.deposit) {
      assertPaymentStateTransition(booking.paymentState, BookingPaymentState.deposit_pending);
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentState: BookingPaymentState.deposit_pending },
      });
    } else if (purpose === PaymentPurpose.balance) {
      assertPaymentStateTransition(booking.paymentState, BookingPaymentState.balance_pending);
      await tx.booking.update({
        where: { id: booking.id },
        data: { paymentState: BookingPaymentState.balance_pending },
      });
    }

    return {
      paymentId: payment.id,
      installment,
      purpose,
      method: input.method as PaymentMethod,
      providerName,
      currency: booking.currency,
      bookingId: booking.id,
    };
  });

  if ('reusePaymentId' in prepared && prepared.reusePaymentId) {
    const existing = await prisma.payment.findUniqueOrThrow({
      where: { id: prepared.reusePaymentId },
    });
    const redirectUrl = await loadStoredRedirectUrl(existing.id);
    return toPaymentSummary(existing, { redirectUrl });
  }

  const created = prepared as {
    paymentId: string;
    installment: number;
    purpose: PaymentPurpose;
    method: PaymentMethod;
    providerName: PaymentProvider;
    currency: string;
    bookingId: string;
  };

  const [user, bookingMeta] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
    prisma.booking.findUnique({
      where: { id: created.bookingId },
      select: { publicCode: true },
    }),
  ]);

  let gateway;
  try {
    gateway = getPaymentGateway(created.providerName);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  let intent;
  try {
    // Amount/currency/purpose are always server-authored — never taken from the client body.
    intent = await gateway.createPayment({
      paymentId: created.paymentId,
      bookingId: created.bookingId,
      amount: created.installment,
      currency: created.currency,
      method: created.method,
      purpose: created.purpose,
      idempotencyKey: providerIdempotencyKey(created.paymentId, created.purpose),
      description: `Mazare3 ${created.purpose} ${bookingMeta?.publicCode ?? created.bookingId}`,
      customer: {
        name: user?.name,
        email: user?.email,
      },
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: created.paymentId },
      data: { status: PaymentStatus.failed, failedAt: new Date() },
    });
    throwPaymentProviderError(err);
  }

  const updated = await prisma.payment.update({
    where: { id: created.paymentId },
    data: {
      status: PaymentStatus.pending,
      provider: intent.provider,
      providerRef: intent.providerRef,
    },
  });

  await appendPaymentEvent(created.paymentId, 'payment.intent_created', PaymentStatus.pending, {
    method: created.method,
    provider: intent.provider,
    purpose: created.purpose,
    amount: created.installment,
    redirectUrl: intent.redirectUrl ?? null,
    ...(intent.provider === 'paytabs'
      ? { paytabsProfileMode: loadPaytabsConfig().profileMode }
      : {}),
    // Never store server keys here.
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'payment.intent_created',
    entityType: 'payment',
    entityId: created.paymentId,
    metadata: {
      bookingId: created.bookingId,
      method: created.method,
      purpose: created.purpose,
      amount: created.installment,
      provider: intent.provider,
      hasRedirect: Boolean(intent.redirectUrl),
      ...(intent.provider === 'paytabs'
        ? { paytabsProfileMode: loadPaytabsConfig().profileMode }
        : {}),
    },
    req,
  });

  return toPaymentSummary(updated, { redirectUrl: intent.redirectUrl ?? null });
}

async function loadStoredRedirectUrl(paymentId: string): Promise<string | null> {
  const ev = await prisma.paymentEvent.findFirst({
    where: { paymentId, action: 'payment.intent_created' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = ev?.metadata as { redirectUrl?: string | null } | null;
  return typeof meta?.redirectUrl === 'string' ? meta.redirectUrl : null;
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
  await refreshBookingPaymentLifecycle(payment.bookingId);
  const refreshed = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!refreshed) return null;
  if (refreshed.status === PaymentStatus.succeeded) {
    await syncPayoutStatusForPayment(refreshed.id);
    const synced = await prisma.payment.findUnique({ where: { id: paymentId } });
    return synced ? toPaymentSummary(synced) : null;
  }
  return toPaymentSummary(refreshed);
}

async function recoverHoldExpiredBookingForCapture(
  tx: Prisma.TransactionClient,
  booking: {
    id: string;
    status: BookingStatus;
    paymentState: BookingPaymentState;
    paymentCollectionMode: string;
    availabilitySlotId: string;
    payments: { id: string; status: PaymentStatus }[];
  },
  paymentId: string,
): Promise<BookingPaymentState> {
  if (booking.status !== BookingStatus.expired) {
    return booking.paymentState;
  }

  const hasOtherSucceeded = booking.payments.some(
    (p) => p.id !== paymentId && p.status === PaymentStatus.succeeded,
  );
  if (hasOtherSucceeded) {
    throw new AppError(400, 'HOLD_EXPIRED', 'Booking is no longer payable');
  }

  const otherHolder = await tx.booking.findFirst({
    where: {
      availabilitySlotId: booking.availabilitySlotId,
      id: { not: booking.id },
      status: { in: SLOT_HOLDING_STATUSES },
    },
    select: { id: true },
  });
  if (otherHolder) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot was just booked');
  }

  const slotClaim = await tx.availabilitySlot.updateMany({
    where: {
      id: booking.availabilitySlotId,
      status: { in: [AvailabilitySlotStatus.available, AvailabilitySlotStatus.booked] },
    },
    data: { status: AvailabilitySlotStatus.booked },
  });
  if (slotClaim.count !== 1) {
    throw new AppError(409, 'SLOT_UNAVAILABLE', 'This time slot was just booked');
  }

  const paymentState =
    booking.paymentCollectionMode === 'full'
      ? BookingPaymentState.unpaid
      : BookingPaymentState.deposit_pending;

  await tx.booking.update({
    where: { id: booking.id },
    data: {
      status: BookingStatus.pending_payment,
      paymentState,
    },
  });

  return paymentState;
}

async function finalizePaymentSuccess(
  paymentId: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const outcome = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { booking: { include: { slot: { select: { date: true } }, payments: true } } },
    });
    if (!payment) {
      throw new AppError(404, 'NOT_FOUND', 'Payment not found');
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM "Booking" WHERE id = ${payment.bookingId} FOR UPDATE`,
    );

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: payment.bookingId },
      include: { payments: true, slot: { select: { date: true } } },
    });

    if (payment.status === PaymentStatus.succeeded) {
      return { kind: 'already' as const, payment };
    }

    if (booking.status === BookingStatus.cancelled) {
      throw new AppError(400, 'HOLD_EXPIRED', 'Booking is no longer payable');
    }

    // Verified capture outranks the unpaid hold clock, including after hold-expiry cleanup.
    const paymentState = await recoverHoldExpiredBookingForCapture(tx, booking, paymentId);

    if (!CAPTURABLE_PAYMENT_STATUSES.includes(payment.status)) {
      throw new AppError(400, 'INVALID_STATUS', 'Payment cannot be completed');
    }

    const duplicatePurpose = booking.payments.find(
      (p) =>
        p.id !== paymentId &&
        p.status === PaymentStatus.succeeded &&
        p.purpose === payment.purpose,
    );
    if (duplicatePurpose) {
      throw new AppError(409, 'ALREADY_PAID', 'This installment is already paid');
    }

    const installment = decimalToNumber(payment.amount);
    const paid = succeededInstallmentFils(booking.payments.filter((p) => p.id !== paymentId));
    const payableFils = jodToFils(decimalToNumber(booking.customerPayableTotal));
    if (paid.total + jodToFils(installment) > payableFils) {
      throw new AppError(400, 'PAYMENT_EXCEEDS_BALANCE', 'Payment would exceed the amount due');
    }

    const captured = await tx.payment.updateMany({
      where: {
        id: paymentId,
        status: { in: CAPTURABLE_PAYMENT_STATUSES },
      },
      data: {
        status: PaymentStatus.succeeded,
        succeededAt: new Date(),
      },
    });
    if (captured.count !== 1) {
      const latest = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (latest.status === PaymentStatus.succeeded) {
        return { kind: 'already' as const, payment: latest };
      }
      throw new AppError(409, 'ALREADY_PAID', 'Payment was already processed');
    }

    const remainingAfterFils = payableFils - paid.total - jodToFils(installment);
    const nextState = paymentStateAfterCapture({
      collectionMode: booking.paymentCollectionMode,
      purpose: payment.purpose,
      remainingAfterFils,
    });
    assertPaymentStateTransition(paymentState, nextState);

    const now = new Date();
    const completesBooking = nextState === 'fully_paid';
    const payoutAvailableAt = completesBooking
      ? computePayoutAvailableAt(booking.slot.date)
      : null;

    await tx.payment.update({
      where: { id: paymentId },
      data: {
        payoutStatus: completesBooking ? PayoutStatus.pending : PayoutStatus.not_ready,
        payoutAvailableAt,
      },
    });

    await tx.booking.update({
      where: { id: payment.bookingId },
      data: {
        status: BookingStatus.confirmed,
        paymentState: nextState as BookingPaymentState,
        depositPaidAt:
          payment.purpose === PaymentPurpose.deposit || payment.purpose === PaymentPurpose.full
            ? (booking.depositPaidAt ?? now)
            : booking.depositPaidAt,
        fullyPaidAt: completesBooking ? now : booking.fullyPaidAt,
      },
    });

    if (payment.purpose === PaymentPurpose.deposit || payment.purpose === PaymentPurpose.full) {
      await redeemCouponInTx(tx, payment.bookingId);
      await redeemPlatformCouponInTx(tx, payment.bookingId);
    }

    return {
      kind: 'captured' as const,
      purpose: payment.purpose,
      installment,
      completesBooking,
      bookingId: payment.bookingId,
      userId: payment.userId,
    };
  }, { timeout: 20_000, maxWait: 10_000 });

  if (outcome.kind === 'already') {
    return toPaymentSummary(outcome.payment);
  }

  await appendPaymentEvent(paymentId, 'payment.succeeded', PaymentStatus.succeeded, {
    purpose: outcome.purpose,
    amount: outcome.installment,
    completesBooking: outcome.completesBooking,
  });
  await createAuditLog({
    actorUserId,
    action: 'payment.succeeded',
    entityType: 'payment',
    entityId: paymentId,
    metadata: {
      bookingId: outcome.bookingId,
      purpose: outcome.purpose,
      amount: outcome.installment,
      completesBooking: outcome.completesBooking,
    },
    req,
  });

  const bookingRow = await prisma.booking.findUnique({
    where: { id: outcome.bookingId },
    include: {
      property: {
        include: { owner: { select: { userId: true } } },
      },
    },
  });

  if (bookingRow && outcome.purpose === PaymentPurpose.deposit) {
    try {
      await notifyDepositPaid({
        customerUserId: outcome.userId,
        bookingId: outcome.bookingId,
        publicCode: bookingRow.publicCode,
        remainingAmount: decimalToNumber(bookingRow.remainingAmount),
        currency: bookingRow.currency,
        balanceDueAt: bookingRow.balanceDueAt,
      });
      await notifyBookingConfirmed({
        customerUserId: outcome.userId,
        ownerUserId: bookingRow.property.owner.userId,
        bookingId: outcome.bookingId,
        publicCode: bookingRow.publicCode,
        propertyTitleAr: bookingRow.property.titleAr,
        propertyTitleEn: bookingRow.property.titleEn ?? bookingRow.property.titleAr,
      });
    } catch (err) {
      console.error('[notifications] deposit paid', err);
    }
    await createAuditLog({
      actorUserId,
      action: 'booking.confirmed_after_payment',
      entityType: 'booking',
      entityId: outcome.bookingId,
      metadata: { paymentId, purpose: 'deposit' },
      req,
    });
  } else if (
    bookingRow &&
    (outcome.purpose === PaymentPurpose.full || outcome.purpose === PaymentPurpose.balance)
  ) {
    try {
      await notifyPaymentSucceeded({
        customerUserId: outcome.userId,
        paymentId,
        bookingId: outcome.bookingId,
        publicCode: bookingRow.publicCode,
      });
      if (outcome.purpose === PaymentPurpose.full) {
        await notifyBookingConfirmed({
          customerUserId: outcome.userId,
          ownerUserId: bookingRow.property.owner.userId,
          bookingId: outcome.bookingId,
          publicCode: bookingRow.publicCode,
          propertyTitleAr: bookingRow.property.titleAr,
          propertyTitleEn: bookingRow.property.titleEn ?? bookingRow.property.titleAr,
        });
      }
    } catch (err) {
      console.error('[notifications] payment/booking confirmed', err);
    }
    if (outcome.purpose === PaymentPurpose.full) {
      await createAuditLog({
        actorUserId,
        action: 'booking.confirmed_after_payment',
        entityType: 'booking',
        entityId: outcome.bookingId,
        metadata: { paymentId, purpose: 'full' },
        req,
      });
    }
  }

  if (outcome.completesBooking) {
    await syncPayoutStatusForPayment(paymentId);
  }

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

  await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.failed,
      failedAt: new Date(),
    },
  });

  if (payment.booking.status === BookingStatus.pending_payment) {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: { paymentState: BookingPaymentState.unpaid },
    });
  } else if (payment.purpose === PaymentPurpose.balance) {
    await prisma.booking.update({
      where: { id: payment.bookingId },
      data: {
        paymentState:
          payment.booking.balanceDueAt && payment.booking.balanceDueAt <= new Date()
            ? BookingPaymentState.balance_overdue
            : BookingPaymentState.deposit_paid,
      },
    });
  }

  await appendPaymentEvent(paymentId, 'payment.failed', PaymentStatus.failed);
  await createAuditLog({
    actorUserId,
    action: 'payment.failed',
    entityType: 'payment',
    entityId: paymentId,
    metadata: { bookingId: payment.bookingId, purpose: payment.purpose },
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

  await refreshBookingPaymentLifecycle(payment.bookingId);
  // QA shortcut — still goes through the same finalize path as a verified gateway event.
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

/**
 * Browser redirect/return pages are informational only.
 * They must NEVER mark a payment succeeded and must NEVER trigger PayTabs reconciliation.
 * Truth comes from verified webhooks, or from an explicit operator reconcile that queries PayTabs.
 */
export async function acknowledgeBrowserPaymentReturn(
  userId: string,
  paymentId: string,
): Promise<PaymentSummary> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }
  await expirePaymentIfNeeded(payment.id);
  await refreshBookingPaymentLifecycle(payment.bookingId);
  await appendPaymentEvent(paymentId, 'payment.browser_return_ack', payment.status, {
    note: 'Browser return is not payment truth; no capture applied',
  });
  const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  return toPaymentSummary(refreshed);
}

/**
 * Apply a normalized gateway event via existing payment business logic.
 * Webhook adapters must not rewrite booking financials directly.
 */
export async function applyNormalizedGatewayEvent(
  event: NormalizedGatewayEvent,
  actorUserId?: string,
  req?: AuthenticatedRequest,
): Promise<{ handled: boolean; message: string; paymentId?: string }> {
  let payment =
    event.paymentId != null
      ? await prisma.payment.findUnique({ where: { id: event.paymentId } })
      : null;

  if (!payment && event.providerPaymentId) {
    payment = await prisma.payment.findFirst({
      where: { providerRef: event.providerPaymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found for gateway event');
  }

  if (event.providerEventId) {
    const recent = await prisma.paymentEvent.findMany({
      where: { paymentId: payment.id, action: 'gateway.event' },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { metadata: true },
    });
    const dup = recent.some((row) => {
      const meta = row.metadata as { providerEventId?: string } | null;
      return meta?.providerEventId === event.providerEventId;
    });
    if (dup) {
      const actor = actorUserId ?? payment.userId;
      // Event was recorded before a previous capture attempt failed (e.g. hold expiry).
      if (event.type === 'payment_succeeded' && payment.status !== PaymentStatus.succeeded) {
        await finalizePaymentSuccess(payment.id, actor, req);
        return { handled: true, message: 'payment_succeeded applied', paymentId: payment.id };
      }
      return {
        handled: true,
        message: 'Duplicate gateway event ignored',
        paymentId: payment.id,
      };
    }
  }

  await appendPaymentEvent(payment.id, 'gateway.event', payment.status, {
    type: event.type,
    providerEventId: event.providerEventId,
    providerPaymentId: event.providerPaymentId,
    ...(payment.provider === 'paytabs'
      ? { paytabsProfileMode: loadPaytabsConfig().profileMode }
      : {}),
    // Preserve raw payload for future signature audits — never return secrets to clients.
    raw: event.raw,
  });

  const actor = actorUserId ?? payment.userId;

  if (event.type === 'payment_succeeded') {
    // Do not expire unpaid holds here — a verified capture outranks the hold clock.
    await finalizePaymentSuccess(payment.id, actor, req);
    return { handled: true, message: 'payment_succeeded applied', paymentId: payment.id };
  }

  if (event.type === 'payment_failed') {
    await finalizePaymentFailure(payment.id, actor, req);
    return { handled: true, message: 'payment_failed applied', paymentId: payment.id };
  }

  if (event.type === 'refund_succeeded' || event.type === 'refund_failed') {
    // Refund request state machine remains admin-driven; gateway ack is recorded only.
    await appendPaymentEvent(payment.id, `gateway.${event.type}`, payment.status, {
      providerEventId: event.providerEventId,
    });
    return {
      handled: true,
      message: `${event.type} recorded (refund machine unchanged)`,
      paymentId: payment.id,
    };
  }

  return { handled: false, message: 'Unhandled gateway event', paymentId: payment.id };
}

export async function listAdminPayments(): Promise<
  import('@mazare3/shared').AdminPaymentRow[]
> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      booking: {
        select: { publicCode: true, paymentState: true },
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
    amount: decimalToNumber(p.amount),
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

export { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
