import {
  prisma,
  AvailabilitySlotStatus,
  BookingPaymentState,
  BookingStatus,
  PaymentCollectionMode,
  PaymentPurpose,
  PaymentStatus,
  PayoutStatus,
  Prisma,
  type PaymentMethod,
  type PaymentProvider,
} from '@mazare3/db';
import type {
  CreateManagedFormPaymentInput,
  CreatePaymentIntentInput,
  CreateSavedCardPaymentInput,
  PaymentSummary,
} from '@mazare3/shared';
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
import {
  loadPaytabsConfig,
  paytabsPaylibScriptUrl,
  resolveSavedCardChargeMode,
} from '../config/paytabs-config.js';
import {
  isSavedCardVaultCapabilityEnabled,
  loadSavedPaymentMethodForCharge,
  markSavedPaymentMethodInvalidToken,
  maybeSavePaytabsCardAfterSuccess,
  paymentRequestedSaveCard,
} from './saved-payment-method.service.js';
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
import {
  resolvePaymentCustomerContact,
  type PaymentCustomerContact,
} from './payment-contact.service.js';
import { redactPaymentVaultSecrets } from '../lib/payment-vault-crypto.js';
import {
  buildInitialPaymentOptions,
  isInitialPaymentChoiceAllowed,
  type BookingAmountsForChoice,
} from '../lib/initial-payment-choice.js';
import type { InitialPaymentChoice } from '@mazare3/shared';

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
  options?: {
    paymentToken?: string;
    saveCard?: boolean;
    savedCardCharge?: {
      savedPaymentMethodId: string;
      providerToken: string;
      providerOriginalTransactionRef: string | null;
      mode: 'ecom_cvv_redirect' | 'recurring_direct';
    };
  },
): Promise<PaymentSummary> {
  const paymentToken = options?.paymentToken?.trim() || undefined;
  const savedCardCharge = options?.savedCardCharge;
  const saveCardRequested = options?.saveCard === true && isSavedCardVaultCapabilityEnabled();
  await refreshBookingPaymentLifecycle(input.bookingId);

  const providerNameEarly = resolveProviderForMethod(input.method as PaymentMethod);
  try {
    assertProviderCanCreateIntent(providerNameEarly);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  // UA-5: for PayTabs, resolve truthful contact before creating Payment rows.
  // Test/mock providers do not require complete customer_details.
  let paytabsCustomer: PaymentCustomerContact | null = null;
  if (providerNameEarly === 'paytabs') {
    const resolved = await resolvePaymentCustomerContact(userId, {
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      requireComplete: true,
    });
    if ('incomplete' in resolved) {
      throw new AppError(
        422,
        'PAYMENT_CONTACT_REQUIRED',
        'Additional contact details are required to continue to payment',
        { requiredFields: resolved.requiredFields },
      );
    }
    paytabsCustomer = resolved;
  }

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

    // CB-6 — apply Deposit vs Full at payment-initiation boundary (not on radio click).
    let working = booking;
    const choiceInput = input.initialPaymentChoice as InitialPaymentChoice | undefined;
    const amountsForChoice: BookingAmountsForChoice = {
      status: working.status,
      paymentCollectionMode: working.paymentCollectionMode,
      paymentState: working.paymentState,
      holdExpiresAt: working.holdExpiresAt,
      depositAmount: decimalToNumber(working.depositAmount),
      remainingAmount: decimalToNumber(working.remainingAmount),
      customerServiceFeeAmount: decimalToNumber(working.customerServiceFeeAmount),
      customerPayableTotal: decimalToNumber(working.customerPayableTotal),
      payments: working.payments.map((p) => ({
        status: p.status,
        purpose: p.purpose,
        providerRef: p.providerRef,
      })),
    };
    const choiceBuilt = buildInitialPaymentOptions(amountsForChoice);
    const effectiveChoice: InitialPaymentChoice | null =
      choiceInput ??
      (choiceBuilt.options ? choiceBuilt.defaultChoice : null);

    if (choiceInput || (choiceBuilt.options && effectiveChoice)) {
      const choice = (choiceInput ?? effectiveChoice)!;
      const allowed = isInitialPaymentChoiceAllowed(amountsForChoice, choice);
      if (!allowed.ok) {
        throw new AppError(400, allowed.code, allowed.message);
      }

      if (choice === 'full' && working.paymentCollectionMode !== PaymentCollectionMode.full) {
        await tx.payment.updateMany({
          where: {
            bookingId: working.id,
            purpose: PaymentPurpose.deposit,
            status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
          },
          data: { status: PaymentStatus.expired },
        });
        working = await tx.booking.update({
          where: { id: working.id },
          data: { paymentCollectionMode: PaymentCollectionMode.full },
          include: { payments: true, slot: { select: { date: true } } },
        });
      } else if (
        choice === 'deposit' &&
        working.paymentCollectionMode === PaymentCollectionMode.full
      ) {
        // Safe switch-back only before any successful capture.
        const anySucceeded = working.payments.some((p) => p.status === PaymentStatus.succeeded);
        if (anySucceeded) {
          throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Cannot switch to deposit after payment');
        }
        await tx.payment.updateMany({
          where: {
            bookingId: working.id,
            purpose: PaymentPurpose.full,
            status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
          },
          data: { status: PaymentStatus.expired },
        });
        working = await tx.booking.update({
          where: { id: working.id },
          data: { paymentCollectionMode: PaymentCollectionMode.deposit_balance },
          include: { payments: true, slot: { select: { date: true } } },
        });
      }
    }

    const flags = derivePayFlags({
      status: working.status,
      collectionMode: working.paymentCollectionMode,
      paymentState: working.paymentState,
      payments: working.payments,
      customerPayableTotal: working.customerPayableTotal,
      remainingSnapshotFils: 0,
    });

    if (flags.isFullyPaid) {
      throw new AppError(400, 'ALREADY_PAID', 'Booking is already paid in full');
    }

    let purpose: PaymentPurpose;
    // initialPaymentChoice is authoritative over client purpose when present.
    if (effectiveChoice === 'full') {
      purpose = PaymentPurpose.full;
    } else if (effectiveChoice === 'deposit' && choiceBuilt.options) {
      purpose = PaymentPurpose.deposit;
    } else if (input.purpose) {
      purpose = input.purpose as PaymentPurpose;
    } else if (flags.duePurpose) {
      purpose = flags.duePurpose as PaymentPurpose;
    } else {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Booking is not awaiting payment');
    }

    if (working.paymentCollectionMode === PaymentCollectionMode.full && purpose !== PaymentPurpose.full) {
      throw new AppError(400, 'BOOKING_NOT_PAYABLE', 'Full payment is not available for this booking');
    }
    if (working.paymentCollectionMode !== PaymentCollectionMode.full && purpose === PaymentPurpose.full) {
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

    const installment = installmentForPurpose(purpose, working);
    const paid = succeededInstallmentFils(working.payments);
    const payableFils = jodToFils(decimalToNumber(working.customerPayableTotal));
    if (paid.total + jodToFils(installment) > payableFils) {
      throw new AppError(400, 'PAYMENT_EXCEEDS_BALANCE', 'Payment would exceed the amount due');
    }

    const succeededSamePurpose = working.payments.find(
      (p) => p.status === PaymentStatus.succeeded && p.purpose === purpose,
    );
    if (succeededSamePurpose) {
      throw new AppError(400, 'ALREADY_PAID', 'This installment is already paid');
    }

    const activePayment = working.payments.find(
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
      if (existing && existing.bookingId === working.id) {
        return { reusePaymentId: existing.id };
      }
    }

    const providerName = providerNameEarly;

    const serviceFee =
      purpose === PaymentPurpose.deposit || purpose === PaymentPurpose.full
        ? decimalToNumber(working.customerServiceFeeAmount)
        : 0;

    const expiresAt =
      purpose === PaymentPurpose.deposit || purpose === PaymentPurpose.full
        ? paymentHoldExpiry(working.holdExpiresAt)
        : paymentHoldExpiry();

    let payment;
    try {
      payment = await tx.payment.create({
        data: {
          bookingId: working.id,
          userId,
          amount: installment,
          bookingTotalAmount: decimalToNumber(working.totalAmount),
          customerPayableAmount: installment,
          platformCommissionAmount: decimalToNumber(working.platformCommissionAmount),
          customerServiceFeeAmount: serviceFee,
          ownerGrossAmount: decimalToNumber(working.totalAmount),
          ownerNetPayoutAmount: decimalToNumber(working.ownerNetPayoutAmount),
          currency: working.currency,
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
        if (existing && existing.bookingId === working.id) {
          return { reusePaymentId: existing.id };
        }
      }
      throw err;
    }

    if (purpose === PaymentPurpose.deposit) {
      assertPaymentStateTransition(working.paymentState, BookingPaymentState.deposit_pending);
      await tx.booking.update({
        where: { id: working.id },
        data: { paymentState: BookingPaymentState.deposit_pending },
      });
    } else if (purpose === PaymentPurpose.balance) {
      assertPaymentStateTransition(working.paymentState, BookingPaymentState.balance_pending);
      await tx.booking.update({
        where: { id: working.id },
        data: { paymentState: BookingPaymentState.balance_pending },
      });
    }

    return {
      paymentId: payment.id,
      installment,
      purpose,
      method: input.method as PaymentMethod,
      providerName,
      currency: working.currency,
      bookingId: working.id,
    };
  });

  if ('reusePaymentId' in prepared && prepared.reusePaymentId) {
    const existing = await prisma.payment.findUniqueOrThrow({
      where: { id: prepared.reusePaymentId },
    });
    // CB-5B saved-card: if provider transaction already started, do not re-charge.
    if (savedCardCharge && existing.providerRef) {
      const priorSaved = await loadStoredSavedCardOutcome(existing.id);
      if (priorSaved) {
        const redirectUrl = await loadStoredRedirectUrl(existing.id);
        return toPaymentSummary(existing, {
          redirectUrl,
          savedCardOutcome: priorSaved,
        });
      }
      await prisma.payment.update({
        where: { id: existing.id },
        data: { status: PaymentStatus.expired },
      });
      return createPaymentIntent(userId, input, req, options);
    }
    if (savedCardCharge && !existing.providerRef) {
      const bookingMetaReuse = await prisma.booking.findUnique({
        where: { id: existing.bookingId },
        select: { publicCode: true },
      });
      return finalizeManagedOrHostedGatewayCall({
        userId,
        req,
        paymentToken,
        saveCardRequested,
        savedCardCharge,
        created: {
          paymentId: existing.id,
          installment: decimalToNumber(existing.customerPayableAmount),
          purpose: existing.purpose as PaymentPurpose,
          method: existing.method as PaymentMethod,
          providerName: existing.provider as PaymentProvider,
          currency: existing.currency,
          bookingId: existing.bookingId,
        },
        bookingMeta: bookingMetaReuse,
        paytabsCustomer,
      });
    }
    // Managed Form: if a prior Managed Form provider transaction already started, do not resubmit token.
    if (paymentToken && existing.providerRef) {
      const priorManaged = await loadStoredManagedFormOutcome(existing.id);
      if (priorManaged) {
        const redirectUrl = await loadStoredRedirectUrl(existing.id);
        return toPaymentSummary(existing, {
          redirectUrl,
          managedFormOutcome: priorManaged,
        });
      }
      // Stale HPP / simulate intent without Managed Form — expire and create a fresh attempt.
      await prisma.payment.update({
        where: { id: existing.id },
        data: { status: PaymentStatus.expired },
      });
      return createPaymentIntent(userId, input, req, options);
    }
    // Managed Form retry on initiated row without providerRef — fall through to gateway below.
    if (paymentToken && !existing.providerRef) {
      const bookingMetaReuse = await prisma.booking.findUnique({
        where: { id: existing.bookingId },
        select: { publicCode: true },
      });
      return finalizeManagedOrHostedGatewayCall({
        userId,
        req,
        paymentToken,
        saveCardRequested,
        created: {
          paymentId: existing.id,
          installment: decimalToNumber(existing.customerPayableAmount),
          purpose: existing.purpose as PaymentPurpose,
          method: existing.method as PaymentMethod,
          providerName: existing.provider as PaymentProvider,
          currency: existing.currency,
          bookingId: existing.bookingId,
        },
        bookingMeta: bookingMetaReuse,
        paytabsCustomer,
      });
    }
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

  const bookingMeta = await prisma.booking.findUnique({
    where: { id: created.bookingId },
    select: { publicCode: true },
  });

  return finalizeManagedOrHostedGatewayCall({
    userId,
    req,
    paymentToken,
    saveCardRequested,
    savedCardCharge,
    created,
    bookingMeta,
    paytabsCustomer,
  });
}

async function finalizeManagedOrHostedGatewayCall(args: {
  userId: string;
  req?: AuthenticatedRequest;
  paymentToken?: string;
  saveCardRequested?: boolean;
  savedCardCharge?: {
    savedPaymentMethodId: string;
    providerToken: string;
    providerOriginalTransactionRef: string | null;
    mode: 'ecom_cvv_redirect' | 'recurring_direct';
  };
  created: {
    paymentId: string;
    installment: number;
    purpose: PaymentPurpose;
    method: PaymentMethod;
    providerName: PaymentProvider;
    currency: string;
    bookingId: string;
  };
  bookingMeta: { publicCode: string } | null;
  paytabsCustomer: PaymentCustomerContact | null;
}): Promise<PaymentSummary> {
  const {
    userId,
    req,
    paymentToken,
    saveCardRequested = false,
    savedCardCharge,
    created,
    bookingMeta,
    paytabsCustomer,
  } = args;

  if (savedCardCharge) {
    return finalizeSavedCardGatewayCall({
      userId,
      req,
      savedCardCharge,
      created,
      bookingMeta,
      paytabsCustomer,
    });
  }

  let gateway;
  try {
    gateway = getPaymentGateway(created.providerName);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  let intent;
  try {
    // Amount/currency/purpose are always server-authored — never taken from the client body.
    // UA-5: customer contact is truthful (PayTabs) or best-effort optional (test/mock).
    let customer: { name?: string | null; email?: string | null; phone?: string | null };
    if (paytabsCustomer) {
      customer = paytabsCustomer;
    } else {
      const u = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      customer = { name: u?.name, email: u?.email };
    }

    intent = await gateway.createPayment({
      paymentId: created.paymentId,
      bookingId: created.bookingId,
      amount: created.installment,
      currency: created.currency,
      method: created.method,
      purpose: created.purpose,
      idempotencyKey: providerIdempotencyKey(created.paymentId, created.purpose),
      description: `Mazare3 ${created.purpose} ${bookingMeta?.publicCode ?? created.bookingId}`,
      customer,
      ...(paymentToken ? { paymentToken } : {}),
      ...(saveCardRequested ? { tokenise: true } : {}),
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: created.paymentId },
      data: { status: PaymentStatus.failed, failedAt: new Date() },
    });
    if (err instanceof AppError) throw err;
    // Unknown network after provider request: leave failed + ask client to reconcile, never retry same token blindly.
    if (err instanceof Error && err.message === 'MOCK_NETWORK_UNKNOWN') {
      throw new AppError(
        409,
        'PAYMENT_STATUS_UNKNOWN',
        'Payment status is uncertain; verify before retrying',
      );
    }
    throwPaymentProviderError(err);
  }

  // Immediate Managed Form authorisation — apply trusted success path (no fake HPP).
  if (paymentToken && intent.status === 'succeeded') {
    await prisma.payment.update({
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
      managedFormOutcome: intent.managedFormOutcome ?? 'authorised',
      redirectUrl: null,
      saveCardRequested,
      // Never store payment_token or persistent provider token here in clear form.
    });
    await applyNormalizedGatewayEvent(
      {
        type: 'payment_succeeded',
        paymentId: created.paymentId,
        providerPaymentId: intent.providerRef,
        providerEventId: `mf_immediate_${intent.providerRef}`,
        raw: intent.providerRaw ?? {
          source: 'managed_form_immediate',
          managedFormOutcome: 'authorised',
          ...(intent.persistentCard
            ? {
                token: intent.persistentCard.providerToken,
                tran_ref: intent.providerRef,
                payment_info: {
                  payment_method: intent.persistentCard.brand,
                  card_scheme: intent.persistentCard.brand,
                  payment_description: intent.persistentCard.maskedDisplay,
                  expiryMonth: intent.persistentCard.expiryMonth,
                  expiryYear: intent.persistentCard.expiryYear,
                },
              }
            : {}),
        },
      },
      userId,
      req,
    );
    const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
    return toPaymentSummary(refreshed, {
      redirectUrl: null,
      managedFormOutcome: 'authorised',
    });
  }

  if (paymentToken && intent.status === 'failed') {
    await prisma.payment.update({
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
      managedFormOutcome: 'declined',
      redirectUrl: null,
    });
    await applyNormalizedGatewayEvent(
      {
        type: 'payment_failed',
        paymentId: created.paymentId,
        providerPaymentId: intent.providerRef,
        providerEventId: `mf_decline_${intent.providerRef}`,
        raw: { source: 'managed_form_immediate', managedFormOutcome: 'declined' },
      },
      userId,
      req,
    );
    const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
    return toPaymentSummary(refreshed, {
      redirectUrl: null,
      managedFormOutcome: 'declined',
    });
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
    managedFormOutcome: intent.managedFormOutcome ?? null,
    saveCardRequested,
    ...(intent.provider === 'paytabs'
      ? {
          paytabsProfileMode: loadPaytabsConfig().profileMode,
          // UA-5: contact snapshot for audit (not auth identity).
          customerContact: paytabsCustomer
            ? {
                email: paytabsCustomer.email,
                phone: paytabsCustomer.phone,
                name: paytabsCustomer.name,
              }
            : null,
        }
      : {}),
    // Never store server keys or payment_token here.
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
      managedForm: Boolean(paymentToken),
      managedFormOutcome: intent.managedFormOutcome ?? null,
      ...(intent.provider === 'paytabs'
        ? { paytabsProfileMode: loadPaytabsConfig().profileMode }
        : {}),
    },
    req,
  });

  return toPaymentSummary(updated, {
    redirectUrl: intent.redirectUrl ?? null,
    managedFormOutcome: intent.managedFormOutcome ?? null,
  });
}

async function finalizeSavedCardGatewayCall(args: {
  userId: string;
  req?: AuthenticatedRequest;
  savedCardCharge: {
    savedPaymentMethodId: string;
    providerToken: string;
    providerOriginalTransactionRef: string | null;
    mode: 'ecom_cvv_redirect' | 'recurring_direct';
  };
  created: {
    paymentId: string;
    installment: number;
    purpose: PaymentPurpose;
    method: PaymentMethod;
    providerName: PaymentProvider;
    currency: string;
    bookingId: string;
  };
  bookingMeta: { publicCode: string } | null;
  paytabsCustomer: PaymentCustomerContact | null;
}): Promise<PaymentSummary> {
  const { userId, req, savedCardCharge, created, bookingMeta, paytabsCustomer } = args;
  const token = savedCardCharge.providerToken;

  let gateway;
  try {
    gateway = getPaymentGateway(created.providerName);
  } catch (err) {
    throwPaymentProviderError(err);
  }

  if (!gateway.chargeSavedPaymentMethod) {
    throw new AppError(
      400,
      'SAVED_CARD_CHARGE_UNSUPPORTED',
      'Saved card charging is not supported by this payment provider',
    );
  }

  let customer: { name?: string | null; email?: string | null; phone?: string | null };
  if (paytabsCustomer) {
    customer = paytabsCustomer;
  } else {
    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    customer = { name: u?.name, email: u?.email };
  }

  let intent;
  try {
    intent = await gateway.chargeSavedPaymentMethod({
      paymentId: created.paymentId,
      bookingId: created.bookingId,
      amount: created.installment,
      currency: created.currency,
      purpose: created.purpose,
      idempotencyKey: providerIdempotencyKey(created.paymentId, created.purpose),
      description: `Mazare3 ${created.purpose} ${bookingMeta?.publicCode ?? created.bookingId}`,
      customer,
      providerToken: token,
      providerOriginalTransactionRef: savedCardCharge.providerOriginalTransactionRef,
      mode: savedCardCharge.mode,
      savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
    });
  } catch (err) {
    await prisma.payment.update({
      where: { id: created.paymentId },
      data: { status: PaymentStatus.failed, failedAt: new Date() },
    });
    if (err instanceof AppError) throw err;
    if (err instanceof Error && err.message === 'MOCK_NETWORK_UNKNOWN') {
      throw new AppError(
        409,
        'PAYMENT_STATUS_UNKNOWN',
        'Payment status is uncertain; verify before retrying',
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.info(
      '[saved-card-charge] provider error',
      redactPaymentVaultSecrets(msg.slice(0, 160), [token]),
    );
    throwPaymentProviderError(err);
  }

  const outcome = intent.savedCardOutcome ?? null;

  if (intent.status === 'succeeded') {
    await prisma.payment.update({
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
      savedCardCharge: true,
      savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
      savedCardMode: savedCardCharge.mode,
      savedCardOutcome: 'authorised',
      redirectUrl: null,
    });
    await applyNormalizedGatewayEvent(
      {
        type: 'payment_succeeded',
        paymentId: created.paymentId,
        providerPaymentId: intent.providerRef,
        providerEventId: `sc_immediate_${intent.providerRef}`,
        raw: intent.providerRaw ?? { source: 'saved_card_immediate', savedCardOutcome: 'authorised' },
      },
      userId,
      req,
    );
    await createAuditLog({
      actorUserId: userId,
      action: 'payment.saved_card_charge',
      entityType: 'payment',
      entityId: created.paymentId,
      metadata: {
        bookingId: created.bookingId,
        savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
        mode: savedCardCharge.mode,
        result: 'authorised',
      },
      req,
    });
    const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
    return toPaymentSummary(refreshed, {
      redirectUrl: null,
      savedCardOutcome: 'authorised',
    });
  }

  if (intent.status === 'failed') {
    await prisma.payment.update({
      where: { id: created.paymentId },
      data: {
        status: PaymentStatus.failed,
        failedAt: new Date(),
        provider: intent.provider,
        providerRef: intent.providerRef,
      },
    });
    await appendPaymentEvent(created.paymentId, 'payment.intent_created', PaymentStatus.failed, {
      method: created.method,
      provider: intent.provider,
      purpose: created.purpose,
      amount: created.installment,
      savedCardCharge: true,
      savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
      savedCardMode: savedCardCharge.mode,
      savedCardOutcome: outcome ?? 'declined',
    });
    if (outcome === 'invalid_token') {
      await markSavedPaymentMethodInvalidToken(
        userId,
        savedCardCharge.savedPaymentMethodId,
        req,
      );
    }
    await applyNormalizedGatewayEvent(
      {
        type: 'payment_failed',
        paymentId: created.paymentId,
        providerPaymentId: intent.providerRef,
        providerEventId: `sc_fail_${intent.providerRef}`,
        raw: intent.providerRaw ?? { source: 'saved_card', savedCardOutcome: outcome },
      },
      userId,
      req,
    );
    await createAuditLog({
      actorUserId: userId,
      action: 'payment.saved_card_charge',
      entityType: 'payment',
      entityId: created.paymentId,
      metadata: {
        bookingId: created.bookingId,
        savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
        mode: savedCardCharge.mode,
        result: outcome ?? 'declined',
      },
      req,
    });
    const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
    return toPaymentSummary(refreshed, {
      redirectUrl: null,
      savedCardOutcome: outcome ?? 'declined',
    });
  }

  // pending — typically ecom_cvv_redirect with provider redirect_url
  await prisma.payment.update({
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
    savedCardCharge: true,
    savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
    savedCardMode: savedCardCharge.mode,
    savedCardOutcome: outcome ?? 'ecom_redirect',
    redirectUrl: intent.redirectUrl ?? null,
  });
  await createAuditLog({
    actorUserId: userId,
    action: 'payment.saved_card_charge',
    entityType: 'payment',
    entityId: created.paymentId,
    metadata: {
      bookingId: created.bookingId,
      savedPaymentMethodId: savedCardCharge.savedPaymentMethodId,
      mode: savedCardCharge.mode,
      result: outcome ?? 'ecom_redirect',
      hasRedirect: Boolean(intent.redirectUrl),
    },
    req,
  });
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: created.paymentId } });
  return toPaymentSummary(updated, {
    redirectUrl: intent.redirectUrl ?? null,
    savedCardOutcome: outcome ?? 'ecom_redirect',
  });
}

