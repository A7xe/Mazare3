/**
 * Phase 3C.4B.1.2 / 3C.4B.1.3 — Personal data breach readiness (Jordan PDPL Article 20).
 *
 * 3C.4B.1.3: Affected Data Subjects terminology (not Customer-only), per-recipient
 * notification evidence helpers, RBAC capability constants, aggregate status derivation.
 *
 * LOCAL / INTERNAL only — no automatic regulator submission / mass email.
 */

/** Article 20 — affected Data Subjects (severe-harm): 24 elapsed hours from discovery. */
export const BREACH_DATA_SUBJECT_NOTIFICATION_HOURS = 24 as const;
/** @deprecated Use BREACH_DATA_SUBJECT_NOTIFICATION_HOURS — Customer is too narrow. */
export const BREACH_CUSTOMER_NOTIFICATION_HOURS = BREACH_DATA_SUBJECT_NOTIFICATION_HOURS;

/** Article 20 — Personal Data Protection Unit: 72 elapsed hours from discovery. */
export const BREACH_AUTHORITY_NOTIFICATION_HOURS = 72 as const;

export const BREACH_DATA_SUBJECT_DUE_SOON_HOURS = 6 as const;
/** @deprecated Use BREACH_DATA_SUBJECT_DUE_SOON_HOURS */
export const BREACH_CUSTOMER_DUE_SOON_HOURS = BREACH_DATA_SUBJECT_DUE_SOON_HOURS;
export const BREACH_AUTHORITY_DUE_SOON_HOURS = 12 as const;
export const BREACH_AUTHORITY_URGENT_HOURS = 6 as const;

export const AFFECTED_DATA_SUBJECTS_LABEL = {
  en: 'Affected Data Subjects',
  ar: 'الأشخاص المعنيون المتأثرون',
} as const;

/** Least-privilege admin capabilities for breach records (3C.4B.1.3). */
export const PRIVACY_BREACH_CAPABILITIES = [
  'privacy_breach_view',
  'privacy_breach_manage',
  'privacy_breach_notification_approve',
  'privacy_breach_authority_record',
  /** Elevated: move effective discovery to a LATER timestamp (extends clocks). */
  'privacy_breach_discovery_correct_later',
] as const;
export type PrivacyBreachCapabilityCode = (typeof PRIVACY_BREACH_CAPABILITIES)[number];

export const PERSONAL_DATA_BREACH_WORKFLOW_STATUSES = [
  'reported',
  'triage',
  'investigating',
  'contained',
  'legal_assessment',
  'notification_required',
  'notification_in_progress',
  'monitoring',
  'closed',
] as const;
export type PersonalDataBreachWorkflowStatusCode =
  (typeof PERSONAL_DATA_BREACH_WORKFLOW_STATUSES)[number];

export const PERSONAL_DATA_BREACH_INCIDENT_KINDS = [
  'security_incident_only',
  'personal_data_breach',
] as const;
export type PersonalDataBreachIncidentKindCode =
  (typeof PERSONAL_DATA_BREACH_INCIDENT_KINDS)[number];

export const SEVERE_HARM_ASSESSMENT_STATUSES = [
  'unassessed',
  'assessing',
  'severe_harm_likely',
  'severe_harm_not_likely',
  'legal_review_required',
] as const;
export type SevereHarmAssessmentStatusCode =
  (typeof SEVERE_HARM_ASSESSMENT_STATUSES)[number];

export const LEGAL_NOTIFICATION_ASSESSMENTS = [
  'not_assessed',
  'not_notifiable',
  'notifiable_pending_confirmation',
  'notifiable_confirmed',
  'legal_review_required',
] as const;
export type LegalNotificationAssessmentCode =
  (typeof LEGAL_NOTIFICATION_ASSESSMENTS)[number];

/** Incident-level aggregate channel status (derived from recipient evidence when present). */
export const BREACH_NOTIFICATION_CHANNEL_STATUSES = [
  'not_required',
  'pending_review',
  'required',
  'prepared',
  'approved_for_send',
  'attempted',
  'partially_sent',
  'sent',
  'confirmed',
  'failed',
  'manual_followup_required',
  'overdue',
] as const;
export type BreachNotificationChannelStatusCode =
  (typeof BREACH_NOTIFICATION_CHANNEL_STATUSES)[number];

