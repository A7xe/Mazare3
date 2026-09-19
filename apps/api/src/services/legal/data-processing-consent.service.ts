/**
 * Phase 3C.4B.1.4 — Jordan Prior Consent (DataProcessingConsent) service.
 * Distinct from optional PrivacyConsent and LegalAcceptance (Terms / Privacy notice).
 * Never fabricates consent for existing users. Admin cannot grant on behalf of Data Subject.
 */

import { createHash } from 'node:crypto';
import {
  DataProcessingConsentPurpose,
  DataProcessingConsentStatus,
  prisma,
  type DataProcessingConsent,
} from '@mazare3/db';
import {
  CONSENT_VALIDITY_STATES,
  DATA_PROCESSING_CONSENT_CORPUS_VERSION,
  DATA_PROCESSING_CONSENT_PURPOSES,
  consentTextFingerprintInput,
  getDataProcessingConsentPurposeDef,
  isRuntimePriorConsentGatedPurpose,
  type ConsentValidityStateCode,
  type DataProcessingConsentPurposeCode,
  type GrantDataProcessingConsentInput,
} from '@mazare3/shared';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

function hashConsentText(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

function mapRow(row: DataProcessingConsent) {
  return {
    id: row.id,
    userId: row.userId,
    purposeKey: row.purposeKey,
    purposeVersion: row.purposeVersion,
    language: row.language,
    consentTextHash: row.consentTextHash,
    status: row.status,
    grantedAt: row.grantedAt.toISOString(),
    withdrawnAt: row.withdrawnAt?.toISOString() ?? null,
    supersededAt: row.supersededAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    durationStatus: row.durationStatus,
    validityEvent: row.validityEvent,
    sourceSurface: row.sourceSurface,
    relatedEntityType: row.relatedEntityType,
    relatedEntityId: row.relatedEntityId,
    privacyNoticeVersionId: row.privacyNoticeVersionId,
  };
}

export function evaluateConsentValidity(
  row: DataProcessingConsent | null,
  purposeKey: DataProcessingConsentPurposeCode,
): ConsentValidityStateCode {
  if (!row) return 'MISSING_PRIOR_CONSENT';
  if (row.status === DataProcessingConsentStatus.withdrawn || row.withdrawnAt) {
    return 'WITHDRAWN';
  }
  if (row.status === DataProcessingConsentStatus.superseded || row.supersededAt) {
    return 'SUPERSEDED';
  }
  if (row.status === DataProcessingConsentStatus.expired) {
    return 'EXPIRED';
  }
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return 'EXPIRED';
  }
  if (row.purposeVersion !== DATA_PROCESSING_CONSENT_CORPUS_VERSION) {
    return 'RECONSENT_REQUIRED';
  }
  const def = getDataProcessingConsentPurposeDef(purposeKey);
  if (!def) return 'RECONSENT_REQUIRED';
  const lang = row.language === 'en' ? 'en' : 'ar';
  const expectedText = lang === 'en' ? def.consentTextEn : def.consentTextAr;
  const expectedHash = hashConsentText(
    consentTextFingerprintInput({
      purposeKey,
      language: lang,
      consentText: expectedText,
    }),
  );
  if (row.consentTextHash !== expectedHash) {
    return 'RECONSENT_REQUIRED';
  }
  if (row.status === DataProcessingConsentStatus.granted) {
    return 'CONSENT_STILL_VALID';
  }
  return 'MISSING_PRIOR_CONSENT';
}

export async function getActiveConsentRow(
  userId: string,
  purposeKey: DataProcessingConsentPurposeCode,
) {
  return prisma.dataProcessingConsent.findFirst({
    where: {
      userId,
      purposeKey: purposeKey as DataProcessingConsentPurpose,
      status: DataProcessingConsentStatus.granted,
      withdrawnAt: null,
      supersededAt: null,
    },
    orderBy: { grantedAt: 'desc' },
  });
}

export async function getPurposeValidity(
  userId: string,
  purposeKey: DataProcessingConsentPurposeCode,
): Promise<{
  purposeKey: DataProcessingConsentPurposeCode;
  validity: ConsentValidityStateCode;
  active: ReturnType<typeof mapRow> | null;
  durationStatus: string;
}> {
  const row = await getActiveConsentRow(userId, purposeKey);
  const validity = evaluateConsentValidity(row, purposeKey);
  const def = getDataProcessingConsentPurposeDef(purposeKey);
  return {
    purposeKey,
    validity,
    active: row && validity === 'CONSENT_STILL_VALID' ? mapRow(row) : null,
    durationStatus: row?.durationStatus ?? def?.durationStatus ?? 'DURATION_REQUIRES_LEGAL_REVIEW',
  };
}

