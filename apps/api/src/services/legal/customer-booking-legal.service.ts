/**
 * Phase 3C.4E.4A — Customer Booking legal corpus resolution + commitment enforcement.
 *
 * LegalAcceptance ≠ DataProcessingConsent ≠ marketing PrivacyConsent.
 * Never selects DRAFT advisor-final documents as active.
 * Never activates documents.
 */
import {
  LegalAcceptanceContext,
  LegalDocumentType,
  prisma,
  type Prisma,
} from '@mazare3/db';
import { getAppEnv } from '../../config/app-env.js';
import { AppError } from '../../lib/errors.js';
import { createAuditLog } from '../audit.service.js';
import { getActiveVersion } from './legal-document.service.js';
import { recordAcceptance } from './legal-acceptance.service.js';
import {
  createSnapshotForBooking,
  type BookingLegalVersionIds,
} from './booking-legal-snapshot.service.js';
import type { AuthenticatedRequest } from '../../middleware/auth.js';

/** Contractual docs required for NEW Customer Booking commitment when corpus is active. */
export const CUSTOMER_BOOKING_REQUIRED_LEGAL_TYPES = [
  LegalDocumentType.terms_and_conditions,
  LegalDocumentType.cancellation_refund_policy,
  LegalDocumentType.booking_terms,
] as const;

/** UI acceptance presentation key (evidence of which copy was shown). */
export const CUSTOMER_BOOKING_ACCEPTANCE_PRESENTATION_KEY =
  'customer_booking_ack_v1_terms_cancellation_booking_terms' as const;

export type ApplicableCustomerBookingLegalDoc = {
  documentType: LegalDocumentType;
  versionId: string;
  version: string;
  language: string;
  title: string;
  status: string;
  releaseId: string;
};

export type ApplicableCustomerBookingLegalSet = {
  locale: 'ar' | 'en';
  corpusReady: boolean;
  /** True when architecture requires hard fail if corpus incomplete (Production, or local STRICT). */
  enforcementStrict: boolean;
  blockers: string[];
  terms: ApplicableCustomerBookingLegalDoc | null;
  cancellation: ApplicableCustomerBookingLegalDoc | null;
  bookingTerms: ApplicableCustomerBookingLegalDoc | null;
  /** Privacy notice — acknowledgement architecture only; not Prior Consent. */
  privacy: ApplicableCustomerBookingLegalDoc | null;
  acceptancePresentationKey: typeof CUSTOMER_BOOKING_ACCEPTANCE_PRESENTATION_KEY;
};

export type SubmittedBookingLegalIds = {
  terms?: string;
  cancellation?: string;
  bookingTerms?: string;
  privacy?: string;
};

function isStrictEnforcement(): boolean {
  if (getAppEnv() === 'production') return true;
  return process.env.CUSTOMER_BOOKING_LEGAL_STRICT === 'true';
}

async function loadActiveDoc(
  documentType: LegalDocumentType,
  language: 'ar' | 'en',
): Promise<ApplicableCustomerBookingLegalDoc | null> {
  // getActiveVersion already filters status=ACTIVE — never DRAFT fallback.
  const v = await getActiveVersion(documentType, language);
  if (!v) return null;
  return {
    documentType,
    versionId: v.id,
    version: v.version,
    language: v.language,
    title: v.title,
    status: String(v.status),
    releaseId: v.releaseId,
  };
}

/**
 * Server-authoritative resolver for Customer Booking legal corpus.
 * ACTIVE versions only — never DRAFT fallback.
 */
export async function resolveApplicableCustomerBookingLegalSet(
  locale: 'ar' | 'en' = 'ar',
): Promise<ApplicableCustomerBookingLegalSet> {
  const [terms, cancellation, bookingTerms, privacy] = await Promise.all([
    loadActiveDoc(LegalDocumentType.terms_and_conditions, locale),
    loadActiveDoc(LegalDocumentType.cancellation_refund_policy, locale),
    loadActiveDoc(LegalDocumentType.booking_terms, locale),
    loadActiveDoc(LegalDocumentType.privacy_policy, locale),
  ]);

  const blockers: string[] = [];
  if (!terms) blockers.push('CUSTOMER_BOOKING_TERMS_ACTIVE_VERSION_REQUIRED');
  if (!cancellation) blockers.push('CUSTOMER_CANCELLATION_POLICY_ACTIVE_VERSION_REQUIRED');
  if (!bookingTerms) blockers.push('CUSTOMER_BOOKING_TERMS_DOC_ACTIVE_VERSION_REQUIRED');

  const corpusReady = blockers.length === 0;
  const enforcementStrict = isStrictEnforcement();

  return {
    locale,
    corpusReady,
    enforcementStrict,
    blockers,
    terms,
    cancellation,
    bookingTerms,
    privacy,
    acceptancePresentationKey: CUSTOMER_BOOKING_ACCEPTANCE_PRESENTATION_KEY,
  };
}

