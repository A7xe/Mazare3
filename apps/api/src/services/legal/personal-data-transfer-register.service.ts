/**
 * Phase 3C.4B.2C — Article 14 transfer/exchange register.
 * Records disclosure relationships / events — not raw Personal Data copies.
 * Legal sufficiency remains COUNSEL_REVIEW_REQUIRED until counsel approves.
 */
import {
  ARTICLE_14_TRANSFER_REGISTER_LEGAL_SUFFICIENCY,
} from '@mazare3/shared';
import {
  PersonalDataTransferBorderScope,
  PersonalDataTransferRegisterReviewStatus,
  prisma,
} from '@mazare3/db';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

export type CreateTransferRegisterEntryInput = {
  processingActivityKey: string;
  dataCategoryCodes: string[];
  recipientKey: string;
  recipientVerifiedLabel?: string | null;
  purpose: string;
  borderScope?: PersonalDataTransferBorderScope;
  consentPurposeKey?: string | null;
  consentPurposeVersion?: string | null;
  privacyNoticeVersionId?: string | null;
  dataProcessingConsentId?: string | null;
  startedAt?: Date;
  effectiveAt?: Date | null;
  endedAt?: Date | null;
  legalExceptionReference?: string | null;
  notes?: string | null;
  createdByUserId?: string | null;
};

function assertNoRawPayload(codes: string[]) {
  for (const code of codes) {
    if (!code || code.length > 120) {
      throw new AppError(
        400,
        'INVALID_DATA_CATEGORY',
        'Transfer register accepts category codes only — not raw Personal Data',
      );
    }
    if (code.includes('@') || code.includes('PAN') || /\d{8,}/.test(code)) {
      throw new AppError(
        400,
        'INVALID_DATA_CATEGORY',
        'Transfer register must not store raw Personal Data values',
      );
    }
  }
}

export async function createPersonalDataTransferRegisterEntry(
  input: CreateTransferRegisterEntryInput,
  req?: AuthenticatedRequest,
) {
  if (!input.processingActivityKey.trim() || !input.recipientKey.trim() || !input.purpose.trim()) {
    throw new AppError(400, 'INVALID_TRANSFER_REGISTER', 'Missing required transfer register fields');
  }
  if (!input.dataCategoryCodes?.length) {
    throw new AppError(400, 'INVALID_TRANSFER_REGISTER', 'At least one data category code is required');
  }
  assertNoRawPayload(input.dataCategoryCodes);

  const created = await prisma.personalDataTransferRegisterEntry.create({
    data: {
      processingActivityKey: input.processingActivityKey.trim(),
      dataCategoryCodes: input.dataCategoryCodes.map((c) => c.trim()),
      recipientKey: input.recipientKey.trim(),
      recipientVerifiedLabel: input.recipientVerifiedLabel?.trim() || null,
      purpose: input.purpose.trim(),
      borderScope: input.borderScope ?? PersonalDataTransferBorderScope.unknown_pending_review,
      consentPurposeKey: input.consentPurposeKey ?? null,
      consentPurposeVersion: input.consentPurposeVersion ?? null,
      privacyNoticeVersionId: input.privacyNoticeVersionId ?? null,
      dataProcessingConsentId: input.dataProcessingConsentId ?? null,
      startedAt: input.startedAt ?? new Date(),
      effectiveAt: input.effectiveAt ?? null,
      endedAt: input.endedAt ?? null,
      legalExceptionReference: input.legalExceptionReference ?? null,
      reviewStatus: PersonalDataTransferRegisterReviewStatus.recorded,
      legalSufficiencyStatus: ARTICLE_14_TRANSFER_REGISTER_LEGAL_SUFFICIENCY,
      notes: input.notes ?? null,
      createdByUserId: input.createdByUserId ?? null,
    },
  });

  await createAuditLog({
    actorUserId: input.createdByUserId ?? null,
    action: 'privacy.transfer_register.recorded',
    entityType: 'personal_data_transfer_register_entry',
    entityId: created.id,
    metadata: {
      processingActivityKey: created.processingActivityKey,
      recipientKey: created.recipientKey,
      borderScope: created.borderScope,
      legalSufficiencyStatus: created.legalSufficiencyStatus,
      // Never log raw Personal Data.
    },
    req,
  });

  return created;
}

export async function listPersonalDataTransferRegisterEntries(params?: {
  recipientKey?: string;
  reviewStatus?: PersonalDataTransferRegisterReviewStatus;
  take?: number;
}) {
  return prisma.personalDataTransferRegisterEntry.findMany({
    where: {
      ...(params?.recipientKey ? { recipientKey: params.recipientKey } : {}),
      ...(params?.reviewStatus ? { reviewStatus: params.reviewStatus } : {}),
    },
    orderBy: { startedAt: 'desc' },
    take: Math.min(params?.take ?? 100, 500),
  });
}
