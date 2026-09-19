/**
 * Phase 3C.4B.1 / 3C.4B.1.1 — Privacy processing inventory / register foundation (SSOT).
 *
 * INTERNAL compliance draft only. Not a government submission.
 * Do NOT invent regions, retention periods, PSP legal identity, or DPO appointment.
 * Legal bases are review statuses — do not mechanically import GDPR "legitimate interest".
 *
 * 3C.4B.1.1 corrections (Jordan PDPL mapping):
 * - Financial personal data classified SENSITIVE_PERSONAL_DATA_FINANCIAL
 * - KYC = high-risk / sensitive-possible (not blanket "always sensitive")
 * - Free-text channels = SENSITIVE_DATA_POSSIBLE + minimisation
 * - DPO appointment treated as Production readiness requirement (still not appointed)
 * - Processor contractual roles = neutral pending contract review
 * - Access includes obtaining a copy; portability remains separate
 */

import { ADVISOR_REVISED_VERSION, LAUNCH_CANDIDATE_VERSION, PRIVACY_ADVISOR_REVISED_VERSION, PRIVACY_ADVISOR_REVISED_VERSION_110, PRIVACY_ADVISOR_REVISED_VERSION_111 } from './legal-content/build-legal-markdown.js';
import type {
  ConsentDurationStatusCode,
  ConsentWithdrawalEffectStatusCode,
  DataProcessingConsentPurposeCode,
  JordanLegalBasisStatus,
} from './jordan-prior-consent.js';
import {
  PRIVACY_ACTIVITY_PRIOR_CONSENT_OVERLAY,
  type ProcessingStartRelativeToConsent,
} from './privacy-activity-prior-consent-overlay.js';

export type { ProcessingStartRelativeToConsent } from './privacy-activity-prior-consent-overlay.js';
export { PRIVACY_ACTIVITY_PRIOR_CONSENT_OVERLAY } from './privacy-activity-prior-consent-overlay.js';

/** Re-export DSR calendar helpers for privacy consumers (canonical module: jordan-privacy-business-calendar). */
export type {
  DsrDeadlineComputation,
  DsrDeadlineUrgency,
} from './jordan-privacy-business-calendar.js';
export {
  DSR_RESPONSE_WORKING_DAYS,
  DSR_DUE_SOON_CALENDAR_DAYS,
  JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES,
  computeDsrDeadlineFromReceivedAt,
  computeDsrDueAtFromReceivedAt,
  classifyDsrDeadlineUrgency,
  isDsrOpenStatus,
  isDsrOverdue,
  isJordanPrivacyWorkingDay,
} from './jordan-privacy-business-calendar.js';

/** Evidence / confirmation status for privacy inventory fields. */
export type PrivacyEvidenceStatus =
  | 'CONFIRMED'
  | 'TECHNICALLY_CONFIRMED'
  | 'FOUNDER_INPUT_REQUIRED'
  | 'PROVIDER_CONTRACT_REQUIRED'
  | 'LEGAL_REVIEW_REQUIRED'
  | 'UNKNOWN';

export type CrossBorderStatus =
  | 'JORDAN_ONLY_CONFIRMED'
  | 'CROSS_BORDER_CONFIRMED'
  | 'CROSS_BORDER_POSSIBLE'
  | 'UNKNOWN';

export type MinimisationRecommendation =
  | 'KEEP'
  | 'MINIMISE'
  | 'RESTRICT_ACCESS'
  | 'STOP_COLLECTING_CANDIDATE'
  | 'LEGAL_REVIEW_REQUIRED';

export type DpiaStatus =
  | 'NOT_REQUIRED_PENDING_REVIEW'
  | 'DPIA_RECOMMENDED'
  | 'DPIA_REQUIRED_LEGAL_REVIEW'
  | 'DPIA_NOT_COMPLETED';

export type RetentionPeriodStatus =
  | 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW'
  | 'TECHNICAL_BEHAVIOR_ONLY'
  | 'CONFIRMED_STATUTORY';

/**
 * Jordan PDPL-oriented sensitive-data classification (inventory — not legal advice).
 * Financial information is treated as sensitive personal data under the Jordan framework.
 */
export type SensitivePersonalDataClassification =
  | 'NOT_SENSITIVE'
  | 'SENSITIVE_PERSONAL_DATA_FINANCIAL'
  | 'SENSITIVE_DATA_POSSIBLE'
  | 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE'
  | 'NOT_APPLICABLE';

/**
 * Contractual controller/processor role — do not guess from industry practice.
 */
export type ProcessorContractualRoleStatus =
  | 'ROLE_REQUIRES_CONTRACT_REVIEW'
  | 'PROCESSOR_ROLE_PENDING'
  | 'INDEPENDENT_CONTROLLER_ROLE_PENDING'
  | 'CONTROLLER_ROLE_PENDING';

/**
 * Working week used for DSR SLA calculation (Asia/Amman calendar).
 * Jordan private-sector common week: Sunday–Thursday.
 * Official holidays: see JORDAN_PRIVACY_OFFICIAL_NON_WORKING_DATES (configurable; empty = provisional).
 */
export const JORDAN_DSR_WORKING_WEEKDAYS = [0, 1, 2, 3, 4] as const; // JS: 0=Sun … 4=Thu

export type PrivacyDataSubjectCategory =
  | 'customer'
  | 'owner_partner'
  | 'visitor_unauthenticated'
  | 'admin_staff'
  | 'mixed';

export type PrivacyProcessingActivity = {
  key: string;
  nameEn: string;
  nameAr: string;
  dataSubjectCategory: PrivacyDataSubjectCategory;
  dataCategories: string[];
  financialData: boolean;
  /** Jordan PDPL classification — prefer this over the boolean alone. */
  sensitiveClassification: SensitivePersonalDataClassification;
  /**
   * Derived convenience: true when classification is financial-sensitive,
   * sensitive-possible, or high-risk sensitive-possible.
   */
  sensitivePersonalDataPossible: boolean;
  collectionSource: string;
  purposeEn: string;
  systemOrService: string;
  internalAccessRoles: string[];
  externalRecipientOrProcessor: string | null;
  processorRoleStatus: ProcessorContractualRoleStatus;
  storageOrProcessingRegion: string;
  regionEvidenceStatus: PrivacyEvidenceStatus;
  crossBorderStatus: CrossBorderStatus;
  /**
   * Legacy evidence-status field (pre-3C.4B.1.4). Prefer jordanLegalBasisStatus.
   * Do not treat LEGAL_REVIEW_REQUIRED as a confirmed Article 6 exception.
   */
  legalBasisReviewStatus: PrivacyEvidenceStatus;
  /** Phase 3C.4B.1.4 — Jordan PDPL legal-basis status (not GDPR labels). */
  jordanLegalBasisStatus: JordanLegalBasisStatus;
  priorConsentRequired: boolean;
  consentPurposeKey: DataProcessingConsentPurposeCode | null;
  article6ExceptionStatus: import('./jordan-prior-consent.js').Article6ExceptionStatusCode;
  withdrawalImpactStatus: ConsentWithdrawalEffectStatusCode | 'NOT_APPLICABLE';
  durationReviewStatus: ConsentDurationStatusCode | 'NOT_APPLICABLE';
  reconsentTriggerNotes: string;
  processingStartRelativeToConsent: ProcessingStartRelativeToConsent;
  runtimeGateStatus:
    | 'CONFIRMED_TECHNICAL_GATE'
    | 'GATE_NOT_REQUIRED'
    | 'GATE_PENDING'
    | 'LEGAL_BASIS_PENDING_COUNSEL';
  transactionalNotificationMapping?: string;
  retentionStatus: RetentionPeriodStatus;
  dsrImpact: string;
  securityControlNotes: string;
  dpiaStatus: DpiaStatus;
  legalReviewNotes: string;
  minimisation: MinimisationRecommendation;
};