export function customerBookingLegalUnavailableError(): AppError {
  return new AppError(
    503,
    'CUSTOMER_BOOKING_LEGAL_TERMS_UNAVAILABLE',
    'Booking cannot be completed right now. Please try again later.',
  );
}

/**
 * Validate submitted version IDs against server-resolved ACTIVE set.
 * Client cannot invent versions, use DRAFT, or another Customer's acceptance.
 */
export async function assertCustomerBookingLegalForCommitment(params: {
  userId: string;
  submitted?: SubmittedBookingLegalIds | null;
  locale?: 'ar' | 'en';
}): Promise<ApplicableCustomerBookingLegalSet> {
  const set = await resolveApplicableCustomerBookingLegalSet(params.locale ?? 'ar');

  if (!set.corpusReady) {
    if (set.enforcementStrict) {
      await createAuditLog({
        actorUserId: params.userId,
        action: 'booking.legal_corpus_unavailable',
        entityType: 'user',
        entityId: params.userId,
        metadata: {
          blockers: set.blockers,
          enforcementStrict: true,
        },
      });
      throw customerBookingLegalUnavailableError();
    }
    // Local/dev without ACTIVE corpus: architecture present; do not block all QA.
    return set;
  }

  const submitted = params.submitted ?? {};
  const required: Array<{ key: keyof SubmittedBookingLegalIds; doc: ApplicableCustomerBookingLegalDoc }> =
    [
      { key: 'terms', doc: set.terms! },
      { key: 'cancellation', doc: set.cancellation! },
      { key: 'bookingTerms', doc: set.bookingTerms! },
    ];

  for (const { key, doc } of required) {
    const provided = submitted[key];
    if (!provided) {
      throw new AppError(
        400,
        'CUSTOMER_BOOKING_LEGAL_ACCEPTANCE_REQUIRED',
        'Booking cannot be completed right now. Please try again later.',
        { missing: key },
      );
    }
    if (provided !== doc.versionId) {
      throw new AppError(
        400,
        'CUSTOMER_BOOKING_LEGAL_VERSION_MISMATCH',
        'Booking cannot be completed right now. Please try again later.',
        { field: key },
      );
    }
  }

  if (submitted.privacy && set.privacy && submitted.privacy !== set.privacy.versionId) {
    throw new AppError(
      400,
      'CUSTOMER_BOOKING_LEGAL_VERSION_MISMATCH',
      'Booking cannot be completed right now. Please try again later.',
      { field: 'privacy' },
    );
  }

  return set;
}

export function versionIdsFromLegalSet(
  set: ApplicableCustomerBookingLegalSet,
  submitted?: SubmittedBookingLegalIds | null,
): BookingLegalVersionIds {
  if (!set.corpusReady) {
    return {
      termsVersionId: null,
      cancellationPolicyVersionId: null,
      bookingTermsVersionId: null,
      privacyNoticeVersionId: null,
    };
  }
  return {
    termsVersionId: set.terms!.versionId,
    cancellationPolicyVersionId: set.cancellation!.versionId,
    bookingTermsVersionId: set.bookingTerms!.versionId,
    privacyNoticeVersionId: submitted?.privacy ?? set.privacy?.versionId ?? null,
  };
}

/**
 * Record LegalAcceptance + BookingLegalSnapshot for a NEW Booking.
 * Phase 3C.4E.4A.1 — both must commit in the same TX as Booking creation
 * when corpus is ready (no after-commit acceptance gap).
 */
