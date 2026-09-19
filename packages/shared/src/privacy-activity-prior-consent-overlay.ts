/**
 * Phase 3C.4B.1.4 / 3C.4B.1.5 — Jordan Prior Consent overlay for privacy processing inventory.
 * Merged into PRIVACY_PROCESSING_ACTIVITIES (SSOT). Internal only.
 */

import type {
  Article6ExceptionStatusCode,
  ConsentDurationStatusCode,
  ConsentWithdrawalEffectStatusCode,
  DataProcessingConsentPurposeCode,
  JordanLegalBasisStatus,
} from './jordan-prior-consent.js';

export type ProcessingStartRelativeToConsent =
  | 'before_explicit_prior_consent'
  | 'after_explicit_consent'
  | 'optional_consent'
  | 'potential_statutory_exception_review'
  | 'minimal_pre_consent_technical_exchange'
  | 'statutory_duty_no_consent';

export type PrivacyActivityPriorConsentOverlay = {
  jordanLegalBasisStatus: JordanLegalBasisStatus;
  priorConsentRequired: boolean;
  consentPurposeKey: DataProcessingConsentPurposeCode | null;
  article6ExceptionStatus: Article6ExceptionStatusCode;
  withdrawalImpactStatus: ConsentWithdrawalEffectStatusCode | 'NOT_APPLICABLE';
  durationReviewStatus: ConsentDurationStatusCode | 'NOT_APPLICABLE';
  reconsentTriggerNotes: string;
  processingStartRelativeToConsent: ProcessingStartRelativeToConsent;
  /** Distinguish technical gate readiness from unresolved counsel basis. */
  runtimeGateStatus:
    | 'CONFIRMED_TECHNICAL_GATE'
    | 'GATE_NOT_REQUIRED'
    | 'GATE_PENDING'
    | 'LEGAL_BASIS_PENDING_COUNSEL';
  transactionalNotificationMapping?: string;
};

/** Every inventory activity key must appear here. */
export const PRIVACY_ACTIVITY_PRIOR_CONSENT_OVERLAY: Record<
  string,
  PrivacyActivityPriorConsentOverlay
> = {
  customer_account: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'account_registration_and_authentication',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change; material_scope_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  authentication_google_oauth: {
    jordanLegalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    priorConsentRequired: true,
    consentPurposeKey: 'account_registration_and_authentication',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'minimal_pre_consent_technical_exchange',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  customer_booking: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'marketplace_booking_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change; material_scope_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
    transactionalNotificationMapping:
      'booking_lifecycle_notices_map_to_marketplace_booking_processing_not_marketing',
  },
  payment_metadata: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'payment_and_refund_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
    transactionalNotificationMapping:
      'payment_refund_notices_map_to_payment_and_refund_processing_not_marketing',
  },
  saved_payment_token_metadata: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'saved_payment_method_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  owner_kyc_documents: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'owner_identity_and_authority_verification',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change; kyc_document_category_expansion',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  /**
   * 3C.4D.7B — Owner/Partner operational marketplace participation residual purpose.
   * Classification: COUNSEL_REVIEW_REQUIRED (not wired as Prior Consent; do not invent Art. 6 exception).
   */
  owner_account_and_marketplace_operation: {
    jordanLegalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'n/a for runtime Prior Consent — OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED; covered operationally by account + KYC + location + payout Prior Consents and LegalAcceptance',
    processingStartRelativeToConsent: 'potential_statutory_exception_review',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  owner_operator_party_and_declared_property_owner: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'owner_identity_and_authority_verification',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change; authority_model_expansion',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  /** 3C.4D.7B — third-party individuals named in authority packages (not fake third-party consent UI). */
  owner_authority_third_party_personal_data: {
    jordanLegalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED — no third-party consent checkbox invented',
    processingStartRelativeToConsent: 'potential_statutory_exception_review',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  property_regulatory_evidence: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'owner_identity_and_authority_verification',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change; regulatory_evidence_category_expansion',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  /** 3C.4D.7B — pool/safety PD implications only (attestations/uploader/reviewer/free-text), not ordinary Property facts. */
  property_pool_safety_personal_data_implications: {
    jordanLegalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'n/a — ordinary pool/safety Property facts are listing data; PD limited to attestation actor IDs / free-text',
    processingStartRelativeToConsent: 'potential_statutory_exception_review',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  owner_payout_iban: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'owner_payout_and_financial_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  exact_property_location: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'property_and_exact_location_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  public_listing_media: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_REQUIRED',
    priorConsentRequired: true,
    consentPurposeKey: 'property_and_exact_location_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'purpose_text_version_change',
    processingStartRelativeToConsent: 'before_explicit_prior_consent',
    runtimeGateStatus: 'GATE_PENDING',
  },
  optional_privacy_consent: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'optional PrivacyConsent purpose/version change',
    processingStartRelativeToConsent: 'optional_consent',
    runtimeGateStatus: 'GATE_NOT_REQUIRED',
  },
  legal_acceptance_evidence: {
    jordanLegalBasisStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'n/a — evidence retention; not Prior Consent substitute',
    processingStartRelativeToConsent: 'statutory_duty_no_consent',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  transactional_notifications: {
    jordanLegalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'n/a — map booking/payment notices to existing Prior Consent purposes; security/breach notices to Art. 6(A)(5) candidate; marketing separate',
    processingStartRelativeToConsent: 'potential_statutory_exception_review',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
    transactionalNotificationMapping:
      'booking->marketplace_booking_processing; payment/refund->payment_and_refund_processing; security/breach->ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL; marketing->PrivacyConsent only',
  },
  data_subject_requests: {
    jordanLegalBasisStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'n/a — statutory rights exercise; must NOT require new Prior Consent',
    processingStartRelativeToConsent: 'statutory_duty_no_consent',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  security_audit_logs: {
    jordanLegalBasisStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'n/a — logs necessary for PDPL / 2025 Security Instructions candidate only; product telemetry without statutory link remains LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED (do not over-collect)',
    processingStartRelativeToConsent: 'statutory_duty_no_consent',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
  reviews_support_disputes: {
    jordanLegalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    priorConsentRequired: true,
    consentPurposeKey: 'support_and_dispute_processing',
    article6ExceptionStatus: 'NOT_APPLICABLE',
    withdrawalImpactStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes:
      'purpose_text_version_change — marketplace support/disputes only; DSR/privacy complaints are separate statutory mapping',
    processingStartRelativeToConsent: 'after_explicit_consent',
    runtimeGateStatus: 'CONFIRMED_TECHNICAL_GATE',
  },
  personal_data_breach_response: {
    jordanLegalBasisStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    priorConsentRequired: false,
    consentPurposeKey: null,
    article6ExceptionStatus: 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
    withdrawalImpactStatus: 'NOT_APPLICABLE',
    durationReviewStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    reconsentTriggerNotes: 'n/a — Art. 20 operational records; never require Data Subject consent checkbox',
    processingStartRelativeToConsent: 'statutory_duty_no_consent',
    runtimeGateStatus: 'LEGAL_BASIS_PENDING_COUNSEL',
  },
};
