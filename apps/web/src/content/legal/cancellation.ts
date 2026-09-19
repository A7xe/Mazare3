import { getLaunchPublicLegalPage } from '@mazare3/shared';
import type { LegalDocument } from '@/lib/legal/types';

export const cancellationEn: LegalDocument = getLaunchPublicLegalPage(
  'cancellation-refund',
  'en',
);
export const cancellationAr: LegalDocument = getLaunchPublicLegalPage(
  'cancellation-refund',
  'ar',
);
