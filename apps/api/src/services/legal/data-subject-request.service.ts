import {
  DataSubjectRequestStatus,
  DataSubjectRequestType,
  prisma,
  type DataSubjectRequest,
} from '@mazare3/db';
import type {
  CreateDataSubjectRequestInput,
  UpdateDataSubjectRequestStatusInput,
} from '@mazare3/shared';
import {
  classifyDsrDeadlineUrgency,
  computeDsrDeadlineFromReceivedAt,
  isDsrOverdue,
  JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES,
} from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

/** Categories retained during erasure (financial/legal evidence). */
export const ERASURE_RETAINED_EVIDENCE_CATEGORIES = [
  'legal_acceptance',
  'booking_legal_snapshot',
  'bookings',
  'payments',
] as const;

/**
 * DSR erasure foundation: prefer anonymize over hard-delete when legal retention applies.
 * Fulfillment is admin-driven via updateDataSubjectRequestStatus.
 */
export function describeErasureFulfillmentPolicy() {
  return {
    strategy: 'anonymize_preferred' as const,
    retainedCategories: ERASURE_RETAINED_EVIDENCE_CATEGORIES,
  };
}

function mapRequest(row: DataSubjectRequest) {
  const receivedAt = row.receivedAt ?? row.createdAt;
  const dueAt = row.dueAt;
  const urgency = classifyDsrDeadlineUrgency({ status: row.status, dueAt });
  const holidayCalendarVerified = JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES.length > 0;
  return {
    id: row.id,
    userId: row.userId,
    email: row.email,
    type: row.type,
    status: row.status,
    description: row.description,
    adminNote: row.adminNote,
    rejectionReason: row.rejectionReason,
    receivedAt: receivedAt.toISOString(),
    dueAt: dueAt?.toISOString() ?? null,
    overdue: isDsrOverdue({ status: row.status, dueAt }),
    urgency,
    holidayCalendarVerified,
    holidayCalendarStatus: holidayCalendarVerified
      ? ('HOLIDAY_CALENDAR_CONFIGURED' as const)
      : ('HOLIDAY_CALENDAR_VERIFICATION_REQUIRED' as const),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    /** Alias for complaint/DSR completion audit surfacing. */
    completedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    handledByUserId: row.handledByUserId,
  };
}

/**
 * Create a Data Subject Request / privacy complaint.
 *
 * Phase 3C.4B.1.5 — Must NOT require Prior Consent. Statutory privacy-rights
 * processing is mapped to ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL.
 * Consent withdrawal must not disable this portal.
 */
export async function createDataSubjectRequest(
  userId: string | null,
  input: CreateDataSubjectRequestInput,
  req?: AuthenticatedRequest,
) {
  if (!userId && !input.email) {
    throw new AppError(400, 'VALIDATION_ERROR', 'email is required when not authenticated');
  }

  // Explicitly do not call assertPriorConsentActive — privacy rights must remain available.

  const userEmail =
    userId != null
      ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))
          ?.email ?? null
      : null;

  const receivedAt = new Date();
  const deadline = computeDsrDeadlineFromReceivedAt(receivedAt);
  const dueAt = deadline.dueAt;

  const created = await prisma.dataSubjectRequest.create({
    data: {
      userId: userId ?? null,
      email: input.email ?? userEmail,
      type: input.type as DataSubjectRequestType,
      status: DataSubjectRequestStatus.requested,
      description: input.description ?? null,
      receivedAt,
      dueAt,
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'privacy.data_subject_request.created',
    entityType: 'data_subject_request',
    entityId: created.id,
    metadata: {
      type: created.type,
      receivedAt: receivedAt.toISOString(),
      dueAt: dueAt.toISOString(),
      dsrWorkingDays: 15,
      holidayCalendarStatus: deadline.holidayCalendarStatus,
      holidayCalendarVerified: deadline.holidayCalendarVerified,
      dueYmdAmman: deadline.dueYmdAmman,
      ...(created.type === DataSubjectRequestType.erasure
        ? { erasurePolicy: describeErasureFulfillmentPolicy() }
        : {}),
      ...(created.type === DataSubjectRequestType.privacy_complaint
        ? {
            complaint: true,
            note: 'privacy_complaint is distinct from privacy_inquiry; does not block contacting the competent Jordanian authority',
          }
        : {}),
    },
    req,
  });

  return mapRequest(created);
}

export async function listDataSubjectRequestsForUser(userId: string) {
  const rows = await prisma.dataSubjectRequest.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(mapRequest);
}

export async function listDataSubjectRequestsAdmin(params?: {
  status?: string;
  overdueOnly?: boolean;
  take?: number;
}) {
  const rows = await prisma.dataSubjectRequest.findMany({
    where: params?.status
      ? { status: params.status as DataSubjectRequestStatus }
      : undefined,
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
    take: params?.take ?? 100,
  });
  const mapped = rows.map(mapRequest);
  if (params?.overdueOnly) {
    return mapped.filter((r) => r.overdue);
  }
  return mapped;
}

export async function countOverdueDataSubjectRequests() {
  const open = await prisma.dataSubjectRequest.findMany({
    where: {
      status: {
        in: [DataSubjectRequestStatus.requested, DataSubjectRequestStatus.under_review],
      },
      dueAt: { lt: new Date() },
    },
    select: { id: true },
  });
  return open.length;
}

export async function updateDataSubjectRequestStatus(
  requestId: string,
  input: UpdateDataSubjectRequestStatusInput,
  handledByUserId: string,
  req?: AuthenticatedRequest,
) {
  const existing = await prisma.dataSubjectRequest.findUnique({ where: { id: requestId } });
  if (!existing) throw new AppError(404, 'NOT_FOUND', 'Data subject request not found');

  if (
    input.status === 'rejected_with_reason' &&
    !(input.rejectionReason ?? existing.rejectionReason)
  ) {
    throw new AppError(400, 'REJECTION_REASON_REQUIRED', 'rejectionReason is required');
  }

  const terminal = ['fulfilled', 'partially_fulfilled', 'rejected_with_reason'].includes(
    input.status,
  );

  const updated = await prisma.dataSubjectRequest.update({
    where: { id: requestId },
    data: {
      status: input.status as DataSubjectRequestStatus,
      adminNote: input.adminNote === undefined ? undefined : input.adminNote,
      rejectionReason:
        input.rejectionReason === undefined ? undefined : input.rejectionReason,
      handledByUserId,
      resolvedAt: terminal ? new Date() : null,
    },
  });

  await createAuditLog({
    actorUserId: handledByUserId,
    action: 'privacy.data_subject_request.status_updated',
    entityType: 'data_subject_request',
    entityId: requestId,
    metadata: {
      status: updated.status,
      type: updated.type,
      completedAt: updated.resolvedAt?.toISOString() ?? null,
      responseNotePresent: Boolean(updated.adminNote),
    },
    req,
  });

  return mapRequest(updated);
}