export async function listPriorConsentStatusForUser(userId: string) {
  const purposes = [...DATA_PROCESSING_CONSENT_PURPOSES];
  const results = await Promise.all(purposes.map((p) => getPurposeValidity(userId, p)));
  return {
    corpusVersion: DATA_PROCESSING_CONSENT_CORPUS_VERSION,
    purposes: results,
  };
}

export async function listPriorConsentHistoryForUser(userId: string) {
  const rows = await prisma.dataProcessingConsent.findMany({
    where: { userId },
    orderBy: { grantedAt: 'desc' },
  });
  return rows.map(mapRow);
}

/**
 * Grant Prior Consent. Append-only history: previous active grant is superseded (not erased).
 * Requires explicitConsent === true. Never called by admin impersonation paths.
 */
export async function grantDataProcessingConsent(
  userId: string,
  input: GrantDataProcessingConsentInput,
  req?: AuthenticatedRequest,
) {
  if (input.explicitConsent !== true) {
    throw new AppError(400, 'EXPLICIT_CONSENT_REQUIRED', 'Prior Consent must be explicit');
  }

  const def = getDataProcessingConsentPurposeDef(input.purposeKey);
  if (!def) {
    throw new AppError(400, 'UNKNOWN_PURPOSE', 'Unknown Prior Consent purpose');
  }

  /**
   * Phase 3C.4D.7B — do not collect suspended / counsel-reclassified purposes
   * (prevents blanket Owner marketplace Prior Consent checkbox evidence).
   */
  if (!def.runtimeGateRequired) {
    throw new AppError(
      400,
      'PURPOSE_COLLECTION_SUSPENDED_COUNSEL_REVIEW',
      `Prior Consent collection for purpose ${input.purposeKey} is suspended pending counsel reclassification`,
      { purposeKey: input.purposeKey, classification: def.legalBasisStatus },
    );
  }

  const language = input.language === 'en' ? 'en' : 'ar';
  const consentText = language === 'en' ? def.consentTextEn : def.consentTextAr;
  const purposeVersion = DATA_PROCESSING_CONSENT_CORPUS_VERSION;
  const consentTextHash = hashConsentText(
    consentTextFingerprintInput({
      purposeKey: input.purposeKey,
      language,
      consentText,
      corpusVersion: purposeVersion,
    }),
  );

  const created = await prisma.$transaction(async (tx) => {
    const active = await tx.dataProcessingConsent.findMany({
      where: {
        userId,
        purposeKey: input.purposeKey as DataProcessingConsentPurpose,
        status: DataProcessingConsentStatus.granted,
        withdrawnAt: null,
        supersededAt: null,
      },
    });
    const now = new Date();
    for (const prev of active) {
      await tx.dataProcessingConsent.update({
        where: { id: prev.id },
        data: {
          status: DataProcessingConsentStatus.superseded,
          supersededAt: now,
        },
      });
    }

    return tx.dataProcessingConsent.create({
      data: {
        userId,
        purposeKey: input.purposeKey as DataProcessingConsentPurpose,
        purposeVersion,
        language,
        consentText,
        consentTextHash,
        status: DataProcessingConsentStatus.granted,
        durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
        validityEvent: null,
        expiresAt: null,
        sourceSurface: input.sourceSurface ?? null,
        relatedEntityType: input.relatedEntityType ?? null,
        relatedEntityId: input.relatedEntityId ?? null,
        privacyNoticeVersionId: input.privacyNoticeVersionId ?? null,
        metadata: {
          corpusVersion: purposeVersion,
          withdrawalEffectStatus: def.withdrawalEffectStatus,
          ...(input.privacyNoticeVersionId
            ? { recipientDisclosureLinkedToPrivacyNotice: true }
            : {}),
        },
      },
    });
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'privacy.prior_consent.granted',
    entityType: 'data_processing_consent',
    entityId: created.id,
    metadata: {
      purposeKey: created.purposeKey,
      purposeVersion: created.purposeVersion,
      consentTextHash: created.consentTextHash,
      language: created.language,
    },
    req,
  });

  return mapRow(created);
}

