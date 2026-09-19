import type { LegalDocumentTypeCode } from '../legal-policy';
import {
  LEGAL_CONTENT_PLACEHOLDERS,
  type LegalContentPlaceholderValues,
} from './placeholders';

/** Phase 3C.3 — identity-integrated launch candidate (unchanged docs remain on this label). */
export const LAUNCH_CANDIDATE_VERSION = '1.0.1-launch-candidate' as const;

/**
 * Phase 3C.4A — first advisor-revised label (historical Terms lineage; do not reuse for mutated Terms body).
 * Corpus source of truth for the three customer docs is the current ADVISOR_REVISED_VERSION.
 */
export const ADVISOR_REVISED_VERSION_110 = '1.1.0-advisor-revised' as const;

/**
 * Phase 3C.4B.2A — Privacy Policy advisor-revised DRAFT (historical / frozen).
 * Same version string as historical Terms 1.1.0 label, but distinct documentType (privacy_policy).
 */
export const PRIVACY_ADVISOR_REVISED_VERSION_110 = '1.1.0-advisor-revised' as const;

/**
 * Phase 3C.4B.2B — Privacy Policy legal & public-UX hardening DRAFT (historical / frozen).
 * Same version string as historical Terms 1.1.1 label, but distinct documentType (privacy_policy).
 */
export const PRIVACY_ADVISOR_REVISED_VERSION_111 = '1.1.1-advisor-revised' as const;

/**
 * Phase 3C.4B.2C — Privacy Policy advisor-final legal accuracy lock DRAFT.
 * Not counsel-activated. Not Production-active.
 * Same version string as customer contractual 1.1.2-advisor-final, but distinct documentType (privacy_policy).
 * Does NOT mutate Terms/Cancellation/Booking corpora.
 */
export const PRIVACY_ADVISOR_REVISED_VERSION = '1.1.2-advisor-final' as const;

/** @deprecated Use PRIVACY_ADVISOR_REVISED_VERSION_110 — kept for 3C.4B.2A script compatibility aliases. */
export const PRIVACY_ADVISOR_REVISED_VERSION_2A = PRIVACY_ADVISOR_REVISED_VERSION_110;

/** Phase 3C.4A.2 — final customer legal polish DRAFT (historical reviewed body). */
export const ADVISOR_REVISED_VERSION_111 = '1.1.1-advisor-revised' as const;

/**
 * Phase 3C.4A.4 — customer legal editorial lock DRAFT for Terms, Cancellation, Booking Terms.
 * Substantively approved; editorial/precision only. Not counsel-activated.
 */
export const ADVISOR_REVISED_VERSION = '1.1.2-advisor-final' as const;

/**
 * Phase 3C.4C.2 — Owner Agreement advisor-revised DRAFT.
 * Same version string as historical Terms/Privacy 1.1.0 label, but distinct documentType (owner_agreement).
 * Not counsel-activated. Not Production-active.
 */
export const OWNER_ADVISOR_REVISED_VERSION = '1.1.1-advisor-final' as const;

/** Frozen Phase 3C.4C.2 Owner Agreement advisor-revised DRAFT. */
export const OWNER_ADVISOR_REVISED_VERSION_110 = '1.1.0-advisor-revised' as const;

export const OWNER_ADVISOR_REVISED_BANNER_EN =
  'INTERNAL REVIEW ONLY — Owner Agreement advisor-final DRAFT (1.1.1). Not counsel-activated. Not Production-active. Do not include in public Owner body.';

export const OWNER_ADVISOR_REVISED_BANNER_AR =
  'للمراجعة الداخلية فقط — مسودة اتفاق المالك النهائية للمستشار (1.1.1). غير مفعّلة من المستشار القانوني. غير مفعّلة في الإنتاج. لا تُدرج في نص المالك العام.';

/** Public-facing timezone prose (do not expose IANA ids in ordinary customer legal text). */
export const PUBLIC_PLATFORM_TIME_ZONE_EN = 'local time in Amman, Jordan' as const;
export const PUBLIC_PLATFORM_TIME_ZONE_AR =
  'بتوقيت عمّان المحلي في المملكة الأردنية الهاشمية' as const;