export type PrivacyProcessorRecord = {
  key: string;
  serviceName: string;
  purposeEn: string;
  dataCategories: string[];
  contractualLegalEntity: string | null;
  contractualEntityStatus: PrivacyEvidenceStatus;
  /** Neutral — do not claim processor vs independent controller without contract review. */
  contractualRoleStatus: ProcessorContractualRoleStatus;
  knownRegionOrEvidence: string;
  regionEvidenceStatus: PrivacyEvidenceStatus;
  crossBorderStatus: CrossBorderStatus;
  notes: string;
};

export type PrivacyRetentionRow = {
  key: string;
  categoryEn: string;
  purposeEn: string;
  retentionStartEvent: string;
  currentTechnicalBehavior: string;
  statutoryOrBusinessStatus: RetentionPeriodStatus;
  proposedDeletionOrAnonymisation: string;
  exactLegalPeriodStatus: RetentionPeriodStatus;
  riskCategoryNote?: string;
};

export type PrivacyDpiaRow = {
  key: string;
  topicEn: string;
  status: DpiaStatus;
  notes: string;
};

/**
 * DPO readiness — INTERNAL only.
 * dpoAppointed must remain false until formal appointment + suitability verification.
 * Formal appointment is treated as a likely/applicable Production readiness requirement
 * given financial personal data processing and possible cross-border database transfers.
 */
export type PrivacyDpoReadiness = {
  /** Must remain false until formally recorded. */
  dpoAppointed: false;
  candidateType: 'INTERNAL' | 'EXTERNAL' | 'NONE_RECORDED';
  candidateLabel: 'INTERNAL_DPO_CANDIDATE';
  appointmentStatus: 'NOT_FORMALLY_RECORDED';
  /** Preferred internal readiness concept (3C.4B.1.1). */
  appointmentRequirementStatus: 'DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION';
  conflictOfInterestReview: 'PENDING';
  specialisedKnowledgeEvidence: 'PENDING';
  accreditationApplicability: 'REQUIRES_SCOPE_CHECK';
  accreditationNotesEn: string;
  publicDpoContact: 'NOT_PUBLISHED';
  productionBlocker: true;
  notesEn: string;
};

export const PRIVACY_DPO_READINESS: PrivacyDpoReadiness = {
  dpoAppointed: false,
  candidateType: 'INTERNAL',
  candidateLabel: 'INTERNAL_DPO_CANDIDATE',
  appointmentStatus: 'NOT_FORMALLY_RECORDED',
  appointmentRequirementStatus: 'DPO_APPOINTMENT_REQUIRED_PENDING_FORMALISATION',
  conflictOfInterestReview: 'PENDING',
  specialisedKnowledgeEvidence: 'PENDING',
  accreditationApplicability: 'REQUIRES_SCOPE_CHECK',
  accreditationNotesEn:
    'Jordan Ministry guidance lists ICT among critical-infrastructure sectors for DPO accreditation. That does NOT mean BATMAN TECHNOLOGY automatically qualifies as critical infrastructure merely because it is an IT company. Entity-specific applicability still REQUIRES_SCOPE_CHECK.',
  publicDpoContact: 'NOT_PUBLISHED',
  productionBlocker: true,
  notesEn:
    'Formal DPO appointment is treated as a likely / applicable legal readiness requirement before Production (financial personal data + possible database transfers outside Jordan), not merely an optional business preference. Keep dpoAppointed=false and do not publish candidate identity until: conflict-of-interest review, specialised-knowledge review, founder/company appointment documentation, accreditation scope check, and publication of official DPO/privacy contact only after formalisation. Do not store candidate private PII in the repo.',
};

