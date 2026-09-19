import type { LegalDocumentTypeCode } from '../legal-policy';
import { LEGAL_DOCUMENT_TYPES } from '../legal-policy';
import {
  fillPlaceholders,
  legalDocMeta,
  toPublicLegalDocument,
  type LaunchLegalDocument,
  type PublicLegalDocument,
  type PublicLegalPageSlug,
} from './build-legal-markdown';
import type { LegalContentPlaceholderValues } from './placeholders';
import { termsAndConditions } from './terms-and-conditions';
import { privacyPolicy } from './privacy-policy';
import { privacyPolicyLaunchCandidate } from './privacy-policy-launch-candidate';
import { privacyPolicyAdvisorRevised110 } from './privacy-policy-1.1.0-advisor-revised';
import { privacyPolicyAdvisorRevised111 } from './privacy-policy-1.1.1-advisor-revised';
import { cancellationRefundPolicy } from './cancellation-refund-policy';
import { ownerAgreement } from './owner-agreement';
import { ownerAgreementLaunchCandidate } from './owner-agreement-launch-candidate';
import { ownerAgreementAdvisorRevised110 } from './owner-agreement-1.1.0-advisor-revised';
import { bookingTerms } from './booking-terms';
import { verificationPolicy } from './verification-policy';
import { communityReviewPolicy } from './community-review-policy';
import { cookiePolicy } from './cookie-policy';

export { LEGAL_CONTENT_PLACEHOLDERS } from './placeholders';
export type { LegalContentPlaceholderKey, LegalContentPlaceholderValues } from './placeholders';
export { LEGAL_GLOSSARY } from './glossary';
export type { LegalGlossaryKey } from './glossary';
export * from './ssot-values';
export {
  LAUNCH_CANDIDATE_VERSION,
  ADVISOR_REVISED_VERSION,
  ADVISOR_REVISED_VERSION_110,
  ADVISOR_REVISED_VERSION_111,
  PRIVACY_ADVISOR_REVISED_VERSION,
  PRIVACY_ADVISOR_REVISED_VERSION_110,
  PRIVACY_ADVISOR_REVISED_VERSION_111,
  OWNER_ADVISOR_REVISED_VERSION,
  OWNER_ADVISOR_REVISED_VERSION_110,
  LAUNCH_CANDIDATE_BANNER_EN,
  LAUNCH_CANDIDATE_BANNER_AR,
  ADVISOR_REVISED_BANNER_EN,
  ADVISOR_REVISED_BANNER_AR,
  PRIVACY_ADVISOR_REVISED_BANNER_EN,
  PRIVACY_ADVISOR_REVISED_BANNER_AR,
  OWNER_ADVISOR_REVISED_BANNER_EN,
  OWNER_ADVISOR_REVISED_BANNER_AR,
  PUBLIC_PLATFORM_TIME_ZONE_EN,
  PUBLIC_PLATFORM_TIME_ZONE_AR,
  fillPlaceholders,
  preparePublicLegalText,
  stripInternalLegalMarkup,
  legalDocMeta,
  sectionsToMarkdown,
  buildLaunchMarkdown,
  finalizeLaunchDocument,
  toPublicLegalDocument,
  applyPlaceholderValuesToPublicLegalDocument,
} from './build-legal-markdown';
export type {
  LaunchLegalDocument,
  LaunchLegalSection,
  PublicLegalDocument,
  PublicLegalPageSlug,
  PublicLegalSection,
  LegalCorpusVersion,
} from './build-legal-markdown';

/** Document types seeded / published from launch-candidate content. */
export const LAUNCH_LEGAL_DOCUMENT_TYPES = LEGAL_DOCUMENT_TYPES;

const LAUNCH_DOCS: Record<LegalDocumentTypeCode, LaunchLegalDocument> = {
  terms_and_conditions: termsAndConditions,
  privacy_policy: privacyPolicy,
  cancellation_refund_policy: cancellationRefundPolicy,
  owner_agreement: ownerAgreement,
  booking_terms: bookingTerms,
  cookie_policy: cookiePolicy,
  verification_policy: verificationPolicy,
  community_review_policy: communityReviewPolicy,
};

