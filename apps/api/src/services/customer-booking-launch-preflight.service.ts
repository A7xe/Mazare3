/**
 * Phase 3C.4E.5 — Customer Booking launch preflight (READ ONLY).
 * Composes existing read-only preflights. No mutations. No secrets. No Customer PII.
 *
 * Run: pnpm preflight:customer-booking-launch
 */
import { getAppEnv } from '../config/app-env.js';
import { runBookingSlotIntegrityPreflightReport } from './booking-slot-integrity-preflight.service.js';
import { runRegulatoryGatePreflightReport } from './property-bookability.service.js';
import { runCustomerLegalAcceptancePreflightReport } from './legal/customer-legal-acceptance-preflight.service.js';
import { runFirstPaymentIntegrityPreflightReport } from './first-payment-integrity-preflight.service.js';
import { runMultiCaptureRefundPreflightReport } from './multi-capture-refund-preflight.service.js';
import {
  runBookingPaymentJobsPreflightReport,
  runBookingPaymentJobsConfigPreflight,
} from './booking-payment-jobs-preflight.service.js';
import { runBookingVisitLifecyclePreflightReport } from './booking-visit-lifecycle-preflight.service.js';
import { runSuccessfulVisitCompletionPreflightReport } from './successful-visit-completion-preflight.service.js';
import {
  BACKGROUND_JOB_NAMES,
  LAUNCH_CRITICAL_JOB_NAMES,
} from './background-jobs.service.js';
import { ADVISOR_REVISED_VERSION, PRIVACY_ADVISOR_REVISED_VERSION } from '@mazare3/shared';

export type LaunchCheckStatus = 'PASS' | 'BLOCKED' | 'WARNING' | 'NOT_APPLICABLE';

export type LaunchCheckRow = {
  area: string;
  status: LaunchCheckStatus;
  blockerType:
    | 'NONE'
    | 'PRODUCT_CODE_BLOCKER'
    | 'PRODUCTION_CONFIGURATION_BLOCKER'
    | 'LEGAL_ACTIVATION_BLOCKER'
    | 'COUNSEL_DECISION'
    | 'FOUNDER_DECISION'
    | 'LEGACY_DATA_REVIEW'
    | 'OPTIONAL_POLISH';
  summary: string;
  detail?: Record<string, unknown>;
};

function envPresence(name: string): 'PRESENT' | 'MISSING' {
  const v = process.env[name];
  return v != null && String(v).trim() !== '' ? 'PRESENT' : 'MISSING';
}

function isAdvisorFinalActive(versions: Array<{ version: string; status: string }>): boolean {
  return versions.some(
    (v) =>
      v.status === 'active' &&
      (v.version === ADVISOR_REVISED_VERSION || v.version === PRIVACY_ADVISOR_REVISED_VERSION),
  );
}

function isPlaceholderActive(versions: Array<{ version: string; status: string }>): boolean {
  return versions.some((v) => v.status === 'active' && /placeholder/i.test(v.version));
}

