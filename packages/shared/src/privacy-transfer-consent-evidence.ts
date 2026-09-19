/**
 * Phase 3C.4B.2B — Article 14 transfer/consent evidence audit (internal).
 *
 * Existing DataProcessingConsent already stores:
 * - consentText (exact text shown)
 * - consentTextHash
 * - purposeVersion / corpus version
 * - privacyNoticeVersionId (link to Privacy Policy / notice version when supplied at grant)
 * - language, grantedAt, sourceSurface, related entity refs
 *
 * Once the public processor/recipient table is finalised and Prior Consent texts
 * (or the linked Privacy Policy version) disclose recipient + purpose information
 * required for Article 14, these fields are sufficient to prove what the Data Subject
 * was shown — without a new consent subsystem.
 *
 * Transfer consent is NOT Production-ready while processor legal identity remains unresolved.
 */
export const ARTICLE_14_TRANSFER_CONSENT_EVIDENCE_AUDIT = {
  phase: '3C.4B.2C',
  status: 'SUFFICIENT_ONCE_PROCESSORS_AND_DISCLOSURE_FINALISED',
  evidenceFields: [
    'consentText',
    'consentTextHash',
    'purposeVersion',
    'privacyNoticeVersionId',
    'language',
    'grantedAt',
    'sourceSurface',
  ] as const,
  transferRegisterModel: 'PersonalDataTransferRegisterEntry',
  transferRegisterLegalSufficiency: 'COUNSEL_REVIEW_REQUIRED',
  productionBlocker:
    'PROCESSOR_IDENTITY_UNRESOLVED — do not mark Article 14 transfer consent ready until active processor legal names/contacts and recipient disclosures are confirmed; transfer register legal sufficiency remains COUNSEL_REVIEW_REQUIRED',
  googleMinimalPreConsentLegalBasis: 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
  note:
    'Prior Consent evidence proves what the Data Subject was shown. PersonalDataTransferRegisterEntry records transfer/exchange relationships (categories + recipient + purpose + consent linkage) without copying raw Personal Data.',
} as const;

/** Google OAuth fields actually received/persisted by Mazare3 (implementation audit). */
export const GOOGLE_OAUTH_PERSONAL_DATA_AUDIT = {
  receivedFromGoogle: ['sub', 'email', 'emailVerified', 'name'] as const,
  persistedByMazare3: [
    'AuthIdentity.providerSubject (Google sub)',
    'User.email (when creating/linking account)',
    'User.name (sanitised Google display name when usable)',
  ] as const,
  notStored: ['Google access token', 'Google refresh token'] as const,
  note: 'emailVerified is checked for account creation but not stored as a dedicated User column.',
} as const;
