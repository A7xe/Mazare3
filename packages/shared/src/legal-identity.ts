/**
 * Phase 3C.3 — centralized legal / operator identity configuration.
 *
 * Product names (Mazare3 Jordan / مزارع الأردن) are brand labels, NOT the
 * registered legal entity.
 *
 * Founder-confirmed company fields are baked in as SSOT defaults.
 * Env vars may override for local experiments — never invent privacy/DPO/PSP.
 *
 * CRITICAL: legal entity NAME and legal FORM are stored separately.
 * Do NOT concatenate "ذات مسؤولية محدودة" into the company name.
 */

import {
  LEGAL_CONTENT_PLACEHOLDERS,
  type LegalContentPlaceholderValues,
} from './legal-content/placeholders';

export type LegalIdentityFieldStatus = 'CONFIRMED' | 'MISSING';

export type LegalIdentitySource =
  | 'FOUNDER_CONFIRMED'
  | 'OFFICIAL_COMPANY_RECORD'
  | 'FOUNDER_COMPANY_PROVIDED'
  | 'ENV_OVERRIDE'
  | 'MISSING';

/** How privacy contact should be labelled in public copy (never invent a DPO). */
export type PrivacyContactLabelMode = 'privacy_contact' | 'dpo';

export type LegalIdentityConfig = {
  productNameEn: string;
  productNameAr: string;

  /** Company name only — never includes LLC / ذات مسؤولية محدودة. */
  legalEntityNameAr: string | null;
  legalEntityNameEn: string | null;
  /**
   * @deprecated Prefer legalEntityNameAr / legalEntityNameEn.
   * Locale-agnostic fallback used only when a single-string token is required.
   */
  legalEntityName: string | null;

  legalFormAr: string | null;
  legalFormEn: string | null;

  commercialRegistrationNumber: string | null;
  nationalEstablishmentNumber: string | null;
  registrationDate: string | null;

  registeredCountryAr: string | null;
  registeredCountryEn: string | null;
  registeredCityAr: string | null;
  registeredCityEn: string | null;

  registeredAddressAr: string | null;
  registeredAddressEn: string | null;
  /**
   * @deprecated Prefer registeredAddressAr / registeredAddressEn.
   */
  registeredAddress: string | null;

  /** Detailed street address source classification. */
  detailedAddressSource: LegalIdentitySource;
  /** City/center source classification. */
  companyCitySource: LegalIdentitySource;
  /**
   * English trade/legal spelling classification.
   * Founder/company confirmed; official English CCD certificate not yet provided.
   */
  englishEntityNameSource: LegalIdentitySource;

  /** Company legal contact — info@battechno.com */
  legalContactEmail: string | null;
  /** Mazare3 project operations — mazare3jo@gmail.com (not legal email). */
  projectOperationalEmail: string | null;
  /**
   * Partnership / farm registration ONLY.
   * Never customer support / privacy / legal / booking hotline.
   */
  partnershipContactPhone: string | null;

  /** Still unresolved unless founder sets env. */
  privacyContactEmail: string | null;
  dpoOrPrivacyContact: string | null;
  paymentProviderLegalName: string | null;

  /** Optional — not required for Production activation when inapplicable. */
  taxNumber: string | null;
  /**
   * Customer support phone — intentionally NOT the partnership number.
   * Leave null so partnership phone is not leaked into support surfaces.
   */
  supportPhone: string | null;

  dpoAppointed: boolean;
  privacyContactLabel: PrivacyContactLabelMode;
};

/** Still-blocking Production identity gaps after Phase 3C.3 founder integration. */
export const LEGAL_IDENTITY_PRODUCTION_REQUIRED_KEYS = [
  'privacyContactEmail',
  'dpoOrPrivacyContact',
  'paymentProviderLegalName',
] as const;

export type LegalIdentityProductionRequiredKey =
  (typeof LEGAL_IDENTITY_PRODUCTION_REQUIRED_KEYS)[number];

