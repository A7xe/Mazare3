/**
 * Phase 3C.4B.1.4 — Jordan PDPL Prior Consent architecture (SSOT helpers).
 *
 * Prior Consent (Arts 4–5) is distinct from:
 * - Privacy Policy acknowledgement (notice)
 * - Terms acceptance (contract)
 * - Optional PrivacyConsent purposes (marketing/analytics/cookies)
 *
 * Do NOT invent GDPR "legitimate interest" / "contract necessity" as Jordan bases.
 * Do NOT invent consent durations or Article 6 exception confirmations.
 */

/** Jordan legal-basis inventory statuses — not GDPR labels. */
export const JORDAN_LEGAL_BASIS_STATUSES = [
  'PRIOR_CONSENT_REQUIRED',
  'PRIOR_CONSENT_CONFIRMED',
  'ARTICLE_6_EXCEPTION_REVIEW_REQUIRED',
  'ARTICLE_6_EXCEPTION_CONFIRMED',
  /** Art. 6(A)(5) legislative-duty candidate — NOT counsel-confirmed. */
  'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
  'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
] as const;
export type JordanLegalBasisStatus = (typeof JORDAN_LEGAL_BASIS_STATUSES)[number];

/** Article 6 exception / legislative-duty inventory statuses. */
export const ARTICLE_6_EXCEPTION_STATUSES = [
  'ARTICLE_6_EXCEPTION_REVIEW_REQUIRED',
  'ARTICLE_6_EXCEPTION_CONFIRMED',
  'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL',
  'NOT_APPLICABLE',
] as const;
export type Article6ExceptionStatusCode = (typeof ARTICLE_6_EXCEPTION_STATUSES)[number];

/** Service Prior Consent purposes (NOT optional marketing/analytics/cookies). */
export const DATA_PROCESSING_CONSENT_PURPOSES = [
  'account_registration_and_authentication',
  'marketplace_booking_processing',
  'payment_and_refund_processing',
  'saved_payment_method_processing',
  'support_and_dispute_processing',
  'owner_account_and_marketplace_operation',
  'owner_identity_and_authority_verification',
  'property_and_exact_location_processing',
  'owner_payout_and_financial_processing',
] as const;
export type DataProcessingConsentPurposeCode =
  (typeof DATA_PROCESSING_CONSENT_PURPOSES)[number];

export const DATA_PROCESSING_CONSENT_STATUSES = [
  'granted',
  'withdrawn',
  'superseded',
  'expired',
] as const;
export type DataProcessingConsentStatusCode =
  (typeof DATA_PROCESSING_CONSENT_STATUSES)[number];

export const CONSENT_DURATION_STATUSES = [
  'DURATION_REQUIRES_LEGAL_REVIEW',
  'EVENT_BASED_PENDING_DEFINITION',
  'FIXED_EXPIRY_PENDING_DEFINITION',
] as const;
export type ConsentDurationStatusCode = (typeof CONSENT_DURATION_STATUSES)[number];

export const CONSENT_WITHDRAWAL_EFFECT_STATUSES = [
  'STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING',
  'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
  'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
] as const;
export type ConsentWithdrawalEffectStatusCode =
  (typeof CONSENT_WITHDRAWAL_EFFECT_STATUSES)[number];

export const CONSENT_VALIDITY_STATES = [
  'CONSENT_STILL_VALID',
  'RECONSENT_REQUIRED',
  'SUPERSEDED',
  'WITHDRAWN',
  'EXPIRED',
  'MISSING_PRIOR_CONSENT',
] as const;
export type ConsentValidityStateCode = (typeof CONSENT_VALIDITY_STATES)[number];

/** Current consent text / purpose definition version for evidence hashing. */
export const DATA_PROCESSING_CONSENT_CORPUS_VERSION = '3c4b1-4-prior-consent-v1' as const;

export type DataProcessingConsentPurposeDef = {
  purposeKey: DataProcessingConsentPurposeCode;
  nameEn: string;
  nameAr: string;
  /** Explicit Prior Consent copy EN (shown at collection point). */
  consentTextEn: string;
  /** Explicit Prior Consent copy AR. */
  consentTextAr: string;
  collectionPoints: string[];
  legalBasisStatus: JordanLegalBasisStatus;
  durationStatus: ConsentDurationStatusCode;
  withdrawalEffectStatus: ConsentWithdrawalEffectStatusCode;
  reconsentTriggers: string[];
  inventoryActivityKeys: string[];
  /**
   * Phase 3C.4D.7B — when false, do not assert/collect this purpose as Prior Consent
   * (corpus retained for history / counsel reclassification only).
   */
  runtimeGateRequired: boolean;
};