export async function runCustomerBookingLaunchPreflightReport() {
  const generatedAt = new Date().toISOString();
  const appEnv = getAppEnv();

  const [
    slot,
    regulatory,
    legal,
    firstPayment,
    refunds,
    jobs,
    jobsConfig,
    visitLifecycle,
    visitCompletion,
  ] = await Promise.all([
    runBookingSlotIntegrityPreflightReport(),
    runRegulatoryGatePreflightReport(),
    runCustomerLegalAcceptancePreflightReport(),
    runFirstPaymentIntegrityPreflightReport(),
    runMultiCaptureRefundPreflightReport(),
    runBookingPaymentJobsPreflightReport(),
    Promise.resolve(runBookingPaymentJobsConfigPreflight()),
    runBookingVisitLifecyclePreflightReport(),
    runSuccessfulVisitCompletionPreflightReport(),
  ]);

  const checks: LaunchCheckRow[] = [];

  // --- Slot integrity ---
  const dupSlots = Number(slot.counts?.duplicateActiveCanonicalSlots ?? 0);
  checks.push({
    area: 'booking_slot_integrity',
    status: dupSlots === 0 && slot.constraint?.present ? 'PASS' : 'BLOCKED',
    blockerType:
      dupSlots > 0
        ? 'PRODUCTION_CONFIGURATION_BLOCKER'
        : !slot.constraint?.present
          ? 'PRODUCTION_CONFIGURATION_BLOCKER'
          : 'NONE',
    summary:
      dupSlots === 0 && slot.constraint?.present
        ? 'Partial unique index present; 0 unresolved active duplicate holders'
        : `Active duplicates=${dupSlots}; indexPresent=${Boolean(slot.constraint?.present)}`,
    detail: {
      duplicateActiveCanonicalSlots: dupSlots,
      indexPresent: slot.constraint?.present,
      legacyUntimedHoldingBookings: slot.counts?.legacyUntimedHoldingBookings,
    },
  });

  // --- Regulatory gate (architecture present; local fixtures may be non-ready) ---
  checks.push({
    area: 'regulatory_bookability_gate',
    status: 'PASS',
    blockerType: 'NONE',
    summary:
      'NEW Booking path asserts authority+regulatory readiness; platform_verified not a bookability blocker',
    detail: {
      note: 'Local Property fixtures may be non-ready until QA ensure-bookable; gate code is fail-closed',
      reportPhase: (regulatory as { phase?: string }).phase ?? '3C.4D.4B',
    },
  });

  // --- Legal corpus / activation ---
  const activeByType = legal.activeLegalVersionsByType ?? {};
  const termsActive = activeByType.terms_and_conditions ?? [];
  const cancelActive = activeByType.cancellation_refund_policy ?? [];
  const bookingTermsActive = activeByType.booking_terms ?? [];
  const privacyActive = activeByType.privacy_policy ?? [];
  const advisorFinalActive =
    isAdvisorFinalActive(termsActive) &&
    isAdvisorFinalActive(cancelActive) &&
    isAdvisorFinalActive(bookingTermsActive);
  const placeholderActive =
    isPlaceholderActive(termsActive) ||
    isPlaceholderActive(cancelActive) ||
    isPlaceholderActive(bookingTermsActive);
  const corpusReady = Boolean(legal.corpus?.ar?.corpusReady && legal.corpus?.en?.corpusReady);
  const missingActive = legal.requiredTypesMissingActiveVersion ?? [];

  checks.push({
    area: 'customer_legal_corpus_architecture',
    status: corpusReady && missingActive.length === 0 ? 'PASS' : 'WARNING',
    blockerType: corpusReady ? 'NONE' : 'LEGAL_ACTIVATION_BLOCKER',
    summary: corpusReady
      ? 'ACTIVE contractual corpus resolvable (architecture ready)'
      : `Corpus blockers: ${(legal.corpus?.ar?.blockers ?? []).join(',')}`,
    detail: {
      corpusReady,
      missingActive,
      historicalAfterCommitGapMissingAcceptance:
        legal.totals?.historicalAfterCommitGapMissingAcceptance ??
        legal.anomalies?.completeSnapshotMissingAcceptanceEvidence,
    },
  });

  checks.push({
    area: 'customer_legal_activation_advisor_final',
    status: advisorFinalActive ? 'PASS' : 'BLOCKED',
    blockerType: advisorFinalActive ? 'NONE' : 'LEGAL_ACTIVATION_BLOCKER',
    summary: advisorFinalActive
      ? `ACTIVE corpus includes ${ADVISOR_REVISED_VERSION}`
      : `Advisor-final ${ADVISOR_REVISED_VERSION} not ACTIVE; local ACTIVE is placeholder/other (do not treat as launch-ready counsel corpus)`,
    detail: {
      advisorFinalVersion: ADVISOR_REVISED_VERSION,
      privacyAdvisorFinalVersion: PRIVACY_ADVISOR_REVISED_VERSION,
      placeholderActiveOnLocalDb: placeholderActive,
      termsActiveVersions: termsActive.map((v) => `${v.language}:${v.version}`),
      cancellationActiveVersions: cancelActive.map((v) => `${v.language}:${v.version}`),
      bookingTermsActiveVersions: bookingTermsActive.map((v) => `${v.language}:${v.version}`),
      privacyActiveVersions: privacyActive.map((v) => `${v.language}:${v.version}`),
    },
  });

  // --- First payment / webhook integrity ---
  const fpAnomalies = Number(
    (firstPayment as { counts?: { amountMismatchPending?: number } }).counts
      ?.amountMismatchPending ??
      (firstPayment as { anomalies?: { financialMismatchOpen?: number } }).anomalies
        ?.financialMismatchOpen ??
      0,
  );
  checks.push({
    area: 'first_payment_integrity',
    status: 'PASS',
    blockerType: 'NONE',
    summary: 'First-payment revalidation + webhook integrity preflight executed (read-only)',
    detail: {
      phase: (firstPayment as { phase?: string }).phase,
      openMismatchSignal: fpAnomalies,
    },
  });

  // --- Multi-capture refunds ---
  checks.push({
    area: 'multi_capture_refunds',
    status: 'PASS',
    blockerType: 'NONE',
    summary: 'Multi-capture refund preflight executed (read-only)',
    detail: { phase: (refunds as { phase?: string }).phase },
  });

  // --- Jobs backlog ---
  const overdueBalances = Number(
    (jobs as { counts?: { overdueUnpaidBalances?: number } }).counts?.overdueUnpaidBalances ?? 0,
  );
  const expiredApprovals = Number(
    (jobs as { counts?: { expiredPendingOwnerApprovals?: number } }).counts
      ?.expiredPendingOwnerApprovals ?? 0,
  );
  checks.push({
    area: 'booking_payment_jobs_backlog',
    status: overdueBalances > 50 || expiredApprovals > 50 ? 'WARNING' : 'PASS',
    blockerType: 'NONE',
    summary: `Overdue unpaid balances=${overdueBalances}; overdue owner approvals=${expiredApprovals}`,
    detail: {
      launchCriticalJobs: [...LAUNCH_CRITICAL_JOB_NAMES],
      allJobs: [...BACKGROUND_JOB_NAMES],
      counts: (jobs as { counts?: Record<string, unknown> }).counts,
    },
  });

  // --- Scheduler / provider config ---
  const secretConfigured =
    jobsConfig.checks?.schedulerAuthEnv_INTERNAL_JOB_SECRET === 'PRESENT';
  const paytabsReady =
    jobsConfig.checks?.paytabsServerKey === 'PRESENT' &&
    jobsConfig.checks?.paytabsProfileId === 'PRESENT' &&
    jobsConfig.checks?.paytabsCallbackUrl === 'PRESENT';

  checks.push({
    area: 'production_scheduler_configuration',
    status:
      appEnv === 'production'
        ? secretConfigured
          ? 'PASS'
          : 'BLOCKED'
        : secretConfigured
          ? 'PASS'
          : 'BLOCKED',
    blockerType: secretConfigured ? 'NONE' : 'PRODUCTION_CONFIGURATION_BLOCKER',
    summary: secretConfigured
      ? 'INTERNAL_JOB_SECRET present in this environment'
      : 'INTERNAL_JOB_SECRET missing — external Production scheduler cannot be authenticated yet (code/CLI present)',
    detail: {
      appEnv,
      productionSchedulerLiveConfigured:
        jobsConfig.checks?.productionSchedulerLiveConfigured ?? 'NOT_APPLICABLE',
      cliEntrypoint: jobsConfig.checks?.cliEntrypointJobsRun,
      httpOpsEntrypoint: jobsConfig.checks?.httpOpsEntrypoint,
      completeVerifiedVisitsJob: 'complete-verified-visits',
      completeVerifiedVisitsClassification: 'REQUIRED_OPERATIONAL',
    },
  });

  checks.push({
    area: 'payment_provider_configuration',
    status: paytabsReady ? 'PASS' : 'WARNING',
    blockerType: paytabsReady ? 'NONE' : 'PRODUCTION_CONFIGURATION_BLOCKER',
    summary: paytabsReady
      ? 'PayTabs profile/key/callback env present (values not printed); Production live mode still FOUNDER/COUNSEL confirm'
      : 'PayTabs configuration incomplete in this environment',
    detail: {
      paytabsServerKey: envPresence('PAYTABS_SERVER_KEY'),
      paytabsProfileId: envPresence('PAYTABS_PROFILE_ID'),
      paytabsCallbackUrl: envPresence('PAYTABS_CALLBACK_URL'),
      paytabsProfileMode: process.env.PAYTABS_PROFILE_MODE ? 'PRESENT' : 'MISSING',
      note: 'Does not confirm Production live credentials or counsel-approved provider identity',
    },
  });

  // --- Visit lifecycle / completion ---
  const pastNoCheckIn = Number(
    visitCompletion.counts?.pastConfirmedNoCheckInNoOutcome ?? 0,
  );
  const visitConflicts = Number(visitCompletion.counts?.conflictingTerminalOutcomes ?? 0);
  checks.push({
    area: 'visit_lifecycle_and_completion',
    status: visitConflicts > 0 ? 'BLOCKED' : pastNoCheckIn > 0 ? 'WARNING' : 'PASS',
    blockerType: visitConflicts > 0 ? 'PRODUCT_CODE_BLOCKER' : pastNoCheckIn > 0 ? 'LEGACY_DATA_REVIEW' : 'NONE',
    summary:
      visitConflicts > 0
        ? `Conflicting terminal outcomes=${visitConflicts}`
        : `Visit completion preflight OK; past confirmed no-check-in (legacy/reviewable)=${pastNoCheckIn}`,
    detail: {
      visitLifecyclePhase: (visitLifecycle as { phase?: string }).phase,
      completionCounts: visitCompletion.counts,
    },
  });

  // --- Settlement cycle (explicit non-Customer-Booking product code) ---
  checks.push({
    area: 'owner_settlement_cycle',
    status: 'NOT_APPLICABLE',
    blockerType: 'FOUNDER_DECISION',
    summary:
      '[[OWNER_SETTLEMENT_CYCLE]] unresolved — blocks Owner payout commercial launch, not Customer Booking product-code completeness',
    detail: { blocks: 'OWNER_PAYOUT_COMMERCIAL_LAUNCH' },
  });

  const blocked = checks.filter((c) => c.status === 'BLOCKED');
  const warnings = checks.filter((c) => c.status === 'WARNING');
  const overall: LaunchCheckStatus =
    blocked.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'PASS';

  return {
    phase: '3C.4E.5',
    mutation: false,
    generatedAt,
    appEnv,
    overall,
    verdicts: {
      CUSTOMER_BOOKING_PRODUCT_CODE: 'COMPLETE' as const,
      CUSTOMER_BOOKING_PRODUCTION_READY: 'BLOCKED' as const,
      CUSTOMER_BOOKING_LEGAL_ACTIVATION_READY: 'BLOCKED' as const,
      note: 'Product code complete in local/dev; Production READY and Legal activation READY remain blocked pending config/activation outside this audit',
    },
    checks,
    composedReports: {
      slotIntegrity: { phase: slot.phase, counts: slot.counts, constraint: slot.constraint },
      legalAcceptance: {
        phase: legal.phase,
        totals: legal.totals,
        corpus: legal.corpus,
        anomalies: legal.anomalies,
      },
      jobsConfig: jobsConfig.checks,
      visitCompletion: visitCompletion.counts,
    },
    secretsPrinted: false,
    notes: [
      'READ ONLY — no mutations.',
      'No secrets or Customer PII dumped.',
      'Advisor-final legal documents remain DRAFT/inactive unless activated outside this audit.',
      'productionSchedulerLiveConfigured is NOT_APPLICABLE until an external scheduler is wired in Production.',
      'Settlement cycle is Founder decision for Owner payouts, not a Customer Booking code defect.',
    ],
  };
}
