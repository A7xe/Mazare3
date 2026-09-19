import { PaymentProvider, PaymentStatus, prisma } from '@mazare3/db';
import { validateProviderCaptureAgainstPayment } from '@mazare3/shared';
import { AppError } from '../lib/errors.js';
import { loadPaytabsConfig, maskPaytabsProfileId } from '../config/paytabs-config.js';
import { createAuditLog } from './audit.service.js';
import { applyNormalizedGatewayEvent } from './payment.service.js';
import { getPaymentGateway } from './payment/payment-provider.registry.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import type { ProviderPaymentResult } from './payment/payment-provider.interface.js';

const RECOVERABLE_STATUSES: PaymentStatus[] = [
  PaymentStatus.initiated,
  PaymentStatus.pending,
  PaymentStatus.expired,
];

export type PaytabsReconcileSource = 'admin' | 'internal_qa' | 'scheduled_job';

export type PaytabsQueryOverride = {
  status: 'pending' | 'succeeded' | 'failed';
  providerRef?: string;
  amount?: number | null;
  currency?: string | null;
  profileId?: string | null;
  providerStatus?: string | null;
};

export type PaytabsReconcileResultCode =
  | 'finalized'
  | 'failed'
  | 'pending'
  | 'already_succeeded'
  | 'mismatch'
  | 'ineligible'
  | 'manual_intervention';

export type PaytabsReconcileResult = {
  paymentId: string;
  result: PaytabsReconcileResultCode;
  message: string;
  providerRef: string | null;
  providerStatus: string | null;
  paymentStatus: string;
  bookingId: string;
};

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

async function appendReconcileEvent(
  paymentId: string,
  status: PaymentStatus,
  metadata: Record<string, unknown>,
) {
  await prisma.paymentEvent.create({
    data: {
      paymentId,
      action: 'payment.reconcile',
      status,
      metadata: metadata as object,
    },
  });
}

function mismatchResult(
  payment: { id: string; bookingId: string; status: PaymentStatus; providerRef: string | null },
  reason: string,
  query: ProviderPaymentResult | null,
): PaytabsReconcileResult {
  return {
    paymentId: payment.id,
    result: 'mismatch',
    message: reason,
    providerRef: query?.providerRef ?? payment.providerRef,
    providerStatus: query?.providerStatus ?? null,
    paymentStatus: payment.status,
    bookingId: payment.bookingId,
  };
}

function validateQuery(
  payment: {
    providerRef: string | null;
    amount: { toNumber(): number } | number;
    currency: string;
  },
  query: ProviderPaymentResult,
  profileId: string,
): string | null {
  const shared = validateProviderCaptureAgainstPayment({
    expectedAmountJod: decimalToNumber(payment.amount),
    expectedCurrency: payment.currency,
    expectedProviderRef: payment.providerRef,
    providerAmountJod: query.amount,
    providerCurrency: query.currency,
    providerRef: query.providerRef,
    requireAmountCurrency: true,
  });
  if (!shared.ok) return shared.message;
  if (query.profileId && profileId && query.profileId !== profileId) {
    return 'PayTabs profile does not match the configured profile';
  }
  return null;
}

/**
 * Server-side PayTabs recovery. Callback/IPN remains payment truth;
 * this path uses authenticated `/payment/query` then existing finalization.
 */
