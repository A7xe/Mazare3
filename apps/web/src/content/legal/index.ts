import type { LegalDocument, LegalPageSlug } from '@/lib/legal/types';
import type { Locale } from '@mazare3/shared';
import {
  preparePublicLegalText,
  getLegalIdentityFromEnv,
  toPlaceholderValues,
  type LegalContentPlaceholderValues,
} from '@mazare3/shared';
import { aboutAr, aboutEn } from './about';
import { contactAr, contactEn } from './contact';
import { termsAr, termsEn } from './terms';
import { privacyAr, privacyEn } from './privacy';
import { cancellationAr, cancellationEn } from './cancellation';
import { bookingPaymentAr, bookingPaymentEn } from './booking-payment';
import { verificationAr, verificationEn } from './verification';
import { cookiePolicyAr, cookiePolicyEn } from './cookie-policy';
import { communityReviewsAr, communityReviewsEn } from './community-reviews';

const EN: Record<LegalPageSlug, LegalDocument> = {
  about: aboutEn,
  contact: contactEn,
  terms: termsEn,
  privacy: privacyEn,
  'cancellation-refund': cancellationEn,
  'booking-payment': bookingPaymentEn,
  verification: verificationEn,
  'cookie-policy': cookiePolicyEn,
  'community-reviews': communityReviewsEn,
};

const AR: Record<LegalPageSlug, LegalDocument> = {
  about: aboutAr,
  contact: contactAr,
  terms: termsAr,
  privacy: privacyAr,
  'cancellation-refund': cancellationAr,
  'booking-payment': bookingPaymentAr,
  verification: verificationAr,
  'cookie-policy': cookiePolicyAr,
  'community-reviews': communityReviewsAr,
};

const LAUNCH_SLUGS = new Set<LegalPageSlug>([
  'terms',
  'privacy',
  'cancellation-refund',
  'booking-payment',
  'verification',
  'cookie-policy',
  'community-reviews',
]);

function applyIdentityPlaceholders(
  doc: LegalDocument,
  values: LegalContentPlaceholderValues,
): LegalDocument {
  const fill = (text: string) => preparePublicLegalText(text, values);
  return {
    ...doc,
    title: fill(doc.title),
    intro: fill(doc.intro),
    sections: doc.sections.map((s) => ({
      ...s,
      title: fill(s.title),
      paragraphs: s.paragraphs.map(fill),
      ...(s.bullets?.length ? { bullets: s.bullets.map(fill) } : {}),
    })),
  };
}

/**
 * Public legal pages: fill confirmed identity placeholders at request time.
 * Missing values leave [[TOKEN]] visible. DB publish should only store filled
 * content when values exist; DRAFT launch-candidate may keep placeholders.
 */
export function getLegalDocument(slug: LegalPageSlug, locale: Locale): LegalDocument {
  const base = locale === 'ar' ? AR[slug] : EN[slug];
  if (!LAUNCH_SLUGS.has(slug)) return base;
  return applyIdentityPlaceholders(
    base,
    toPlaceholderValues(getLegalIdentityFromEnv(), locale === 'ar' ? 'ar' : 'en'),
  );
}
