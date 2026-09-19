/**
 * Phase 3C.4B.1.3 — Personal data breach access & notification evidence.
 *
 * LOCAL / DEV readiness only:
 * - No automatic regulator submission
 * - No automatic mass user email
 * - discoveredAt / initiallyRecordedDiscoveryAt are never silently rewritten
 * - 24h/72h elapsed hours (not DSR working days)
 * - Human confirmation required for severe-harm / notification gates
 * - Affected Data Subjects terminology (Customers are one subset)
 * - Per-recipient notice evidence; aggregate status derived from recipients
 *
 * NOT BookingIncident.
 */
import { createHash } from 'node:crypto';
import {
  BreachDataSubjectCategoryLabel,
  BreachNotificationChannelStatus,
  BreachRecipientNoticeState,
  LegalNotificationAssessment,
  PersonalDataBreachIncidentKind,
  PersonalDataBreachWorkflowStatus,
  SevereHarmAssessmentStatus,
  prisma,
  type PersonalDataBreachDeadlineHistory,
  type PersonalDataBreachIncident,
  type PersonalDataBreachRecipientNotice,
  type Prisma,
} from '@mazare3/db';
import type {
  ApproveBreachAuthorityPackInput,
  ApproveBreachCustomerNoticeInput,
  CorrectBreachDiscoveryInput,
  CreatePersonalDataBreachIncidentInput,
  PrepareBreachCustomerNoticeInput,
  RecordBreachAuthoritySubmissionInput,
  RecordBreachCustomerNoticeSentInput,
  UpdatePersonalDataBreachIncidentInput,
} from '@mazare3/shared';
import {
  BREACH_ACCESS_CONTROL_GAP_NOTE_EN,
  BREACH_AUTHORITY_DUE_SOON_HOURS,
  BREACH_AUTHORITY_URGENT_HOURS,
  BREACH_DATA_SUBJECT_DUE_SOON_HOURS,
  BREACH_PRIVACY_CONTACT_UNRESOLVED,
  EMPTY_BREACH_CONTAINMENT_CHECKLIST,
  buildAuthorityBreachNotificationPack,
  buildDataSubjectBreachNoticeDrafts,
  classifyBreachDeadlineUrgency,
  computeArticle20NotificationDeadlines,
  deriveDataSubjectAggregateNoticeStatus,
  effectiveBreachDiscoveryAt,
  isBreachNotificationActuallySent,
  isSevereHarmConfirmed,
} from '@mazare3/shared';
import { loadEmailConfig } from '../../config/email-config.js';
import { AppError } from '../../lib/errors.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';
import { createAuditLog } from '../audit.service.js';

type ReopenPersonalDataBreachIncidentInput = {
  humanConfirmation: true;
  reason: string;
  nextWorkflowStatus?: 'legal_assessment' | 'investigating' | 'notification_required';
};

type AddBreachRecipientNoticeInput = {
  subjectCategory: string;
  userId?: string;
  ownerProfileId?: string;
  externalRef?: string;
  contactChannel?: 'email' | 'in_app' | 'manual' | 'other';
};

type UpdateBreachRecipientNoticeInput = {
  state:
    | 'not_required'
    | 'pending'
    | 'prepared'
    | 'approved'
    | 'attempted'
    | 'sent'
    | 'delivery_confirmed'
    | 'failed'
    | 'manual_followup_required';
  failureCategory?: string | null;
  fallbackManualStatus?: string | null;
  contentHash?: string | null;
  humanConfirmation?: boolean;
};

/** Preferred prepare input name (same shape as deprecated customer alias). */
export type PrepareBreachDataSubjectNoticeInput = PrepareBreachCustomerNoticeInput;
export type ApproveBreachDataSubjectNoticeInput = ApproveBreachCustomerNoticeInput;
export type RecordBreachDataSubjectNoticeSentInput = RecordBreachCustomerNoticeSentInput;

type AssessmentHistoryEntry = {
  at: string;
  byUserId: string;
  reason?: string | null;
  previousSevereHarmAssessment: string;
  previousLegalNotificationAssessment: string;
  previousWorkflowStatus: string;
  previousDataSubjectNotificationRequired: boolean;
  previousAuthorityNotificationRequired: boolean;
  previousDataSubjectNotificationDueAt: string | null;
  previousAuthorityNotificationDueAt: string | null;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asAssessmentHistory(value: unknown): AssessmentHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is AssessmentHistoryEntry =>
      !!v && typeof v === 'object' && typeof (v as AssessmentHistoryEntry).at === 'string',
  );
}

function hashNoticeDraft(draft: unknown): string {
  return createHash('sha256').update(JSON.stringify(draft)).digest('hex');
}

function emailProviderBlockerMessage(): string | null {
  return loadEmailConfig().provider === 'none'
    ? 'EMAIL_PROVIDER=none — cannot claim real user notification delivery'
    : null;
}

function dataSubjectRequiredFromUpdate(input: UpdatePersonalDataBreachIncidentInput): boolean | undefined {
  if (input.dataSubjectNotificationRequired !== undefined) {
    return input.dataSubjectNotificationRequired;
  }
  if (input.customerNotificationRequired !== undefined) {
    return input.customerNotificationRequired;
  }
  return undefined;
}

function mapRecipientNotice(row: PersonalDataBreachRecipientNotice) {
  return {
    id: row.id,
    breachIncidentId: row.breachIncidentId,
    subjectCategory: row.subjectCategory,
    userId: row.userId,
    ownerProfileId: row.ownerProfileId,
    externalRef: row.externalRef,
    contactChannel: row.contactChannel,
    contentHash: row.contentHash,
    state: row.state,
    preparedAt: row.preparedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    attemptedAt: row.attemptedAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    failedAt: row.failedAt?.toISOString() ?? null,
    failureCategory: row.failureCategory,
    fallbackManualStatus: row.fallbackManualStatus,
    deliveryState: row.deliveryState,
    actorUserId: row.actorUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    /** Attempted is never treated as sent. */
    isActuallySent: isBreachNotificationActuallySent(row.state),
  };
}

function mapDeadlineHistoryRow(row: PersonalDataBreachDeadlineHistory) {
  return {
    id: row.id,
    breachIncidentId: row.breachIncidentId,
    kind: row.kind,
    discoveryAt: row.discoveryAt.toISOString(),
    dataSubjectDueAt: row.dataSubjectDueAt?.toISOString() ?? null,
    authorityDueAt: row.authorityDueAt?.toISOString() ?? null,
    /** Compatibility alias */
    customerDueAt: row.dataSubjectDueAt?.toISOString() ?? null,
    reason: row.reason,
    reviewerUserId: row.reviewerUserId,
    recordedAt: row.recordedAt.toISOString(),
    previousSnapshot: row.previousSnapshot,
  };
}

