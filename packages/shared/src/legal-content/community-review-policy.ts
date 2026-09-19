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

export const communityReviewPolicy: LaunchLegalDocument = finalizeLaunchDocument({
  documentType: 'community_review_policy',
  titleEn: 'Community & Review Policy',
  titleAr: 'سياسة المجتمع والمراجعات',
  introEn: `Short rules for Mazare3 property reviews and user content.`,
  introAr: `قواعد مختصرة لمراجعات عقارات مزارع ومحتوى المستخدمين.`,
  sections: [
    {
      id: 'eligibility',
      titleEn: '1. Eligibility',
      titleAr: '1. الأهلية',
      paragraphsEn: [
        `Reviews come from eligible Bookings under Mazare3’s review system. Write about firsthand experience only.`
      ],
      paragraphsAr: [
        `تنشأ المراجعات من حجوزات مؤهلة وفق نظام مراجعات مزارع. اكتب عن تجربة مباشرة فقط.`
      ]
    },
    {
      id: 'prohibited',
      titleEn: '2. Prohibited content',
      titleAr: '2. المحتوى المحظور',
      paragraphsEn: [
        `Do not post fake reviews, paid or coerced reviews, threats, harassment, illegal content, or another person’s private information. Do not manipulate ratings.`
      ],
      paragraphsAr: [
        `يُحظر نشر مراجعات مزيفة أو مدفوعة أو مُكره عليها، أو تهديدات أو مضايقة أو محتوى غير قانوني أو بيانات خاصة لشخص آخر. ويُحظر التلاعب بالتقييمات.`
      ]
    },
    {
      id: 'moderation',
      titleEn: '3. Moderation',
      titleAr: '3. الإشراف',
      paragraphsEn: [
        `Mazare3 may hide or remove reviews that violate this Policy. Mazare3 does not promise to fact-check every statement. Contact support to appeal a moderation decision where a path is offered.`
      ],
      paragraphsAr: [
        `يجوز لمزارع إخفاء أو إزالة مراجعات تخالف هذه السياسة. لا تعد مزارع بالتحقق من كل عبارة. تواصل مع الدعم للتظلم من قرار إشراف عند توفر مسار لذلك.`
      ]
    }
  ],
});