const PRODUCT_NAME_EN = 'Mazare3 Jordan';
const PRODUCT_NAME_AR = 'مزارع الأردن';

/** Founder-confirmed SSOT — Arabic name does NOT include legal form. */
export const FOUNDER_CONFIRMED_LEGAL_IDENTITY = {
  legalEntityNameAr: 'شركة الرجل الوطواط للتكنولوجيا',
  legalEntityNameEn: 'BATMAN TECHNOLOGY',
  legalFormAr: 'شركة ذات مسؤولية محدودة',
  legalFormEn: 'Limited Liability Company (LLC)',
  commercialRegistrationNumber: '62272',
  nationalEstablishmentNumber: '200185304',
  registrationDate: '17/01/2022',
  registeredCountryAr: 'المملكة الأردنية الهاشمية',
  registeredCountryEn: 'Hashemite Kingdom of Jordan',
  registeredCityAr: 'عمّان',
  registeredCityEn: 'Amman',
  registeredAddressAr: [
    'المملكة الأردنية الهاشمية - عمّان',
    'المكتب 405، الطابق الرابع',
    'مجمع الباسم 2، شارع المدينة المنورة',
    'بالقرب من البنك العربي',
  ].join('\n'),
  registeredAddressEn: [
    'Hashemite Kingdom of Jordan – Amman',
    'Office 405, Fourth Floor',
    'Al-Basem Complex 2, Al-Madina Al-Munawwara Street',
    'Near Arab Bank',
  ].join('\n'),
  legalContactEmail: 'info@battechno.com',
  projectOperationalEmail: 'mazare3jo@gmail.com',
  partnershipContactPhone: '+962 7 9605 3210',
} as const;

function trimEnv(name: string): string | null {
  const value = (process.env[name] ?? '').trim();
  return value.length > 0 ? value : null;
}

function firstEnv(...names: string[]): string | null {
  for (const name of names) {
    const v = trimEnv(name);
    if (v) return v;
  }
  return null;
}

function parseBoolEnv(name: string, defaultValue = false): boolean {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (raw === '' || raw == null) return defaultValue;
  if (raw === 'true' || raw === '1' || raw === 'yes') return true;
  if (raw === 'false' || raw === '0' || raw === 'no') return false;
  return defaultValue;
}

export function classifyLegalIdentityField(
  value: string | null | undefined,
): LegalIdentityFieldStatus {
  return value != null && String(value).trim().length > 0 ? 'CONFIRMED' : 'MISSING';
}

/**
 * Assert Arabic entity name does not accidentally include the LLC form phrase.
 */
export function assertLegalEntityNameExcludesForm(nameAr: string | null): boolean {
  if (!nameAr) return true;
  return !nameAr.includes('ذات مسؤولية محدودة');
}

/**
 * Load identity: founder-confirmed defaults, then optional env overrides.
 * Never invent privacy / DPO / PSP legal name.
 */