function mapIncident(
  row: PersonalDataBreachIncident,
  opts?: {
    includeSensitiveDetail?: boolean;
    includeAffectedRefs?: boolean;
    recipientNotices?: PersonalDataBreachRecipientNotice[];
  },
) {
  const sensitive = opts?.includeSensitiveDetail === true;
  const includeRefs = opts?.includeAffectedRefs === true || sensitive;
  const discovery = effectiveBreachDiscoveryAt({
    discoveredAt: row.discoveredAt,
    correctedDiscoveryAt: row.correctedDiscoveryAt,
  });

  const dataSubjectUrgency = classifyBreachDeadlineUrgency({
    dueAt: row.dataSubjectNotificationDueAt,
    channelStatus: row.dataSubjectNotificationStatus,
    dueSoonHours: BREACH_DATA_SUBJECT_DUE_SOON_HOURS,
    urgentHours: 2,
  });
  const authorityUrgency = classifyBreachDeadlineUrgency({
    dueAt: row.authorityNotificationDueAt,
    channelStatus: row.authorityNotificationStatus,
    dueSoonHours: BREACH_AUTHORITY_DUE_SOON_HOURS,
    urgentHours: BREACH_AUTHORITY_URGENT_HOURS,
  });

  const base = {
    id: row.id,
    title: row.title,
    internalSummary: row.internalSummary,
    incidentKind: row.incidentKind,
    workflowStatus: row.workflowStatus,
    discoveredAt: row.discoveredAt.toISOString(),
    initiallyRecordedDiscoveryAt: row.initiallyRecordedDiscoveryAt.toISOString(),
    correctedDiscoveryAt: row.correctedDiscoveryAt?.toISOString() ?? null,
    discoveryCorrectionReason: row.discoveryCorrectionReason,
    discoveryCorrectionReviewedByUserId: row.discoveryCorrectionReviewedByUserId,
    discoveryCorrectionReviewedAt: row.discoveryCorrectionReviewedAt?.toISOString() ?? null,
    effectiveDiscoveryAt: discovery.toISOString(),
    occurredAt: row.occurredAt?.toISOString() ?? null,
    containedAt: row.containedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    discoverySource: row.discoverySource,
    affectedSystems: asStringArray(row.affectedSystems),
    affectedDataCategories: asStringArray(row.affectedDataCategories),
    affectedDataSubjectCategories: asStringArray(row.affectedDataSubjectCategories),
    estimatedAffectedCount: row.estimatedAffectedCount,
    affectedSubjectRefCount: Array.isArray(row.affectedSubjectRefs)
      ? row.affectedSubjectRefs.length
      : 0,
    involvesSensitivePersonalData: row.involvesSensitivePersonalData,
    involvesFinancialSensitiveData: row.involvesFinancialSensitiveData,
    involvesKycData: row.involvesKycData,
    involvesCredentialsAuthData: row.involvesCredentialsAuthData,
    dataWasEncrypted: row.dataWasEncrypted,
    encryptionKeysCompromised: row.encryptionKeysCompromised,
    containmentChecklist: row.containmentChecklist ?? EMPTY_BREACH_CONTAINMENT_CHECKLIST,
    likelyConsequences: row.likelyConsequences,
    severeHarmAssessment: row.severeHarmAssessment,
    severeHarmReason: row.severeHarmReason,
    severeHarmFactorKeys: asStringArray(row.severeHarmFactorKeys),
    legalNotificationAssessment: row.legalNotificationAssessment,
    reviewedByUserId: row.reviewedByUserId,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    dataSubjectNotificationRequired: row.dataSubjectNotificationRequired,
    authorityNotificationRequired: row.authorityNotificationRequired,
    dataSubjectNotificationDueAt: row.dataSubjectNotificationDueAt?.toISOString() ?? null,
    authorityNotificationDueAt: row.authorityNotificationDueAt?.toISOString() ?? null,
    dataSubjectNotificationStatus: row.dataSubjectNotificationStatus,
    authorityNotificationStatus: row.authorityNotificationStatus,
    dataSubjectNoticeContentHash: row.dataSubjectNoticeContentHash,
    dataSubjectNoticeApprovedAt: row.dataSubjectNoticeApprovedAt?.toISOString() ?? null,
    dataSubjectNoticeSentAt: row.dataSubjectNoticeSentAt?.toISOString() ?? null,
    authorityPackApprovedAt: row.authorityPackApprovedAt?.toISOString() ?? null,
    authoritySubmittedAt: row.authoritySubmittedAt?.toISOString() ?? null,
    authoritySubmissionReference: row.authoritySubmissionReference,
    authoritySubmittedByUserId: row.authoritySubmittedByUserId,
    reportedByUserId: row.reportedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    dataSubjectDeadlineUrgency: dataSubjectUrgency,
    authorityDeadlineUrgency: authorityUrgency,
    recipientNoticeCount: opts?.recipientNotices?.length ?? undefined,
    accessControlGapNoteEn: BREACH_ACCESS_CONTROL_GAP_NOTE_EN,
    emailProviderBlocker: emailProviderBlockerMessage(),
    article20CalendarNoteEn:
      'Elapsed hours from discovery. Weekends/holidays do NOT extend. Not DSR working days. Deadlines apply to Affected Data Subjects (not Customers only).',
    affectedDataSubjectsLabelEn: 'Affected Data Subjects',
    affectedDataSubjectsLabelAr: 'الأشخاص المعنيون المتأثرون',
    // --- one-release compatibility aliases (customer* = dataSubject*) ---
    customerNotificationRequired: row.dataSubjectNotificationRequired,
    customerNotificationDueAt: row.dataSubjectNotificationDueAt?.toISOString() ?? null,
    customerNotificationStatus: row.dataSubjectNotificationStatus,
    customerNoticeContentHash: row.dataSubjectNoticeContentHash,
    customerNoticeApprovedAt: row.dataSubjectNoticeApprovedAt?.toISOString() ?? null,
    customerNoticeSentAt: row.dataSubjectNoticeSentAt?.toISOString() ?? null,
    customerDeadlineUrgency: dataSubjectUrgency,
  };

  if (!sensitive) {
    return {
      ...base,
      affectedSubjectRefs: includeRefs ? row.affectedSubjectRefs : undefined,
    };
  }

  return {
    ...base,
    affectedSubjectRefs: includeRefs ? row.affectedSubjectRefs : undefined,
    sourceMechanismDescription: row.sourceMechanismDescription,
    containmentActions: row.containmentActions,
    remediationActions: row.remediationActions,
    internalNotes: row.internalNotes,
    dataSubjectNoticeDraftJson: row.dataSubjectNoticeDraftJson,
    /** Compatibility alias */
    customerNoticeDraftJson: row.dataSubjectNoticeDraftJson,
    authorityPackJson: row.authorityPackJson,
    assessmentHistory: asAssessmentHistory(row.assessmentHistory),
    recipientNotices: (opts?.recipientNotices ?? []).map(mapRecipientNotice),
  };
}