export async function finalizeCustomerBookingLegalEvidence(params: {
  userId: string;
  bookingId: string;
  legalSet: ApplicableCustomerBookingLegalSet;
  submitted?: SubmittedBookingLegalIds | null;
  commissionPercent: number;
  depositPercent: number;
  req?: AuthenticatedRequest;
  /** Prefer binding snapshot + acceptances to the Booking TX. */
  tx?: Prisma.TransactionClient;
  /**
   * @deprecated Prefer omitting (defaults to `all`). Kept for callers that
   * still pass an explicit phase during transition.
   */
  phase?: 'snapshot' | 'acceptances' | 'all';
}): Promise<void> {
  // Atomic path: always snapshot + acceptances together when using Booking TX.
  const phase = params.phase ?? 'all';
  const { userId, bookingId, legalSet } = params;
  const versionIds = versionIdsFromLegalSet(legalSet, params.submitted);

  if (phase === 'snapshot' || phase === 'all') {
    if (legalSet.corpusReady) {
      await createSnapshotForBooking(bookingId, {
        versionIds,
        locale: legalSet.locale,
        commissionPercent: params.commissionPercent,
        depositPercent: params.depositPercent,
        tx: params.tx,
        requireComplete: true,
      });
      if (!params.tx) {
        await createAuditLog({
          actorUserId: userId,
          action: 'booking.legal_snapshot_created',
          entityType: 'booking',
          entityId: bookingId,
          metadata: {
            acceptancePresentationKey: legalSet.acceptancePresentationKey,
            termsVersionId: versionIds.termsVersionId,
            cancellationPolicyVersionId: versionIds.cancellationPolicyVersionId,
            bookingTermsVersionId: versionIds.bookingTermsVersionId,
            corpusReady: true,
            atomicWithAcceptances: phase === 'all',
          },
          req: params.req,
        });
      }
    } else {
      await createSnapshotForBooking(bookingId, {
        versionIds,
        locale: legalSet.locale,
        commissionPercent: params.commissionPercent,
        depositPercent: params.depositPercent,
        tx: params.tx,
        requireComplete: false,
        allowIncompleteCorpus: true,
      });
      if (!params.tx) {
        await createAuditLog({
          actorUserId: userId,
          action: 'booking.legal_snapshot_incomplete',
          entityType: 'booking',
          entityId: bookingId,
          metadata: {
            blockers: legalSet.blockers,
            note: 'ACTIVE legal corpus not configured — DRAFT not used',
          },
          req: params.req,
        });
      }
    }
  }

  if (phase === 'acceptances' || phase === 'all') {
    if (!legalSet.corpusReady) return;
    const docs: Array<{ versionId: string; surface: string }> = [
      { versionId: legalSet.terms!.versionId, surface: 'booking.create.terms' },
      {
        versionId: legalSet.cancellation!.versionId,
        surface: 'booking.create.cancellation',
      },
      {
        versionId: legalSet.bookingTerms!.versionId,
        surface: 'booking.create.booking_terms',
      },
    ];
    for (const d of docs) {
      await recordAcceptance(
        userId,
        {
          documentVersionId: d.versionId,
          context: LegalAcceptanceContext.checkout,
          relatedBookingId: bookingId,
          sourceSurface: d.surface,
        },
        {
          req: params.req,
          tx: params.tx,
          metadata: {
            acceptancePresentationKey: legalSet.acceptancePresentationKey,
          },
        },
      );
    }
  }
}

/** Public payload for web clients (no secrets). */
export async function getCustomerBookingLegalSetPublic(locale: 'ar' | 'en') {
  const set = await resolveApplicableCustomerBookingLegalSet(locale);
  return {
    corpusReady: set.corpusReady,
    enforcementStrict: set.enforcementStrict,
    blockers: set.blockers,
    acceptancePresentationKey: set.acceptancePresentationKey,
    documents: {
      terms: set.terms
        ? {
            versionId: set.terms.versionId,
            version: set.terms.version,
            title: set.terms.title,
            language: set.terms.language,
          }
        : null,
      cancellation: set.cancellation
        ? {
            versionId: set.cancellation.versionId,
            version: set.cancellation.version,
            title: set.cancellation.title,
            language: set.cancellation.language,
          }
        : null,
      bookingTerms: set.bookingTerms
        ? {
            versionId: set.bookingTerms.versionId,
            version: set.bookingTerms.version,
            title: set.bookingTerms.title,
            language: set.bookingTerms.language,
          }
        : null,
      privacy: set.privacy
        ? {
            versionId: set.privacy.versionId,
            version: set.privacy.version,
            title: set.privacy.title,
            language: set.privacy.language,
          }
        : null,
    },
  };
}