/**
 * CB-5B — pay with a vaulted saved card (customer-initiated only).
 * Body: bookingId + savedPaymentMethodId. Never accepts token/CVV/amount/purpose.
 */
export async function createSavedCardPayment(
  userId: string,
  input: CreateSavedCardPaymentInput,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const charge = resolveSavedCardChargeMode();
  if (!charge.enabled || !charge.mode) {
    throw new AppError(
      400,
      'SAVED_CARD_CHARGE_DISABLED',
      charge.reason === 'recurring_direct_requires_PAYTABS_RECURRING_ENABLED'
        ? 'Recurring saved-card charging is not approved for this deployment'
        : 'Saved card charging is not enabled',
    );
  }

  const raw = req?.body as Record<string, unknown> | undefined;
  if (raw) {
    const forbidden = [
      'number',
      'card_number',
      'cardNumber',
      'pan',
      'cvv',
      'cvc',
      'securityCode',
      'token',
      'providerToken',
      'tran_ref',
      'tranRef',
      'providerOriginalTransactionRef',
      'amount',
      'currency',
      'purpose',
      'collectionMode',
      'paymentCollectionMode',
      'remaining',
      'fee',
      'total',
    ];
    for (const key of forbidden) {
      if (key in raw && raw[key] != null && raw[key] !== '') {
        throw new AppError(400, 'PCI_FORBIDDEN_FIELD', 'Card or amount fields are not accepted');
      }
    }
  }

  const method = await loadSavedPaymentMethodForCharge(userId, input.savedPaymentMethodId);

  let mode = charge.mode;
  if (mode === 'recurring_direct' && !method.providerOriginalTransactionRef?.trim()) {
    // Prefer safe ecom redirect when original tran_ref is missing and ecom is an allowed alternate.
    // Product rule: only when configured mode was recurring but ref missing — fall back to ecom
    // if PAYTABS_SAVED_CARD_CHARGE_MODE allows ecom via explicit env FALLBACK, else refuse.
    // Spec: "fallback to ecom_cvv_redirect if allowed, otherwise new card."
    // We allow automatic ecom fallback when recurring was requested but ref is missing —
    // customer-present is safer than failing hard when vault lacks original ref.
    mode = 'ecom_cvv_redirect';
  }

  // If config is strictly recurring_direct without ref and we fell back, still OK (safer).
  // If config was ecom, mode stays ecom.

  return createPaymentIntent(
    userId,
    {
      bookingId: input.bookingId,
      method: 'card',
      idempotencyKey: input.idempotencyKey,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      initialPaymentChoice: input.initialPaymentChoice,
    },
    req,
    {
      savedCardCharge: {
        savedPaymentMethodId: method.id,
        providerToken: method.providerToken,
        providerOriginalTransactionRef: method.providerOriginalTransactionRef,
        mode,
      },
    },
  );
}

