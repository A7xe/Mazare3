/**
 * Phase 3C.2 — LOCAL admin activation-readiness preview.
 * Never claims "legally compliant". Technical readiness only.
 *
 * Future Production activation must also require counsel + founder approvals
 * (see PRODUCTION_LEGAL_ACTIVATION_REQUIRES_APPROVALS) — this phase does not activate.
 */

import {
  LEGAL_BOOTSTRAP_CHANGELOG,
  LEGAL_DOCUMENT_TYPES,
  LEGAL_REVIEW_BANNER,
  findUnresolvedLegalPlaceholders,
  getLegalIdentityFromEnv,
  hashLegalContent,
  summarizeLegalIdentity,
  priorConsentDurationBlocksProductionActivation,
  priorConsentPurposesWithUnresolvedDuration,
  PRIVACY_PROCESSING_ACTIVITIES,
  DATA_PROCESSING_CONSENT_PURPOSE_DEFS,
  type LegalDocumentTypeCode,
} from '@mazare3/shared';
import { LegalDocumentStatus, prisma } from '@mazare3/db';

export type ActivationOverallStatus =
  | 'TECHNICALLY_READY'
  | 'LEGAL_REVIEW_PENDING'
  | 'FOUNDER_INPUT_MISSING'
  | 'BLOCKED';

export type ActivationReadinessReport = {
  overall: ActivationOverallStatus;
  /** Explicit disclaimer — never claim legal compliance. */
  disclaimer: string;
  identity: ReturnType<typeof summarizeLegalIdentity> & {
    productNameEn: string;
    productNameAr: string;
  };
  documents: Array<{
    documentType: LegalDocumentTypeCode;
    activeVersion: string | null;
    draftLaunchCandidate: boolean;
    languages: { ar: boolean; en: boolean };
    status: string | null;
    legalReviewStatus: string | null;
    founderApprovalStatus: string | null;
    unresolvedPlaceholders: string[];
    hashOk: boolean;
    placeholderMarkers: boolean;
    issues: string[];
  }>;
  consistency: {
    unresolvedPlaceholdersInActive: number;
    hashMismatchCount: number;
    placeholderActiveCount: number;
    launchCandidateActiveCount: number;
    ssotNote: string;
  };
  acceptanceFlows: {
    registrationClickwrap: string;
    checkoutAck: string;
    ownerAgreementGate: string;
    oauthPhoneGate: string;
    note: string;
    customerBookingCorpusBlockers: string[];
  };
  privacy: {
    privacyContactConfigured: boolean;
    dpoAppointed: boolean;
    privacyContactLabel: string;
    dsrFlow: string;
    optionalConsentSeparation: string;
    pdplGapDoc: string;
  };
  /** Phase 3C.4B.1.5 — Prior Consent / Art. 6 production blockers (technical, not compliance cert). */
  priorConsent: {
    privacyPolicyFinalised: false;
    unresolvedDurationBlocksProduction: boolean;
    unresolvedDurationPurposes: string[];
    missingTechnicalGates: string[];
    unresolvedLegalBasisActivities: string[];
    statutoryRightsDoNotRequireConsent: true;
    breachDoesNotRequireConsent: true;
    adminCannotFabricateConsent: true;
    productionBlockers: string[];
  };
  psp: {
    status: 'FLAGGED' | 'CONFIRMED';
    note: string;
  };
  legalReview: {
    anyApproved: boolean;
    anyPending: boolean;
    byDocument: Array<{ documentType: string; version: string; status: string }>;
    note: string;
  };
  founderApproval: {
    anyApproved: boolean;
    anyPending: boolean;
    byDocument: Array<{ documentType: string; version: string; status: string }>;
    note: string;
  };
};

const REQUIRED_TYPES: LegalDocumentTypeCode[] = [
  'terms_and_conditions',
  'privacy_policy',
  'cancellation_refund_policy',
  'booking_terms',
  'owner_agreement',
];

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value.trim());
}