async function getOrThrow(id: string) {
  const row = await prisma.personalDataBreachIncident.findUnique({ where: { id } });
  if (!row) throw new AppError(404, 'NOT_FOUND', 'Breach incident not found');
  return row;
}

function requireHumanConfirmation(flag: boolean | undefined, message: string) {
  if (!flag) {
    throw new AppError(400, 'HUMAN_CONFIRMATION_REQUIRED', message);
  }
}

async function appendDeadlineHistory(params: {
  breachIncidentId: string;
  kind: string;
  discoveryAt: Date;
  dataSubjectDueAt: Date | null;
  authorityDueAt: Date | null;
  reason?: string | null;
  reviewerUserId?: string | null;
  previousSnapshot?: Prisma.InputJsonValue | null;
}) {
  await prisma.personalDataBreachDeadlineHistory.create({
    data: {
      breachIncidentId: params.breachIncidentId,
      kind: params.kind,
      discoveryAt: params.discoveryAt,
      dataSubjectDueAt: params.dataSubjectDueAt,
      authorityDueAt: params.authorityDueAt,
      reason: params.reason ?? null,
      reviewerUserId: params.reviewerUserId ?? null,
      previousSnapshot: params.previousSnapshot ?? undefined,
    },
  });
}

async function recomputeAndPersistDataSubjectAggregateStatus(incidentId: string) {
  const notices = await prisma.personalDataBreachRecipientNotice.findMany({
    where: { breachIncidentId: incidentId },
    select: { state: true },
  });
  const aggregate = deriveDataSubjectAggregateNoticeStatus(notices.map((n) => n.state));
  const updated = await prisma.personalDataBreachIncident.update({
    where: { id: incidentId },
    data: {
      dataSubjectNotificationStatus: aggregate as BreachNotificationChannelStatus,
      ...(aggregate === 'sent' || aggregate === 'confirmed'
        ? { dataSubjectNoticeSentAt: new Date() }
        : {}),
    },
  });
  return updated;
}

export async function createPersonalDataBreachIncident(
  input: CreatePersonalDataBreachIncidentInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const discoveredAt = new Date(input.discoveredAt);
  if (Number.isNaN(discoveredAt.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid discoveredAt');
  }

  // Auto-flag category hints from selected categories (assessment aid only).
  const cats = input.affectedDataCategories ?? [];
  const involvesFinancial =
    input.involvesFinancialSensitiveData ??
    cats.some((c) => c === 'financial_sensitive' || c === 'payout_iban' || c === 'payment_metadata');
  const involvesKyc = input.involvesKycData ?? cats.includes('kyc');
  const involvesCreds =
    input.involvesCredentialsAuthData ?? cats.includes('authentication_account_data');
  const involvesSensitive =
    input.involvesSensitivePersonalData ?? (involvesFinancial || involvesKyc || involvesCreds);

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.personalDataBreachIncident.create({
      data: {
        title: input.title,
        internalSummary: input.internalSummary ?? null,
        incidentKind: input.incidentKind as PersonalDataBreachIncidentKind,
        workflowStatus: PersonalDataBreachWorkflowStatus.reported,
        discoveredAt,
        initiallyRecordedDiscoveryAt: discoveredAt,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : null,
        discoverySource: input.discoverySource ?? null,
        affectedSystems: input.affectedSystems ?? [],
        affectedDataCategories: cats,
        affectedDataSubjectCategories: input.affectedDataSubjectCategories ?? [],
        estimatedAffectedCount: input.estimatedAffectedCount ?? null,
        affectedSubjectRefs: input.affectedSubjectRefs ?? [],
        involvesSensitivePersonalData: involvesSensitive,
        involvesFinancialSensitiveData: involvesFinancial,
        involvesKycData: involvesKyc,
        involvesCredentialsAuthData: involvesCreds,
        dataWasEncrypted: input.dataWasEncrypted ?? null,
        encryptionKeysCompromised: input.encryptionKeysCompromised ?? null,
        sourceMechanismDescription: input.sourceMechanismDescription ?? null,
        likelyConsequences: input.likelyConsequences ?? null,
        internalNotes: input.internalNotes ?? null,
        containmentChecklist: EMPTY_BREACH_CONTAINMENT_CHECKLIST,
        assessmentHistory: [],
        reportedByUserId: actorUserId,
        // Security incident only: never auto-set Art.20 notification clocks.
        dataSubjectNotificationStatus: BreachNotificationChannelStatus.not_required,
        authorityNotificationStatus: BreachNotificationChannelStatus.not_required,
      },
    });

    await tx.personalDataBreachDeadlineHistory.create({
      data: {
        breachIncidentId: row.id,
        kind: 'initial',
        discoveryAt: discoveredAt,
        dataSubjectDueAt: null,
        authorityDueAt: null,
        reason: 'Initial discovery recorded; Art.20 clocks not started until severe-harm confirmation',
        reviewerUserId: actorUserId,
      },
    });

    return row;
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.reported',
    entityType: 'personal_data_breach_incident',
    entityId: created.id,
    metadata: {
      incidentKind: created.incidentKind,
      discoveredAt: created.discoveredAt.toISOString(),
      involvesFinancialSensitiveData: created.involvesFinancialSensitiveData,
      involvesKycData: created.involvesKycData,
      // Never log secrets / KYC contents / tokens
    },
    req,
  });
  await createAuditLog({
    actorUserId,
    action: 'breach.discovery_recorded',
    entityType: 'personal_data_breach_incident',
    entityId: created.id,
    metadata: {
      discoveredAt: created.discoveredAt.toISOString(),
      initiallyRecordedDiscoveryAt: created.initiallyRecordedDiscoveryAt.toISOString(),
      deadlineHistoryKind: 'initial',
    },
    req,
  });

  return mapIncident(created, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

export async function listPersonalDataBreachIncidents(params?: {
  workflowStatus?: string;
  incidentKind?: string;
  take?: number;
}) {
  const rows = await prisma.personalDataBreachIncident.findMany({
    where: {
      ...(params?.workflowStatus
        ? { workflowStatus: params.workflowStatus as PersonalDataBreachWorkflowStatus }
        : {}),
      ...(params?.incidentKind
        ? { incidentKind: params.incidentKind as PersonalDataBreachIncidentKind }
        : {}),
    },
    orderBy: [{ dataSubjectNotificationDueAt: 'asc' }, { createdAt: 'desc' }],
    take: params?.take ?? 100,
  });
  // List intentionally omits sensitive detail fields.
  return rows.map((r) => mapIncident(r, { includeSensitiveDetail: false, includeAffectedRefs: false }));
}

export async function getPersonalDataBreachIncident(
  id: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const row = await getOrThrow(id);
  const recipientNotices = await prisma.personalDataBreachRecipientNotice.findMany({
    where: { breachIncidentId: id },
    orderBy: { createdAt: 'asc' },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.access_authorized',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      view: 'detail',
      includeSensitiveDetail: true,
    },
    req,
  });

  return mapIncident(row, {
    includeSensitiveDetail: true,
    includeAffectedRefs: true,
    recipientNotices,
  });
}