/**
 * CB-4 Managed Form payment — temporary payment_token only.
 * Server derives amount, currency, duePurpose; never accepts PAN/CVV.
 */
export async function createManagedFormPayment(
  userId: string,
  input: CreateManagedFormPaymentInput,
  req?: AuthenticatedRequest,
): Promise<PaymentSummary> {
  const paytabs = loadPaytabsConfig();
  if (paytabs.checkoutMode !== 'managed_form') {
    throw new AppError(
      400,
      'MANAGED_FORM_DISABLED',
      'Managed Form checkout is not enabled for this deployment',
    );
  }

  // Reject accidental card-field smuggling if present on a loosely typed body.
  const raw = req?.body as Record<string, unknown> | undefined;
  if (raw) {
    const forbidden = [
      'number',
      'card_number',
      'cardNumber',
      'pan',
      'cvv',
      'cvc',
      'securityCode',
      'expmonth',
      'expyear',
      'expiry',
      'expMonth',
      'expYear',
      'amount',
      'currency',
      'purpose',
      'collectionMode',
      'paymentCollectionMode',
      'remaining',
      'fee',
      'total',
    ];
    for (const key of forbidden) {
      if (key in raw && raw[key] != null && raw[key] !== '') {
        throw new AppError(400, 'PCI_FORBIDDEN_FIELD', 'Card or amount fields are not accepted');
      }
    }
  }

  return createPaymentIntent(
    userId,
    {
      bookingId: input.bookingId,
      method: 'card',
      // purpose intentionally omitted — server derives duePurpose from initialPaymentChoice / flags
      idempotencyKey: input.idempotencyKey,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      initialPaymentChoice: input.initialPaymentChoice,
    },
    req,
    { paymentToken: input.paymentToken, saveCard: input.saveCard === true },
  );
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

async function loadStoredManagedFormOutcome(
  paymentId: string,
): Promise<PaymentSummary['managedFormOutcome']> {
  const ev = await prisma.paymentEvent.findFirst({
    where: { paymentId, action: 'payment.intent_created' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = ev?.metadata as { managedFormOutcome?: PaymentSummary['managedFormOutcome'] } | null;
  const outcome = meta?.managedFormOutcome;
  if (
    outcome === 'redirect_3ds' ||
    outcome === 'authorised' ||
    outcome === 'declined' ||
    outcome === 'pending'
  ) {
    return outcome;
  }
  return null;
}

async function loadStoredSavedCardOutcome(
  paymentId: string,
): Promise<PaymentSummary['savedCardOutcome']> {
  const ev = await prisma.paymentEvent.findFirst({
    where: { paymentId, action: 'payment.intent_created' },
    orderBy: { createdAt: 'desc' },
    select: { metadata: true },
  });
  const meta = ev?.metadata as { savedCardOutcome?: PaymentSummary['savedCardOutcome'] } | null;
  const outcome = meta?.savedCardOutcome;
  if (
    outcome === 'ecom_redirect' ||
    outcome === 'authorised' ||
    outcome === 'declined' ||
    outcome === 'pending' ||
    outcome === 'invalid_token'
  ) {
    return outcome;
  }
  return null;
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
      }
      // CB-5A — vault upsert is idempotent; re-run on duplicate success so token capture is not lost.
      if (event.type === 'payment_succeeded') {
        try {
          const saveCardRequested = await paymentRequestedSaveCard(payment.id);
          await maybeSavePaytabsCardAfterSuccess({
            userId: actor,
            paymentId: payment.id,
            provider: payment.provider,
            providerRef: payment.providerRef,
            raw: event.raw,
            saveCardRequested,
            req,
          });
        } catch (err) {
          console.error(
            '[saved-payment-method] capture after duplicate success failed',
            err instanceof Error ? err.message : err,
          );
        }
      }
      return {
        handled: true,
        message:
          event.type === 'payment_succeeded' && payment.status !== PaymentStatus.succeeded
            ? 'payment_succeeded applied'
            : 'Duplicate gateway event ignored',
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
    try {
      const saveCardRequested = await paymentRequestedSaveCard(payment.id);
      await maybeSavePaytabsCardAfterSuccess({
        userId: actor,
        paymentId: payment.id,
        provider: payment.provider,
        providerRef: payment.providerRef,
        raw: event.raw,
        saveCardRequested,
        req,
      });
    } catch (err) {
      console.error(
        '[saved-payment-method] capture after success failed',
        err instanceof Error ? err.message : err,
      );
    }
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
  const paytabs = loadPaytabsConfig();
  const managedForm =
    paytabs.checkoutMode === 'managed_form' &&
    (c.provider === 'paytabs'
      ? Boolean(paytabs.clientKey)
      : c.provider === 'test' /* mock Managed Form seam */);

  return {
    provider: c.provider,
    currency: c.currency,
    simulateEnabled: c.simulateEnabled,
    livePaymentsEnabled: c.livePaymentsEnabled,
    policy: getPublicPolicySummary(),
    paymentUiMode: managedForm ? 'managed_form' : 'hosted_redirect',
    paytabsClientKey: managedForm
      ? c.provider === 'test'
        ? 'mock_client_key'
        : paytabs.clientKey || null
      : null,
    paylibScriptUrl: managedForm
      ? c.provider === 'test'
        ? null
        : paytabsPaylibScriptUrl(paytabs.baseUrl)
      : null,
    managedFormMock: managedForm && c.provider === 'test',
    savedCardsEnabled: isSavedCardVaultCapabilityEnabled(),
    savedCardChargeEnabled: resolveSavedCardChargeMode().enabled,
    savedCardChargeMode: resolveSavedCardChargeMode().mode,
  };
}

export { SLOT_HOLDING_STATUSES } from '../lib/payment-hold.js';