/** Per affected Data Subject / recipient notice evidence states. */
export const BREACH_RECIPIENT_NOTICE_STATES = [
  'not_required',
  'pending',
  'prepared',
  'approved',
  'attempted',
  'sent',
  'delivery_confirmed',
  'failed',
  'manual_followup_required',
] as const;
export type BreachRecipientNoticeStateCode =
  (typeof BREACH_RECIPIENT_NOTICE_STATES)[number];

export const BREACH_AFFECTED_DATA_CATEGORIES = [
  'identity_contact',
  'financial_sensitive',
  'payout_iban',
  'kyc',
  'booking_history',
  'payment_metadata',
  'legal_acceptance_data',
  'precise_property_location',
  'support_dispute_content',
  'authentication_account_data',
  'listing_media_incidental',
  'dsr_or_complaint_content',
  'audit_security_logs',
] as const;
export type BreachAffectedDataCategoryCode =
  (typeof BREACH_AFFECTED_DATA_CATEGORIES)[number];

export const BREACH_DATA_SUBJECT_CATEGORIES = [
  'customer',
  'owner_partner',
  'visitor_unauthenticated',
  'admin_staff',
  'mixed',
  'unknown_or_non_account',
] as const;
export type BreachDataSubjectCategoryCode =
  (typeof BREACH_DATA_SUBJECT_CATEGORIES)[number];

export type BreachDeadlineUrgency = 'ok' | 'DUE_SOON' | 'URGENT' | 'OVERDUE' | 'n/a';

export type BreachSevereHarmFactorAid = {
  key: string;
  labelEn: string;
  elevatesConcern: boolean;
};

export const BREACH_SEVERE_HARM_FACTOR_AID: readonly BreachSevereHarmFactorAid[] = [
  { key: 'financial_sensitive', labelEn: 'Financial-sensitive personal data involved', elevatesConcern: true },
  { key: 'kyc_identity_docs', labelEn: 'KYC / identity documents involved', elevatesConcern: true },
  { key: 'auth_credentials', labelEn: 'Authentication credentials / session data involved', elevatesConcern: true },
  { key: 'high_volume', labelEn: 'Large number of affected individuals', elevatesConcern: true },
  { key: 'easy_identification', labelEn: 'Individuals readily identifiable from exposed data', elevatesConcern: true },
  { key: 'encryption_protected', labelEn: 'Data was encrypted at rest/in transit', elevatesConcern: false },
  { key: 'keys_compromised', labelEn: 'Encryption keys / vault secrets also compromised', elevatesConcern: true },
  { key: 'long_exposure', labelEn: 'Extended exposure duration before containment', elevatesConcern: true },
  { key: 'unauthorised_recipient', labelEn: 'Unauthorised third-party access / exfiltration', elevatesConcern: true },
  { key: 'likely_financial_harm', labelEn: 'Likely financial harm', elevatesConcern: true },
  { key: 'likely_identity_harm', labelEn: 'Likely identity / privacy harm', elevatesConcern: true },
  { key: 'likely_discrimination_or_safety', labelEn: 'Likely discrimination or safety harm', elevatesConcern: true },
  { key: 'containment_success', labelEn: 'Containment appears successful / limited exposure', elevatesConcern: false },
] as const;

export type BreachContainmentChecklist = {
  accessRevoked: boolean;
  credentialsOrTokensRotated: boolean;
  vulnerableEndpointDisabled: boolean;
  compromisedSessionsInvalidated: boolean;
  storageExposureCorrected: boolean;
  affectedSecretsRotated: boolean;
  evidencePreserved: boolean;
  forensicNotesRecorded: boolean;
  rootCauseRecorded: boolean;
  remediationActionRecorded: boolean;
  preventiveFollowUpRecorded: boolean;
};

export const EMPTY_BREACH_CONTAINMENT_CHECKLIST: BreachContainmentChecklist = {
  accessRevoked: false,
  credentialsOrTokensRotated: false,
  vulnerableEndpointDisabled: false,
  compromisedSessionsInvalidated: false,
  storageExposureCorrected: false,
  affectedSecretsRotated: false,
  evidencePreserved: false,
  forensicNotesRecorded: false,
  rootCauseRecorded: false,
  remediationActionRecorded: false,
  preventiveFollowUpRecorded: false,
};