export async function reconcilePayTabsPayment(
  paymentId: string,
  options: {
    actorUserId?: string | null;
    source: PaytabsReconcileSource;
    req?: AuthenticatedRequest;
    queryOverride?: PaytabsQueryOverride;
  },
): Promise<PaytabsReconcileResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: { select: { id: true, status: true } } },
  });
  if (!payment) {
    throw new AppError(404, 'NOT_FOUND', 'Payment not found');
  }

  const cfg = loadPaytabsConfig();
  const safeMetaBase = {
    source: options.source,
    actor: options.source,
    paytabsProfileMode: cfg.profileMode,
    timestamp: new Date().toISOString(),
  };

  if (payment.provider !== PaymentProvider.paytabs) {
    const result: PaytabsReconcileResult = {
      paymentId: payment.id,
      result: 'ineligible',
      message: 'Only PayTabs payments can be reconciled',
      providerRef: payment.providerRef,
      providerStatus: null,
      paymentStatus: payment.status,
      bookingId: payment.bookingId,
    };
    await appendReconcileEvent(payment.id, payment.status, { ...safeMetaBase, result: result.result });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile_ineligible',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { ...safeMetaBase, result: result.result },
      req: options.req,
    });
    throw new AppError(400, 'RECONCILE_INELIGIBLE', result.message);
  }

  if (payment.status === PaymentStatus.succeeded) {
    const result: PaytabsReconcileResult = {
      paymentId: payment.id,
      result: 'already_succeeded',
      message: 'Payment already succeeded; reconciliation is a no-op',
      providerRef: payment.providerRef,
      providerStatus: null,
      paymentStatus: payment.status,
      bookingId: payment.bookingId,
    };
    await appendReconcileEvent(payment.id, payment.status, {
      ...safeMetaBase,
      result: result.result,
      providerRef: payment.providerRef,
    });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile',
      entityType: 'payment',
      entityId: payment.id,
      metadata: { ...safeMetaBase, result: result.result, providerRef: payment.providerRef },
      req: options.req,
    });
    return result;
  }

  if (!payment.providerRef) {
    throw new AppError(400, 'RECONCILE_INELIGIBLE', 'Payment has no PayTabs transaction reference');
  }

  if (!RECOVERABLE_STATUSES.includes(payment.status)) {
    throw new AppError(
      400,
      'RECONCILE_INELIGIBLE',
      `Payment status ${payment.status} cannot be reconciled`,
    );
  }

  let query: ProviderPaymentResult;
  if (options.queryOverride) {
    query = {
      provider: 'paytabs',
      providerRef: options.queryOverride.providerRef ?? payment.providerRef,
      status: options.queryOverride.status,
      providerStatus: options.queryOverride.providerStatus ?? null,
      amount: options.queryOverride.amount ?? null,
      currency: options.queryOverride.currency ?? null,
      profileId: options.queryOverride.profileId ?? null,
    };
  } else {
    const gateway = getPaymentGateway('paytabs');
    query = await gateway.retrievePayment({
      paymentId: payment.id,
      providerRef: payment.providerRef,
    });
  }

  const mismatch = validateQuery(payment, query, cfg.profileId);
  if (mismatch) {
    const result = mismatchResult(payment, mismatch, query);
    await appendReconcileEvent(payment.id, payment.status, {
      ...safeMetaBase,
      result: 'mismatch',
      reason: mismatch,
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
      profileIdMasked: query.profileId ? maskPaytabsProfileId(query.profileId) : null,
    });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile_mismatch',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        ...safeMetaBase,
        result: 'mismatch',
        reason: mismatch,
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
      },
      req: options.req,
    });
    throw new AppError(409, 'RECONCILE_MISMATCH', mismatch, { result: result.result });
  }

  const latest = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
  if (latest.status === PaymentStatus.succeeded) {
    return {
      paymentId: payment.id,
      result: 'already_succeeded',
      message: 'Payment already succeeded; reconciliation is a no-op',
      providerRef: payment.providerRef,
      providerStatus: query.providerStatus ?? null,
      paymentStatus: latest.status,
      bookingId: payment.bookingId,
    };
  }

  const providerEventId = `reconcile:${query.providerRef}:${query.status}`;

  if (query.status === 'pending') {
    await appendReconcileEvent(payment.id, payment.status, {
      ...safeMetaBase,
      result: 'pending',
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
    });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        ...safeMetaBase,
        result: 'pending',
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
      },
      req: options.req,
    });
    return {
      paymentId: payment.id,
      result: 'pending',
      message: 'PayTabs still reports pending; no financial state change',
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
      paymentStatus: latest.status,
      bookingId: payment.bookingId,
    };
  }

  try {
    const applied = await applyNormalizedGatewayEvent(
      {
        type: query.status === 'succeeded' ? 'payment_succeeded' : 'payment_failed',
        paymentId: payment.id,
        providerPaymentId: query.providerRef,
        providerEventId,
        amount: query.amount,
        currency: query.currency,
        raw: {
          source: 'paytabs_reconciliation',
          providerStatus: query.providerStatus ?? null,
        },
      },
      options.actorUserId ?? payment.userId,
      options.req,
    );

    const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    const resultCode: PaytabsReconcileResultCode =
      query.status === 'succeeded'
        ? refreshed.status === PaymentStatus.succeeded
          ? 'finalized'
          : 'manual_intervention'
        : 'failed';

    await appendReconcileEvent(payment.id, refreshed.status, {
      ...safeMetaBase,
      result: resultCode,
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
      gatewayMessage: applied.message,
    });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        ...safeMetaBase,
        result: resultCode,
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
        gatewayMessage: applied.message,
      },
      req: options.req,
    });

    return {
      paymentId: payment.id,
      result: resultCode,
      message: applied.message,
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
      paymentStatus: refreshed.status,
      bookingId: payment.bookingId,
    };
  } catch (err) {
    const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
    if (query.status === 'failed' && code === 'INVALID_STATUS') {
      const refreshed = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
      await appendReconcileEvent(payment.id, refreshed.status, {
        ...safeMetaBase,
        result: 'failed',
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
        errorCode: code,
      });
      return {
        paymentId: payment.id,
        result: 'failed',
        message: 'PayTabs reports failed; internal payment is not in a failable state — no change',
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
        paymentStatus: refreshed.status,
        bookingId: payment.bookingId,
      };
    }
    const needsReview = code === 'SLOT_UNAVAILABLE' || code === 'HOLD_EXPIRED';
    const resultCode: PaytabsReconcileResultCode = needsReview ? 'manual_intervention' : 'ineligible';
    await appendReconcileEvent(payment.id, payment.status, {
      ...safeMetaBase,
      result: resultCode,
      providerRef: query.providerRef,
      providerStatus: query.providerStatus ?? null,
      errorCode: code,
    });
    await createAuditLog({
      actorUserId: options.actorUserId,
      action: 'payment.reconcile_needs_review',
      entityType: 'payment',
      entityId: payment.id,
      metadata: {
        ...safeMetaBase,
        result: resultCode,
        providerRef: query.providerRef,
        providerStatus: query.providerStatus ?? null,
        errorCode: code,
      },
      req: options.req,
    });
    if (needsReview) {
      throw new AppError(
        409,
        'RECONCILE_NEEDS_REVIEW',
        'PayTabs reports success but the slot/booking cannot be reclaimed automatically. Manual review required.',
        { paymentId: payment.id, providerRef: query.providerRef, errorCode: code },
      );
    }
    throw err;
  }
}
