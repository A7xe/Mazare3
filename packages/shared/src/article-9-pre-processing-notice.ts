/**
 * Phase 3C.4B.2C — Article 9 pre-processing notice audit (internal).
 *
 * Article 9 elements are supplied primarily by the linked Privacy Policy version
 * plus purpose-specific Prior Consent text shown at the gate, with evidence via:
 * consentText, consentTextHash, purposeVersion, privacyNoticeVersionId, duration architecture.
 *
 * Processing start is event-based (not an invented calendar date per person).
 * Legal sufficiency of notice coverage remains COUNSEL_REVIEW_REQUIRED.
 */
import type { DataProcessingConsentPurposeCode } from './jordan-prior-consent.js';

export type Article9StartEventCode =
  | 'AFTER_ACCOUNT_CONSENT_GATE'
  | 'BEFORE_NEW_BOOKING_ACTION'
  | 'BEFORE_PAYMENT_OR_REFUND_ACTION'
  | 'BEFORE_SAVED_PAYMENT_METHOD_ACTION'
  | 'BEFORE_SUPPORT_OR_DISPUTE_SUBMISSION'
  | 'BEFORE_OWNER_ACCOUNT_OPERATION'
  | 'BEFORE_KYC_UPLOAD_OR_STORAGE'
  | 'BEFORE_EXACT_LOCATION_STORAGE'
  | 'BEFORE_PAYOUT_OR_IBAN_COLLECTION';

export type Article9PurposeNoticeRow = {
  purposeKey: DataProcessingConsentPurposeCode;
  processingStartEvent: Article9StartEventCode;
  privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true;
  consentTextSuppliesPurposeSpecificAck: true;
  evidenceLinkage: readonly [
    'consentText',
    'consentTextHash',
    'purposeVersion',
    'privacyNoticeVersionId',
  ];
  counselStatus: 'COUNSEL_REVIEW_REQUIRED';
};

export const ARTICLE_9_PRE_PROCESSING_NOTICE_AUDIT: readonly Article9PurposeNoticeRow[] = [
  {
    purposeKey: 'account_registration_and_authentication',
    processingStartEvent: 'AFTER_ACCOUNT_CONSENT_GATE',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'marketplace_booking_processing',
    processingStartEvent: 'BEFORE_NEW_BOOKING_ACTION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'payment_and_refund_processing',
    processingStartEvent: 'BEFORE_PAYMENT_OR_REFUND_ACTION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'saved_payment_method_processing',
    processingStartEvent: 'BEFORE_SAVED_PAYMENT_METHOD_ACTION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'support_and_dispute_processing',
    processingStartEvent: 'BEFORE_SUPPORT_OR_DISPUTE_SUBMISSION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'owner_account_and_marketplace_operation',
    processingStartEvent: 'BEFORE_OWNER_ACCOUNT_OPERATION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    /**
     * 3C.4D.7B: corpus consent text exists historically, but runtime collection/assertion
     * is suspended pending counsel reclassification — not a live Prior Consent gate.
     */
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'owner_identity_and_authority_verification',
    processingStartEvent: 'BEFORE_KYC_UPLOAD_OR_STORAGE',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'property_and_exact_location_processing',
    processingStartEvent: 'BEFORE_EXACT_LOCATION_STORAGE',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
  {
    purposeKey: 'owner_payout_and_financial_processing',
    processingStartEvent: 'BEFORE_PAYOUT_OR_IBAN_COLLECTION',
    privacyPolicySuppliesCategoriesPurposeDurationProcessorsSecurityProfiling: true,
    consentTextSuppliesPurposeSpecificAck: true,
    evidenceLinkage: [
      'consentText',
      'consentTextHash',
      'purposeVersion',
      'privacyNoticeVersionId',
    ],
    counselStatus: 'COUNSEL_REVIEW_REQUIRED',
  },
] as const;

export const ARTICLE_9_NOTICE_LEGAL_SUFFICIENCY = 'COUNSEL_REVIEW_REQUIRED' as const;

/** Production readiness: verify no GA/Meta/non-essential tracker active without consent. */
export const PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED =
  'PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED' as const;

export const ARTICLE_14_TRANSFER_REGISTER_LEGAL_SUFFICIENCY =
  'COUNSEL_REVIEW_REQUIRED' as const;