export function effectiveBreachDiscoveryAt(params: {
  discoveredAt: Date | string;
  correctedDiscoveryAt?: Date | string | null;
}): Date {
  const corrected = params.correctedDiscoveryAt
    ? typeof params.correctedDiscoveryAt === 'string'
      ? new Date(params.correctedDiscoveryAt)
      : params.correctedDiscoveryAt
    : null;
  if (corrected && !Number.isNaN(corrected.getTime())) return corrected;
  return typeof params.discoveredAt === 'string'
    ? new Date(params.discoveredAt)
    : params.discoveredAt;
}

export function computeBreachDataSubjectNotificationDueAt(discoveredAt: Date): Date {
  return new Date(discoveredAt.getTime() + BREACH_DATA_SUBJECT_NOTIFICATION_HOURS * 3600_000);
}

/** @deprecated Use computeBreachDataSubjectNotificationDueAt */
export const computeBreachCustomerNotificationDueAt = computeBreachDataSubjectNotificationDueAt;

export function computeBreachAuthorityNotificationDueAt(discoveredAt: Date): Date {
  return new Date(discoveredAt.getTime() + BREACH_AUTHORITY_NOTIFICATION_HOURS * 3600_000);
}

export function computeArticle20NotificationDeadlines(discoveredAt: Date): {
  dataSubjectNotificationDueAt: Date;
  authorityNotificationDueAt: Date;
  /** @deprecated alias — Customer is too narrow for Art. 20 */
  customerNotificationDueAt: Date;
  calendarNoteEn: string;
} {
  const dataSubjectNotificationDueAt = computeBreachDataSubjectNotificationDueAt(discoveredAt);
  const authorityNotificationDueAt = computeBreachAuthorityNotificationDueAt(discoveredAt);
  return {
    dataSubjectNotificationDueAt,
    authorityNotificationDueAt,
    customerNotificationDueAt: dataSubjectNotificationDueAt,
    calendarNoteEn:
      'Elapsed hours from discovery (Asia/Amman display). Weekends/holidays do NOT extend Article 20 deadlines. Not a DSR working-day calculation. Deadlines apply to Affected Data Subjects (not Customers only).',
  };
}

export function classifyBreachDeadlineUrgency(params: {
  dueAt: Date | string | null | undefined;
  channelStatus: string;
  now?: Date;
  dueSoonHours: number;
  urgentHours?: number;
}): BreachDeadlineUrgency {
  if (
    params.channelStatus === 'not_required' ||
    params.channelStatus === 'sent' ||
    params.channelStatus === 'confirmed' ||
    params.channelStatus === 'delivery_confirmed'
  ) {
    return 'n/a';
  }
  if (!params.dueAt) return 'n/a';
  const now = params.now ?? new Date();
  const due = typeof params.dueAt === 'string' ? new Date(params.dueAt) : params.dueAt;
  const remainingMs = due.getTime() - now.getTime();
  if (remainingMs < 0) return 'OVERDUE';
  const urgentMs = (params.urgentHours ?? 0) * 3600_000;
  if (urgentMs > 0 && remainingMs <= urgentMs) return 'URGENT';
  if (remainingMs <= params.dueSoonHours * 3600_000) return 'DUE_SOON';
  return 'ok';
}

export function isSevereHarmConfirmed(status: string): boolean {
  return status === 'severe_harm_likely';
}

export function isBreachNotificationActuallySent(status: string): boolean {
  return status === 'sent' || status === 'confirmed' || status === 'delivery_confirmed';
}

/** Capability implication: manage/approve/authority/elevate imply view. */
export function expandPrivacyBreachCapabilities(
  granted: readonly string[],
  opts?: { superAdmin?: boolean },
): Set<string> {
  if (opts?.superAdmin) return new Set(PRIVACY_BREACH_CAPABILITIES);
  const out = new Set<string>();
  for (const g of granted) {
    out.add(g);
    if (
      g === 'privacy_breach_manage' ||
      g === 'privacy_breach_notification_approve' ||
      g === 'privacy_breach_authority_record' ||
      g === 'privacy_breach_discovery_correct_later'
    ) {
      out.add('privacy_breach_view');
    }
    if (g === 'privacy_breach_discovery_correct_later') {
      out.add('privacy_breach_manage');
    }
  }
  return out;
}