export type LegalCorpusVersion =
  | typeof LAUNCH_CANDIDATE_VERSION
  | typeof ADVISOR_REVISED_VERSION_110
  | typeof PRIVACY_ADVISOR_REVISED_VERSION_110
  | typeof PRIVACY_ADVISOR_REVISED_VERSION_111
  | typeof PRIVACY_ADVISOR_REVISED_VERSION
  | typeof OWNER_ADVISOR_REVISED_VERSION
  | typeof OWNER_ADVISOR_REVISED_VERSION_110
  | typeof ADVISOR_REVISED_VERSION_111
  | typeof ADVISOR_REVISED_VERSION;

/** Internal-only review banner — never required in public customer rendering. */
export const LAUNCH_CANDIDATE_BANNER_EN =
  'INTERNAL REVIEW ONLY — Launch-candidate legal text for Jordanian counsel review. Not yet approved by legal counsel.';

export const LAUNCH_CANDIDATE_BANNER_AR =
  'للمراجعة الداخلية فقط — نص قانوني مرشّح للإطلاق لمراجعة المستشار القانوني الأردني. لم يُعتمد بعد من المستشار القانوني.';

export const ADVISOR_REVISED_BANNER_EN =
  'INTERNAL REVIEW ONLY — Advisor-final editorial lock DRAFT (1.1.2). Substantively approved. Not counsel-activated. Not Production-active.';

export const ADVISOR_REVISED_BANNER_AR =
  'للمراجعة الداخلية فقط — مسودة القفل التحريري النهائي للمستشار (1.1.2). معتمدة موضوعياً. غير مفعّلة من المستشار القانوني. غير مفعّلة في الإنتاج.';

export const PRIVACY_ADVISOR_REVISED_BANNER_EN =
  'INTERNAL REVIEW ONLY — Privacy Policy advisor-revised DRAFT. Not counsel-activated. Not Production-active. Do not include in public legal body.';

export const PRIVACY_ADVISOR_REVISED_BANNER_AR =
  'للمراجعة الداخلية فقط — مسودة سياسة الخصوصية المنقّحة للمستشار. غير مفعّلة من المستشار القانوني. غير مفعّلة في الإنتاج. لا تُدرج في النص القانوني العام.';

export type LaunchLegalSection = {
  id: string;
  titleEn: string;
  titleAr: string;
  paragraphsEn: string[];
  paragraphsAr: string[];
  bulletsEn?: string[];
  bulletsAr?: string[];
  /** Raw GFM pipe table (no leading `- `). Rendered as markdown table / HTML table. */
  tableMarkdownEn?: string;
  tableMarkdownAr?: string;
};

export type LaunchLegalDocument = {
  documentType: LegalDocumentTypeCode;
  version: LegalCorpusVersion;
  titleEn: string;
  titleAr: string;
  introEn: string;
  introAr: string;
  sections: LaunchLegalSection[];
  /** Pre-built markdown. May include an INTERNAL review banner blockquote. */
  markdownEn: string;
  markdownAr: string;
};

/** Web / static page shape (mirrors apps/web LegalDocument without importing app types). */
export type PublicLegalPageSlug =
  | 'terms'
  | 'privacy'
  | 'cancellation-refund'
  | 'booking-payment'
  | 'verification'
  | 'cookie-policy'
  | 'community-reviews';

export type PublicLegalSection = {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
  /** GFM pipe-table block for accessible HTML rendering. */
  tableMarkdown?: string;
};

export type PublicLegalDocument = {
  slug: PublicLegalPageSlug;
  title: string;
  intro: string;
  sections: PublicLegalSection[];
};

export function legalDocMeta(documentType: LegalDocumentTypeCode) {
  return {
    documentType,
    version: LAUNCH_CANDIDATE_VERSION,
    bannerEn: LAUNCH_CANDIDATE_BANNER_EN,
    bannerAr: LAUNCH_CANDIDATE_BANNER_AR,
  } as const;
}

