import {
  PrivacyConsentPurpose,
  PrivacyConsentStatus,
  prisma,
  type PrivacyConsent,
} from '@mazare3/db';
import type { GrantPrivacyConsentInput, PrivacyConsentPurposeCode } from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

function mapConsent(row: PrivacyConsent) {
  return {
    id: row.id,
    userId: row.userId,
    purposeCode: row.purposeCode,
    consentVersion: row.consentVersion,
    noticeVersionId: row.noticeVersionId,
    status: row.status,
    grantedAt: row.grantedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    sourceSurface: row.sourceSurface,
  };
}

/**
 * Grant purpose-specific consent. Keeps history: if a prior grant exists and is active,
 * withdraw it then create a NEW row (do not erase grant history).
 */
export async function grantConsent(
  userId: string,
  input: GrantPrivacyConsentInput,
  req?: AuthenticatedRequest,
) {
  const purpose = input.purposeCode as PrivacyConsentPurpose;

  const created = await prisma.$transaction(async (tx) => {
    const active = await tx.privacyConsent.findFirst({
      where: {
        userId,
        purposeCode: purpose,
        status: PrivacyConsentStatus.granted,
        withdrawnAt: null,
      },
      orderBy: { grantedAt: 'desc' },
    });
    if (active) {
      await tx.privacyConsent.update({
        where: { id: active.id },
        data: {
          status: PrivacyConsentStatus.withdrawn,
          withdrawnAt: new Date(),
        },
      });
    }

    return tx.privacyConsent.create({
      data: {
        userId,
        purposeCode: purpose,
        consentVersion: input.consentVersion,
        noticeVersionId: input.noticeVersionId ?? null,
        status: PrivacyConsentStatus.granted,
        sourceSurface: input.sourceSurface ?? null,
      },
    });
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'privacy.consent.granted',
    entityType: 'privacy_consent',
    entityId: created.id,
    metadata: { purposeCode: created.purposeCode, consentVersion: created.consentVersion },
    req,
  });

  return mapConsent(created);
}

export async function withdrawConsent(
  userId: string,
  purposeCode: PrivacyConsentPurposeCode | string,
  req?: AuthenticatedRequest,
) {
  const purpose = purposeCode as PrivacyConsentPurpose;
  const active = await prisma.privacyConsent.findFirst({
    where: {
      userId,
      purposeCode: purpose,
      status: PrivacyConsentStatus.granted,
      withdrawnAt: null,
    },
    orderBy: { grantedAt: 'desc' },
  });
  if (!active) {
    throw new AppError(404, 'CONSENT_NOT_FOUND', 'No active consent for that purpose');
  }

  const updated = await prisma.privacyConsent.update({
    where: { id: active.id },
    data: {
      status: PrivacyConsentStatus.withdrawn,
      withdrawnAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'privacy.consent.withdrawn',
    entityType: 'privacy_consent',
    entityId: updated.id,
    metadata: { purposeCode: updated.purposeCode },
    req,
  });

  return mapConsent(updated);
}

export async function listConsentsForUser(userId: string) {
  const rows = await prisma.privacyConsent.findMany({
    where: { userId },
    orderBy: [{ purposeCode: 'asc' }, { grantedAt: 'desc' }],
  });
  return rows.map(mapConsent);
}

export async function getActiveConsents(userId: string) {
  const rows = await prisma.privacyConsent.findMany({
    where: {
      userId,
      status: PrivacyConsentStatus.granted,
      withdrawnAt: null,
    },
    orderBy: { purposeCode: 'asc' },
  });
  return rows.map(mapConsent);
}