export function getLegalIdentityFromEnv(): LegalIdentityConfig {
  const dpoAppointed = parseBoolEnv('LEGAL_DPO_APPOINTED', false);
  const dpoOrPrivacyContact = firstEnv(
    'LEGAL_DPO_OR_PRIVACY_CONTACT',
    'NEXT_PUBLIC_DPO_OR_PRIVACY_CONTACT',
  );
  // Do NOT silently map legalContactEmail → privacy.
  const privacyContactEmail = firstEnv(
    'NEXT_PUBLIC_PRIVACY_EMAIL',
    'LEGAL_PRIVACY_CONTACT_EMAIL',
  );

  const legalEntityNameAr =
    firstEnv('LEGAL_ENTITY_NAME_AR', 'NEXT_PUBLIC_LEGAL_ENTITY_NAME_AR') ??
    FOUNDER_CONFIRMED_LEGAL_IDENTITY.legalEntityNameAr;
  const legalEntityNameEn =
    firstEnv('LEGAL_ENTITY_NAME_EN', 'NEXT_PUBLIC_LEGAL_ENTITY_NAME_EN') ??
    FOUNDER_CONFIRMED_LEGAL_IDENTITY.legalEntityNameEn;

  const registeredAddressAr =
    firstEnv('LEGAL_REGISTERED_ADDRESS_AR', 'NEXT_PUBLIC_REGISTERED_ADDRESS_AR') ??
    FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredAddressAr;
  const registeredAddressEn =
    firstEnv('LEGAL_REGISTERED_ADDRESS_EN', 'NEXT_PUBLIC_REGISTERED_ADDRESS_EN') ??
    FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredAddressEn;

  return {
    productNameEn: PRODUCT_NAME_EN,
    productNameAr: PRODUCT_NAME_AR,
    legalEntityNameAr,
    legalEntityNameEn,
    legalEntityName: legalEntityNameEn,
    legalFormAr:
      firstEnv('LEGAL_FORM_AR') ?? FOUNDER_CONFIRMED_LEGAL_IDENTITY.legalFormAr,
    legalFormEn:
      firstEnv('LEGAL_FORM_EN') ?? FOUNDER_CONFIRMED_LEGAL_IDENTITY.legalFormEn,
    commercialRegistrationNumber:
      firstEnv(
        'NEXT_PUBLIC_REGISTRATION_NUMBER',
        'LEGAL_COMMERCIAL_REGISTRATION_NUMBER',
        'LEGAL_REGISTRATION_NUMBER',
      ) ?? FOUNDER_CONFIRMED_LEGAL_IDENTITY.commercialRegistrationNumber,
    nationalEstablishmentNumber:
      firstEnv('LEGAL_NATIONAL_ESTABLISHMENT_NUMBER') ??
      FOUNDER_CONFIRMED_LEGAL_IDENTITY.nationalEstablishmentNumber,
    registrationDate:
      firstEnv('LEGAL_REGISTRATION_DATE') ??
      FOUNDER_CONFIRMED_LEGAL_IDENTITY.registrationDate,
    registeredCountryAr: FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredCountryAr,
    registeredCountryEn: FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredCountryEn,
    registeredCityAr: FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredCityAr,
    registeredCityEn: FOUNDER_CONFIRMED_LEGAL_IDENTITY.registeredCityEn,
    registeredAddressAr,
    registeredAddressEn,
    registeredAddress: registeredAddressEn,
    detailedAddressSource: 'FOUNDER_COMPANY_PROVIDED',
    companyCitySource: 'OFFICIAL_COMPANY_RECORD',
    englishEntityNameSource: 'FOUNDER_CONFIRMED',
    legalContactEmail:
      firstEnv('LEGAL_CONTACT_EMAIL', 'NEXT_PUBLIC_LEGAL_CONTACT_EMAIL') ??
      FOUNDER_CONFIRMED_LEGAL_IDENTITY.legalContactEmail,
    projectOperationalEmail:
      firstEnv(
        'LEGAL_PROJECT_OPERATIONAL_EMAIL',
        'NEXT_PUBLIC_PROJECT_OPERATIONAL_EMAIL',
        'NEXT_PUBLIC_SUPPORT_EMAIL',
      ) ?? FOUNDER_CONFIRMED_LEGAL_IDENTITY.projectOperationalEmail,
    partnershipContactPhone:
      firstEnv(
        'LEGAL_PARTNERSHIP_CONTACT_PHONE',
        'NEXT_PUBLIC_PARTNERSHIP_CONTACT_PHONE',
      ) ?? FOUNDER_CONFIRMED_LEGAL_IDENTITY.partnershipContactPhone,
    privacyContactEmail,
    dpoOrPrivacyContact,
    paymentProviderLegalName: firstEnv('LEGAL_PAYMENT_PROVIDER_LEGAL_NAME'),
    taxNumber: firstEnv('NEXT_PUBLIC_TAX_NUMBER', 'LEGAL_TAX_NUMBER'),
    // Never map partnership phone into customer supportPhone.
    supportPhone: firstEnv('NEXT_PUBLIC_CUSTOMER_SUPPORT_PHONE', 'LEGAL_CUSTOMER_SUPPORT_PHONE'),
    dpoAppointed,
    privacyContactLabel: dpoAppointed ? 'dpo' : 'privacy_contact',
  };
}