export async function getLegalActivationReadiness(): Promise<ActivationReadinessReport> {
  const identityConfig = getLegalIdentityFromEnv();
  const identitySummary = summarizeLegalIdentity(identityConfig);

  const releases = await prisma.legalRelease.findMany({
    include: { versions: true },
    orderBy: [{ documentType: 'asc' }, { createdAt: 'desc' }],
  });

  const documents: ActivationReadinessReport['documents'] = [];
  let unresolvedPlaceholdersInActive = 0;
  let hashMismatchCount = 0;
  let placeholderActiveCount = 0;
  let launchCandidateActiveCount = 0;

  for (const docType of LEGAL_DOCUMENT_TYPES) {
    const active = releases.find(
      (r) => r.documentType === docType && r.status === LegalDocumentStatus.active,
    );
    const launchDraft = releases.find(
      (r) =>
        r.documentType === docType &&
        r.version.toLowerCase().includes('launch-candidate') &&
        r.status === LegalDocumentStatus.draft,
    );
    const focus = active ?? launchDraft ?? null;
    const versions = focus?.versions ?? [];
    const ar = versions.some((v) => v.language === 'ar');
    const en = versions.some((v) => v.language === 'en');
    const issues: string[] = [];
    const unresolved: string[] = [];
    let hashOk = true;
    let placeholderMarkers = false;

    if (active) {
      if (active.version.toLowerCase().includes('launch-candidate')) {
        launchCandidateActiveCount += 1;
        issues.push('ACTIVE version contains launch-candidate');
      }
      if (active.version.toLowerCase().includes('placeholder')) {
        placeholderActiveCount += 1;
        placeholderMarkers = true;
        issues.push('ACTIVE version string includes placeholder');
      }
      const meta = `${active.changelog ?? ''}\n${active.summaryOfChanges ?? ''}`;
      if (
        meta.includes(LEGAL_REVIEW_BANNER) ||
        meta.includes(LEGAL_BOOTSTRAP_CHANGELOG) ||
        meta.toLowerCase().includes('placeholder')
      ) {
        placeholderActiveCount += 1;
        placeholderMarkers = true;
        issues.push('ACTIVE changelog/summary has bootstrap/placeholder markers');
      }
      for (const v of versions) {
        const tokens = findUnresolvedLegalPlaceholders(v.content);
        unresolved.push(...tokens);
        unresolvedPlaceholdersInActive += tokens.length;
        if (tokens.length) {
          issues.push(`${v.language}: unresolved ${tokens.join(', ')}`);
        }
        const hash = (v.contentHash ?? '').trim();
        if (!hash || !isSha256Hex(hash) || hashLegalContent(v.content) !== hash) {
          hashOk = false;
          hashMismatchCount += 1;
          issues.push(`${v.language}: contentHash missing/invalid/mismatch`);
        }
        if (
          v.content.includes(LEGAL_REVIEW_BANNER) ||
          v.content.toLowerCase().includes('placeholder')
        ) {
          placeholderMarkers = true;
          issues.push(`${v.language}: content has placeholder/bootstrap markers`);
        }
      }
      if (!ar) issues.push('missing AR');
      if (!en) issues.push('missing EN');
    } else if (REQUIRED_TYPES.includes(docType)) {
      issues.push('No ACTIVE release');
    }

    documents.push({
      documentType: docType,
      activeVersion: active?.version ?? null,
      draftLaunchCandidate: Boolean(launchDraft),
      languages: { ar, en },
      status: focus?.status ?? null,
      legalReviewStatus: focus?.legalReviewStatus ?? null,
      founderApprovalStatus: focus?.founderApprovalStatus ?? null,
      unresolvedPlaceholders: [...new Set(unresolved)],
      hashOk,
      placeholderMarkers,
      issues,
    });
  }

  const paymentNameConfigured = Boolean(identityConfig.paymentProviderLegalName);
  const psp = {
    status: (paymentNameConfigured ? 'CONFIRMED' : 'FLAGGED') as 'FLAGGED' | 'CONFIRMED',
    note: paymentNameConfigured
      ? 'LEGAL_PAYMENT_PROVIDER_LEGAL_NAME is set. MoR / contractual role still REQUIRES PSP CONTRACT REVIEW before claiming Merchant of Record.'
      : 'Payment provider legal name unset; MoR UNKNOWN — REQUIRES PSP CONTRACT REVIEW. See docs/phase3c2-payment-provider-legal-role-audit.md. Do not invent PayTabs Inc.',
  };

  const reviewRows = releases
    .filter((r) => r.status === LegalDocumentStatus.draft || r.status === LegalDocumentStatus.active)
    .map((r) => ({
      documentType: r.documentType,
      version: r.version,
      status: r.legalReviewStatus,
    }));
  const founderRows = releases
    .filter((r) => r.status === LegalDocumentStatus.draft || r.status === LegalDocumentStatus.active)
    .map((r) => ({
      documentType: r.documentType,
      version: r.version,
      status: r.founderApprovalStatus,
    }));

  const legalReview = {
    anyApproved: reviewRows.some(
      (r) => r.status === 'approved' || r.status === 'approved_with_changes',
    ),
    anyPending: reviewRows.some(
      (r) => r.status === 'not_reviewed' || r.status === 'under_review',
    ),
    byDocument: reviewRows,
    note: 'Counsel approval is internal governance only — not legal compliance certification.',
  };

  const founderApproval = {
    anyApproved: founderRows.some((r) => r.status === 'approved'),
    anyPending: founderRows.some((r) => r.status === 'pending'),
    byDocument: founderRows,
    note: 'Founder approval is business publication approval, separate from counsel review.',
  };

  const founderMissing = identitySummary.founderInputRequired.length > 0;

  const unresolvedDurationPurposes = priorConsentPurposesWithUnresolvedDuration();
  const unresolvedDurationBlocksProduction = priorConsentDurationBlocksProductionActivation();
  const missingTechnicalGates = PRIVACY_PROCESSING_ACTIVITIES.filter(
    (a) => a.priorConsentRequired && a.runtimeGateStatus === 'GATE_PENDING',
  ).map((a) => a.key);
  const unresolvedLegalBasisActivities = PRIVACY_PROCESSING_ACTIVITIES.filter(
    (a) =>
      a.jordanLegalBasisStatus === 'LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED' ||
      a.jordanLegalBasisStatus === 'ARTICLE_6_5_LEGISLATIVE_DUTY_PENDING_COUNSEL' ||
      a.jordanLegalBasisStatus === 'ARTICLE_6_EXCEPTION_REVIEW_REQUIRED' ||
      a.jordanLegalBasisStatus === 'PRIOR_CONSENT_REQUIRED',
  ).map((a) => a.key);

  const priorConsentProductionBlockers: string[] = [];
  if (unresolvedDurationBlocksProduction) {
    priorConsentProductionBlockers.push(
      'PRIOR_CONSENT_DURATION_UNRESOLVED: Article 5 duration still DURATION_REQUIRES_LEGAL_REVIEW for one or more Prior Consent purposes',
    );
  }
  if (missingTechnicalGates.length) {
    priorConsentProductionBlockers.push(
      `MISSING_PRIOR_CONSENT_GATE: ${missingTechnicalGates.join(', ')}`,
    );
  }
  priorConsentProductionBlockers.push(
    'PRIVACY_POLICY_NOT_FINALISED: Privacy Policy DRAFT 1.1.2-advisor-final remains non-activated (counsel review + founder publication approval + unresolved public facts required)',
  );
  priorConsentProductionBlockers.push(
    'OWNER_AGREEMENT_NOT_FINALISED: Owner Agreement DRAFT 1.1.1-advisor-final remains non-activated (counsel review + founder publication approval required)',
  );
  priorConsentProductionBlockers.push(
    'OWNER_SETTLEMENT_CYCLE_REQUIRES_FOUNDER_DECISION: [[OWNER_SETTLEMENT_CYCLE]] must be founder-approved before Owner Agreement Production activation',
  );
  priorConsentProductionBlockers.push(
    'OWNER_PAYMENT_FEE_TREATMENT_REQUIRES_FOUNDER_DECISION: confirm Owner Earnings are not reduced by separate PSP/processing fees (code currently deducts only documented OwnerFinancialAdjustments)',
  );
  priorConsentProductionBlockers.push(
    'LIABILITY_CAP_COUNSEL_REVIEW_REQUIRED: Owner Agreement liability cap/formula pending counsel',
  );
  priorConsentProductionBlockers.push(
    'INDEMNITY_ENFORCEABILITY_COUNSEL_REVIEW_REQUIRED: Owner indemnity enforceability pending counsel',
  );
  priorConsentProductionBlockers.push(
    'OWNER_CUSTOMER_DATA_ROLE_COUNSEL_REVIEW_REQUIRED: Owner role vs Customer Personal Data (processor/controller) pending counsel — do not invent in public body',
  );
  priorConsentProductionBlockers.push(
    'OWNER_ACCOUNT_MARKETPLACE_PROCESSING_COUNSEL_REVIEW_REQUIRED: owner_account_and_marketplace_operation reclassified 3C.4D.7B (COUNSEL_REVIEW_REQUIRED; not wired as Prior Consent; do not invent Art. 6 exception)',
  );
  priorConsentProductionBlockers.push(
    'OWNER_AUTHORITY_THIRD_PARTY_DATA_COUNSEL_REVIEW_REQUIRED: authority packages may contain third-party Personal Data (declared owner/representative/manager) — no fabricated third-party consent checkbox',
  );
  priorConsentProductionBlockers.push(
    'PRIVACY_RETENTION_DECISION_REQUIRED: abandoned Owner onboarding datasets (KYC/authority/drafts/regulatory/exact-location/payout/consent evidence) lack founder/counsel retention periods',
  );
  priorConsentProductionBlockers.push(
    'OWNER_TAX_LICENCE_ACCOUNTANT_COUNSEL_REVIEW_REQUIRED: tax/invoice/licensing wording pending accountant/counsel',
  );
  priorConsentProductionBlockers.push(
    'PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED: verify Production code/config has no GA/Meta Pixel/other non-essential tracker active without applicable consent before Privacy Policy activation',
  );
  priorConsentProductionBlockers.push(
    'CROSS_BORDER_DPIA_REQUIRED: required cross-border DPIAs must be completed and recorded before relying on outside-Jordan transfers in Production',
  );
  priorConsentProductionBlockers.push(
    'ARTICLE_14_TRANSFER_REGISTER_COUNSEL_REVIEW_REQUIRED: PersonalDataTransferRegisterEntry exists but legal sufficiency remains COUNSEL_REVIEW_REQUIRED',
  );
  if (
    DATA_PROCESSING_CONSENT_PURPOSE_DEFS.some(
      (p) => p.durationStatus === 'DURATION_REQUIRES_LEGAL_REVIEW',
    )
  ) {
    // Already covered by duration blocker; keep explicit privacy finalisation separate.
  }

  /** Hard technical blockers for a Production-bound ACTIVE corpus. */
  const hardBlocked =
    placeholderActiveCount > 0 ||
    unresolvedPlaceholdersInActive > 0 ||
    hashMismatchCount > 0 ||
    launchCandidateActiveCount > 0 ||
    priorConsentProductionBlockers.length > 0;

  const requiredDraftOrActiveOk = REQUIRED_TYPES.every((t) => {
    const d = documents.find((x) => x.documentType === t);
    if (!d) return false;
    // Pre-activation local state: DRAFT launch-candidate bilingual is acceptable for preview.
    if (d.draftLaunchCandidate && d.languages.ar && d.languages.en) return true;
    return Boolean(d.activeVersion && d.languages.ar && d.languages.en && d.hashOk);
  });

  let overall: ActivationOverallStatus;
  if (hardBlocked) {
    overall = 'BLOCKED';
  } else if (founderMissing) {
    overall = 'FOUNDER_INPUT_MISSING';
  } else if (!requiredDraftOrActiveOk) {
    overall = 'BLOCKED';
  } else if (
    !legalReview.anyApproved ||
    legalReview.anyPending ||
    !founderApproval.anyApproved
  ) {
    overall = 'LEGAL_REVIEW_PENDING';
  } else {
    overall = 'TECHNICALLY_READY';
  }

  return {
    overall,
    disclaimer:
      'Technical readiness preview only. This endpoint never asserts legal compliance, Jordan PDPL compliance, or counsel approval.',
    identity: {
      ...identitySummary,
      productNameEn: identityConfig.productNameEn,
      productNameAr: identityConfig.productNameAr,
    },
    documents,
    consistency: {
      unresolvedPlaceholdersInActive,
      hashMismatchCount,
      placeholderActiveCount,
      launchCandidateActiveCount,
      ssotNote:
        'Financial figures must remain aligned with packages/shared marketplace-financial-policy SSOT (18%/15%, deposit 30%, ladders).',
    },
    acceptanceFlows: {
      registrationClickwrap:
        'wired — Terms + Privacy ack + account Prior Consent separate from optional marketing',
      checkoutAck:
        'wired 3C.4E.4A — server-resolved ACTIVE Terms + Booking Terms + Cancellation; LegalAcceptance + BookingLegalSnapshot; never DRAFT',
      ownerAgreementGate: 'wired soft gate for new listings; payouts must remain accessible',
      oauthPhoneGate:
        'first-run Prior Consent gate required before Booking/KYC/payout; Google minimal pre-consent = LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED',
      note: 'Flow flags are architecture status, not compliance certification.',
      customerBookingCorpusBlockers: [
        'CUSTOMER_BOOKING_TERMS_ACTIVE_VERSION_REQUIRED',
        'CUSTOMER_CANCELLATION_POLICY_ACTIVE_VERSION_REQUIRED',
        'CUSTOMER_BOOKING_TERMS_DOC_ACTIVE_VERSION_REQUIRED',
      ],
    },
    privacy: {
      privacyContactConfigured: Boolean(identityConfig.privacyContactEmail),
      dpoAppointed: identityConfig.dpoAppointed,
      privacyContactLabel: identityConfig.privacyContactLabel,
      dsrFlow:
        'DSR / privacy complaint available without requiring new Prior Consent (Art. 6(A)(5) candidate pending counsel)',
      optionalConsentSeparation: 'marketing/optional purposes separate from Privacy acknowledgement and Prior Consent',
      pdplGapDoc: 'docs/MAZARE3_PDPL_PRIOR_CONSENT_MATRIX_3C4B1_5.md',
    },
    priorConsent: {
      privacyPolicyFinalised: false,
      unresolvedDurationBlocksProduction,
      unresolvedDurationPurposes,
      missingTechnicalGates,
      unresolvedLegalBasisActivities,
      statutoryRightsDoNotRequireConsent: true,
      breachDoesNotRequireConsent: true,
      adminCannotFabricateConsent: true,
      productionBlockers: priorConsentProductionBlockers,
    },
    psp,
    legalReview,
    founderApproval,
  };
}