/** Strip HTML legal-review comments from text destined for customers. */
export function stripInternalLegalMarkup(text: string): string {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Replace `[[KEY]]` tokens. Unknown keys are left unchanged. */
export function fillPlaceholders(
  text: string,
  values?: LegalContentPlaceholderValues,
): string {
  let out = text;
  for (const key of Object.keys(LEGAL_CONTENT_PLACEHOLDERS) as Array<
    keyof typeof LEGAL_CONTENT_PLACEHOLDERS
  >) {
    const token = LEGAL_CONTENT_PLACEHOLDERS[key];
    const replacement = values?.[key];
    if (replacement != null && replacement !== '') {
      out = out.split(token).join(replacement);
    }
  }
  return out;
}

/**
 * Public rendering: fill known identity, strip HTML comments, leave unresolved
 * tokens only when still present (activation guard continues to block publish).
 */
export function preparePublicLegalText(
  text: string,
  values?: LegalContentPlaceholderValues,
): string {
  return stripInternalLegalMarkup(fillPlaceholders(text, values));
}

function formatBullets(bullets: string[]): string {
  return bullets.map((b) => `- ${b}`).join('\n');
}

export function sectionsToMarkdown(params: {
  banner?: string | null;
  title: string;
  intro: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
    bullets?: string[];
    tableMarkdown?: string;
  }>;
}): string {
  const parts: string[] = [];
  if (params.banner && params.banner.trim()) {
    parts.push(`> ${params.banner}`, '');
  }
  parts.push(`# ${params.title}`, '', params.intro);

  for (const section of params.sections) {
    parts.push('', `## ${section.title}`, '');
    for (const p of section.paragraphs) {
      parts.push(p, '');
    }
    if (section.tableMarkdown?.trim()) {
      parts.push(section.tableMarkdown.trim(), '');
    }
    if (section.bullets?.length) {
      parts.push(formatBullets(section.bullets), '');
    }
  }

  return parts.join('\n').trim() + '\n';
}

export function buildLaunchMarkdown(
  doc: Omit<LaunchLegalDocument, 'markdownEn' | 'markdownAr'>,
  options?: { includeInternalBanner?: boolean },
): Pick<LaunchLegalDocument, 'markdownEn' | 'markdownAr'> {
  const includeBanner = options?.includeInternalBanner !== false;
  const isPrivacyAdvisor =
    doc.documentType === 'privacy_policy' &&
    (doc.version === PRIVACY_ADVISOR_REVISED_VERSION ||
      doc.version === PRIVACY_ADVISOR_REVISED_VERSION_111 ||
      doc.version === PRIVACY_ADVISOR_REVISED_VERSION_110);
  const isAdvisor =
    (doc.version === ADVISOR_REVISED_VERSION && doc.documentType !== 'privacy_policy') ||
    (doc.version === ADVISOR_REVISED_VERSION_111 && doc.documentType !== 'privacy_policy') ||
    (doc.version === ADVISOR_REVISED_VERSION_110 && doc.documentType !== 'privacy_policy');
  // Privacy 1.1.2-advisor-final shares the string with Terms — never use Terms banner for privacy_policy.
  const bannerEn = includeBanner
    ? isPrivacyAdvisor
      ? PRIVACY_ADVISOR_REVISED_BANNER_EN
      : isAdvisor
        ? ADVISOR_REVISED_BANNER_EN
        : LAUNCH_CANDIDATE_BANNER_EN
    : null;
  const bannerAr = includeBanner
    ? isPrivacyAdvisor
      ? PRIVACY_ADVISOR_REVISED_BANNER_AR
      : isAdvisor
        ? ADVISOR_REVISED_BANNER_AR
        : LAUNCH_CANDIDATE_BANNER_AR
    : null;

  return {
    markdownEn: sectionsToMarkdown({
      banner: bannerEn,
      title: doc.titleEn,
      intro: doc.introEn,
      sections: doc.sections.map((s) => ({
        title: s.titleEn,
        paragraphs: s.paragraphsEn,
        bullets: s.bulletsEn,
        tableMarkdown: s.tableMarkdownEn,
      })),
    }),
    markdownAr: sectionsToMarkdown({
      banner: bannerAr,
      title: doc.titleAr,
      intro: doc.introAr,
      sections: doc.sections.map((s) => ({
        title: s.titleAr,
        paragraphs: s.paragraphsAr,
        bullets: s.bulletsAr,
        tableMarkdown: s.tableMarkdownAr,
      })),
    }),
  };
}