/** Preferred Arabic operator introduction for legal documents. */
export function formatLegalEntityIntroAr(identity: LegalIdentityConfig): string {
  const name = identity.legalEntityNameAr ?? '[[LEGAL_ENTITY_NAME]]';
  const form = identity.legalFormAr ?? '[[LEGAL_FORM]]';
  const cr = identity.commercialRegistrationNumber ?? '[[COMMERCIAL_REGISTRATION_NUMBER]]';
  return `${name}، وهي ${form} مسجلة في المملكة الأردنية الهاشمية تحت رقم التسجيل ${cr}`;
}

/** Preferred English operator introduction for legal documents. */
export function formatLegalEntityIntroEn(identity: LegalIdentityConfig): string {
  const name = identity.legalEntityNameEn ?? '[[LEGAL_ENTITY_NAME]]';
  // Presentation only: spell out the form; do not render lowercase "(llc)".
  // SSOT legalFormEn may still retain "(LLC)" as a separate field.
  const formRaw = identity.legalFormEn ?? 'Limited Liability Company';
  const form = formRaw
    .replace(/\s*\(\s*llc\s*\)/gi, '')
    .trim()
    .toLowerCase();
  const cr = identity.commercialRegistrationNumber ?? '[[COMMERCIAL_REGISTRATION_NUMBER]]';
  return `${name}, a ${form} registered in the Hashemite Kingdom of Jordan under Commercial Registration No. ${cr}`;
}

/**
 * Map confirmed identity fields onto legal-content placeholder values.
 * Locale-aware: pass language so LEGAL_ENTITY_NAME / REGISTERED_ADDRESS resolve correctly.
 * Missing privacy/DPO/PSP keys leave [[TOKEN]] untouched.
 */
export function toPlaceholderValues(
  identity: LegalIdentityConfig,
  language: 'ar' | 'en' = 'en',
): LegalContentPlaceholderValues {
  const out: LegalContentPlaceholderValues = {};

  const entityName =
    language === 'ar' ? identity.legalEntityNameAr : identity.legalEntityNameEn;
  const address =
    language === 'ar' ? identity.registeredAddressAr : identity.registeredAddressEn;
  const legalForm = language === 'ar' ? identity.legalFormAr : identity.legalFormEn;

  if (entityName) {
    out.LEGAL_ENTITY_NAME = entityName;
    if (language === 'ar') out.LEGAL_ENTITY_NAME_AR = entityName;
    else out.LEGAL_ENTITY_NAME_EN = entityName;
  }
  if (identity.legalEntityNameAr) out.LEGAL_ENTITY_NAME_AR = identity.legalEntityNameAr;
  if (identity.legalEntityNameEn) out.LEGAL_ENTITY_NAME_EN = identity.legalEntityNameEn;
  if (legalForm) {
    if (language === 'ar') out.LEGAL_FORM_AR = legalForm;
    else out.LEGAL_FORM_EN = legalForm;
  }
  if (identity.legalFormAr) out.LEGAL_FORM_AR = identity.legalFormAr;
  if (identity.legalFormEn) out.LEGAL_FORM_EN = identity.legalFormEn;

  if (address) {
    out.REGISTERED_ADDRESS = address;
  }
  if (identity.registeredAddressAr) out.REGISTERED_ADDRESS_AR = identity.registeredAddressAr;
  if (identity.registeredAddressEn) out.REGISTERED_ADDRESS_EN = identity.registeredAddressEn;

  if (identity.legalContactEmail) {
    out.LEGAL_CONTACT_EMAIL = identity.legalContactEmail;
  }
  if (identity.commercialRegistrationNumber) {
    out.COMMERCIAL_REGISTRATION_NUMBER = identity.commercialRegistrationNumber;
  }
  if (identity.nationalEstablishmentNumber) {
    out.NATIONAL_ESTABLISHMENT_NUMBER = identity.nationalEstablishmentNumber;
  }
  if (identity.projectOperationalEmail) {
    out.PROJECT_OPERATIONAL_EMAIL = identity.projectOperationalEmail;
  }
  if (identity.partnershipContactPhone) {
    out.PARTNERSHIP_CONTACT_PHONE = identity.partnershipContactPhone;
  }

  // Do NOT fill privacy from legal email.
  if (identity.privacyContactEmail) {
    out.PRIVACY_CONTACT_EMAIL = identity.privacyContactEmail;
  }
  // Never claim DPO unless appointed.
  if (identity.dpoAppointed && identity.dpoOrPrivacyContact) {
    out.DPO_OR_PRIVACY_CONTACT = identity.dpoOrPrivacyContact;
  }
  if (identity.paymentProviderLegalName) {
    out.PAYMENT_PROVIDER_LEGAL_NAME = identity.paymentProviderLegalName;
  }

  out.LEGAL_ENTITY_INTRO_AR = formatLegalEntityIntroAr(identity);
  out.LEGAL_ENTITY_INTRO_EN = formatLegalEntityIntroEn(identity);

  return out;
}

