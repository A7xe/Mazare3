/**
 * Public operator / legal-business identity for Mazare3.
 *
 * Thin web wrapper over `@mazare3/shared` legal-identity SSOT (Phase 3C.3).
 * Product names are marketplace brands — NOT the registered legal entity.
 *
 * Contact separation:
 * - legalContactEmail = company legal (info@battechno.com)
 * - projectOperationalEmail = Mazare3 ops (mazare3jo@gmail.com)
 * - partnershipContactPhone = partnerships/farm registration ONLY
 * - supportPhone = customer support phone (intentionally null; use tickets)
 * - privacyEmail = unresolved until founder decides
 */

import {
  getLegalIdentityFromEnv,
  listFounderInputRequired,
  type LegalIdentityConfig,
} from '@mazare3/shared/legal-identity';

export type SiteIdentity = {
  productNameEn: string;
  productNameAr: string;
  legalEntityName: string | null;
  legalEntityNameAr: string | null;
  legalEntityNameEn: string | null;
  legalFormAr: string | null;
  legalFormEn: string | null;
  registrationNumber: string | null;
  nationalEstablishmentNumber: string | null;
  registrationDate: string | null;
  taxNumber: string | null;
  registeredAddress: string | null;
  registeredAddressAr: string | null;
  registeredAddressEn: string | null;
  /** Company legal email */
  legalContactEmail: string | null;
  /** @deprecated Prefer legalContactEmail — maps to company legal email for contact page */
  supportEmail: string | null;
  /** Mazare3 operational email — not legal email */
  projectOperationalEmail: string | null;
  privacyEmail: string | null;
  /** Customer support phone — must NOT be partnership phone */
  supportPhone: string | null;
  /** Partnership / farm registration only */
  partnershipContactPhone: string | null;
  dpoOrPrivacyContact: string | null;
  paymentProviderLegalName: string | null;
  dpoAppointed: boolean;
  privacyContactLabel: LegalIdentityConfig['privacyContactLabel'];
};

export function getSiteIdentity(locale: 'ar' | 'en' = 'en'): SiteIdentity {
  const identity = getLegalIdentityFromEnv();
  const legalEntityName =
    locale === 'ar' ? identity.legalEntityNameAr : identity.legalEntityNameEn;
  const registeredAddress =
    locale === 'ar' ? identity.registeredAddressAr : identity.registeredAddressEn;
  return {
    productNameEn: identity.productNameEn,
    productNameAr: identity.productNameAr,
    legalEntityName,
    legalEntityNameAr: identity.legalEntityNameAr,
    legalEntityNameEn: identity.legalEntityNameEn,
    legalFormAr: identity.legalFormAr,
    legalFormEn: identity.legalFormEn,
    registrationNumber: identity.commercialRegistrationNumber,
    nationalEstablishmentNumber: identity.nationalEstablishmentNumber,
    registrationDate: identity.registrationDate,
    taxNumber: identity.taxNumber,
    registeredAddress,
    registeredAddressAr: identity.registeredAddressAr,
    registeredAddressEn: identity.registeredAddressEn,
    legalContactEmail: identity.legalContactEmail,
    supportEmail: identity.legalContactEmail,
    projectOperationalEmail: identity.projectOperationalEmail,
    privacyEmail: identity.privacyContactEmail,
    supportPhone: identity.supportPhone,
    partnershipContactPhone: identity.partnershipContactPhone,
    dpoOrPrivacyContact: identity.dpoOrPrivacyContact,
    paymentProviderLegalName: identity.paymentProviderLegalName,
    dpoAppointed: identity.dpoAppointed,
    privacyContactLabel: identity.privacyContactLabel,
  };
}

export { getLegalIdentityFromEnv, listFounderInputRequired };

export const LEGAL_PAGES_UPDATED_ON = '2026-09-13';

/** Remaining gaps before Production legal activation (Phase 3C.3). */
export const LEGAL_IDENTITY_GAPS_BEFORE_PRODUCTION = [
  'Privacy-request email (NEXT_PUBLIC_PRIVACY_EMAIL) — do not auto-map company or Gmail ops email',
  'DPO or privacy contact (REQUIRES JORDANIAN LEGAL REVIEW — do not invent a DPO)',
  'Payment provider legal name (LEGAL_PAYMENT_PROVIDER_LEGAL_NAME — REQUIRES PSP CONTRACT REVIEW)',
  'Jordanian counsel approval of launch-candidate legal corpus',
  'Founder publication approval',
] as const;
