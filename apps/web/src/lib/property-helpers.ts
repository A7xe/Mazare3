import type { Locale } from '@mazare3/shared';
import type { PublicPropertySummary, VerificationStatus } from '@mazare3/shared';

export function getPropertyTitle(
  property: Pick<PublicPropertySummary, 'titleAr' | 'titleEn'>,
  locale: Locale,
): string {
  return locale === 'ar' ? property.titleAr : (property.titleEn || property.titleAr);
}

export function getApproxLocation(
  property: Pick<PublicPropertySummary, 'approximateLocation'>,
): string {
  return property.approximateLocation;
}

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-JO' : 'en-JO', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function shouldShowVerificationBadge(status: VerificationStatus): boolean {
  return status === 'platform_verified' || status === 'platform_reviewed';
}