export type FounderInputRequiredItem = {
  key: LegalIdentityProductionRequiredKey | 'dpoAppointedReview' | 'counselApproval';
  token: string | null;
  envHints: string[];
  status: LegalIdentityFieldStatus;
  note?: string;
};

/** Remaining founder/legal inputs still required for Production activation. */
export function listFounderInputRequired(
  identity: LegalIdentityConfig = getLegalIdentityFromEnv(),
): FounderInputRequiredItem[] {
  const items: FounderInputRequiredItem[] = [
    {
      key: 'privacyContactEmail',
      token: LEGAL_CONTENT_PLACEHOLDERS.PRIVACY_CONTACT_EMAIL,
      envHints: ['NEXT_PUBLIC_PRIVACY_EMAIL', 'LEGAL_PRIVACY_CONTACT_EMAIL'],
      status: classifyLegalIdentityField(identity.privacyContactEmail),
      note: 'Do not auto-map info@battechno.com or mazare3jo@gmail.com',
    },
    {
      key: 'dpoOrPrivacyContact',
      token: LEGAL_CONTENT_PLACEHOLDERS.DPO_OR_PRIVACY_CONTACT,
      envHints: ['LEGAL_DPO_OR_PRIVACY_CONTACT', 'NEXT_PUBLIC_DPO_OR_PRIVACY_CONTACT'],
      status: classifyLegalIdentityField(identity.dpoOrPrivacyContact),
      note: 'REQUIRES JORDANIAN LEGAL REVIEW — do not invent a DPO title',
    },
    {
      key: 'paymentProviderLegalName',
      token: LEGAL_CONTENT_PLACEHOLDERS.PAYMENT_PROVIDER_LEGAL_NAME,
      envHints: ['LEGAL_PAYMENT_PROVIDER_LEGAL_NAME'],
      status: classifyLegalIdentityField(identity.paymentProviderLegalName),
      note: 'REQUIRES PSP CONTRACT REVIEW — do not invent PayTabs Inc from brand',
    },
  ];

  return items.filter((i) => i.status === 'MISSING');
}

/**
 * Hard-fail Production activation when still-required identity fields are missing.
 * Resolved Phase 3C.3 fields (entity, form, CR, address, legal email) are not flagged.
 */