export function hasPrivacyBreachCapability(
  granted: readonly string[],
  needed: PrivacyBreachCapabilityCode | PrivacyBreachCapabilityCode[],
  opts?: { superAdmin?: boolean },
): boolean {
  const caps = expandPrivacyBreachCapabilities(granted, opts);
  const need = Array.isArray(needed) ? needed : [needed];
  return need.every((n) => caps.has(n));
}

/**
 * Aggregate incident Data-Subject notification status from per-recipient evidence.
 * One FAILED recipient must NOT yield a fully-notified aggregate.
 */
export function deriveDataSubjectAggregateNoticeStatus(
  recipientStates: readonly string[],
): BreachNotificationChannelStatusCode {
  if (recipientStates.length === 0) return 'pending_review';
  const required = recipientStates.filter((s) => s !== 'not_required');
  if (required.length === 0) return 'not_required';

  const allTerminalOk = required.every(
    (s) => s === 'sent' || s === 'delivery_confirmed',
  );
  if (allTerminalOk) {
    return required.every((s) => s === 'delivery_confirmed') ? 'confirmed' : 'sent';
  }

  if (required.some((s) => s === 'manual_followup_required')) {
    return 'manual_followup_required';
  }
  if (required.some((s) => s === 'failed')) {
    const anySent = required.some((s) => s === 'sent' || s === 'delivery_confirmed');
    return anySent ? 'partially_sent' : 'failed';
  }
  if (required.some((s) => s === 'attempted')) return 'attempted';
  if (required.every((s) => s === 'approved' || s === 'sent' || s === 'delivery_confirmed')) {
    return 'approved_for_send';
  }
  if (required.every((s) => ['prepared', 'approved', 'attempted', 'sent', 'delivery_confirmed'].includes(s))) {
    return 'prepared';
  }
  if (required.some((s) => s === 'sent' || s === 'delivery_confirmed')) return 'partially_sent';
  return 'required';
}

export type DataSubjectBreachNoticeDraftInput = {
  discoveredAtIso: string;
  noticeAtIso: string;
  whatHappenedEn: string;
  whatHappenedAr: string;
  affectedCategoriesEn: string;
  affectedCategoriesAr: string;
  likelyConsequencesEn: string;
  likelyConsequencesAr: string;
  actionsTakenEn: string;
  actionsTakenAr: string;
  practicalMeasuresEn: string;
  practicalMeasuresAr: string;
  privacyContactLabelEn: string;
  privacyContactLabelAr: string;
};

export type DataSubjectBreachNoticeDraft = {
  language: 'en' | 'ar';
  subject: string;
  body: string;
};

/** Internal draft generator for Affected Data Subjects — does NOT send. */
export function buildDataSubjectBreachNoticeDrafts(
  input: DataSubjectBreachNoticeDraftInput,
): { en: DataSubjectBreachNoticeDraft; ar: DataSubjectBreachNoticeDraft } {
  const enBody = [
    `Date/time of this notice: ${input.noticeAtIso}`,
    `Discovery reference time: ${input.discoveredAtIso}`,
    '',
    'What happened:',
    input.whatHappenedEn,
    '',
    'Categories of your personal data that may be affected:',
    input.affectedCategoriesEn,
    '',
    'Known likely consequences (where appropriate):',
    input.likelyConsequencesEn,
    '',
    'Actions Mazare3 has taken:',
    input.actionsTakenEn,
    '',
    'Practical measures you can take to reduce consequences:',
    input.practicalMeasuresEn,
    '',
    `Privacy / support contact: ${input.privacyContactLabelEn}`,
    '',
    'This notice does not prevent you from contacting the competent Jordanian authority.',
  ].join('\n');

  const arBody = [
    `تاريخ/وقت هذا الإشعار: ${input.noticeAtIso}`,
    `وقت الاكتشاف المرجعي: ${input.discoveredAtIso}`,
    '',
    'ما الذي حدث:',
    input.whatHappenedAr,
    '',
    'فئات بياناتك الشخصية التي قد تكون متأثرة:',
    input.affectedCategoriesAr,
    '',
    'العواقب المحتملة المعروفة (حيث ينطبق):',
    input.likelyConsequencesAr,
    '',
    'الإجراءات التي اتخذتها مزارع:',
    input.actionsTakenAr,
    '',
    'إجراءات عملية يمكنك اتخاذها لتقليل العواقب:',
    input.practicalMeasuresAr,
    '',
    `جهة اتصال الخصوصية / الدعم: ${input.privacyContactLabelAr}`,
    '',
    'لا يمنعك هذا الإشعار من التواصل مع الجهة الأردنية المختصة.',
  ].join('\n');

  return {
    en: {
      language: 'en',
      subject: 'Important notice about your personal data — Mazare3',
      body: enBody,
    },
    ar: {
      language: 'ar',
      subject: 'إشعار هام بشأن بياناتك الشخصية — مزارع',
      body: arBody,
    },
  };
}

