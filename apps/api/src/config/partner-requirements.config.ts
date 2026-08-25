import type { PartnerDocumentType, PartnerEntityType } from '@mazare3/db';

export type PartnerRequirementDef = {
  id: string;
  documentType: PartnerDocumentType;
  entityType: PartnerEntityType | null;
  required: boolean;
  active: boolean;
  labelAr: string;
  labelEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sortOrder: number;
};

/** Fallback if the database checklist is empty. Legal-review placeholders only. */
export const DEFAULT_PARTNER_REQUIREMENTS: PartnerRequirementDef[] = [
  {
    id: 'req_identity_all',
    documentType: 'identity',
    entityType: null,
    required: true,
    active: true,
    labelAr: 'وثيقة إثبات الهوية',
    labelEn: 'Identity document',
    descriptionAr: '[للمراجعة القانونية قبل الإنتاج] وثيقة هوية سارية للشخص المسؤول عن الحساب.',
    descriptionEn:
      '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] A valid identity document for the account holder.',
    sortOrder: 10,
  },
  {
    id: 'req_ownership_all',
    documentType: 'property_ownership',
    entityType: null,
    required: true,
    active: true,
    labelAr: 'إثبات ملكية العقار',
    labelEn: 'Proof of property ownership',
    descriptionAr:
      '[للمراجعة القانونية قبل الإنتاج] مستند يوضح علاقة الشريك بالعقار (ملكية أو حق إدارة).',
    descriptionEn:
      '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] A document showing the partner’s relationship to the property.',
    sortOrder: 20,
  },
  {
    id: 'req_auth_individual',
    documentType: 'management_authorization',
    entityType: 'individual',
    required: false,
    active: true,
    labelAr: 'تفويض إدارة العقار (إن وجد)',
    labelEn: 'Authorization to manage the property (if applicable)',
    descriptionAr:
      '[للمراجعة القانونية قبل الإنتاج] مطلوب إذا كان مقدم الطلب يدير العقار نيابة عن المالك.',
    descriptionEn:
      '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Required if the applicant manages the property on behalf of the owner.',
    sortOrder: 30,
  },
  {
    id: 'req_business_reg',
    documentType: 'business_registration',
    entityType: 'business',
    required: true,
    active: true,
    labelAr: 'وثيقة تسجيل النشاط',
    labelEn: 'Business registration document',
    descriptionAr:
      '[للمراجعة القانونية قبل الإنتاج] مستند تسجيل النشاط التشغيلي — تصنيف المنصة وليس استشارة قانونية.',
    descriptionEn:
      '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Operating registration document — a platform classification, not legal advice.',
    sortOrder: 40,
  },
  {
    id: 'req_payout_all',
    documentType: 'payout_proof',
    entityType: null,
    required: true,
    active: true,
    labelAr: 'إثبات حساب القبض',
    labelEn: 'Bank / payout-account proof',
    descriptionAr: '[للمراجعة القانونية قبل الإنتاج] إثبات يطابق بيانات التحويل اليدوي الحالية.',
    descriptionEn:
      '[LEGAL REVIEW REQUIRED BEFORE PRODUCTION] Proof matching the current manual payout details.',
    sortOrder: 50,
  },
];

export function requirementsForEntity(
  all: PartnerRequirementDef[],
  entityType: PartnerEntityType | null,
): PartnerRequirementDef[] {
  return all
    .filter((r) => r.active)
    .filter((r) => r.entityType == null || (entityType != null && r.entityType === entityType))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