export async function listDeadlineHistory(incidentId: string) {
  await getOrThrow(incidentId);
  const rows = await prisma.personalDataBreachDeadlineHistory.findMany({
    where: { breachIncidentId: incidentId },
    orderBy: { recordedAt: 'asc' },
  });
  return rows.map(mapDeadlineHistoryRow);
}

export async function updatePersonalDataBreachIncident(
  id: string,
  input: UpdatePersonalDataBreachIncidentInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await getOrThrow(id);

  // discoveredAt is intentionally absent from update schema / never patched here.
  if (input.severeHarmAssessment === 'severe_harm_likely') {
    requireHumanConfirmation(
      input.humanConfirmation,
      'humanConfirmation required to mark severe harm likely',
    );
    if (existing.incidentKind !== PersonalDataBreachIncidentKind.personal_data_breach) {
      throw new AppError(
        400,
        'NOT_A_PERSONAL_DATA_BREACH',
        'Severe-harm Art.20 clocks apply only to personal_data_breach incidents',
      );
    }
  }

  const dataSubjectRequiredFlag = dataSubjectRequiredFromUpdate(input);
  const makingNotificationsRequired =
    dataSubjectRequiredFlag === true || input.authorityNotificationRequired === true;
  if (makingNotificationsRequired) {
    requireHumanConfirmation(
      input.humanConfirmation,
      'humanConfirmation required to mark notifications required',
    );
  }

  let dataSubjectDue = existing.dataSubjectNotificationDueAt;
  let authorityDue = existing.authorityNotificationDueAt;
  let dataSubjectRequired = existing.dataSubjectNotificationRequired;
  let authorityRequired = existing.authorityNotificationRequired;
  let dataSubjectStatus = existing.dataSubjectNotificationStatus;
  let authorityStatus = existing.authorityNotificationStatus;
  let legalAssessment = existing.legalNotificationAssessment;
  let workflowStatus = existing.workflowStatus;

  const nextSevere =
    (input.severeHarmAssessment as SevereHarmAssessmentStatus | undefined) ??
    existing.severeHarmAssessment;

  let severeHarmDeadlinesApplied = false;
  let severeHarmDiscovery: Date | null = null;

  if (input.severeHarmAssessment === 'severe_harm_likely') {
    const discovery = effectiveBreachDiscoveryAt({
      discoveredAt: existing.discoveredAt,
      correctedDiscoveryAt: existing.correctedDiscoveryAt,
    });
    severeHarmDiscovery = discovery;
    const deadlines = computeArticle20NotificationDeadlines(discovery);
    dataSubjectDue = deadlines.dataSubjectNotificationDueAt;
    authorityDue = deadlines.authorityNotificationDueAt;
    dataSubjectRequired = true;
    authorityRequired = true;
    severeHarmDeadlinesApplied = true;
    if (
      dataSubjectStatus === BreachNotificationChannelStatus.not_required ||
      dataSubjectStatus === BreachNotificationChannelStatus.pending_review
    ) {
      dataSubjectStatus = BreachNotificationChannelStatus.required;
    }
    if (
      authorityStatus === BreachNotificationChannelStatus.not_required ||
      authorityStatus === BreachNotificationChannelStatus.pending_review
    ) {
      authorityStatus = BreachNotificationChannelStatus.required;
    }
    legalAssessment = LegalNotificationAssessment.notifiable_pending_confirmation;
    if (
      workflowStatus === PersonalDataBreachWorkflowStatus.reported ||
      workflowStatus === PersonalDataBreachWorkflowStatus.triage ||
      workflowStatus === PersonalDataBreachWorkflowStatus.investigating ||
      workflowStatus === PersonalDataBreachWorkflowStatus.contained ||
      workflowStatus === PersonalDataBreachWorkflowStatus.legal_assessment
    ) {
      workflowStatus = PersonalDataBreachWorkflowStatus.notification_required;
    }
  }

  if (dataSubjectRequiredFlag === true) {
    dataSubjectRequired = true;
    if (dataSubjectStatus === BreachNotificationChannelStatus.not_required) {
      dataSubjectStatus = BreachNotificationChannelStatus.required;
    }
  }
  if (input.authorityNotificationRequired === true) {
    authorityRequired = true;
    if (authorityStatus === BreachNotificationChannelStatus.not_required) {
      authorityStatus = BreachNotificationChannelStatus.required;
    }
  }

  if (input.workflowStatus === 'closed') {
    workflowStatus = PersonalDataBreachWorkflowStatus.closed;
  } else if (input.workflowStatus) {
    workflowStatus = input.workflowStatus as PersonalDataBreachWorkflowStatus;
  }

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      title: input.title ?? undefined,
      internalSummary: input.internalSummary === undefined ? undefined : input.internalSummary,
      workflowStatus,
      occurredAt:
        input.occurredAt === undefined
          ? undefined
          : input.occurredAt
            ? new Date(input.occurredAt)
            : null,
      containedAt:
        input.containedAt === undefined
          ? undefined
          : input.containedAt
            ? new Date(input.containedAt)
            : null,
      closedAt:
        workflowStatus === PersonalDataBreachWorkflowStatus.closed
          ? (existing.closedAt ?? new Date())
          : undefined,
      discoverySource: input.discoverySource === undefined ? undefined : input.discoverySource,
      affectedSystems: input.affectedSystems ?? undefined,
      affectedDataCategories: input.affectedDataCategories ?? undefined,
      affectedDataSubjectCategories: input.affectedDataSubjectCategories ?? undefined,
      estimatedAffectedCount:
        input.estimatedAffectedCount === undefined ? undefined : input.estimatedAffectedCount,
      affectedSubjectRefs: input.affectedSubjectRefs ?? undefined,
      involvesSensitivePersonalData: input.involvesSensitivePersonalData ?? undefined,
      involvesFinancialSensitiveData: input.involvesFinancialSensitiveData ?? undefined,
      involvesKycData: input.involvesKycData ?? undefined,
      involvesCredentialsAuthData: input.involvesCredentialsAuthData ?? undefined,
      dataWasEncrypted: input.dataWasEncrypted === undefined ? undefined : input.dataWasEncrypted,
      encryptionKeysCompromised:
        input.encryptionKeysCompromised === undefined
          ? undefined
          : input.encryptionKeysCompromised,
      sourceMechanismDescription:
        input.sourceMechanismDescription === undefined
          ? undefined
          : input.sourceMechanismDescription,
      containmentActions:
        input.containmentActions === undefined ? undefined : input.containmentActions,
      remediationActions:
        input.remediationActions === undefined ? undefined : input.remediationActions,
      containmentChecklist: input.containmentChecklist ?? undefined,
      likelyConsequences:
        input.likelyConsequences === undefined ? undefined : input.likelyConsequences,
      severeHarmAssessment: nextSevere,
      severeHarmReason: input.severeHarmReason === undefined ? undefined : input.severeHarmReason,
      severeHarmFactorKeys: input.severeHarmFactorKeys ?? undefined,
      legalNotificationAssessment:
        (input.legalNotificationAssessment as LegalNotificationAssessment | undefined) ??
        legalAssessment,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      dataSubjectNotificationRequired: dataSubjectRequired,
      authorityNotificationRequired: authorityRequired,
      dataSubjectNotificationDueAt: dataSubjectDue,
      authorityNotificationDueAt: authorityDue,
      dataSubjectNotificationStatus: dataSubjectStatus,
      authorityNotificationStatus: authorityStatus,
      internalNotes: input.internalNotes === undefined ? undefined : input.internalNotes,
    },
  });

  if (severeHarmDeadlinesApplied && severeHarmDiscovery) {
    await appendDeadlineHistory({
      breachIncidentId: id,
      kind: 'severe_harm_confirmed',
      discoveryAt: severeHarmDiscovery,
      dataSubjectDueAt: dataSubjectDue,
      authorityDueAt: authorityDue,
      reason: 'Severe harm likely confirmed; Article 20 24h/72h clocks set from effective discovery',
      reviewerUserId: actorUserId,
      previousSnapshot: {
        discoveryAt: severeHarmDiscovery.toISOString(),
        dataSubjectNotificationDueAt: existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
        authorityNotificationDueAt: existing.authorityNotificationDueAt?.toISOString() ?? null,
        severeHarmAssessment: existing.severeHarmAssessment,
      },
    });
  }

  await createAuditLog({
    actorUserId,
    action: 'breach.assessment_updated',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      severeHarmAssessment: updated.severeHarmAssessment,
      workflowStatus: updated.workflowStatus,
      dataWasEncrypted: updated.dataWasEncrypted,
      encryptionKeysCompromised: updated.encryptionKeysCompromised,
    },
    req,
  });

  if (input.severeHarmAssessment === 'severe_harm_likely') {
    await createAuditLog({
      actorUserId,
      action: 'breach.severe_harm_confirmed',
      entityType: 'personal_data_breach_incident',
      entityId: id,
      metadata: {
        dataSubjectNotificationDueAt: updated.dataSubjectNotificationDueAt?.toISOString() ?? null,
        customerNotificationDueAt: updated.dataSubjectNotificationDueAt?.toISOString() ?? null,
        authorityNotificationDueAt: updated.authorityNotificationDueAt?.toISOString() ?? null,
        effectiveDiscoveryAt: severeHarmDiscovery?.toISOString() ?? null,
        humanConfirmation: true,
      },
      req,
    });
    await createAuditLog({
      actorUserId,
      action: 'breach.notification_required',
      entityType: 'personal_data_breach_incident',
      entityId: id,
      metadata: {
        dataSubjectNotificationRequired: true,
        customerNotificationRequired: true,
        authorityNotificationRequired: true,
      },
      req,
    });
  }

  if (input.containedAt || input.workflowStatus === 'contained') {
    await createAuditLog({
      actorUserId,
      action: 'breach.contained',
      entityType: 'personal_data_breach_incident',
      entityId: id,
      metadata: { containedAt: updated.containedAt?.toISOString() ?? null },
      req,
    });
  }

  if (workflowStatus === PersonalDataBreachWorkflowStatus.closed) {
    await createAuditLog({
      actorUserId,
      action: 'breach.closed',
      entityType: 'personal_data_breach_incident',
      entityId: id,
      metadata: {
        closedAt: updated.closedAt?.toISOString() ?? null,
        preservedNotificationEvidence: true,
        dataSubjectNoticeSentAt: updated.dataSubjectNoticeSentAt?.toISOString() ?? null,
        customerNoticeSentAt: updated.dataSubjectNoticeSentAt?.toISOString() ?? null,
        authoritySubmittedAt: updated.authoritySubmittedAt?.toISOString() ?? null,
      },
      req,
    });
  }

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/**
 * Authorised discovery correction — never silently overwrites discoveredAt /
 * initiallyRecordedDiscoveryAt. Recalculates Art.20 deadlines if severe harm already confirmed.
 * Moving effective discovery LATER requires elevated=true (or elevatedLaterCorrection).
 */
