import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_FREE,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  STANDARD_COMMISSION_PERCENT,
} from './marketplace-financial-policy';
import { sha256Hex } from './sha256';

/** Phase 3B — legal document taxonomy (mirrors Prisma LegalDocumentType). */
export const LEGAL_DOCUMENT_TYPES = [
  'terms_and_conditions',
  'privacy_policy',
  'cancellation_refund_policy',
  'owner_agreement',
  'booking_terms',
  'cookie_policy',
  'verification_policy',
  'community_review_policy',
] as const;
export type LegalDocumentTypeCode = (typeof LEGAL_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_STATUSES = [
  'draft',
  'scheduled',
  'active',
  'superseded',
  'archived',
] as const;
export type LegalDocumentStatusCode = (typeof LEGAL_DOCUMENT_STATUSES)[number];

export const LEGAL_ACCEPTANCE_CONTEXTS = [
  'registration',
  'login_reacceptance',
  'checkout',
  'owner_onboarding',
  'owner_agreement_update',
  'policy_update',
  'privacy_consent',
  'marketing_consent',
  'commercial_terms_ack',
] as const;
export type LegalAcceptanceContextCode = (typeof LEGAL_ACCEPTANCE_CONTEXTS)[number];

export const LEGAL_ACCEPTANCE_EVIDENCE_SOURCES = [
  'user_explicit_acceptance',
  'system_import_admin_exception',
] as const;
export type LegalAcceptanceEvidenceSourceCode =
  (typeof LEGAL_ACCEPTANCE_EVIDENCE_SOURCES)[number];

/** Optional purposes only — never essential processing bundled into Terms. */
export const PRIVACY_CONSENT_PURPOSES = [
  'marketing_email',
  'marketing_sms',
  'personalized_analytics',
  'optional_cookies',
] as const;
export type PrivacyConsentPurposeCode = (typeof PRIVACY_CONSENT_PURPOSES)[number];

export const PRIVACY_CONSENT_STATUSES = ['granted', 'withdrawn'] as const;
export type PrivacyConsentStatusCode = (typeof PRIVACY_CONSENT_STATUSES)[number];

export const DATA_SUBJECT_REQUEST_TYPES = [
  'access',
  'correction',
  'erasure',
  'objection',
  'portability',
  'privacy_inquiry',
  /** Distinct from privacy_inquiry — personal data / privacy complaint. */
  'privacy_complaint',
  'restriction',
  'consent_withdrawal',
] as const;
export type DataSubjectRequestTypeCode = (typeof DATA_SUBJECT_REQUEST_TYPES)[number];

/** Jordan Ministry guidance — DSR response window (working days). */
export const DSR_RESPONSE_WORKING_DAYS_POLICY = 15 as const;

export const DATA_SUBJECT_REQUEST_STATUSES = [
  'requested',
  'under_review',
  'fulfilled',
  'partially_fulfilled',
  'rejected_with_reason',
] as const;
export type DataSubjectRequestStatusCode = (typeof DATA_SUBJECT_REQUEST_STATUSES)[number];

/** Phase 3C.2 — counsel review status (mirrors Prisma LegalReviewStatus). */
export const LEGAL_REVIEW_STATUSES = [
  'not_reviewed',
  'under_review',
  'approved',
  'approved_with_changes',
  'rejected',
] as const;
export type LegalReviewStatusCode = (typeof LEGAL_REVIEW_STATUSES)[number];

/** Phase 3C.2 — founder/business approval (mirrors Prisma FounderApprovalStatus). */
export const FOUNDER_APPROVAL_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type FounderApprovalStatusCode = (typeof FOUNDER_APPROVAL_STATUSES)[number];

/**
 * Future Production activation path (Phase 3C.2+): refuse publish/activate unless
 * legalReviewStatus is approved | approved_with_changes AND founderApprovalStatus
 * is approved. This phase documents the gate only — do not activate Production here.
 */
export const PRODUCTION_LEGAL_ACTIVATION_REQUIRES_APPROVALS = true as const;

export const LEGAL_LANGUAGES = ['ar', 'en'] as const;
export type LegalLanguage = (typeof LEGAL_LANGUAGES)[number];

export const LEGAL_ACCEPTANCE_STATUS = [
  'accepted',
  'missing',
  'superseded_still_valid',
  'reacceptance_required',
] as const;
export type LegalAcceptanceStatusCode = (typeof LEGAL_ACCEPTANCE_STATUS)[number];

/** Key for BookingLegalSnapshot.financialPolicyKey — Phase 1 SSOT constants. */
export const FINANCIAL_POLICY_SNAPSHOT_KEY = 'phase1-ssot-v1';

export type CancellationRulesSnapshot = {
  freeUntilHours: number;
  charge30UntilHours: number;
  charge50UntilHours: number;
  chargePercentFree: number;
  chargePercentTier: {
    tier30: number;
    tier50: number;
    tier100: number;
  };
};

export type FinancialPolicySnapshot = {
  key: string;
  /** SHA-256 hex of canonical JSON of SSOT numbers used at booking time. */
  hash: string;
  commissionPercentDefault: number;
  depositPercent: number;
  balanceDueHoursBeforeStart: number;
  fullPaymentWithinHours: number;
  cancellationRules: CancellationRulesSnapshot;
};

/**
 * Normalize legal Markdown/text before hashing.
 * contentHash = sha256 hex of UTF-8 trim(content).
 */
export function normalizeLegalContent(content: string): string {
  return content.trim();
}

/** SHA-256 hex of normalized UTF-8 content (immutable publication fingerprint). */
export function hashLegalContent(content: string): string {
  return sha256Hex(normalizeLegalContent(content));
}

/** Stable JSON stringify for financial SSOT hashing (sorted keys). */
export function stableJsonStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableJsonStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonStringify(obj[k])}`).join(',')}}`;
}