export function finalizeLaunchDocument(
  partial: Omit<LaunchLegalDocument, 'markdownEn' | 'markdownAr' | 'version'> & {
    version?: LegalCorpusVersion;
    /** When false, markdown omits the INTERNAL review banner (preferred for advisor public body). */
    includeInternalBanner?: boolean;
  },
): LaunchLegalDocument {
  const { includeInternalBanner, ...rest } = partial;
  const base = {
    ...rest,
    version: partial.version ?? LAUNCH_CANDIDATE_VERSION,
  };
  const md = buildLaunchMarkdown(base, {
    includeInternalBanner: includeInternalBanner ?? true,
  });
  return { ...base, ...md };
}

const DOC_TYPE_TO_PUBLIC_SLUG: Partial<
  Record<LegalDocumentTypeCode, PublicLegalPageSlug>
> = {
  terms_and_conditions: 'terms',
  privacy_policy: 'privacy',
  cancellation_refund_policy: 'cancellation-refund',
  booking_terms: 'booking-payment',
  verification_policy: 'verification',
  cookie_policy: 'cookie-policy',
  community_review_policy: 'community-reviews',
};

export function toPublicLegalDocument(
  doc: LaunchLegalDocument,
  locale: 'en' | 'ar',
  placeholderValues?: LegalContentPlaceholderValues,
): PublicLegalDocument | null {
  const slug = DOC_TYPE_TO_PUBLIC_SLUG[doc.documentType];
  if (!slug) return null;
  const isAr = locale === 'ar';
  const fill = (text: string) => preparePublicLegalText(text, placeholderValues);
  return {
    slug,
    title: fill(isAr ? doc.titleAr : doc.titleEn),
    intro: fill(isAr ? doc.introAr : doc.introEn),
    sections: doc.sections.map((s) => {
      const bullets = isAr ? s.bulletsAr : s.bulletsEn;
      const tableMarkdown = isAr ? s.tableMarkdownAr : s.tableMarkdownEn;
      return {
        id: s.id,
        title: fill(isAr ? s.titleAr : s.titleEn),
        paragraphs: (isAr ? s.paragraphsAr : s.paragraphsEn).map(fill),
        ...(bullets?.length ? { bullets: bullets.map(fill) } : {}),
        ...(tableMarkdown?.trim()
          ? { tableMarkdown: fill(tableMarkdown.trim()) }
          : {}),
      };
    }),
  };
}

/** Apply placeholder values to an already-built public legal page (display-time fill). */
export function applyPlaceholderValuesToPublicLegalDocument(
  doc: PublicLegalDocument,
  placeholderValues?: LegalContentPlaceholderValues,
): PublicLegalDocument {
  if (!placeholderValues || Object.keys(placeholderValues).length === 0) {
    return {
      ...doc,
      intro: stripInternalLegalMarkup(doc.intro),
      sections: doc.sections.map((s) => ({
        ...s,
        title: stripInternalLegalMarkup(s.title),
        paragraphs: s.paragraphs.map(stripInternalLegalMarkup),
        ...(s.bullets?.length
          ? { bullets: s.bullets.map(stripInternalLegalMarkup) }
          : {}),
        ...(s.tableMarkdown
          ? { tableMarkdown: stripInternalLegalMarkup(s.tableMarkdown) }
          : {}),
      })),
    };
  }
  const fill = (text: string) => preparePublicLegalText(text, placeholderValues);
  return {
    ...doc,
    title: fill(doc.title),
    intro: fill(doc.intro),
    sections: doc.sections.map((s) => ({
      ...s,
      title: fill(s.title),
      paragraphs: s.paragraphs.map(fill),
      ...(s.bullets?.length ? { bullets: s.bullets.map(fill) } : {}),
      ...(s.tableMarkdown ? { tableMarkdown: fill(s.tableMarkdown) } : {}),
    })),
  };
}
