import { LEGAL_CONTENT_PLACEHOLDERS as P } from './placeholders';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_FREE_UNTIL_HOURS,
  CHECK_IN_EXPIRE_MINUTES_AFTER_START,
  CHECK_IN_OPEN_HOURS_BEFORE_START,
  CUSTOMER_NO_SHOW_GRACE_MINUTES,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
  MAX_CUSTOMER_RESCHEDULES,
  OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_10,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_20,
  OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS,
  OWNER_PENALTY_MAX_JOD,
  OWNER_PENALTY_MIN_JOD,
  RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
} from './ssot-values';
import { finalizeLaunchDocument, type LaunchLegalDocument } from './build-legal-markdown';

export const cookiePolicy: LaunchLegalDocument = finalizeLaunchDocument({
  documentType: 'cookie_policy',
  titleEn: 'Cookie Policy',
  titleAr: 'سياسة ملفات تعريف الارتباط',
  introEn: `Concise essentials-only cookie and local storage notice for Mazare3.`,
  introAr: `إشعار مختصر لملفات الارتباط والتخزين المحلي الأساسية في مزارع.`,
  sections: [
    {
      id: 'essentials',
      titleEn: '1. Essential cookies and storage',
      titleAr: '1. ملفات الارتباط والتخزين الأساسية',
      paragraphsEn: [
        `Mazare3 currently uses essential technologies needed to run the service: authentication/session cookies, locale or preference storage, security protections, and payment-related necessary technologies on PSP-hosted pages where applicable.`,
        `Phase 3B audit found no Google Analytics or Meta Pixel in application source at drafting time.`
      ],
      paragraphsAr: [
        `تستخدم مزارع حالياً تقنيات أساسية لتشغيل الخدمة: ملفات مصادقة/جلسة، وتخزين اللغة أو التفضيلات، وحمايات أمنية، وتقنيات دفع لازمة على صفحات مزود الدفع عند الاقتضاء.`,
        `لم يظهر تدقيق المرحلة 3B وجود Google Analytics أو Meta Pixel في مصدر التطبيق وقت الصياغة.`
      ]
    },
    {
      id: 'optional',
      titleEn: '2. Optional analytics or marketing',
      titleAr: '2. التحليلات أو التسويق الاختياري',
      paragraphsEn: [
        `If optional analytics or marketing trackers are introduced later, Mazare3 will update this Policy and obtain appropriate consent before non-essential tracking, separate from Terms acceptance.`
      ],
      paragraphsAr: [
        `إذا أُدخلت لاحقاً أدوات تحليلات أو تسويق اختيارية، ستحدّث مزارع هذه السياسة وتحصل على الموافقة المناسبة قبل التتبع غير الأساسي، منفصلة عن قبول الشروط.`
      ]
    },
    {
      id: 'contact',
      titleEn: '3. Contact',
      titleAr: '3. التواصل',
      paragraphsEn: [
        `Privacy questions: ${P.PRIVACY_CONTACT_EMAIL}. Operator: ${P.LEGAL_ENTITY_NAME}.`
      ],
      paragraphsAr: [
        `استفسارات الخصوصية: ${P.PRIVACY_CONTACT_EMAIL}. المشغّل: ${P.LEGAL_ENTITY_NAME}.`
      ]
    }
  ],
});
