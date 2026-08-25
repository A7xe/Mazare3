import type { Locale } from '@mazare3/shared';
import type { LegalDocument, LegalPageSlug } from '@/lib/legal/types';
import { aboutAr, aboutEn } from './about';
import { contactAr, contactEn } from './contact';
import { termsAr, termsEn } from './terms';
import { privacyAr, privacyEn } from './privacy';
import { cancellationAr, cancellationEn } from './cancellation';
import { bookingPaymentAr, bookingPaymentEn } from './booking-payment';

const EN: Record<LegalPageSlug, LegalDocument> = {
  about: aboutEn,
  contact: contactEn,
  terms: termsEn,
  privacy: privacyEn,
  'cancellation-refund': cancellationEn,
  'booking-payment': bookingPaymentEn,
};

const AR: Record<LegalPageSlug, LegalDocument> = {
  about: aboutAr,
  contact: contactAr,
  terms: termsAr,
  privacy: privacyAr,
  'cancellation-refund': cancellationAr,
  'booking-payment': bookingPaymentAr,
};

export function getLegalDocument(slug: LegalPageSlug, locale: Locale): LegalDocument {
  return locale === 'ar' ? AR[slug] : EN[slug];
}