export function assertLegalIdentityReadyForProduction(
  identity: LegalIdentityConfig = getLegalIdentityFromEnv(),
): void {
  if (!assertLegalEntityNameExcludesForm(identity.legalEntityNameAr)) {
    throw new Error(
      '[legal-identity] INVALID — Arabic legal entity name must not contain "ذات مسؤولية محدودة" (legal form is separate)',
    );
  }
  const missing = listFounderInputRequired(identity);
  if (missing.length === 0) return;
  const lines = missing.map((m) => {
    const token = m.token ? ` ${m.token}` : '';
    return `${m.key}${token} (env: ${m.envHints.join(' | ')})`;
  });
  throw new Error(
    `[legal-identity] FOUNDER INPUT REQUIRED — missing Production identity fields:\n- ${lines.join('\n- ')}`,
  );
}

export function summarizeLegalIdentity(
  identity: LegalIdentityConfig = getLegalIdentityFromEnv(),
): {
  fields: Record<string, { status: LegalIdentityFieldStatus; valuePresent: boolean }>;
  founderInputRequired: FounderInputRequiredItem[];
  dpoAppointed: boolean;
  privacyContactLabel: PrivacyContactLabelMode;
  resolvedIdentity: {
    legalEntityNameAr: boolean;
    legalEntityNameEn: boolean;
    legalFormAr: boolean;
    legalFormEn: boolean;
    commercialRegistrationNumber: boolean;
    nationalEstablishmentNumber: boolean;
    registeredAddressAr: boolean;
    registeredAddressEn: boolean;
    legalContactEmail: boolean;
    projectOperationalEmail: boolean;
    partnershipContactPhone: boolean;
  };
} {
  const stringFields: Array<keyof LegalIdentityConfig> = [
    'legalEntityNameAr',
    'legalEntityNameEn',
    'legalFormAr',
    'legalFormEn',
    'commercialRegistrationNumber',
    'nationalEstablishmentNumber',
    'registrationDate',
    'registeredAddressAr',
    'registeredAddressEn',
    'legalContactEmail',
    'projectOperationalEmail',
    'partnershipContactPhone',
    'privacyContactEmail',
    'dpoOrPrivacyContact',
    'paymentProviderLegalName',
    'taxNumber',
    'supportPhone',
  ];
  const fields: Record<string, { status: LegalIdentityFieldStatus; valuePresent: boolean }> =
    {};
  for (const key of stringFields) {
    const value = identity[key];
    const status =
      typeof value === 'string' || value === null
        ? classifyLegalIdentityField(value)
        : 'CONFIRMED';
    fields[key] = { status, valuePresent: status === 'CONFIRMED' };
  }
  return {
    fields,
    founderInputRequired: listFounderInputRequired(identity),
    dpoAppointed: identity.dpoAppointed,
    privacyContactLabel: identity.privacyContactLabel,
    resolvedIdentity: {
      legalEntityNameAr: classifyLegalIdentityField(identity.legalEntityNameAr) === 'CONFIRMED',
      legalEntityNameEn: classifyLegalIdentityField(identity.legalEntityNameEn) === 'CONFIRMED',
      legalFormAr: classifyLegalIdentityField(identity.legalFormAr) === 'CONFIRMED',
      legalFormEn: classifyLegalIdentityField(identity.legalFormEn) === 'CONFIRMED',
      commercialRegistrationNumber:
        classifyLegalIdentityField(identity.commercialRegistrationNumber) === 'CONFIRMED',
      nationalEstablishmentNumber:
        classifyLegalIdentityField(identity.nationalEstablishmentNumber) === 'CONFIRMED',
      registeredAddressAr:
        classifyLegalIdentityField(identity.registeredAddressAr) === 'CONFIRMED',
      registeredAddressEn:
        classifyLegalIdentityField(identity.registeredAddressEn) === 'CONFIRMED',
      legalContactEmail: classifyLegalIdentityField(identity.legalContactEmail) === 'CONFIRMED',
      projectOperationalEmail:
        classifyLegalIdentityField(identity.projectOperationalEmail) === 'CONFIRMED',
      partnershipContactPhone:
        classifyLegalIdentityField(identity.partnershipContactPhone) === 'CONFIRMED',
    },
  };
}
