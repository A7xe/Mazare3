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
  const intlLocale = locale === 'ar' ? 'ar-JO' : 'en-JO';
  const formatter = new Intl.NumberFormat(intlLocale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
    numberingSystem: 'latn',
  });

  if (locale === 'ar' && currency.toUpperCase() === 'JOD') {
    return formatter
      .formatToParts(amount)
      .map((part) => (part.type === 'currency' ? 'د.أ' : part.value))
      .join('');
  }

  return formatter.format(amount);
}

export function shouldShowVerificationBadge(status: VerificationStatus): boolean {
  return status === 'platform_verified';
}