export function hashFinancialPolicyPayload(payload: Record<string, unknown>): string {
  return sha256Hex(stableJsonStringify(payload));
}

/**
 * Build financial policy snapshot numbers from marketplace-financial-policy SSOT.
 * Legal snapshots link to this — they never invent their own commercial rates.
 */
export function buildFinancialPolicySnapshot(
  overrides?: { commissionPercent?: number },
): FinancialPolicySnapshot {
  const cancellationRules: CancellationRulesSnapshot = {
    freeUntilHours: CANCELLATION_FREE_UNTIL_HOURS,
    charge30UntilHours: CANCELLATION_CHARGE_30_UNTIL_HOURS,
    charge50UntilHours: CANCELLATION_CHARGE_50_UNTIL_HOURS,
    chargePercentFree: CANCELLATION_CHARGE_PERCENT_FREE,
    chargePercentTier: {
      tier30: CANCELLATION_CHARGE_PERCENT_TIER_30,
      tier50: CANCELLATION_CHARGE_PERCENT_TIER_50,
      tier100: CANCELLATION_CHARGE_PERCENT_TIER_100,
    },
  };

  const commissionPercentDefault =
    overrides?.commissionPercent ?? STANDARD_COMMISSION_PERCENT;

  const payload = {
    key: FINANCIAL_POLICY_SNAPSHOT_KEY,
    commissionPercentDefault,
    depositPercent: DEPOSIT_PERCENT,
    balanceDueHoursBeforeStart: BALANCE_DUE_HOURS_BEFORE_START,
    fullPaymentWithinHours: FULL_PAYMENT_WITHIN_HOURS,
    cancellationRules,
  };

  return {
    key: FINANCIAL_POLICY_SNAPSHOT_KEY,
    hash: hashFinancialPolicyPayload(payload),
    commissionPercentDefault,
    depositPercent: DEPOSIT_PERCENT,
    balanceDueHoursBeforeStart: BALANCE_DUE_HOURS_BEFORE_START,
    fullPaymentWithinHours: FULL_PAYMENT_WITHIN_HOURS,
    cancellationRules,
  };
}

/** Bootstrap changelog — never fabricate user acceptances. */
export const LEGAL_BOOTSTRAP_CHANGELOG =
  'Phase 3B architecture bootstrap — placeholder pending Phase 3C final legal rewrite';

export const LEGAL_REVIEW_BANNER =
  'REQUIRES JORDANIAN LEGAL REVIEW — placeholder content for architecture bootstrap only.';