/** @deprecated Use buildDataSubjectBreachNoticeDrafts */
export const buildCustomerBreachNoticeDrafts = buildDataSubjectBreachNoticeDrafts;
/** @deprecated */
export type CustomerBreachNoticeDraftInput = DataSubjectBreachNoticeDraftInput;
/** @deprecated */
export type CustomerBreachNoticeDraft = DataSubjectBreachNoticeDraft;

export type AuthorityBreachNotificationPack = {
  statusEn: 'HUMAN_SUBMISSION_REQUIRED';
  titleEn: string;
  discoveryAtIso: string;
  sourceOfBreach: string;
  mechanismOfBreach: string;
  affectedDataSubjectsSummary: string;
  affectedDataCategories: string[];
  estimatedAffectedCount: number | null;
  containmentRemediationSummary: string;
  otherRelevantInformation: string;
  dataSubjectNotificationDueAtIso: string | null;
  /** @deprecated alias */
  customerNotificationDueAtIso: string | null;
  authorityNotificationDueAtIso: string | null;
  notesEn: string;
};

export function buildAuthorityBreachNotificationPack(input: {
  title: string;
  discoveryAtIso: string;
  sourceOfBreach: string;
  mechanismOfBreach: string;
  affectedDataSubjectsSummary: string;
  affectedDataCategories: string[];
  estimatedAffectedCount: number | null;
  containmentRemediationSummary: string;
  otherRelevantInformation?: string;
  dataSubjectNotificationDueAtIso?: string | null;
  /** @deprecated */
  customerNotificationDueAtIso?: string | null;
  authorityNotificationDueAtIso?: string | null;
}): AuthorityBreachNotificationPack {
  const dsDue =
    input.dataSubjectNotificationDueAtIso ?? input.customerNotificationDueAtIso ?? null;
  return {
    statusEn: 'HUMAN_SUBMISSION_REQUIRED',
    titleEn: input.title,
    discoveryAtIso: input.discoveryAtIso,
    sourceOfBreach: input.sourceOfBreach,
    mechanismOfBreach: input.mechanismOfBreach,
    affectedDataSubjectsSummary: input.affectedDataSubjectsSummary,
    affectedDataCategories: input.affectedDataCategories,
    estimatedAffectedCount: input.estimatedAffectedCount,
    containmentRemediationSummary: input.containmentRemediationSummary,
    otherRelevantInformation: input.otherRelevantInformation ?? '',
    dataSubjectNotificationDueAtIso: dsDue,
    customerNotificationDueAtIso: dsDue,
    authorityNotificationDueAtIso: input.authorityNotificationDueAtIso ?? null,
    notesEn:
      'INTERNAL pack only. HUMAN_SUBMISSION_REQUIRED. No automatic Unit submission. Affected Data Subjects may include Customers, Owners/Partners, and other natural persons — not Customers only.',
  };
}

export const BREACH_PRIVACY_CONTACT_UNRESOLVED = {
  en: '[PRIVACY_CONTACT_EMAIL_UNRESOLVED — FOUNDER_INPUT_REQUIRED]',
  ar: '[بريد_جهة_اتصال_الخصوصية_غير_محسوم — يلزم إدخال المؤسس]',
} as const;

export const BREACH_ACCESS_CONTROL_GAP_NOTE_EN =
  'Breach APIs require privacy_breach_* capabilities or superAdmin. Ordinary admin role alone is denied. Organisational grants required.';

export const BREACH_AUTOMATIC_AUTHORITY_SUBMISSION_EXISTS = false as const;

/** Fields never returned on list endpoints. */
export const BREACH_LIST_EXCLUDED_DETAIL_FIELDS = [
  'affectedSubjectRefs',
  'sourceMechanismDescription',
  'internalNotes',
  'containmentActions',
  'remediationActions',
  'forensicNotes',
  'dataSubjectNoticeDraftJson',
  'customerNoticeDraftJson',
  'authorityPackJson',
  'assessmentHistory',
] as const;