/**
 * Phase 3C.4D.7B — product classification of `owner_account_and_marketplace_operation`.
 * Not a counsel legal conclusion; does not invent Jordan Article 6 exceptions.
 */
export const OWNER_ACCOUNT_MARKETPLACE_OPERATION_CLASSIFICATION = {
  purposeKey: 'owner_account_and_marketplace_operation' as const,
  /** Primary closure status — do not wire a blanket Prior Consent checkbox. */
  classification: 'COUNSEL_REVIEW_REQUIRED' as const,
  /** Secondary product observation: overlaps purpose-specific Prior Consents + LegalAcceptance. */
  overlapNote: 'DUPLICATE_OR_OVERLAPPING_PURPOSE_CANDIDATE' as const,
  intendedCoverageEn:
    'Owner/Partner account and operational marketplace participation (become-owner / partner entry) — historically bundled; not wired at runtime.',
  coveredInsteadBy: [
    'account_registration_and_authentication',
    'owner_identity_and_authority_verification',
    'property_and_exact_location_processing',
    'owner_payout_and_financial_processing',
    'LegalAcceptance:terms_and_conditions',
    'LegalAcceptance:owner_agreement',
    'LegalAcceptance:privacy_policy_acknowledgement',
  ] as const,
  runtimePriorConsentGate: false as const,
  collectableAsPriorConsent: false as const,
  activationBlocker: 'OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED' as const,
};