export function getLaunchLegalDocument(
  type: LegalDocumentTypeCode,
): LaunchLegalDocument {
  return LAUNCH_DOCS[type];
}

export function listLaunchLegalDocuments(): LaunchLegalDocument[] {
  return LAUNCH_LEGAL_DOCUMENT_TYPES.map((t) => LAUNCH_DOCS[t]);
}

export function getLaunchLegalMarkdown(
  type: LegalDocumentTypeCode,
  language: 'en' | 'ar',
  placeholderValues?: LegalContentPlaceholderValues,
): string {
  const doc = getLaunchLegalDocument(type);
  const raw = language === 'ar' ? doc.markdownAr : doc.markdownEn;
  return fillPlaceholders(raw, placeholderValues);
}

const PUBLIC_SLUG_TO_DOC_TYPE: Record<PublicLegalPageSlug, LegalDocumentTypeCode> = {
  terms: 'terms_and_conditions',
  privacy: 'privacy_policy',
  'cancellation-refund': 'cancellation_refund_policy',
  'booking-payment': 'booking_terms',
  verification: 'verification_policy',
  'cookie-policy': 'cookie_policy',
  'community-reviews': 'community_review_policy',
};

/**
 * Map public web slug → launch document for static pages.
 * Optional identity values fill confirmed placeholders only; missing stay as [[TOKEN]].
 * When publishing to DB, store filled content only when values exist — DRAFT
 * launch-candidate may keep placeholders (see seed-legal-launch-candidate).
 */
export function getLaunchPublicLegalPage(
  slug: PublicLegalPageSlug,
  locale: 'en' | 'ar',
  placeholderValues?: LegalContentPlaceholderValues,
): PublicLegalDocument {
  const type = PUBLIC_SLUG_TO_DOC_TYPE[slug];
  if (!type) {
    throw new Error(`No launch legal document type for slug ${slug}`);
  }
  const page = toPublicLegalDocument(
    getLaunchLegalDocument(type),
    locale,
    placeholderValues,
  );
  if (!page) {
    throw new Error(`No public legal page mapping for ${type}`);
  }
  return page;
}

const UNRESOLVED_PLACEHOLDER_RE = /\[\[[A-Z0-9_]+\]\]/g;

/** Return distinct unresolved `[[TOKEN]]` placeholders found in text. */
export function findUnresolvedLegalPlaceholders(text: string): string[] {
  const found = text.match(UNRESOLVED_PLACEHOLDER_RE) ?? [];
  return [...new Set(found)];
}

export type ProductionPlaceholderDoc = {
  documentType: string;
  language?: string;
  version?: string;
  content: string;
};

/**
 * Fail closed for Production activation when any `[[…]]` identity tokens remain.
 * Does not invent founder values — only detects unresolved tokens.
 */
export function assertNoUnresolvedPlaceholdersForProduction(
  docs: ProductionPlaceholderDoc[],
): void {
  const problems: string[] = [];
  for (const doc of docs) {
    const unresolved = findUnresolvedLegalPlaceholders(doc.content);
    if (unresolved.length === 0) continue;
    const where = [doc.documentType, doc.language, doc.version].filter(Boolean).join('/');
    problems.push(`${where}: ${unresolved.join(', ')}`);
  }
  if (problems.length > 0) {
    throw new Error(
      `Unresolved legal identity placeholders block Production activation:\n${problems.join('\n')}`,
    );
  }
}

export {
  termsAndConditions,
  privacyPolicy,
  privacyPolicyLaunchCandidate,
  privacyPolicyAdvisorRevised110,
  privacyPolicyAdvisorRevised111,
  cancellationRefundPolicy,
  ownerAgreement,
  ownerAgreementLaunchCandidate,
  ownerAgreementAdvisorRevised110,
  bookingTerms,
  verificationPolicy,
  communityReviewPolicy,
  cookiePolicy,
};

/** Convenience meta for admin/seeding UIs. */
export function getLaunchLegalDocMeta(type: LegalDocumentTypeCode) {
  return legalDocMeta(type);
}
