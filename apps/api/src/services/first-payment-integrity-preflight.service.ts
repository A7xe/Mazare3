/**
 * Phase 3C.4E.2B — Read-only first-payment / webhook integrity preflight.
 * No mutations. No secrets / PII dump.
 */
import { prisma, BookingStatus, PaymentStatus } from '@mazare3/db';
import {
  FULL_PAYMENT_WITHIN_HOURS,
  hoursUntilInstant,
  jodToFils,
  resolveBookingPeriodStart,
  resolvePaymentPlan,
} from '@mazare3/shared';

function decimalToNumber(value: { toNumber(): number } | number): number {
  return typeof value === 'number' ? value : value.toNumber();
}

export type FirstPaymentIntegrityPreflightReport = {
  phase: '3C.4E.2B';
  mutation: false;
  generatedAt: string;
  fullPaymentWithinHours: number;
  counts: {
    unpaidBookingsDepositPlanAndOver72h: number;
    unpaidBookingsStillDepositPlanButNowWithin72h: number;
    activeSessionsAmountDiffersFromCurrentObligation: number;
    captureMismatchEvents: number;
    currencyMismatchEvents: number;
    duplicateProviderTransactionRefs: number;
    cartIdReuseAcrossBookings: number;
    unresolvedCaptureMismatchAudits: number;
  };
  sampleBookingIds: {
    staleDepositPlanWithin72h: string[];
    staleSessionAmount: string[];
  };
};

export async function runFirstPaymentIntegrityPreflightReport(): Promise<FirstPaymentIntegrityPreflightReport> {
  const now = new Date();
  const unpaid = await prisma.booking.findMany({
    where: {
      status: { in: [BookingStatus.pending_payment, BookingStatus.pending_owner_approval] },
    },
    include: {
      slot: { select: { date: true } },
      payments: {
        where: { status: { in: [PaymentStatus.initiated, PaymentStatus.pending, PaymentStatus.succeeded] } },
        select: {
          id: true,
          status: true,
          purpose: true,
          amount: true,
          currency: true,
          providerRef: true,
          idempotencyKey: true,
        },
      },
    },
    take: 2000,
  });

  let over72Deposit = 0;
  let within72StaleDeposit = 0;
  let staleSession = 0;
  const stalePlanIds: string[] = [];
  const staleSessionIds: string[] = [];

  for (const b of unpaid) {
    if (b.payments.some((p) => p.status === PaymentStatus.succeeded)) continue;
    const start = resolveBookingPeriodStart(b.bookingStartAt, b.slot.date);
    const hours = hoursUntilInstant(start, now);
    const plan = resolvePaymentPlan({
      hoursUntilStart: hours,
      customerPayable: decimalToNumber(b.customerPayableTotal),
    });
    const depPct = decimalToNumber(b.depositPercent);
    if (!plan.fullPaymentRequired && depPct < 100) over72Deposit += 1;
    if (plan.fullPaymentRequired && depPct < 100) {
      within72StaleDeposit += 1;
      if (stalePlanIds.length < 20) stalePlanIds.push(b.id);
    }

    const dueDeposit = jodToFils(decimalToNumber(b.depositAmount));
    const dueFull = jodToFils(decimalToNumber(b.customerPayableTotal));
    for (const p of b.payments) {
      if (p.status !== PaymentStatus.initiated && p.status !== PaymentStatus.pending) continue;
      if (p.purpose !== 'deposit' && p.purpose !== 'full') continue;
      const amt = jodToFils(decimalToNumber(p.amount));
      const expected = p.purpose === 'full' || plan.fullPaymentRequired ? dueFull : dueDeposit;
      if (amt !== expected) {
        staleSession += 1;
        if (staleSessionIds.length < 20) staleSessionIds.push(b.id);
        break;
      }
    }
  }

  const audits = await prisma.auditLog.findMany({
    where: {
      action: {
        in: [
          'payment.capture_mismatch',
          'payment.reconcile_mismatch',
          'payment.stale_session_shortfall',
        ],
      },
    },
    select: { action: true, metadata: true },
    take: 500,
    orderBy: { createdAt: 'desc' },
  });

  let amountMismatch = 0;
  let currencyMismatch = 0;
  for (const a of audits) {
    const meta = a.metadata as { category?: string } | null;
    if (meta?.category === 'PAYMENT_AMOUNT_MISMATCH') amountMismatch += 1;
    if (meta?.category === 'PAYMENT_CURRENCY_MISMATCH') currencyMismatch += 1;
  }

  const refs = await prisma.payment.findMany({
    where: { providerRef: { not: null } },
    select: { providerRef: true, bookingId: true },
    take: 5000,
  });
  const refCounts = new Map<string, Set<string>>();
  for (const r of refs) {
    if (!r.providerRef) continue;
    const set = refCounts.get(r.providerRef) ?? new Set();
    set.add(r.bookingId);
    refCounts.set(r.providerRef, set);
  }
  let dupRefs = 0;
  let cartReuse = 0;
  for (const set of refCounts.values()) {
    if (set.size > 1) {
      dupRefs += 1;
      cartReuse += 1;
    }
  }

  // cart_id reuse approximated via idempotencyKey across bookings
  const keys = await prisma.payment.findMany({
    where: { idempotencyKey: { not: null } },
    select: { idempotencyKey: true, bookingId: true },
    take: 5000,
  });
  const keyMap = new Map<string, Set<string>>();
  for (const k of keys) {
    if (!k.idempotencyKey) continue;
    const set = keyMap.get(k.idempotencyKey) ?? new Set();
    set.add(k.bookingId);
    keyMap.set(k.idempotencyKey, set);
  }
  for (const set of keyMap.values()) {
    if (set.size > 1) cartReuse += 1;
  }

  return {
    phase: '3C.4E.2B',
    mutation: false,
    generatedAt: now.toISOString(),
    fullPaymentWithinHours: FULL_PAYMENT_WITHIN_HOURS,
    counts: {
      unpaidBookingsDepositPlanAndOver72h: over72Deposit,
      unpaidBookingsStillDepositPlanButNowWithin72h: within72StaleDeposit,
      activeSessionsAmountDiffersFromCurrentObligation: staleSession,
      captureMismatchEvents: amountMismatch,
      currencyMismatchEvents: currencyMismatch,
      duplicateProviderTransactionRefs: dupRefs,
      cartIdReuseAcrossBookings: cartReuse,
      unresolvedCaptureMismatchAudits: audits.filter(
        (a) =>
          a.action === 'payment.capture_mismatch' || a.action === 'payment.reconcile_mismatch',
      ).length,
    },
    sampleBookingIds: {
      staleDepositPlanWithin72h: stalePlanIds,
      staleSessionAmount: staleSessionIds,
    },
  };
}