export async function correctBreachDiscoveryTime(
  id: string,
  input: CorrectBreachDiscoveryInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
  opts?: { elevated?: boolean },
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  if (!input.reason?.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Correction reason is mandatory');
  }

  const existing = await getOrThrow(id);
  const corrected = new Date(input.correctedDiscoveryAt);
  if (Number.isNaN(corrected.getTime())) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Invalid correctedDiscoveryAt');
  }

  const currentEffective = effectiveBreachDiscoveryAt({
    discoveredAt: existing.discoveredAt,
    correctedDiscoveryAt: existing.correctedDiscoveryAt,
  });

  const elevated =
    opts?.elevated === true || input.elevatedLaterCorrection === true;
  if (corrected.getTime() > currentEffective.getTime() && !elevated) {
    throw new AppError(
      403,
      'NEED_ELEVATED_DISCOVERY_CORRECTION',
      'Moving effective discovery later extends Article 20 clocks and requires elevated approval',
    );
  }

  const previousSnapshot = {
    discoveryAt: currentEffective.toISOString(),
    discoveredAtImmutable: existing.discoveredAt.toISOString(),
    initiallyRecordedDiscoveryAt: existing.initiallyRecordedDiscoveryAt.toISOString(),
    previousCorrectedDiscoveryAt: existing.correctedDiscoveryAt?.toISOString() ?? null,
    dataSubjectNotificationDueAt: existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
    authorityNotificationDueAt: existing.authorityNotificationDueAt?.toISOString() ?? null,
  };

  let dataSubjectDue = existing.dataSubjectNotificationDueAt;
  let authorityDue = existing.authorityNotificationDueAt;
  if (isSevereHarmConfirmed(existing.severeHarmAssessment)) {
    const deadlines = computeArticle20NotificationDeadlines(corrected);
    dataSubjectDue = deadlines.dataSubjectNotificationDueAt;
    authorityDue = deadlines.authorityNotificationDueAt;
  }

  const reviewedAt = new Date();
  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      // discoveredAt + initiallyRecordedDiscoveryAt intentionally untouched
      correctedDiscoveryAt: corrected,
      discoveryCorrectionReason: input.reason,
      discoveryCorrectionReviewedByUserId: actorUserId,
      discoveryCorrectionReviewedAt: reviewedAt,
      dataSubjectNotificationDueAt: dataSubjectDue,
      authorityNotificationDueAt: authorityDue,
      reviewedByUserId: actorUserId,
      reviewedAt,
    },
  });

  await appendDeadlineHistory({
    breachIncidentId: id,
    kind: 'discovery_correction',
    discoveryAt: corrected,
    dataSubjectDueAt: dataSubjectDue,
    authorityDueAt: authorityDue,
    reason: input.reason,
    reviewerUserId: actorUserId,
    previousSnapshot,
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.discovery_recorded',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      correction: true,
      elevatedLaterCorrection: elevated,
      discoveredAtUnchanged: existing.discoveredAt.toISOString(),
      initiallyRecordedDiscoveryAt: existing.initiallyRecordedDiscoveryAt.toISOString(),
      previousEffectiveDiscoveryAt: currentEffective.toISOString(),
      correctedDiscoveryAt: corrected.toISOString(),
      reasonLength: input.reason.length,
      deadlinesRecalculated: isSevereHarmConfirmed(existing.severeHarmAssessment),
      dataSubjectNotificationDueAt: dataSubjectDue?.toISOString() ?? null,
      authorityNotificationDueAt: authorityDue?.toISOString() ?? null,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/**
 * Reopen a closed incident for reassessment. Does NOT reset discovery or Art.20 dues;
 * clocks remain anchored to effective discovery.
 */
export async function reopenPersonalDataBreachIncident(
  id: string,
  input: ReopenPersonalDataBreachIncidentInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  const existing = await getOrThrow(id);

  if (existing.workflowStatus !== PersonalDataBreachWorkflowStatus.closed) {
    throw new AppError(
      400,
      'NOT_CLOSED',
      'Only closed incidents can be reopened for reassessment',
    );
  }

  const nextStatus =
    (input.nextWorkflowStatus as PersonalDataBreachWorkflowStatus | undefined) ??
    PersonalDataBreachWorkflowStatus.legal_assessment;

  const historyEntry: AssessmentHistoryEntry = {
    at: new Date().toISOString(),
    byUserId: actorUserId,
    reason: input.reason,
    previousSevereHarmAssessment: existing.severeHarmAssessment,
    previousLegalNotificationAssessment: existing.legalNotificationAssessment,
    previousWorkflowStatus: existing.workflowStatus,
    previousDataSubjectNotificationRequired: existing.dataSubjectNotificationRequired,
    previousAuthorityNotificationRequired: existing.authorityNotificationRequired,
    previousDataSubjectNotificationDueAt:
      existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
    previousAuthorityNotificationDueAt: existing.authorityNotificationDueAt?.toISOString() ?? null,
  };

  const priorHistory = asAssessmentHistory(existing.assessmentHistory);

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      workflowStatus: nextStatus,
      closedAt: null,
      assessmentHistory: [...priorHistory, historyEntry] as Prisma.InputJsonValue,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
      // Intentionally do NOT touch discoveredAt, correctedDiscoveryAt, or Art.20 dues
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.reopened',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      previousWorkflowStatus: existing.workflowStatus,
      nextWorkflowStatus: nextStatus,
      reasonLength: input.reason.length,
      discoveryUnchanged: true,
      art20DeadlinesUnchanged: true,
      effectiveDiscoveryAt: effectiveBreachDiscoveryAt({
        discoveredAt: existing.discoveredAt,
        correctedDiscoveryAt: existing.correctedDiscoveryAt,
      }).toISOString(),
      dataSubjectNotificationDueAt: existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
      authorityNotificationDueAt: existing.authorityNotificationDueAt?.toISOString() ?? null,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

export async function addRecipientNotice(
  incidentId: string,
  input: AddBreachRecipientNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  await getOrThrow(incidentId);

  if (!input.userId && !input.ownerProfileId && !input.externalRef) {
    throw new AppError(
      400,
      'RECIPIENT_REF_REQUIRED',
      'Provide userId, ownerProfileId, or minimal externalRef',
    );
  }

  const created = await prisma.personalDataBreachRecipientNotice.create({
    data: {
      breachIncidentId: incidentId,
      subjectCategory: input.subjectCategory as BreachDataSubjectCategoryLabel,
      userId: input.userId ?? null,
      ownerProfileId: input.ownerProfileId ?? null,
      externalRef: input.externalRef ?? null,
      contactChannel: input.contactChannel ?? 'email',
      state: BreachRecipientNoticeState.pending,
      actorUserId,
    },
  });

  const updatedIncident = await recomputeAndPersistDataSubjectAggregateStatus(incidentId);

  await createAuditLog({
    actorUserId,
    action: 'breach.recipient_notice_added',
    entityType: 'personal_data_breach_recipient_notice',
    entityId: created.id,
    metadata: {
      breachIncidentId: incidentId,
      subjectCategory: created.subjectCategory,
      hasUserId: !!created.userId,
      hasOwnerProfileId: !!created.ownerProfileId,
      hasExternalRef: !!created.externalRef,
      contactChannel: created.contactChannel,
      aggregateStatus: updatedIncident.dataSubjectNotificationStatus,
      // Never log contact payloads / KYC
    },
    req,
  });

  const notices = await prisma.personalDataBreachRecipientNotice.findMany({
    where: { breachIncidentId: incidentId },
    orderBy: { createdAt: 'asc' },
  });
  return {
    notice: mapRecipientNotice(created),
    incident: mapIncident(updatedIncident, {
      includeSensitiveDetail: true,
      includeAffectedRefs: true,
      recipientNotices: notices,
    }),
  };
}

export async function updateRecipientNoticeState(
  incidentId: string,
  noticeId: string,
  input: UpdateBreachRecipientNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.personalDataBreachRecipientNotice.findUnique({
    where: { id: noticeId },
  });
  if (!existing || existing.breachIncidentId !== incidentId) {
    throw new AppError(404, 'NOT_FOUND', 'Recipient notice not found');
  }

  const nextState = input.state as BreachRecipientNoticeState;
  const emailBlocker = emailProviderBlockerMessage();
  const now = new Date();

  // EMAIL_PROVIDER=none: cannot claim automated delivery; force manual follow-up path.
  let resolvedState = nextState;
  if (
    (nextState === BreachRecipientNoticeState.sent ||
      nextState === BreachRecipientNoticeState.delivery_confirmed ||
      nextState === BreachRecipientNoticeState.attempted) &&
    emailBlocker &&
    existing.contactChannel === 'email'
  ) {
    if (nextState === BreachRecipientNoticeState.attempted) {
      // attempted != sent — record attempt then require manual follow-up
      resolvedState = BreachRecipientNoticeState.manual_followup_required;
    } else if (
      nextState === BreachRecipientNoticeState.sent ||
      nextState === BreachRecipientNoticeState.delivery_confirmed
    ) {
      requireHumanConfirmation(
        input.humanConfirmation,
        'humanConfirmation required to record sent/delivery when EMAIL_PROVIDER=none (manual channel evidence)',
      );
      if (!input.fallbackManualStatus && !input.humanConfirmation) {
        resolvedState = BreachRecipientNoticeState.manual_followup_required;
      }
    }
  }

  // Keep FAILED distinct; aggregate must not show fully notified when any failed.
  if (nextState === BreachRecipientNoticeState.failed) {
    resolvedState = BreachRecipientNoticeState.failed;
  }

  const data: Prisma.PersonalDataBreachRecipientNoticeUncheckedUpdateInput = {
    state: resolvedState,
    actorUserId,
    failureCategory:
      input.failureCategory === undefined ? undefined : input.failureCategory,
    fallbackManualStatus:
      input.fallbackManualStatus === undefined ? undefined : input.fallbackManualStatus,
    contentHash: input.contentHash === undefined ? undefined : input.contentHash,
  };

  if (resolvedState === BreachRecipientNoticeState.prepared) {
    data.preparedAt = now;
  }
  if (resolvedState === BreachRecipientNoticeState.approved) {
    data.approvedAt = now;
  }
  if (
    resolvedState === BreachRecipientNoticeState.attempted ||
    (nextState === BreachRecipientNoticeState.attempted &&
      resolvedState === BreachRecipientNoticeState.manual_followup_required)
  ) {
    data.attemptedAt = now;
    // Do NOT set sentAt — attempted != sent
  }
  if (
    resolvedState === BreachRecipientNoticeState.sent ||
    resolvedState === BreachRecipientNoticeState.delivery_confirmed
  ) {
    data.sentAt = existing.sentAt ?? now;
    if (resolvedState === BreachRecipientNoticeState.delivery_confirmed) {
      data.deliveryState = 'confirmed';
    }
  }
  if (
    nextState === BreachRecipientNoticeState.failed ||
    resolvedState === BreachRecipientNoticeState.manual_followup_required
  ) {
    data.failedAt = existing.failedAt ?? now;
    if (nextState === BreachRecipientNoticeState.failed && !input.failureCategory) {
      data.failureCategory = emailBlocker ? 'email_provider_unavailable' : 'send_failed';
    }
    if (emailBlocker && !input.fallbackManualStatus) {
      data.fallbackManualStatus = 'MANUAL_FOLLOWUP_REQUIRED';
    }
  }

  const updatedNotice = await prisma.personalDataBreachRecipientNotice.update({
    where: { id: noticeId },
    data,
  });

  const updatedIncident = await recomputeAndPersistDataSubjectAggregateStatus(
    existing.breachIncidentId,
  );

  await createAuditLog({
    actorUserId,
    action: 'breach.recipient_notice_state_updated',
    entityType: 'personal_data_breach_recipient_notice',
    entityId: noticeId,
    metadata: {
      breachIncidentId: existing.breachIncidentId,
      previousState: existing.state,
      requestedState: nextState,
      resolvedState,
      attemptedIsNotSent: true,
      emailProviderBlocker: emailBlocker,
      aggregateStatus: updatedIncident.dataSubjectNotificationStatus,
    },
    req,
  });

  const notices = await prisma.personalDataBreachRecipientNotice.findMany({
    where: { breachIncidentId: existing.breachIncidentId },
    orderBy: { createdAt: 'asc' },
  });

  return {
    notice: mapRecipientNotice(updatedNotice),
    incident: mapIncident(updatedIncident, {
      includeSensitiveDetail: true,
      includeAffectedRefs: true,
      recipientNotices: notices,
    }),
    emailProviderBlocker: emailBlocker,
  };
}

export async function prepareBreachDataSubjectNotice(
  id: string,
  input: PrepareBreachDataSubjectNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await getOrThrow(id);
  if (
    !isSevereHarmConfirmed(existing.severeHarmAssessment) &&
    !existing.dataSubjectNotificationRequired
  ) {
    throw new AppError(
      400,
      'NOTICE_NOT_APPLICABLE',
      'Data-subject notice pack requires severe-harm confirmation or dataSubjectNotificationRequired',
    );
  }

  const discovery = effectiveBreachDiscoveryAt({
    discoveredAt: existing.discoveredAt,
    correctedDiscoveryAt: existing.correctedDiscoveryAt,
  });
  const drafts = buildDataSubjectBreachNoticeDrafts({
    discoveredAtIso: discovery.toISOString(),
    noticeAtIso: new Date().toISOString(),
    whatHappenedEn: input.whatHappenedEn,
    whatHappenedAr: input.whatHappenedAr,
    affectedCategoriesEn: input.affectedCategoriesEn,
    affectedCategoriesAr: input.affectedCategoriesAr,
    likelyConsequencesEn: input.likelyConsequencesEn,
    likelyConsequencesAr: input.likelyConsequencesAr,
    actionsTakenEn: input.actionsTakenEn,
    actionsTakenAr: input.actionsTakenAr,
    practicalMeasuresEn: input.practicalMeasuresEn,
    practicalMeasuresAr: input.practicalMeasuresAr,
    privacyContactLabelEn: BREACH_PRIVACY_CONTACT_UNRESOLVED.en,
    privacyContactLabelAr: BREACH_PRIVACY_CONTACT_UNRESOLVED.ar,
  });
  const contentHash = hashNoticeDraft(drafts);

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      dataSubjectNoticeDraftJson: drafts,
      dataSubjectNoticeContentHash: contentHash,
      dataSubjectNotificationStatus: BreachNotificationChannelStatus.prepared,
      // Draft !== sent
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.assessment_updated',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      dataSubjectNoticePrepared: true,
      customerNoticePrepared: true,
      contentHash,
      status: 'prepared',
      sent: false,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/** @deprecated Use prepareBreachDataSubjectNotice */
export async function prepareBreachCustomerNotice(
  id: string,
  input: PrepareBreachCustomerNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  return prepareBreachDataSubjectNotice(id, input, actorUserId, req);
}

export async function approveBreachDataSubjectNotice(
  id: string,
  input: ApproveBreachDataSubjectNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  const existing = await getOrThrow(id);
  if (!existing.dataSubjectNoticeDraftJson || !existing.dataSubjectNoticeContentHash) {
    throw new AppError(400, 'DRAFT_REQUIRED', 'Prepare data-subject notice draft first');
  }

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      dataSubjectNotificationStatus: BreachNotificationChannelStatus.approved_for_send,
      dataSubjectNoticeApprovedAt: new Date(),
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.data_subject_notice_approved',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      contentHash: existing.dataSubjectNoticeContentHash,
      sent: false,
      /** Compatibility */
      customerNoticeApproved: true,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/** @deprecated Use approveBreachDataSubjectNotice */
export async function approveBreachCustomerNotice(
  id: string,
  input: ApproveBreachCustomerNoticeInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  return approveBreachDataSubjectNotice(id, input, actorUserId, req);
}

/**
 * Records that an aggregate data-subject notice send event occurred.
 * Does NOT call email providers to mass-mail real users in this phase.
 * Prefer per-recipient PersonalDataBreachRecipientNotice evidence.
 */
export async function recordBreachDataSubjectNoticeSent(
  id: string,
  input: RecordBreachDataSubjectNoticeSentInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  const existing = await getOrThrow(id);
  if (
    existing.dataSubjectNotificationStatus !== BreachNotificationChannelStatus.approved_for_send
  ) {
    throw new AppError(
      400,
      'APPROVAL_REQUIRED',
      'Data-subject notice must be approved_for_send first',
    );
  }

  const emailCfg = loadEmailConfig();
  if (input.sendMode === 'manual_recorded' && emailCfg.provider === 'none') {
    // Allow recording a manual offline send, but surface blocker in response mapping.
  }

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      dataSubjectNotificationStatus: BreachNotificationChannelStatus.sent,
      dataSubjectNoticeSentAt: new Date(),
      workflowStatus: PersonalDataBreachWorkflowStatus.notification_in_progress,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.data_subject_notice_sent',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      sendMode: input.sendMode,
      contentHash: existing.dataSubjectNoticeContentHash,
      automaticMassEmail: false,
      note: input.note ?? null,
      /** Compatibility */
      customerNoticeSent: true,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/** @deprecated Use recordBreachDataSubjectNoticeSent */
export async function recordBreachCustomerNoticeSent(
  id: string,
  input: RecordBreachCustomerNoticeSentInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  return recordBreachDataSubjectNoticeSent(id, input, actorUserId, req);
}

export async function prepareBreachAuthorityPack(
  id: string,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await getOrThrow(id);
  if (
    !isSevereHarmConfirmed(existing.severeHarmAssessment) &&
    !existing.authorityNotificationRequired
  ) {
    throw new AppError(
      400,
      'PACK_NOT_APPLICABLE',
      'Authority pack requires severe-harm confirmation or authorityNotificationRequired',
    );
  }

  const discovery = effectiveBreachDiscoveryAt({
    discoveredAt: existing.discoveredAt,
    correctedDiscoveryAt: existing.correctedDiscoveryAt,
  });
  const pack = buildAuthorityBreachNotificationPack({
    title: existing.title,
    discoveryAtIso: discovery.toISOString(),
    sourceOfBreach: existing.discoverySource ?? existing.sourceMechanismDescription ?? 'unknown',
    mechanismOfBreach: existing.sourceMechanismDescription ?? 'See containment notes',
    affectedDataSubjectsSummary: [
      `categories=${asStringArray(existing.affectedDataSubjectCategories).join(',') || 'unspecified'}`,
      `estimatedCount=${existing.estimatedAffectedCount ?? 'unknown'}`,
      `refCount=${Array.isArray(existing.affectedSubjectRefs) ? existing.affectedSubjectRefs.length : 0}`,
    ].join('; '),
    affectedDataCategories: asStringArray(existing.affectedDataCategories),
    estimatedAffectedCount: existing.estimatedAffectedCount,
    containmentRemediationSummary:
      [existing.containmentActions ?? '', existing.remediationActions ?? '']
        .filter(Boolean)
        .join('\n') || 'See incident record',
    otherRelevantInformation: existing.likelyConsequences ?? '',
    dataSubjectNotificationDueAtIso:
      existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
    customerNotificationDueAtIso: existing.dataSubjectNotificationDueAt?.toISOString() ?? null,
    authorityNotificationDueAtIso: existing.authorityNotificationDueAt?.toISOString() ?? null,
  });

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      authorityPackJson: pack,
      authorityNotificationStatus: BreachNotificationChannelStatus.prepared,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.assessment_updated',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      authorityPackPrepared: true,
      statusEn: pack.statusEn,
      submitted: false,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

export async function approveBreachAuthorityPack(
  id: string,
  input: ApproveBreachAuthorityPackInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  const existing = await getOrThrow(id);
  if (!existing.authorityPackJson) {
    throw new AppError(400, 'PACK_REQUIRED', 'Prepare authority pack first');
  }

  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      authorityNotificationStatus: BreachNotificationChannelStatus.approved_for_send,
      authorityPackApprovedAt: new Date(),
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.authority_pack_approved',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      statusEn: 'HUMAN_SUBMISSION_REQUIRED',
      automaticSubmission: false,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/**
 * Records human regulator submission evidence. Never auto-submits to government.
 */
export async function recordBreachAuthoritySubmission(
  id: string,
  input: RecordBreachAuthoritySubmissionInput,
  actorUserId: string,
  req?: AuthenticatedRequest,
) {
  requireHumanConfirmation(input.humanConfirmation, 'humanConfirmation required');
  const existing = await getOrThrow(id);
  if (existing.authorityNotificationStatus !== BreachNotificationChannelStatus.approved_for_send) {
    throw new AppError(400, 'APPROVAL_REQUIRED', 'Authority pack must be approved_for_send first');
  }
  if (!input.authoritySubmissionReference.trim()) {
    throw new AppError(400, 'REFERENCE_REQUIRED', 'authoritySubmissionReference is required');
  }

  const submittedAt = new Date(input.authoritySubmittedAt);
  const updated = await prisma.personalDataBreachIncident.update({
    where: { id },
    data: {
      authorityNotificationStatus: BreachNotificationChannelStatus.sent,
      authoritySubmittedAt: submittedAt,
      authoritySubmissionReference: input.authoritySubmissionReference.trim(),
      authoritySubmittedByUserId: actorUserId,
      legalNotificationAssessment: LegalNotificationAssessment.notifiable_confirmed,
      reviewedByUserId: actorUserId,
      reviewedAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId,
    action: 'breach.authority_submission_recorded',
    entityType: 'personal_data_breach_incident',
    entityId: id,
    metadata: {
      authoritySubmittedAt: submittedAt.toISOString(),
      referencePresent: true,
      referenceLength: input.authoritySubmissionReference.trim().length,
      automaticSubmission: false,
      note: input.note ?? null,
    },
    req,
  });

  return mapIncident(updated, { includeSensitiveDetail: true, includeAffectedRefs: true });
}

/** Explicit: there is no automatic government filing function in this module. */
export { BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS } from '@mazare3/shared';

export function assertDraftIsNotSent(status: string): boolean {
  return status === 'prepared' ||
    status === 'approved_for_send' ||
    status === 'approved' ||
    status === 'attempted'
    ? !isBreachNotificationActuallySent(status)
    : true;
}