export async function withdrawDataProcessingConsent(
  userId: string,
  purposeKey: DataProcessingConsentPurposeCode | string,
  req?: AuthenticatedRequest,
) {
  const purpose = purposeKey as DataProcessingConsentPurposeCode;
  if (!DATA_PROCESSING_CONSENT_PURPOSES.includes(purpose)) {
    throw new AppError(400, 'UNKNOWN_PURPOSE', 'Unknown Prior Consent purpose');
  }

  const active = await getActiveConsentRow(userId, purpose);
  if (!active) {
    throw new AppError(404, 'CONSENT_NOT_FOUND', 'No active Prior Consent for that purpose');
  }

  const updated = await prisma.dataProcessingConsent.update({
    where: { id: active.id },
    data: {
      status: DataProcessingConsentStatus.withdrawn,
      withdrawnAt: new Date(),
    },
  });

  await createAuditLog({
    actorUserId: userId,
    action: 'privacy.prior_consent.withdrawn',
    entityType: 'data_processing_consent',
    entityId: updated.id,
    metadata: {
      purposeKey: updated.purposeKey,
      note: 'Stops future consent-dependent processing; does not erase Booking/payment legal evidence',
    },
    req,
  });

  return mapRow(updated);
}

/** Gate: require CONSENT_STILL_VALID for a purpose before new processing. */
export async function assertPriorConsentActive(
  userId: string,
  purposeKey: DataProcessingConsentPurposeCode,
) {
  if (!isRuntimePriorConsentGatedPurpose(purposeKey)) {
    throw new AppError(
      500,
      'PRIOR_CONSENT_GATE_MISCONFIGURED',
      `Purpose ${purposeKey} is not a runtime Prior Consent gate (3C.4D.7B)`,
      { purposeKey },
    );
  }

  const { validity } = await getPurposeValidity(userId, purposeKey);
  if (validity === 'CONSENT_STILL_VALID') return;

  const code =
    validity === 'RECONSENT_REQUIRED'
      ? 'RECONSENT_REQUIRED'
      : validity === 'WITHDRAWN'
        ? 'PRIOR_CONSENT_WITHDRAWN'
        : validity === 'EXPIRED'
          ? 'PRIOR_CONSENT_EXPIRED'
          : 'MISSING_PRIOR_CONSENT';

  throw new AppError(
    403,
    code,
    `Prior Consent required for purpose ${purposeKey} (status: ${validity})`,
    { purposeKey, validity },
  );
}

/**
 * Phase 3C.4D.7B — purpose-aware Prior Consent gate.
 * ONLY for purposes that actually require Prior Consent (not LegalAcceptance).
 */
export async function assertProcessingConsent(params: {
  userId: string;
  purpose: DataProcessingConsentPurposeCode;
  context?: string;
}) {
  await assertPriorConsentActive(params.userId, params.purpose);
}

export async function assertPriorConsentsActive(
  userId: string,
  purposeKeys: DataProcessingConsentPurposeCode[],
) {
  for (const key of purposeKeys) {
    await assertPriorConsentActive(userId, key);
  }
}

/** Admin aggregate readiness — no Personal Data, no grant capability. */
export async function getPriorConsentAdminReadiness() {
  const byPurposeStatus = await prisma.dataProcessingConsent.groupBy({
    by: ['purposeKey', 'status'],
    _count: true,
  });
  const purposeDefs = DATA_PROCESSING_CONSENT_PURPOSES.map((purposeKey) => {
    const def = getDataProcessingConsentPurposeDef(purposeKey)!;
    return {
      purposeKey,
      nameEn: def.nameEn,
      legalBasisStatus: def.legalBasisStatus,
      durationStatus: def.durationStatus,
      withdrawalEffectStatus: def.withdrawalEffectStatus,
      runtimeGateRequired: def.runtimeGateRequired,
      corpusVersion: DATA_PROCESSING_CONSENT_CORPUS_VERSION,
      collectionPoints: def.collectionPoints,
    };
  });

  return {
    corpusVersion: DATA_PROCESSING_CONSENT_CORPUS_VERSION,
    adminCannotGrantConsent: true as const,
    purposeDefs,
    countsByPurposeStatus: byPurposeStatus.map((r) => ({
      purposeKey: r.purposeKey,
      status: r.status,
      count: r._count,
    })),
    validityStatesSupported: [...CONSENT_VALIDITY_STATES],
  };
}