export const DATA_PROCESSING_CONSENT_PURPOSE_DEFS: readonly DataProcessingConsentPurposeDef[] = [
  {
    purposeKey: 'account_registration_and_authentication',
    nameEn: 'Account registration and authentication',
    nameAr: 'تسجيل الحساب والمصادقة',
    consentTextEn:
      'I explicitly consent to the collection and processing of my account data for account creation, authentication and account operation purposes, as described in the Privacy Policy. This is separate from Terms acceptance and from optional marketing preferences.',
    consentTextAr:
      'أوافق صراحةً على جمع ومعالجة بيانات حسابي لأغراض إنشاء الحساب والمصادقة وتشغيل الحساب، وفق ما هو موضّح في سياسة الخصوصية. هذا منفصل عن قبول الشروط وعن التفضيلات التسويقية الاختيارية.',
    collectionPoints: ['registration', 'google_oauth_first_run_legal_gate', 'phone_profile_completion'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change', 'material_scope_change'],
    inventoryActivityKeys: ['customer_account', 'authentication_google_oauth'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'marketplace_booking_processing',
    nameEn: 'Marketplace booking processing',
    nameAr: 'معالجة حجوزات السوق',
    consentTextEn:
      'I explicitly consent to processing of my personal data necessary to create and administer marketplace Bookings, as described in the Privacy Policy.',
    consentTextAr:
      'أوافق صراحةً على معالجة بياناتي الشخصية اللازمة لإنشاء حجوزات السوق وإدارتها، وفق سياسة الخصوصية.',
    collectionPoints: ['checkout', 'booking_panel', 'first_booking_if_missing'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['customer_booking'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'payment_and_refund_processing',
    nameEn: 'Payment and refund processing',
    nameAr: 'معالجة المدفوعات والاسترداد',
    consentTextEn:
      'I explicitly consent to processing of payment and refund-related personal data (amounts, status, provider references — not PAN/CVV, which Mazare3 does not store) for payment and refund operations, as described in the Privacy Policy.',
    consentTextAr:
      'أوافق صراحةً على معالجة البيانات الشخصية المتعلقة بالدفع والاسترداد (المبالغ والحالة ومراجع المزود — وليس رقم البطاقة/CVV التي لا تخزّنها مزارع) لعمليات الدفع والاسترداد، وفق سياسة الخصوصية.',
    collectionPoints: ['checkout_payment', 'refund_flow'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['payment_metadata'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'saved_payment_method_processing',
    nameEn: 'Saved payment method (provider token) processing',
    nameAr: 'معالجة وسيلة الدفع المحفوظة',
    consentTextEn:
      'I explicitly consent to storing a payment-provider token (not PAN/CVV) so I can use a saved payment method for future checkouts, as described in the Privacy Policy. I may remove the saved method at any time.',
    consentTextAr:
      'أوافق صراحةً على حفظ رمز مزود الدفع (وليس رقم البطاقة/CVV) لاستخدام وسيلة دفع محفوظة لاحقاً، وفق سياسة الخصوصية. يمكنني إزالة الوسيلة المحفوظة في أي وقت.',
    collectionPoints: ['checkout_save_card_opt_in'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'STOPS_FUTURE_CONSENT_DEPENDENT_PROCESSING',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['saved_payment_token_metadata'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'support_and_dispute_processing',
    nameEn: 'Support and dispute processing',
    nameAr: 'معالجة الدعم والنزاعات',
    consentTextEn:
      'I explicitly consent to processing personal data I submit in support tickets, disputes or related communications for support and fairness handling, as described in the Privacy Policy.',
    consentTextAr:
      'أوافق صراحةً على معالجة البيانات الشخصية التي أقدّمها في تذاكر الدعم أو النزاعات أو الاتصالات ذات الصلة لمعالجة الدعم والعدالة، وفق سياسة الخصوصية.',
    collectionPoints: ['support_ticket_create', 'dispute_create'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['reviews_support_disputes'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'owner_account_and_marketplace_operation',
    nameEn: 'Owner account and marketplace operation',
    nameAr: 'حساب المالك وتشغيل السوق',
    consentTextEn:
      'I explicitly consent to processing of my Owner/Partner account and operational data to participate in the Mazare3 marketplace, as described in the Privacy Policy.',
    consentTextAr:
      'أوافق صراحةً على معالجة بيانات حساب المالك/الشريك والبيانات التشغيلية للمشاركة في سوق مزارع، وفق سياسة الخصوصية.',
    /**
     * 3C.4D.7B: collection suspended — overlaps account Prior Consent + KYC/location/payout
     * Prior Consents + Owner Agreement / Terms / Privacy LegalAcceptance. Do NOT show as UI checkbox.
     * Corpus text retained for historical evidence rows only; new grants rejected at API.
     */
    collectionPoints: [
      'become_owner_SUSPENDED_3C4D7B',
      'partner_onboarding_entry_SUSPENDED_3C4D7B',
    ],
    legalBasisStatus: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change', 'counsel_reclassification'],
    inventoryActivityKeys: ['owner_account_and_marketplace_operation'],
    runtimeGateRequired: false,
  },
  {
    purposeKey: 'owner_identity_and_authority_verification',
    nameEn: 'Owner identity and authority verification (KYC)',
    nameAr: 'التحقق من هوية المالك وصلاحيته (KYC)',
    consentTextEn:
      'I explicitly consent to collection and processing of identity and authority verification documents and related high-risk personal data for marketplace trust and compliance verification. Documents may be stored with a private storage provider; processing geography may involve CROSS_BORDER_POSSIBLE status pending provider confirmation. Duration of retention remains subject to legal review. This is not optional marketing consent.',
    consentTextAr:
      'أوافق صراحةً على جمع ومعالجة وثائق التحقق من الهوية والصلاحية والبيانات الشخصية عالية المخاطر ذات الصلة للتحقق والامتثال في السوق. قد تُخزَّن الوثائق لدى مزود تخزين خاص؛ وقد تكون جغرافيا المعالجة CROSS_BORDER_POSSIBLE بانتظار تأكيد المزود. مدة الاحتفاظ تخضع للمراجعة القانونية. هذه ليست موافقة تسويقية اختيارية.',
    collectionPoints: ['owner_kyc_document_upload'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change', 'kyc_document_category_expansion'],
    inventoryActivityKeys: [
      'owner_kyc_documents',
      'owner_operator_party_and_declared_property_owner',
      'property_regulatory_evidence',
      'owner_authority_third_party_personal_data',
    ],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'property_and_exact_location_processing',
    nameEn: 'Property and exact location processing',
    nameAr: 'معالجة العقار والموقع الدقيق',
    consentTextEn:
      'I explicitly consent to processing of Property listing data and exact location / arrival instructions for marketplace listing and eligible Customer arrival, as described in the Privacy Policy.',
    consentTextAr:
      'أوافق صراحةً على معالجة بيانات عرض العقار والموقع الدقيق / تعليمات الوصول لغرض العرض في السوق ووصول العميل المؤهل، وفق سياسة الخصوصية.',
    collectionPoints: ['owner_property_create_or_exact_location_save'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'WITHDRAWAL_EFFECT_LEGAL_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['exact_property_location', 'public_listing_media'],
    runtimeGateRequired: true,
  },
  {
    purposeKey: 'owner_payout_and_financial_processing',
    nameEn: 'Owner payout and financial processing',
    nameAr: 'صرف المالك والمعالجة المالية',
    consentTextEn:
      'I explicitly consent to collection and processing of my IBAN, bank and beneficiary details (financial-sensitive personal data) for Owner settlement and payouts. Mazare3 does not store PAN/CVV. Cross-border database storage may be CROSS_BORDER_POSSIBLE pending provider confirmation. Retention duration remains LEGAL_REVIEW.',
    consentTextAr:
      'أوافق صراحةً على جمع ومعالجة بيانات الآيبان والبنك والمستفيد (بيانات مالية حسّاسة) لأغراض التسوية والصرف للمالك. مزارع لا تخزّن رقم البطاقة/CVV. قد يكون تخزين قاعدة البيانات عبر الحدود CROSS_BORDER_POSSIBLE بانتظار تأكيد المزود. مدة الاحتفاظ تخضع للمراجعة القانونية.',
    collectionPoints: ['owner_payout_profile_save'],
    legalBasisStatus: 'PRIOR_CONSENT_CONFIRMED',
    durationStatus: 'DURATION_REQUIRES_LEGAL_REVIEW',
    withdrawalEffectStatus: 'STATUTORY_PROCESSING_MAY_CONTINUE_REVIEW_REQUIRED',
    reconsentTriggers: ['purpose_text_version_change'],
    inventoryActivityKeys: ['owner_payout_iban'],
    runtimeGateRequired: true,
  },
] as const;

export function getDataProcessingConsentPurposeDef(
  purposeKey: string,
): DataProcessingConsentPurposeDef | undefined {
  return DATA_PROCESSING_CONSENT_PURPOSE_DEFS.find((p) => p.purposeKey === purposeKey);
}

/** Purposes that must be asserted via assertPriorConsentActive / assertProcessingConsent. */
export function isRuntimePriorConsentGatedPurpose(
  purposeKey: DataProcessingConsentPurposeCode,
): boolean {
  const def = getDataProcessingConsentPurposeDef(purposeKey);
  return def?.runtimeGateRequired === true;
}

export function runtimePriorConsentGatedPurposes(): DataProcessingConsentPurposeCode[] {
  return DATA_PROCESSING_CONSENT_PURPOSE_DEFS.filter((p) => p.runtimeGateRequired).map(
    (p) => p.purposeKey,
  );
}

/** SHA-256 hex of language-specific consent text + corpus version (Node or Web Crypto callers). */
export function consentTextFingerprintInput(params: {
  purposeKey: string;
  language: 'ar' | 'en';
  consentText: string;
  corpusVersion?: string;
}): string {
  return [
    params.corpusVersion ?? DATA_PROCESSING_CONSENT_CORPUS_VERSION,
    params.purposeKey,
    params.language,
    params.consentText.trim(),
  ].join('\n');
}

/**
 * Google OAuth may return minimal identity before first-run consent UI.
 * Documented technical sequence — legal basis for that minimal exchange remains counsel review.
 */
export const GOOGLE_OAUTH_PRE_CONSENT_NOTE_EN =
  'Technical sequence: Google may return minimal identity (e.g. sub/email) to complete OAuth before the first-run Prior Consent UI. Mazare3 must minimise processing until Prior Consent is recorded; full marketplace processing must not begin before consent. Legal basis for the minimal pre-consent authentication exchange: LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED.';

/**
 * Phase 3C.4B.1.5 — Withdrawal effect matrix (INTERNAL).
 * Withdrawal stops future consent-dependent processing; never blocks statutory rights.
 */
export type WithdrawalEffectMatrixRow = {
  purposeKey: DataProcessingConsentPurposeCode | 'statutory_privacy_rights' | 'breach_art20';
  stopsFutureConsentDependentProcessing: boolean;
  preservesFinancialObligations: boolean;
  preservesDsrPrivacyComplaintAccess: boolean;
  preservesBreachInvestigation: boolean;
  preservesLegalRetentionEvidence: boolean;
  retentionOutcomeStatus: 'LEGAL_REVIEW_REQUIRED' | 'STOPS_FUTURE_ONLY' | 'STATUTORY_MAY_CONTINUE_REVIEW';
  notesEn: string;
};

export const PRIOR_CONSENT_WITHDRAWAL_EFFECT_MATRIX: readonly WithdrawalEffectMatrixRow[] = [
  {
    purposeKey: 'account_registration_and_authentication',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'LEGAL_REVIEW_REQUIRED',
    notesEn: 'Stops new account-processing actions that depend solely on this consent; does not erase Booking/payment evidence or block DSR.',
  },
  {
    purposeKey: 'marketplace_booking_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'No new Bookings without renewed consent; existing Booking economics/refunds retained pending counsel.',
  },
  {
    purposeKey: 'payment_and_refund_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'Future payment-token/new-payment processing gated; completed payment/refund records retained pending counsel.',
  },
  {
    purposeKey: 'saved_payment_method_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STOPS_FUTURE_ONLY',
    notesEn: 'Stops future use of saved methods; does not erase historical payment ledger.',
  },
  {
    purposeKey: 'support_and_dispute_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'LEGAL_REVIEW_REQUIRED',
    notesEn: 'Marketplace support/dispute tickets gated; privacy DSR/complaint portal remains available without this consent.',
  },
  {
    purposeKey: 'owner_account_and_marketplace_operation',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'LEGAL_REVIEW_REQUIRED',
    notesEn:
      '3C.4D.7B: purpose not runtime-gated / not newly collectable. Withdrawal of any legacy row remains auditable; does not fabricate deletion of Owner Agreement, KYC, location, payout, or Booking evidence. Counsel must close reclassification (merge/remove vs alternative basis).',
  },
  {
    purposeKey: 'owner_identity_and_authority_verification',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'No new KYC uploads without consent; already-stored KYC retention LEGAL_REVIEW_REQUIRED.',
  },
  {
    purposeKey: 'property_and_exact_location_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'LEGAL_REVIEW_REQUIRED',
    notesEn: 'No new exact-location writes without consent; historic location for eligible Bookings not hidden solely due to missing historic consent evidence.',
  },
  {
    purposeKey: 'owner_payout_and_financial_processing',
    stopsFutureConsentDependentProcessing: true,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'No new IBAN collection without consent; already-due payouts and financial records preserved pending counsel.',
  },
  {
    purposeKey: 'statutory_privacy_rights',
    stopsFutureConsentDependentProcessing: false,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'DSR / privacy complaint / consent withdrawal processing must remain available; Art. 6(A)(5) candidate — pending counsel.',
  },
  {
    purposeKey: 'breach_art20',
    stopsFutureConsentDependentProcessing: false,
    preservesFinancialObligations: true,
    preservesDsrPrivacyComplaintAccess: true,
    preservesBreachInvestigation: true,
    preservesLegalRetentionEvidence: true,
    retentionOutcomeStatus: 'STATUTORY_MAY_CONTINUE_REVIEW',
    notesEn: 'Art. 20 breach investigation/notification must not depend on Data Subject Prior Consent.',
  },
] as const;

/** Production readiness: Prior Consent purposes whose Article 5 duration remains unresolved. */
export function priorConsentPurposesWithUnresolvedDuration(): DataProcessingConsentPurposeCode[] {
  return DATA_PROCESSING_CONSENT_PURPOSE_DEFS.filter(
    (p) =>
      p.runtimeGateRequired &&
      (p.durationStatus === 'DURATION_REQUIRES_LEGAL_REVIEW' ||
        p.durationStatus === 'EVENT_BASED_PENDING_DEFINITION' ||
        p.durationStatus === 'FIXED_EXPIRY_PENDING_DEFINITION'),
  ).map((p) => p.purposeKey);
}

/** True when Production activation must block because Prior Consent duration is unresolved. */
export function priorConsentDurationBlocksProductionActivation(): boolean {
  return priorConsentPurposesWithUnresolvedDuration().length > 0;
}
