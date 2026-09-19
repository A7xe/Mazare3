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

export const verificationPolicy: LaunchLegalDocument = finalizeLaunchDocument({
  documentType: 'verification_policy',
  titleEn: 'Verification Policy',
  titleAr: 'سياسة التحقق',
  introEn: `Explains “Verified by Mazare3” for Mazare3 Jordan listings.`,
  introAr: `توضح معنى «تم التحقق بواسطة Mazare3» لإعلانات مزارع الأردن.`,
  sections: [
    {
      id: 'meaning',
      titleEn: '1. What “Verified by Mazare3” means',
      titleAr: '1. معنى «تم التحقق بواسطة Mazare3»',
      paragraphsEn: [
        `The badge “Verified by Mazare3” / “تم التحقق بواسطة Mazare3” appears only when Property.verificationStatus === platform_verified after Mazare3’s platform review process.`,
        `It is not government certification, licensing approval, or an absolute guarantee of property condition, safety, identity, or future performance.`
      ],
      paragraphsAr: [
        `تظهر شارة «تم التحقق بواسطة Mazare3» / “Verified by Mazare3” فقط عندما تكون حالة التحقق platform_verified بعد عملية مراجعة منصة مزارع.`,
        `وليست شهادة حكومية أو اعتماد ترخيص أو ضماناً مطلقاً لحالة العقار أو السلامة أو الهوية أو الأداء المستقبلي.`
      ]
    },
    {
      id: 'vs-kyc',
      titleEn: '2. Difference from basic Owner KYC',
      titleAr: '2. الفرق عن تحقق المالك الأساسي',
      paragraphsEn: [
        `Owner onboarding/KYC checks identity and listing authority documents for partnership. Platform verification is a separate review that may examine listing quality and related signals. Passing KYC alone does not grant the badge.`,
        `For Owners, platform_verified may apply a ${VERIFIED_COMMISSION_PERCENT}% commission instead of ${STANDARD_COMMISSION_PERCENT}% unless custom commercial terms apply — this commercial detail is primarily an Owner matter.`
      ],
      paragraphsAr: [
        `تهيئة المالك/التحقق تفحص الهوية ومستندات صلاحية العرض للشراكة. التحقق المنصّي مراجعة منفصلة قد تنظر في جودة الإعلان وإشارات ذات صلة. اجتياز التحقق الأساسي وحده لا يمنح الشارة.`,
        `للمالكين، قد تطبّق platform_verified عمولة ${VERIFIED_COMMISSION_PERCENT}٪ بدل ${STANDARD_COMMISSION_PERCENT}٪ ما لم تُطبَّق شروط تجارية مخصّصة — وهذا تفصيل تجاري يخص المالك أساساً.`
      ]
    },
    {
      id: 'changes',
      titleEn: '3. Suspension and changes',
      titleAr: '3. التعليق والتغيير',
      paragraphsEn: [
        `Verification may be suspended or revoked if standards are no longer met or information changes. Listing information can become outdated; Customers should still read the live listing and house rules.`,
        `Mazare3 does not publish internal antifraud methods in this Policy.`
      ],
      paragraphsAr: [
        `قد يُعلَّق التحقق أو يُلغى إذا لم تعد المعايير مستوفاة أو تغيّرت المعلومات. قد يصبح محتوى الإعلان قديماً؛ وينبغي للزبائن قراءة الإعلان الحي وقواعد البيت.`,
        `لا تنشر مزارع أساليب مكافحة الاحتيال الداخلية في هذه السياسة.`
      ]
    }
  ],
});
