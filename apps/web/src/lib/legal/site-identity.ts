/**
 * Public operator / legal-business identity for Mazare3.
 *
 * Product names below are the marketplace working names already used in the UI
 * (Mazare3 Jordan / مزارع الأردن). They are NOT a registered legal entity.
 *
 * Leave operator fields empty until a human supplies real values.
 * Do not invent company names, registration numbers, addresses, phones, or tax IDs.
 * Empty fields are omitted from public pages.
 *
 * Optional overrides (public, non-secret) if you later publish real details:
 *   NEXT_PUBLIC_LEGAL_ENTITY_NAME
 *   NEXT_PUBLIC_REGISTRATION_NUMBER
 *   NEXT_PUBLIC_TAX_NUMBER
 *   NEXT_PUBLIC_REGISTERED_ADDRESS
 *   NEXT_PUBLIC_SUPPORT_EMAIL
 *   NEXT_PUBLIC_PRIVACY_EMAIL
 *   NEXT_PUBLIC_SUPPORT_PHONE
 */

function optionalPublicEnv(name: string): string | null {
  const value = (process.env[name] ?? '').trim();
  return value.length > 0 ? value : null;
}

export type SiteIdentity = {
  productNameEn: string;
  productNameAr: string;
  legalEntityName: string | null;
  registrationNumber: string | null;
  taxNumber: string | null;
  registeredAddress: string | null;
  supportEmail: string | null;
  privacyEmail: string | null;
  supportPhone: string | null;
};

export function getSiteIdentity(): SiteIdentity {
  return {
    productNameEn: 'Mazare3 Jordan',
    productNameAr: 'مزارع الأردن',
    legalEntityName: optionalPublicEnv('NEXT_PUBLIC_LEGAL_ENTITY_NAME'),
    registrationNumber: optionalPublicEnv('NEXT_PUBLIC_REGISTRATION_NUMBER'),
    taxNumber: optionalPublicEnv('NEXT_PUBLIC_TAX_NUMBER'),
    registeredAddress: optionalPublicEnv('NEXT_PUBLIC_REGISTERED_ADDRESS'),
    supportEmail: optionalPublicEnv('NEXT_PUBLIC_SUPPORT_EMAIL'),
    privacyEmail: optionalPublicEnv('NEXT_PUBLIC_PRIVACY_EMAIL'),
    supportPhone: optionalPublicEnv('NEXT_PUBLIC_SUPPORT_PHONE'),
  };
}

/** ISO date of the current public policy pages (not a statutory filing date). */
export const LEGAL_PAGES_UPDATED_ON = '2026-08-19';

/** Human must supply these before production if they want a complete legal footer/contact block. */
export const LEGAL_IDENTITY_GAPS_BEFORE_PRODUCTION = [
  'Legal entity / operator name',
  'Company registration number (if the operator is a registered company)',
  'Tax / VAT number (if applicable in Jordan)',
  'Registered business address',
  'Public support email',
  'Privacy-request email (may be the same as support)',
  'Public support phone (optional)',
] as const;
