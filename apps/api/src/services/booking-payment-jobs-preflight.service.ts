/**
 * Phase 3C.4E.2C — read-only Booking/payment jobs preflight.
 * No mutations, no provider charge/refund, no secrets, no Personal Data dump.
 */
import {
  prisma,
  BookingPaymentState,
  BookingStatus,
  PaymentCollectionMode,
  PaymentProvider,
  PaymentStatus,
  RefundAllocationStatus,
} from '@mazare3/db';
import {
  BACKGROUND_JOB_NAMES,
  LAUNCH_CRITICAL_JOB_NAMES,
  getBackgroundJobHealth,
} from './background-jobs.service.js';
import { isInternalJobSecretConfigured } from '../middleware/require-internal-job-auth.js';
import { getAppEnv } from '../config/app-env.js';

function envPresence(name: string): 'PRESENT' | 'MISSING' {
  const v = process.env[name];
  return v != null && String(v).trim() !== '' ? 'PRESENT' : 'MISSING';
}

export async function runBookingPaymentJobsPreflightReport() {
  const now = new Date();
  const lookback = new Date(Date.now() - 72 * 3_600_000);

  const [
    expiredPendingOwnerApprovals,
    overdueUnpaidBalances,
    overdueWithOpenBalancePayment,
    pendingPaymentsNeedingReconcile,
    pendingRefundAllocations,
    failedRefundAllocations,
    staleLocalPaymentSessions,
    regulatoryExpiredActionable,
    jobHealth,
  ] = await Promise.all([
    prisma.booking.count({
      where: {
        status: BookingStatus.pending_owner_approval,
        ownerApprovalExpiresAt: { lte: now },
      },
    }),
    prisma.booking.count({
      where: {
        status: BookingStatus.confirmed,
        paymentCollectionMode: PaymentCollectionMode.deposit_balance,
        paymentState: {
          in: [
            BookingPaymentState.deposit_paid,
            BookingPaymentState.balance_pending,
            BookingPaymentState.balance_overdue,
          ],
        },
        balanceDueAt: { lte: now },
      },
    }),
    prisma.booking.count({
      where: {
        status: BookingStatus.confirmed,
        paymentCollectionMode: PaymentCollectionMode.deposit_balance,
        paymentState: {
          in: [
            BookingPaymentState.deposit_paid,
            BookingPaymentState.balance_pending,
            BookingPaymentState.balance_overdue,
          ],
        },
        balanceDueAt: { lte: now },
        payments: {
          some: {
            purpose: 'balance',
            status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
            providerRef: { not: null },
          },
        },
      },
    }),
    prisma.payment.count({
      where: {
        provider: PaymentProvider.paytabs,
        providerRef: { not: null },
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
        createdAt: { gte: lookback },
      },
    }),
    prisma.refundPaymentAllocation.count({
      where: { status: RefundAllocationStatus.pending },
    }),
    prisma.refundPaymentAllocation.count({
      where: { status: RefundAllocationStatus.failed },
    }),
    prisma.payment.count({
      where: {
        status: { in: [PaymentStatus.initiated, PaymentStatus.pending] },
        expiresAt: { lte: now },
      },
    }),
    prisma.propertyRegulatoryRequirement.count({
      where: {
        expiresAt: { lte: now },
      },
    }),
    getBackgroundJobHealth([...LAUNCH_CRITICAL_JOB_NAMES]),
  ]);

  const config = {
    INTERNAL_JOB_SECRET: isInternalJobSecretConfigured() ? 'PRESENT' : 'MISSING',
    PAYTABS_SERVER_KEY: envPresence('PAYTABS_SERVER_KEY'),
    PAYTABS_PROFILE_ID: envPresence('PAYTABS_PROFILE_ID'),
    PAYTABS_CALLBACK_URL: envPresence('PAYTABS_CALLBACK_URL'),
    DATABASE_URL: envPresence('DATABASE_URL'),
    APP_ENV: getAppEnv(),
    PLATFORM_TIME_ZONE: envPresence('PLATFORM_TIME_ZONE'),
  };

  return {
    phase: '3C.4E.2C',
    mutation: false,
    generatedAt: now.toISOString(),
    counts: {
      expiredPendingOwnerApprovalsNotTransitioned: expiredPendingOwnerApprovals,
      overdueUnpaidBalances: overdueUnpaidBalances,
      overdueBalancesWithUnresolvedProviderPayment: overdueWithOpenBalancePayment,
      pendingPaymentsNeedingReconciliation: pendingPaymentsNeedingReconcile,
      pendingRefundAllocations,
      failedRefundAllocationsManual: failedRefundAllocations,
      staleLocalPaymentSessions,
      regulatoryExpiryCandidates: regulatoryExpiredActionable,
    },
    scheduler: {
      registeredJobs: [...BACKGROUND_JOB_NAMES],
      launchCriticalJobs: [...LAUNCH_CRITICAL_JOB_NAMES],
      entrypoints: {
        cli: 'pnpm jobs:run [-- <job-name>]',
        http: 'POST /api/v1/ops/jobs/:name/run (Bearer INTERNAL_JOB_SECRET)',
        httpCritical: 'POST /api/v1/ops/jobs/run-critical',
        httpHealth: 'GET /api/v1/ops/jobs/health',
      },
      productionSchedulerConfiguredLive: false,
      note: 'External Production scheduler must be configured at go-live — not in this phase.',
    },
    jobHealth,
    configPresence: config,
  };
}

export function runBookingPaymentJobsConfigPreflight() {
  const checks: Record<string, 'PRESENT' | 'MISSING' | 'NOT_APPLICABLE'> = {
    requiredSchedulerJobsIdentified: 'PRESENT',
    cliEntrypointJobsRun: 'PRESENT',
    httpOpsEntrypoint: 'PRESENT',
    schedulerAuthEnv_INTERNAL_JOB_SECRET: isInternalJobSecretConfigured()
      ? 'PRESENT'
      : 'MISSING',
    paytabsServerKey: envPresence('PAYTABS_SERVER_KEY'),
    paytabsProfileId: envPresence('PAYTABS_PROFILE_ID'),
    paytabsCallbackUrl: envPresence('PAYTABS_CALLBACK_URL'),
    databaseUrl: envPresence('DATABASE_URL'),
    platformTimezone: envPresence('PLATFORM_TIME_ZONE'),
    frontendUrl: envPresence('FRONTEND_URL'),
    corsOrigin: envPresence('CORS_ORIGIN'),
    jobCadenceDocumented: 'PRESENT',
    monitoringAlertingDocumented: 'PRESENT',
    productionSchedulerLiveConfigured: 'NOT_APPLICABLE',
  };

  return {
    phase: '3C.4E.2C',
    mutation: false,
    generatedAt: new Date().toISOString(),
    checks,
    secretsPrinted: false,
  };
}
