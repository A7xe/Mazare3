import { getLaunchPublicLegalPage } from '@mazare3/shared';
import type { LegalDocument } from '@/lib/legal/types';

export const termsEn: LegalDocument = getLaunchPublicLegalPage('terms', 'en');
export const termsAr: LegalDocument = getLaunchPublicLegalPage('terms', 'ar');