/** Jordan DSR rights mapped to current product architecture (inventory — not legal advice). */
export const JORDAN_DSR_RIGHTS_INVENTORY = [
  {
    rightKey: 'access',
    nameEn: 'Access — Customer may request access to and obtain a copy of their personal data',
    architectureSupport:
      'DataSubjectRequestType.access — fulfilment includes providing access to and a copy of personal data',
    includesObtainingCopy: true,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'correction',
    nameEn: 'Correction / update',
    architectureSupport: 'DataSubjectRequestType.correction',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'objection',
    nameEn: 'Objection',
    architectureSupport: 'DataSubjectRequestType.objection',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'consent_withdrawal',
    nameEn: 'Withdrawal of prior optional consent',
    architectureSupport:
      'PrivacyConsent withdraw API + DataSubjectRequestType.consent_withdrawal',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'erasure',
    nameEn: 'Erasure / hiding where legally available',
    architectureSupport:
      'DataSubjectRequestType.erasure (anonymize preferred; retain bookings/payments/legal evidence)',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'restriction',
    nameEn: 'Restriction / limitation of processing',
    architectureSupport: 'DataSubjectRequestType.restriction',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'portability',
    nameEn:
      'Portability — separate right/process for transferring or providing a portable copy in the legally applicable form',
    architectureSupport:
      'DataSubjectRequestType.portability (technically an export may also support access fulfilment, but legal concepts remain separate)',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'privacy_inquiry',
    nameEn: 'Privacy inquiry (not automatically a complaint)',
    architectureSupport: 'DataSubjectRequestType.privacy_inquiry',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    rightKey: 'privacy_complaint',
    nameEn: 'Personal data / privacy complaint',
    nameAr: 'شكوى تتعلق بحماية البيانات الشخصية',
    architectureSupport:
      'DataSubjectRequestType.privacy_complaint — distinct from privacy_inquiry; does not block contacting the competent Jordanian authority',
    includesObtainingCopy: false,
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
] as const;

function sensitivePossible(c: SensitivePersonalDataClassification): boolean {
  return (
    c === 'SENSITIVE_PERSONAL_DATA_FINANCIAL' ||
    c === 'SENSITIVE_DATA_POSSIBLE' ||
    c === 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE'
  );
}

/** Controller registration readiness checklist (internal — no external submission). */
export const CONTROLLER_REGISTRATION_READINESS_CHECKLIST = [
  { key: 'controller_identity', labelEn: 'Controller legal identity', status: 'CONFIRMED' as PrivacyEvidenceStatus },
  { key: 'company_details', labelEn: 'Company CR / address / form', status: 'CONFIRMED' as PrivacyEvidenceStatus },
  {
    key: 'processing_activities',
    labelEn: 'Processing activities inventory',
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    key: 'processors',
    labelEn: 'Processor / service inventory',
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    key: 'dpo_status',
    labelEn: 'DPO formal appointment / accreditation',
    status: 'FOUNDER_INPUT_REQUIRED' as PrivacyEvidenceStatus,
  },
  {
    key: 'data_categories',
    labelEn: 'Data categories per activity',
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  { key: 'purposes', labelEn: 'Purposes per activity', status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus },
  {
    key: 'transfers',
    labelEn: 'Cross-border transfer assessment',
    status: 'LEGAL_REVIEW_REQUIRED' as PrivacyEvidenceStatus,
  },
  {
    key: 'security_controls',
    labelEn: 'Security / organisational measures mapping',
    status: 'TECHNICALLY_CONFIRMED' as PrivacyEvidenceStatus,
  },
  {
    key: 'privacy_contact',
    labelEn: 'Public privacy contact email',
    status: 'FOUNDER_INPUT_REQUIRED' as PrivacyEvidenceStatus,
  },
  {
    key: 'psp_legal_name',
    labelEn: 'Payment provider legal name',
    status: 'FOUNDER_INPUT_REQUIRED' as PrivacyEvidenceStatus,
  },
] as const;

export const PRIVACY_PROCESSORS: PrivacyProcessorRecord[] = [
  {
    key: 'neon_postgres',
    serviceName: 'Neon PostgreSQL',
    purposeEn: 'Primary application database',
    dataCategories: ['account', 'booking', 'payment_metadata', 'KYC_metadata_keys', 'logs_refs'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'PROVIDER_CONTRACT_REQUIRED',
    contractualRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    knownRegionOrEvidence: 'DATABASE_URL host pattern may include AWS region; Production region not proven in-repo',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    notes:
      'Do not infer country from Neon HQ. REGION_REQUIRES_PROVIDER_CONFIRMATION. Contractual role not guessed — ROLE_REQUIRES_CONTRACT_REVIEW.',
  },
  {
    key: 'cloudflare_r2_public_media',
    serviceName: 'Cloudflare R2 (public property media)',
    purposeEn: 'Public listing images/media',
    dataCategories: ['property_media', 'possible_incidental_personal_in_photos'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'PROVIDER_CONTRACT_REQUIRED',
    contractualRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    knownRegionOrEvidence: 'CLOUDFLARE_R2_REGION=auto in .env.example — actual location unproven',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    notes: 'REGION_REQUIRES_PROVIDER_CONFIRMATION. Contractual role pending review.',
  },
  {
    key: 'cloudflare_r2_private_kyc',
    serviceName: 'Cloudflare R2 (private partner documents)',
    purposeEn: 'Owner KYC / listing authority document object storage',
    dataCategories: ['identity_documents', 'authority_documents', 'file_metadata'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'PROVIDER_CONTRACT_REQUIRED',
    contractualRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    knownRegionOrEvidence: 'Private bucket config; region auto/unproven',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    notes:
      'Objects served via authenticated API stream; no public bucket listing. REGION_REQUIRES_PROVIDER_CONFIRMATION. Role pending contract review.',
  },
  {
    key: 'paytabs',
    serviceName: 'PayTabs (configured PSP)',
    purposeEn: 'Card payment processing / hosted fields / authorisation',
    dataCategories: ['payment_transaction_metadata', 'PSP_references', 'masked_card_display'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'FOUNDER_INPUT_REQUIRED',
    contractualRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    knownRegionOrEvidence: 'PAYTABS_REGION=JOR / secure-jordan.paytabs.com evidenced in .env.example',
    regionEvidenceStatus: 'TECHNICALLY_CONFIRMED',
    crossBorderStatus: 'UNKNOWN',
    notes:
      'Jordan endpoint evidenced; full processing geography / merchant-of-record legal name still FOUNDER_INPUT_REQUIRED / LEGAL_REVIEW_REQUIRED. PAN/CVV not stored by Mazare3. Do not guess processor vs independent controller — ROLE_REQUIRES_CONTRACT_REVIEW.',
  },
  {
    key: 'google_oauth',
    serviceName: 'Google OAuth',
    purposeEn: 'Optional sign-in identity federation',
    dataCategories: ['google_sub', 'email_if_provided_by_google_flow'],
    contractualLegalEntity: 'Google (entity TBD in contract)',
    contractualEntityStatus: 'PROVIDER_CONTRACT_REQUIRED',
    contractualRoleStatus: 'INDEPENDENT_CONTROLLER_ROLE_PENDING',
    knownRegionOrEvidence: 'Not proven in-repo',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    notes:
      'INDEPENDENT_CONTROLLER_ROLE_PENDING — do not treat Google’s role as settled without contract/terms confirmation. REGION_REQUIRES_PROVIDER_CONFIRMATION.',
  },
  {
    key: 'resend_email',
    serviceName: 'Resend / SMTP (when EMAIL_PROVIDER enabled)',
    purposeEn: 'Transactional email delivery',
    dataCategories: ['email', 'notification_content_metadata'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'PROVIDER_CONTRACT_REQUIRED',
    contractualRoleStatus: 'PROCESSOR_ROLE_PENDING',
    knownRegionOrEvidence: 'Default EMAIL_PROVIDER=none in .env.example; region unknown when enabled',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    notes:
      'PROCESSOR_ROLE_PENDING until DPA/contract confirms. Do not invent active processing if provider disabled.',
  },
  {
    key: 'app_hosting',
    serviceName: 'Application hosting (web/API)',
    purposeEn: 'Serve application and API',
    dataCategories: ['request_metadata', 'application_data_in_transit'],
    contractualLegalEntity: null,
    contractualEntityStatus: 'FOUNDER_INPUT_REQUIRED',
    contractualRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    knownRegionOrEvidence: 'Hosting provider/region not confirmed by Production env in-repo',
    regionEvidenceStatus: 'FOUNDER_INPUT_REQUIRED',
    crossBorderStatus: 'UNKNOWN',
    notes: 'REGION_REQUIRES_PROVIDER_CONFIRMATION. Contractual role pending.',
  },
];

type PrivacyProcessingActivityCore = Omit<
  PrivacyProcessingActivity,
  | 'jordanLegalBasisStatus'
  | 'priorConsentRequired'
  | 'consentPurposeKey'
  | 'article6ExceptionStatus'
  | 'withdrawalImpactStatus'
  | 'durationReviewStatus'
  | 'reconsentTriggerNotes'
  | 'processingStartRelativeToConsent'
  | 'runtimeGateStatus'
  | 'transactionalNotificationMapping'
>;

const PRIVACY_PROCESSING_ACTIVITY_CORES: PrivacyProcessingActivityCore[] = [
  {
    key: 'customer_account',
    nameEn: 'Customer account registration & profile',
    nameAr: 'تسجيل حساب العميل والملف',
    dataSubjectCategory: 'customer',
    dataCategories: ['name', 'email', 'phone_optional', 'password_hash', 'locale', 'auth_identities'],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'registration / profile forms / Google OAuth',
    purposeEn: 'Create and administer Customer accounts; authentication',
    systemOrService: 'Neon User + AuthIdentity',
    internalAccessRoles: ['customer_self', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres; google_oauth if used',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access (incl. copy), correction, erasure(partial), portability, objection',
    securityControlNotes: 'bcrypt passwordHash; JWT session cookie; passwordChangedAt invalidation',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes: 'Map to Jordan PDPL lawful basis with counsel — do not assume GDPR LI',
    minimisation: 'KEEP',
  },
  {
    key: 'authentication_google_oauth',
    nameEn: 'Authentication via Google OAuth (optional)',
    nameAr: 'المصادقة عبر Google OAuth (اختياري)',
    dataSubjectCategory: 'customer',
    dataCategories: ['google_sub', 'linked_email_if_provided', 'auth_identity_provider'],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'Google OAuth callback when enabled',
    purposeEn: 'Federated sign-in identity linkage',
    systemOrService: 'Neon AuthIdentity; Google OAuth',
    internalAccessRoles: ['customer_self', 'admin'],
    externalRecipientOrProcessor: 'google_oauth',
    processorRoleStatus: 'INDEPENDENT_CONTROLLER_ROLE_PENDING',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; unlink/correction via account tools where available',
    securityControlNotes: 'OAuth tokens handled per auth service; no inventing Google role',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes:
      'Mapped separately from general account activity for register completeness. Contractual role INDEPENDENT_CONTROLLER_ROLE_PENDING.',
    minimisation: 'KEEP',
  },
  {
    key: 'customer_booking',
    nameEn: 'Booking creation and lifecycle',
    nameAr: 'إنشاء الحجز ودورة حياته',
    dataSubjectCategory: 'customer',
    dataCategories: [
      'booking_ids',
      'dates',
      'guests_count',
      'amounts',
      'status',
      'user_link',
      'booking_property_listing_snapshot',
    ],
    financialData: true,
    sensitiveClassification: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
    sensitivePersonalDataPossible: true,
    collectionSource: 'checkout / booking APIs',
    purposeEn: 'Perform marketplace Booking contract and operations',
    systemOrService: 'Neon Booking + related',
    internalAccessRoles: ['customer_self', 'owner_of_property', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres; paytabs for payment',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access (incl. copy); erasure limited by financial/legal retention',
    securityControlNotes:
      'RBAC; BookingLegalSnapshot immutable evidence; BookingPropertySnapshot immutable listing evidence (3C.4D.6)',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'Booking amounts / financial transaction linkage = SENSITIVE_PERSONAL_DATA_FINANCIAL under Jordan PDPL mapping (3C.4B.1.1). Counsel to confirm lawful basis.',
    minimisation: 'KEEP',
  },
  {
    key: 'payment_metadata',
    nameEn: 'Payment transaction metadata (no PAN/CVV)',
    nameAr: 'بيانات وصفية لعمليات الدفع (بدون رقم البطاقة/CVV)',
    dataSubjectCategory: 'customer',
    dataCategories: [
      'amounts',
      'currency',
      'status',
      'provider_ref',
      'masked_display',
      'refund_metadata',
      'provider_token_cipher_optional',
    ],
    financialData: true,
    sensitiveClassification: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
    sensitivePersonalDataPossible: true,
    collectionSource: 'PSP callbacks / vault tokenisation',
    purposeEn: 'Facilitate payments, refunds, reconciliation; never store PAN/CVV',
    systemOrService: 'Neon Payment + SavedPaymentMethod; PayTabs',
    internalAccessRoles: ['customer_self_limited', 'admin', 'system_jobs'],
    externalRecipientOrProcessor: 'paytabs',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'PayTabs JOR endpoint evidenced; DB region unproven',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'UNKNOWN',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; erasure restricted for accounting/fraud',
    securityControlNotes:
      'PAN/CVV not in Mazare3 schema/logging; providerTokenCipher AES-GCM when saved cards used (token metadata only)',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'Payment/refund financial metadata = SENSITIVE_PERSONAL_DATA_FINANCIAL. Saved provider token metadata is financial-sensitive where it constitutes financial information; PAN/CVV remain absent from Mazare3.',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'saved_payment_token_metadata',
    nameEn: 'Saved payment-provider token metadata',
    nameAr: 'بيانات وصفية لرمز مزود الدفع المحفوظ',
    dataSubjectCategory: 'customer',
    dataCategories: ['provider_token_cipher', 'masked_display', 'provider_refs'],
    financialData: true,
    sensitiveClassification: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
    sensitivePersonalDataPossible: true,
    collectionSource: 'optional saved-card vault flow',
    purposeEn: 'Enable repeat checkout without re-entering card details at PSP',
    systemOrService: 'Neon SavedPaymentMethod + payment-vault-crypto',
    internalAccessRoles: ['customer_self', 'admin', 'system'],
    externalRecipientOrProcessor: 'paytabs',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'same as primary DB / PSP',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'UNKNOWN',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; deletion of saved method where product supports',
    securityControlNotes: 'AES-GCM cipher of provider token — not PAN/CVV',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'Covered as focused activity row; also referenced under payment_metadata. Financial-sensitive classification.',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'owner_kyc_documents',
    nameEn: 'Owner KYC / authority documents',
    nameAr: 'وثائق التحقق وصلاحية المالك',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'identity_docs',
      'authority_docs',
      'original_file_name',
      'storage_key',
      'possible_photo',
      'possible_national_identifier',
      'possible_date_of_birth',
      'possible_signature',
    ],
    financialData: false,
    sensitiveClassification: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'partner onboarding upload',
    purposeEn: 'Verify Owner identity / listing authority for marketplace trust & compliance',
    systemOrService: 'Neon OwnerDocument + private R2',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'cloudflare_r2_private_kyc',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; erasure/anonymisation subject to anti-fraud & legal holds',
    securityControlNotes:
      'Private bucket; authenticated download stream; Cache-Control private no-store; owner scoped by ownerProfileId; admin route requireAdmin; no public URL pattern',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'HIGH-RISK personal data; may contain sensitive personal data depending on document contents (identity details, photograph, national identifier, DOB, signatures, potentially other sensitive fields). Restricted access. DPIA/legal review required. Do NOT claim every KYC document is automatically legally "sensitive" without examining contents.',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'owner_account_and_marketplace_operation',
    nameEn: 'Owner account & marketplace operation (residual)',
    nameAr: 'حساب المالك وتشغيل السوق (متبقي)',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'owner_profile_fields',
      'partner_onboarding_status',
      'marketplace_participation_operational_metadata',
    ],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'become-owner / partner onboarding / owner shell',
    purposeEn:
      'Residual inventory key for Owner marketplace participation operational data not covered by purpose-specific Prior Consents (3C.4D.7B counsel reclassification)',
    systemOrService: 'Neon OwnerProfile + partner onboarding state',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; rectification; erasure subject to contract/dispute holds',
    securityControlNotes:
      'Not gated by owner_account_and_marketplace_operation Prior Consent (collection suspended 3C.4D.7B). Account Prior Consent + Owner Agreement LegalAcceptance + purpose-specific Prior Consents apply where processing starts.',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED. Do not invent Jordan contractual-necessity exception from code. Do not wire blanket Prior Consent checkbox.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'owner_operator_party_and_declared_property_owner',
    nameEn: 'Owner OperatorParty / declared Property owner',
    nameAr: 'الطرف المتعاقد ومالك العقار حسب الإفادة',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'legal_name',
      'registration_number_optional',
      'registration_authority_optional',
      'contact_email_optional',
      'contact_phone_optional',
      'authority_basis',
      'account_holder_relation',
      'attestation_metadata',
    ],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'owner onboarding + property authority package',
    purposeEn:
      'Identify contracting operator vs account holder vs declared Property owner for authority assessment',
    systemOrService: 'Neon OperatorParty + Property authority fields + OwnerAttestation',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'none_primary',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'PRIMARY_APP_DB',
    regionEvidenceStatus: 'TECHNICALLY_CONFIRMED',
    crossBorderStatus: 'JORDAN_ONLY_CONFIRMED',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; rectification; erasure subject to dispute/audit holds',
    securityControlNotes:
      'Not exposed on public Property mappers; declared owner is Owner-declared wording only — never “verified legal owner” without review',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'PUBLIC_POLICY_CHANGE_MAY_BE_REQUIRED later if Privacy Policy must name OperatorParty fields; inventory-only update in 3C.4D.3. Do not invent third-party national IDs. See also owner_authority_third_party_personal_data.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'owner_authority_third_party_personal_data',
    nameEn: 'Authority package third-party Personal Data',
    nameAr: 'بيانات شخصية لأطراف ثالثة في حزمة الصلاحية',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'declared_property_owner_name_if_third_party',
      'authorised_representative_name_optional',
      'manager_name_optional',
      'authority_document_incidental_third_party_identifiers',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'Owner-declared authority package + uploaded authority documents',
    purposeEn:
      'Assess listing authority when declared owner / representative / manager may be a different individual than the account holder',
    systemOrService: 'Neon Property authority fields + OwnerDocument private storage',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'cloudflare_r2_private_kyc',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact:
      'third-party DSR may apply; no fabricated third-party Prior Consent checkbox in product',
    securityControlNotes:
      'Private document storage; not public; Owner-declared names only; documents may contain incidental third-party PD',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED. Source=Owner upload/declaration; disclosure=admin review; retention=LEGAL_REVIEW; do NOT invent third-party consent UI unless counsel requires and architecture supports it.',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'property_regulatory_evidence',
    nameEn: 'Property regulatory evidence documents',
    nameAr: 'مستندات الأدلة التنظيمية للعقار',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'regulatory_documents',
      'original_file_name',
      'storage_key',
      'issuer_optional',
      'document_number_optional',
      'expiry_date_optional',
    ],
    financialData: false,
    sensitiveClassification: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'owner regulatory evidence upload',
    purposeEn:
      'Support Mazare3 regulatory applicability/compliance assessment for Property offerings',
    systemOrService: 'Neon RegulatoryEvidence + private R2/S3 partner storage',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'cloudflare_r2_private_kyc',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; erasure subject to compliance/audit holds',
    securityControlNotes:
      'Private storageKey only; authenticated Owner/admin download; not in public Property mappers',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'PUBLIC_POLICY_CHANGE_MAY_BE_REQUIRED if Privacy Policy must name regulatory evidence; inventory-only in 3C.4D.4A. Documents may contain Personal Data; gated under owner_identity_and_authority_verification Prior Consent at upload — no separate regulatory-doc Prior Consent checkbox.',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'property_pool_safety_personal_data_implications',
    nameEn: 'Property pool/safety Personal Data implications',
    nameAr: 'آثار البيانات الشخصية لسلامة المسبح',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'attestation_actor_user_id',
      'reviewer_admin_user_id',
      'free_text_safety_disclosure_optional',
      'pool_safety_property_facts_non_pd',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'Owner pool/safety attestations + admin review (3C.4D.5)',
    purposeEn:
      'Record pool/safety listing facts with attestation/reviewer identity; ordinary Property pool facts are not classified as sensitive Personal Data',
    systemOrService: 'Neon Property pool/safety fields + attestation audit',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access to attestation metadata; free-text may require redaction review',
    securityControlNotes:
      'No separate Prior Consent for ordinary pool facts; free-text disclosures minimised; do not over-classify Property facts as sensitive PD',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes:
      '3C.4D.7B: inventory PD implications only. Attestor/reviewer IDs are operational. Free-text = SENSITIVE_DATA_POSSIBLE. No new consent checkbox.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'owner_payout_iban',
    nameEn: 'Owner payout / IBAN / bank / beneficiary data',
    nameAr: 'بيانات الصرف / الآيبان / البنك / المستفيد للمالك',
    dataSubjectCategory: 'owner_partner',
    dataCategories: [
      'iban_cipher',
      'bank_name_cipher',
      'beneficiary_name_cipher',
      'iban_last4',
      'settlement_payout_financial_records',
    ],
    financialData: true,
    sensitiveClassification: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
    sensitivePersonalDataPossible: true,
    collectionSource: 'partner payout profile form',
    purposeEn: 'Settle Owner earnings',
    systemOrService: 'Neon OwnerPayoutProfile + settlement records',
    internalAccessRoles: ['owner_self', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres; payout ops as configured',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; correction; erasure limited',
    securityControlNotes:
      'AES-256-GCM field encryption via PARTNER_DATA_ENCRYPTION_KEY; fingerprint for uniqueness; masked last4 only in Owner UI; Admin decrypt for authorised beneficiary review only (3C.4D.7A); Prior Consent owner_payout_and_financial_processing; third-party READY blocked by counsel flag',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'Owner IBAN, bank account details, beneficiary/payout data, and settlement financial records = SENSITIVE_PERSONAL_DATA_FINANCIAL under Jordan PDPL mapping. Contracting OperatorParty is primary beneficiary reference (not User display name).',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'exact_property_location',
    nameEn: 'Exact Property location & arrival instructions',
    nameAr: 'الموقع الدقيق للعقار وتعليمات الوصول',
    dataSubjectCategory: 'owner_partner',
    dataCategories: ['exact_address', 'exact_coordinates', 'arrival_instructions'],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'Owner property forms',
    purposeEn: 'Enable Customer arrival after confirmed paid Booking; public pages show approx only',
    systemOrService: 'Neon Property; location-privacy reveal rules',
    internalAccessRoles: ['owner_self', 'eligible_customer', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; restrict public exposure controls',
    securityControlNotes: 'canRevealExactLocation gating; public payload strips exact keys',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes: 'Precise location disclosure risk — keep RESTRICT_ACCESS',
    minimisation: 'RESTRICT_ACCESS',
  },
  {
    key: 'public_listing_media',
    nameEn: 'Public Property listing media',
    nameAr: 'وسائط عرض العقار العامة',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'property_images',
      'property_media_urls',
      'possible_incidental_identifiable_people',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'Owner media upload to public R2',
    purposeEn: 'Market Properties to prospective Customers',
    systemOrService: 'Cloudflare R2 public media + Property media records',
    internalAccessRoles: ['owner_self', 'public_read', 'admin'],
    externalRecipientOrProcessor: 'cloudflare_r2_public_media',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access/erasure of media subject to listing ops; incidental persons may lack direct account link',
    securityControlNotes:
      'No face recognition or biometric processing. Moderation/minimisation implications for staff; Owner lawful-upload duties belong in Owner Agreement / content rules (separate from this inventory).',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'Public listing media may incidentally contain identifiable people (SENSITIVE_DATA_POSSIBLE). Do not introduce biometric processing.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'optional_privacy_consent',
    nameEn: 'Optional privacy consents (marketing/analytics/cookies)',
    nameAr: 'موافقات الخصوصية الاختيارية',
    dataSubjectCategory: 'customer',
    dataCategories: ['purpose', 'status', 'consent_version', 'withdrawn_at', 'source_surface'],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'account privacy / cookie surfaces',
    purposeEn: 'Record optional consent separately from Terms acceptance',
    systemOrService: 'Neon PrivacyConsent',
    internalAccessRoles: ['customer_self', 'admin'],
    externalRecipientOrProcessor: null,
    processorRoleStatus: 'CONTROLLER_ROLE_PENDING',
    storageOrProcessingRegion: 'same as primary DB',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'TECHNICAL_BEHAVIOR_ONLY',
    dsrImpact: 'consent_withdrawal; objection; access',
    securityControlNotes: 'Withdrawal sets status=withdrawn + withdrawnAt; history rows retained',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes: 'Must remain unbundled from Terms; marketing infrastructure may be inactive',
    minimisation: 'KEEP',
  },
  {
    key: 'legal_acceptance_evidence',
    nameEn: 'Legal acceptance / booking legal snapshot evidence',
    nameAr: 'أدلة قبول الشروط ولقطات الحجز القانونية',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'document_type',
      'version',
      'accepted_at',
      'user_link',
      'booking_legal_snapshot',
    ],
    financialData: false,
    sensitiveClassification: 'NOT_SENSITIVE',
    sensitivePersonalDataPossible: false,
    collectionSource: 'acceptance gates / checkout / partner agreement',
    purposeEn: 'Prove acceptance of contractual/legal documents',
    systemOrService: 'Neon LegalAcceptance + BookingLegalSnapshot',
    internalAccessRoles: ['parties', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres',
    processorRoleStatus: 'CONTROLLER_ROLE_PENDING',
    storageOrProcessingRegion: 'same as primary DB',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; erasure generally refused for legal evidence',
    securityControlNotes: 'Immutable retention; listed in erasure-retained categories',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes: 'Register completeness — focused evidence activity.',
    minimisation: 'KEEP',
  },
  {
    key: 'transactional_notifications',
    nameEn: 'Transactional / operational notifications',
    nameAr: 'الإشعارات التشغيلية والمعاملات',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'notification_type',
      'user_link',
      'booking_refs',
      'in_app_message_metadata',
      'email_when_provider_enabled',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'notification.service / jobs',
    purposeEn: 'Deliver operational Booking, payment, and account notices',
    systemOrService: 'Neon Notification (+ Resend/SMTP when EMAIL_PROVIDER enabled)',
    internalAccessRoles: ['recipient_self', 'admin', 'system'],
    externalRecipientOrProcessor: 'resend_email when enabled',
    processorRoleStatus: 'PROCESSOR_ROLE_PENDING',
    storageOrProcessingRegion: 'DB + email provider when enabled',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access; objection limited for essential operational notices',
    securityControlNotes: 'Email delivery inactive when EMAIL_PROVIDER=none; do not invent active transfers',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes:
      'Email delivery covered here when enabled (also processor resend_email). Free-text content in notices may incidentally include PII — MINIMISE.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'data_subject_requests',
    nameEn: 'Data subject request & privacy complaint handling',
    nameAr: 'معالجة طلبات أصحاب البيانات وشكاوى الخصوصية',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'request_type',
      'email',
      'description_free_text',
      'admin_notes',
      'status',
      'due_at',
      'response',
      'completed_at',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'account privacy tools / admin console',
    purposeEn: 'Receive and track Jordan data-subject rights requests and privacy complaints',
    systemOrService: 'Neon DataSubjectRequest',
    internalAccessRoles: ['requester', 'admin'],
    externalRecipientOrProcessor: null,
    processorRoleStatus: 'CONTROLLER_ROLE_PENDING',
    storageOrProcessingRegion: 'same as primary DB',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'meta-processing of rights requests; privacy_complaint distinct from privacy_inquiry',
    securityControlNotes:
      'Admin-only status updates; audit logs on create/update; 15 working-day dueAt via Jordan privacy business calendar; DUE_SOON warning; holiday verification flag when calendar empty',
    dpiaStatus: 'NOT_REQUIRED_PENDING_REVIEW',
    legalReviewNotes:
      'DSR description free text = SENSITIVE_DATA_POSSIBLE. Does not prevent contacting the competent Jordanian authority. Holiday calendar configurable — do not invent dates.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'security_audit_logs',
    nameEn: 'Security / audit logs',
    nameAr: 'سجلات الأمن والتدقيق',
    dataSubjectCategory: 'mixed',
    dataCategories: ['actor_user_id', 'action', 'entity_refs', 'request_metadata_if_stored'],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'application audit service',
    purposeEn: 'Security, fraud prevention, accountability',
    systemOrService: 'Neon AuditLog (+ rate-limit/abuse hashed keys)',
    internalAccessRoles: ['admin', 'system'],
    externalRecipientOrProcessor: 'neon_postgres',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'may refuse erasure where security/legal hold applies',
    securityControlNotes: 'LoginAbuseState/RateLimitBucket use hashed identifiers; raw IP not confirmed as stored',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes: 'Confirm whether IP is ever persisted outside hashed keys',
    minimisation: 'MINIMISE',
  },
  {
    key: 'reviews_support_disputes',
    nameEn: 'Reviews, support tickets, disputes/incidents',
    nameAr: 'المراجعات وتذاكر الدعم والنزاعات/الحوادث',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'review_free_text',
      'support_ticket_text',
      'dispute_text',
      'incident_evidence_text',
      'guest_contact_on_tickets',
      'reasons',
    ],
    financialData: false,
    sensitiveClassification: 'SENSITIVE_DATA_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'in-product forms',
    purposeEn: 'Marketplace quality, support, fairness incidents',
    systemOrService: 'Neon Review / SupportTicket / Dispute / BookingIncident',
    internalAccessRoles: ['parties', 'admin'],
    externalRecipientOrProcessor: 'neon_postgres; email if notifications enabled',
    processorRoleStatus: 'ROLE_REQUIRES_CONTRACT_REVIEW',
    storageOrProcessingRegion: 'REGION_REQUIRES_PROVIDER_CONFIRMATION',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'access, correction, erasure with dispute holds',
    securityControlNotes: 'Role-scoped access; free text may contain voluntarily/incidentally supplied sensitive data',
    dpiaStatus: 'DPIA_RECOMMENDED',
    legalReviewNotes:
      'Do not classify the entire activity as always sensitive. Free-text channels = SENSITIVE_DATA_POSSIBLE. Staff guidance: minimise prompts for excess PII; redact where operationally feasible.',
    minimisation: 'MINIMISE',
  },
  {
    key: 'personal_data_breach_response',
    nameEn: 'Personal-data breach incident response (Art. 20 readiness)',
    nameAr: 'الاستجابة لحوادث خرق البيانات الشخصية',
    dataSubjectCategory: 'mixed',
    dataCategories: [
      'breach_incident_metadata',
      'affected_subject_id_refs',
      'affected_data_category_flags',
      'assessment_notes',
      'notification_draft_evidence',
      'authority_pack_evidence',
      'investigation_audit_refs',
    ],
    financialData: false,
    sensitiveClassification: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
    sensitivePersonalDataPossible: true,
    collectionSource: 'admin privacy/security breach console',
    purposeEn:
      'Record, assess, contain, and prepare notifications for personal-data security incidents under Jordan PDPL Article 20 readiness',
    systemOrService: 'Neon PersonalDataBreachIncident + AuditLog',
    internalAccessRoles: ['admin_authorised_privacy_ops'],
    externalRecipientOrProcessor: null,
    processorRoleStatus: 'CONTROLLER_ROLE_PENDING',
    storageOrProcessingRegion: 'same as primary DB',
    regionEvidenceStatus: 'PROVIDER_CONTRACT_REQUIRED',
    crossBorderStatus: 'CROSS_BORDER_POSSIBLE',
    legalBasisReviewStatus: 'LEGAL_REVIEW_REQUIRED',
    retentionStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    dsrImpact: 'breach records may themselves be subject to access with strong redaction',
    securityControlNotes:
      'privacy_breach_* capabilities or superAdmin required (ordinary admin denied). Do not store breached payloads, KYC bytes, PAN/CVV, or secrets. Affected people referenced by IDs/counts + per-recipient notice evidence. Closing/reopening must preserve notification/audit/deadline history.',
    dpiaStatus: 'DPIA_REQUIRED_LEGAL_REVIEW',
    legalReviewNotes:
      'Breach records are high-risk operational data. Art. 20 clocks use Affected Data Subjects terminology (not Customers only). Encryption does not automatically dismiss severe-harm. No automatic regulator filing. dpoAppointed remains false.',
    minimisation: 'RESTRICT_ACCESS',
  },
];

export const PRIVACY_PROCESSING_ACTIVITIES: PrivacyProcessingActivity[] =
  PRIVACY_PROCESSING_ACTIVITY_CORES.map((core) => {
    const overlay = PRIVACY_ACTIVITY_PRIOR_CONSENT_OVERLAY[core.key];
    if (!overlay) {
      throw new Error(`Missing Jordan Prior Consent overlay for activity ${core.key}`);
    }
    return { ...core, ...overlay };
  });

// Sanity: keep boolean aligned with classification helper for all rows
for (const a of PRIVACY_PROCESSING_ACTIVITIES) {
  if (a.sensitivePersonalDataPossible !== sensitivePossible(a.sensitiveClassification)) {
    throw new Error(`sensitivePersonalDataPossible mismatch for activity ${a.key}`);
  }
}

export const PRIVACY_RETENTION_MAP: PrivacyRetentionRow[] = [
  {
    key: 'accounts',
    categoryEn: 'User accounts',
    purposeEn: 'Account lifecycle',
    retentionStartEvent: 'account creation / last activity (technical behavior TBD)',
    currentTechnicalBehavior: 'Retained until account closure process (no automated purge found)',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Scoped anonymisation via DSR erasure policy when lawful',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
  {
    key: 'kyc',
    categoryEn: 'Owner KYC documents',
    purposeEn: 'Verification / compliance',
    retentionStartEvent: 'document upload / verification decision',
    currentTechnicalBehavior: 'Stored in private R2 + OwnerDocument metadata; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Delete/anonymise when legally permitted after verification purpose ends',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE — retention review must use this risk category',
  },
  {
    key: 'bookings',
    categoryEn: 'Booking records',
    purposeEn: 'Contract performance / disputes',
    retentionStartEvent: 'booking creation',
    currentTechnicalBehavior: 'Durable rows; listed as erasure-retained evidence',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Retain then anonymise non-essential fields when lawful',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'Includes financial amounts — SENSITIVE_PERSONAL_DATA_FINANCIAL category for retention review',
  },
  {
    key: 'payments_refunds',
    categoryEn: 'Payment / refund metadata',
    purposeEn: 'Accounting, refunds, fraud',
    retentionStartEvent: 'payment initiation / capture',
    currentTechnicalBehavior: 'Durable Payment + RefundRequest rows; no PAN/CVV',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Retain financial evidence; minimise free-text',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
  },
  {
    key: 'settlements',
    categoryEn: 'Owner settlements / payouts',
    purposeEn: 'Partner settlement',
    retentionStartEvent: 'settlement period close',
    currentTechnicalBehavior: 'Durable settlement records',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Retain for accounting; counsel period required',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_PERSONAL_DATA_FINANCIAL (IBAN/beneficiary linkage)',
  },
  {
    key: 'legal_acceptances',
    categoryEn: 'LegalAcceptance evidence',
    purposeEn: 'Prove contract acceptance',
    retentionStartEvent: 'acceptance event',
    currentTechnicalBehavior: 'Immutable retention; erasure-retained',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Do not hard-delete; counsel on duration',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
  {
    key: 'audit_security_logs',
    categoryEn: 'Audit / security logs',
    purposeEn: 'Security & accountability',
    retentionStartEvent: 'event time',
    currentTechnicalBehavior: 'Append-only audit logs; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Minimise PII in metadata; timed purge after counsel period',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_DATA_POSSIBLE in free-text metadata',
  },
  {
    key: 'support_disputes',
    categoryEn: 'Support / disputes / incidents',
    purposeEn: 'Support & fairness',
    retentionStartEvent: 'ticket/dispute open',
    currentTechnicalBehavior: 'Durable rows',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Anonymise after closure when lawful',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_DATA_POSSIBLE (free text)',
  },
  {
    key: 'reviews',
    categoryEn: 'Reviews',
    purposeEn: 'Marketplace reputation',
    retentionStartEvent: 'review publish',
    currentTechnicalBehavior: 'Durable Review rows',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Hide/anonymise on DSR where lawful',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_DATA_POSSIBLE (free text)',
  },
  {
    key: 'exact_location',
    categoryEn: 'Exact Property location',
    purposeEn: 'Arrival after confirmation',
    retentionStartEvent: 'property save',
    currentTechnicalBehavior: 'Stored on Property; public reveal gated',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Restrict access; delete when listing removed if lawful',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
  {
    key: 'uploaded_documents',
    categoryEn: 'Uploaded partner documents',
    purposeEn: 'KYC / authority',
    retentionStartEvent: 'upload',
    currentTechnicalBehavior: 'Private object + metadata; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Secure delete from R2 when retention expires',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
  },
  {
    key: 'listing_media',
    categoryEn: 'Public listing media',
    purposeEn: 'Property marketing',
    retentionStartEvent: 'media upload',
    currentTechnicalBehavior: 'Public R2 objects + media metadata',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'Remove on listing deletion; incidental persons handling LEGAL_REVIEW',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_DATA_POSSIBLE (incidental identifiable people)',
  },
  {
    key: 'abandoned_owner_onboarding_kyc',
    categoryEn: 'Abandoned Owner onboarding — KYC documents',
    purposeEn: 'Incomplete partner verification',
    retentionStartEvent: 'KYC upload without completed Owner activation',
    currentTechnicalBehavior: 'Private R2 + OwnerDocument rows retained; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation:
      'PRIVACY_RETENTION_DECISION_REQUIRED — founder/counsel must set period before purge',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE; PRIVACY_RETENTION_DECISION_REQUIRED',
  },
  {
    key: 'abandoned_owner_onboarding_authority',
    categoryEn: 'Abandoned Owner onboarding — authority evidence',
    purposeEn: 'Incomplete authority package',
    retentionStartEvent: 'authority document/declaration without completed listing',
    currentTechnicalBehavior: 'Private storage + Property authority fields retained',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'PRIVACY_RETENTION_DECISION_REQUIRED',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'May include third-party PD; OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED',
  },
  {
    key: 'abandoned_owner_onboarding_property_draft',
    categoryEn: 'Abandoned Owner onboarding — Property drafts',
    purposeEn: 'Incomplete listing draft',
    retentionStartEvent: 'Property draft create',
    currentTechnicalBehavior: 'Draft Property rows retained; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'PRIVACY_RETENTION_DECISION_REQUIRED',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
  {
    key: 'abandoned_owner_onboarding_regulatory',
    categoryEn: 'Abandoned Owner onboarding — regulatory evidence',
    purposeEn: 'Incomplete regulatory package',
    retentionStartEvent: 'regulatory evidence upload',
    currentTechnicalBehavior: 'Private RegulatoryEvidence retained',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'PRIVACY_RETENTION_DECISION_REQUIRED',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'HIGH_RISK_PERSONAL_DATA_SENSITIVE_POSSIBLE',
  },
  {
    key: 'abandoned_owner_onboarding_exact_location',
    categoryEn: 'Abandoned Owner onboarding — exact location',
    purposeEn: 'Draft exact location before publication',
    retentionStartEvent: 'exact location save on draft',
    currentTechnicalBehavior: 'Stored on Property; public reveal gated',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'PRIVACY_RETENTION_DECISION_REQUIRED',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
  {
    key: 'abandoned_owner_onboarding_payout',
    categoryEn: 'Abandoned Owner onboarding — payout data if entered',
    purposeEn: 'Payout profile before marketplace activity',
    retentionStartEvent: 'payout profile save',
    currentTechnicalBehavior: 'Encrypted IBAN/beneficiary retained; no automated purge found',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation: 'PRIVACY_RETENTION_DECISION_REQUIRED',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    riskCategoryNote: 'SENSITIVE_PERSONAL_DATA_FINANCIAL',
  },
  {
    key: 'abandoned_owner_onboarding_consent_acceptance',
    categoryEn: 'Abandoned Owner onboarding — consent/acceptance evidence',
    purposeEn: 'Prove Prior Consent / LegalAcceptance events',
    retentionStartEvent: 'grant/accept event',
    currentTechnicalBehavior: 'Append-only LegalAcceptance + DataProcessingConsent history',
    statutoryOrBusinessStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
    proposedDeletionOrAnonymisation:
      'Do not hard-delete evidence rows; PRIVACY_RETENTION_DECISION_REQUIRED for duration only',
    exactLegalPeriodStatus: 'LEGAL_RETENTION_PERIOD_REQUIRES_REVIEW',
  },
];

export const PRIVACY_DPIA_READINESS: PrivacyDpiaRow[] = [
  {
    key: 'owner_kyc',
    topicEn: 'Owner KYC identity documents',
    status: 'DPIA_REQUIRED_LEGAL_REVIEW',
    notes:
      'High-risk docs; may contain sensitive data depending on contents; possible cross-border object storage',
  },
  {
    key: 'financial_iban',
    topicEn: 'Financial / IBAN / payment metadata (sensitive financial)',
    status: 'DPIA_REQUIRED_LEGAL_REVIEW',
    notes: 'SENSITIVE_PERSONAL_DATA_FINANCIAL; field encryption confirmed; transfer/retention still open',
  },
  {
    key: 'exact_location',
    topicEn: 'Exact location disclosure',
    status: 'DPIA_RECOMMENDED',
    notes: 'Reveal gating exists; assess residual risk',
  },
  {
    key: 'cross_border',
    topicEn: 'Cross-border storage/processing',
    status: 'DPIA_REQUIRED_LEGAL_REVIEW',
    notes: 'Multiple processors with unproven regions — Production blocker readiness',
  },
  {
    key: 'fraud_security',
    topicEn: 'Fraud / security processing',
    status: 'DPIA_RECOMMENDED',
    notes: 'Hashed abuse keys; confirm log contents',
  },
  {
    key: 'free_text_channels',
    topicEn: 'Free-text support / disputes / DSR / reviews',
    status: 'DPIA_RECOMMENDED',
    notes: 'SENSITIVE_DATA_POSSIBLE — minimisation guidance required',
  },
  {
    key: 'personal_data_breach_response',
    topicEn: 'Personal-data breach incident records & notifications',
    status: 'DPIA_REQUIRED_LEGAL_REVIEW',
    notes: 'High-risk operational records; Art. 20 readiness; restrict access',
  },
  {
    key: 'future_profiling_analytics',
    topicEn: 'Future profiling / analytics',
    status: 'DPIA_NOT_COMPLETED',
    notes: 'Optional analytics consent purpose exists; product analytics not confirmed shipped',
  },
];

/** Contractual customer package versions must remain unchanged by this privacy phase. */
export const PRIVACY_PHASE_MUST_NOT_MUTATE_CONTRACT_VERSIONS = [
  ADVISOR_REVISED_VERSION, // 1.1.2-advisor-final
] as const;

export const PRIVACY_POLICY_CORPUS_VERSION_NOTE =
  `Public Privacy Policy corpus DRAFT is ${PRIVACY_ADVISOR_REVISED_VERSION} (Phase 3C.4B.2C) — NOT counsel-activated / NOT Production-active. Historical ${PRIVACY_ADVISOR_REVISED_VERSION_111}, ${PRIVACY_ADVISOR_REVISED_VERSION_110}, and ${LAUNCH_CANDIDATE_VERSION} preserved separately.`;
