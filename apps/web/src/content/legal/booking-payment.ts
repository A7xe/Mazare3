import { getLaunchPublicLegalPage } from '@mazare3/shared';
import type { LegalDocument } from '@/lib/legal/types';

export const bookingPaymentEn: LegalDocument = getLaunchPublicLegalPage(
  'booking-payment',
  'en',
);
export const bookingPaymentAr: LegalDocument = getLaunchPublicLegalPage(
  'booking-payment',
  'ar',
);
