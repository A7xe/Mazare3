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
} from './ssot-values';
import {
  ADVISOR_REVISED_VERSION,
  PUBLIC_PLATFORM_TIME_ZONE_AR,
  PUBLIC_PLATFORM_TIME_ZONE_EN,
  finalizeLaunchDocument,
  type LaunchLegalDocument,
} from './build-legal-markdown';

export const bookingTerms: LaunchLegalDocument = finalizeLaunchDocument({
  documentType: 'booking_terms',
  version: ADVISOR_REVISED_VERSION,
  includeInternalBanner: false,
  titleEn: 'Booking Terms',
  titleAr: 'شروط الحجز',
  introEn: `These Booking Terms summarise what you confirm at checkout on Mazare3. They do not replace the full Terms & Conditions or the Cancellation & Refund Policy.`,
  introAr: `تلخّص شروط الحجز هذه ما تؤكده عند إتمام الدفع على مزارع. وهي لا تحل محل الشروط والأحكام الكاملة أو سياسة الإلغاء والاسترداد.`,
  sections: [
    {
      id: 'what-you-confirm',
      titleEn: '1. What you confirm at checkout',
      titleAr: '1. ما تؤكده عند إتمام الدفع',
      paragraphsEn: [
        `You are creating a Booking request, or confirming a Booking where confirmation conditions are already met, for a specific Property, date, and period at the price shown, including any valid coupon Mazare3 accepts.`,
        `By completing the explicit acknowledgement at checkout, you confirm that you have reviewed the amounts due, the Balance rules (if any), and the cancellation summary linked below.`,
      ],
      paragraphsAr: [
        `أنت تنشئ طلب حجز، أو تؤكد حجزاً حيث استُوفيت شروط التأكيد، لعقار وتاريخ وفترة محددة بالسعر الظاهر، بما في ذلك أي كوبون مقبول من مزارع.`,
        `بإتمام الإقرار الصريح عند الدفع، تؤكد أنك راجعت المبالغ المستحقة وقواعد الرصيد المتبقي (إن وُجد) وملخص الإلغاء المرتبط أدناه.`,
      ],
    },
    {
      id: 'amounts',
      titleEn: '2. Amounts due',
      titleAr: '2. المبالغ المستحقة',
      paragraphsEn: [
        `Checkout shows the amount due now (Deposit or full payment) and any future Balance. Timing uses the actual Booking start in ${PUBLIC_PLATFORM_TIME_ZONE_EN}.`,
        `If start is more than ${FULL_PAYMENT_WITHIN_HOURS} hours away, you may choose a ${DEPOSIT_PERCENT}% Deposit or pay in full. Within ${FULL_PAYMENT_WITHIN_HOURS} hours of start, full payment is required.`,
        `Any remaining Balance must be paid by the deadline that is ${BALANCE_DUE_HOURS_BEFORE_START} hours before the actual Booking start. If unpaid when that deadline has passed, the Booking will be automatically cancelled under Mazare3’s payment rules after payment-status reconciliation; the captured Deposit is retained; no additional cancellation amount is collected.`,
      ],
      paragraphsAr: [
        `يُظهر إتمام الدفع المبلغ المستحق فوراً (عربون أو دفع كامل) وأي رصيد متبقٍ. يعتمد التوقيت على بداية الحجز الفعلية ${PUBLIC_PLATFORM_TIME_ZONE_AR}.`,
        `إذا بقي أكثر من ${FULL_PAYMENT_WITHIN_HOURS} ساعة على البداية، يجوز اختيار عربون بنسبة ${DEPOSIT_PERCENT}٪ أو الدفع الكامل. وخلال ${FULL_PAYMENT_WITHIN_HOURS} ساعة من البداية يُطلب الدفع الكامل.`,
        `يجب سداد أي رصيد متبقٍ بحلول الموعد الذي يسبق بداية الحجز الفعلية بـ${BALANCE_DUE_HOURS_BEFORE_START} ساعة. إذا بقي غير مدفوع عند حلول الموعد، يُلغى الحجز تلقائياً وفق قواعد الدفع بعد مطابقة حالة الدفع؛ ويُحتفظ بالعربون المحصّل؛ ولا يُجمع مبلغ إلغاء إضافي.`,
      ],
    },
    {
      id: 'approval',
      titleEn: '3. Owner approval',
      titleAr: '3. موافقة المالك',
      paragraphsEn: [
        `If the listing requires Owner approval, payment is not collected until acceptance. Instant-booking listings proceed to payment after you confirm. A Booking becomes confirmed only after the required payment condition is satisfied and Owner approval is obtained where the listing requires approval.`,
      ],
      paragraphsAr: [
        `إذا تطلب الإعلان موافقة المالك، لا يُحصَّل الدفع حتى القبول. عقارات الحجز الفوري تنتقل للدفع بعد تأكيدك. ويصبح الحجز مؤكداً فقط بعد استيفاء شرط الدفع المطلوب والحصول على موافقة المالك حيث يتطلب الإعلان الموافقة.`,
      ],
    },
    {
      id: 'cancel-rules',
      titleEn: '4. Cancellation summary',
      titleAr: '4. ملخص الإلغاء',
      paragraphsEn: [
        `Customer cancellation charges use Booking Value for Cancellation Purposes. Retained amount cannot exceed what was actually captured. Exact tiers:`,
      ],
      paragraphsAr: [
        `تُحسب رسوم إلغاء العميل من قيمة الحجز المعتمدة لأغراض الإلغاء. ولا يتجاوز المبلغ المحتفظ به ما جُمع فعلاً. الشرائح الدقيقة:`,
      ],
      bulletsEn: [
        `More than ${CANCELLATION_FREE_UNTIL_HOURS} hours before start: 0%.`,
        `More than ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours and up to ${CANCELLATION_FREE_UNTIL_HOURS} hours: ${CANCELLATION_CHARGE_PERCENT_TIER_30}%.`,
        `More than ${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours and up to ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours: ${CANCELLATION_CHARGE_PERCENT_TIER_50}%.`,
        `${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours or less before start: ${CANCELLATION_CHARGE_PERCENT_TIER_100}%.`,
        `Full detail: Cancellation & Refund Policy.`,
      ],
      bulletsAr: [
        `أكثر من ${CANCELLATION_FREE_UNTIL_HOURS} ساعة قبل البداية: 0٪.`,
        `أكثر من ${CANCELLATION_CHARGE_30_UNTIL_HOURS} ساعة وحتى ${CANCELLATION_FREE_UNTIL_HOURS} ساعة: ${CANCELLATION_CHARGE_PERCENT_TIER_30}٪.`,
        `أكثر من ${CANCELLATION_CHARGE_50_UNTIL_HOURS} ساعة وحتى ${CANCELLATION_CHARGE_30_UNTIL_HOURS} ساعة: ${CANCELLATION_CHARGE_PERCENT_TIER_50}٪.`,
        `${CANCELLATION_CHARGE_50_UNTIL_HOURS} ساعة أو أقل قبل البداية: ${CANCELLATION_CHARGE_PERCENT_TIER_100}٪.`,
        `التفاصيل الكاملة: سياسة الإلغاء والاسترداد.`,
      ],
    },
    {
      id: 'owner-cancel-customer',
      titleEn: '5. If the Owner cancels',
      titleAr: '5. إذا ألغى المالك',
      paragraphsEn: [
        `If an Owner causes cancellation of a confirmed Booking, you are entitled to a 100% refund of eligible captured Booking payments; the resulting amount becomes a Refund Due until payment processing confirms completion. Owner payout for that Booking is zero. Owner financial and reliability consequences may apply under the Owner Agreement.`,
      ],
      paragraphsAr: [
        `إذا تسبب المالك بإلغاء حجز مؤكد، تستحق استرداداً بنسبة 100٪ من مدفوعات الحجز المحصّلة المؤهلة؛ ويصبح المبلغ الناتج مبلغ استرداد مستحقاً حتى يؤكد مزود الدفع اكتمال المعالجة. صرف المالك لذلك الحجز يكون صفراً. وقد تُطبَّق عواقب مالية وموثوقية بموجب اتفاق المالك.`,
      ],
    },
    {
      id: 'stay-rules',
      titleEn: '6. Property rules, check-in, and no-show',
      titleAr: '6. قواعد العقار وتسجيل الوصول وعدم الحضور',
      paragraphsEn: [
        `Follow house rules and guest limits. A check-in code is evidence of arrival or handover only. It does not prove Property quality, cleanliness, that every amenity worked, or absence of later problems.`,
        `Customer no-show is not automatic. It requires Booking start, a ${CUSTOMER_NO_SHOW_GRACE_MINUTES}-minute grace period, satisfied payment conditions, unverified check-in, no unresolved Owner-fault / access-denied / force-majeure condition, possible Owner report, and Mazare3 review and confirmation.`,
        `Check-in typically becomes available ${CHECK_IN_OPEN_HOURS_BEFORE_START} hours before start and expires ${CHECK_IN_EXPIRE_MINUTES_AFTER_START} minutes after start under product rules.`,
      ],
      paragraphsAr: [
        `اتبع قواعد البيت وحدود الضيوف. رمز تسجيل الوصول دليل وصول أو تسليم فقط. ولا يثبت جودة العقار أو النظافة أو عمل كل مرفق أو غياب مشاكل لاحقة.`,
        `عدم حضور العميل ليس تلقائياً. يتطلب بداية الحجز، وفترة سماح ${CUSTOMER_NO_SHOW_GRACE_MINUTES} دقيقة، واستيفاء شروط الدفع، وعدم تحقق تسجيل الوصول، وغياب حالة مفتوحة لخطأ المالك / منع الوصول / القوة القاهرة، وقد يبلّغ المالك، ويُشترط مراجعة مزارع وتأكيدها.`,
        `يتاح تسجيل الوصول عادة قبل ${CHECK_IN_OPEN_HOURS_BEFORE_START} ساعة من البداية وينتهي بعد ${CHECK_IN_EXPIRE_MINUTES_AFTER_START} دقيقة من البداية وفق قواعد المنتج.`,
      ],
    },
    {
      id: 'reschedule',
      titleEn: '7. Rescheduling',
      titleAr: '7. إعادة الجدولة',
      paragraphsEn: [
        `Rescheduling needs agreement under product rules (normally up to ${MAX_CUSTOMER_RESCHEDULES} successful Customer-requested change). After a Customer-requested change, cancellation timing is calculated using the earlier of the original Booking start and the new Booking start, so moving a Booking to a later date cannot create a more favourable cancellation window.`,
        `Customer-initiated: same price → no adjustment; higher → you pay the accepted difference before completion; lower → eligible difference becomes a Refund Due. Owner-initiated: you cannot be forced to pay a higher replacement price solely because the Owner requested the change; if the accepted replacement results in a lower eligible price, the applicable difference is refunded according to the existing rules.`,
      ],
      paragraphsAr: [
        `إعادة الجدولة تحتاج اتفاقاً وفق قواعد المنتج (عادة حتى ${MAX_CUSTOMER_RESCHEDULES} تغيير ناجح بطلب العميل). بعد إعادة الجدولة بطلب العميل، يُحتسب توقيت الإلغاء بالاستناد إلى الأسبق من موعد بداية الحجز الأصلي وموعد البداية الجديد، حتى لا ينشئ نقل الحجز إلى موعد أبعد نافذة إلغاء أفضل.`,
        `بمبادرة العميل: نفس السعر → بلا تعديل؛ أعلى → تدفع الفرق المقبول قبل الإتمام؛ أدنى → يصبح الفرق المستحق مبلغ استرداد مستحقاً. بمبادرة المالك: لا تُجبر على دفع سعر بديل أعلى لمجرد أن المالك طلب التغيير؛ وإذا نتج عن البديل المقبول سعر مؤهل أدنى، يُسترد الفرق المنطبق وفق القواعد القائمة.`,
      ],
    },
    {
      id: 'force-majeure',
      titleEn: '8. Force majeure',
      titleAr: '8. القوة القاهرة',
      paragraphsEn: [
        `Where Mazare3 confirms a genuine force-majeure event that makes performance of the Booking objectively impossible: you are entitled to a full refund of eligible captured Booking payments. An equivalent reschedule may be offered as an alternative and is not imposed instead of that refund without your agreement. Ordinary cancellation penalties do not apply to that genuine approved force-majeure impossibility.`,
      ],
      paragraphsAr: [
        `عندما تؤكد مزارع حدث قوة قاهرة حقيقياً يجعل تنفيذ الحجز متعذراً بصورة موضوعية: تستحق استرداداً كاملاً لمدفوعات الحجز المحصّلة المؤهلة. ويجوز عرض إعادة جدولة مكافئة كبديل، ولا تُفرض بدلاً من ذلك الاسترداد دون موافقتك. ولا تُطبَّق غرامات الإلغاء العادية على حالة القوة القاهرة المعتمدة التي يتعذر معها التنفيذ.`,
      ],
    },
    {
      id: 'controlling-docs',
      titleEn: '9. Which documents govern what',
      titleAr: '9. أي المستندات تحكم ماذا',
      paragraphsEn: [
        `The Terms & Conditions, these Booking Terms, and the Cancellation & Refund Policy are the contractual Booking documents that govern Booking contractual and economic rules (price, Deposit, Balance, cancellation, refunds, no-show, reschedule). These documents should be read together according to the subject they govern.`,
        `The Privacy Policy and Cookie Policy are privacy and data notices. They explain Personal Data and cookies; they are not Booking economic terms that set price, cancellation percentages, or refund obligations. You still acknowledge the Privacy Policy through the applicable privacy flow.`,
        `Community and Verification policies apply to their respective subject matter.`,
        `Mazare3 operates a marketplace. Mazare3 is not the Property Owner, is not the day-to-day Property operator, does not itself provide the hosted Property service, is not an insurer, and is not an escrow service. Operator: ${P.LEGAL_ENTITY_NAME}.`,
      ],
      paragraphsAr: [
        `الشروط والأحكام وشروط الحجز هذه وسياسة الإلغاء والاسترداد هي مستندات الحجز التعاقدية التي تحكم القواعد التعاقدية والاقتصادية للحجز (السعر والعربون والرصيد المتبقي والإلغاء والاسترداد وعدم الحضور وإعادة الجدولة). وتُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.`,
        `سياسة الخصوصية وسياسة ملفات تعريف الارتباط إشعارات خصوصية وبيانات. توضحان البيانات الشخصية وملفات الارتباط؛ وليستا شروطاً اقتصادية للحجز تحدد السعر أو نسب الإلغاء أو التزامات الاسترداد. وما زلت تُقرّ بسياسة الخصوصية عبر مسار الخصوصية المعمول به.`,
        `تنطبق سياسات المجتمع والتحقق على موضوع كلٍّ منهما.`,
        `تشغّل مزارع سوقاً. مزارع ليست مالك العقار، وليست المشغّل اليومي للعقار، ولا تقدّم بنفسها الخدمة المتعلقة باستخدام العقار المحجوز، وليست مؤمِّناً، ولا تقدم خدمة حفظ الأموال في حساب ضمان (Escrow). المشغّل: ${P.LEGAL_ENTITY_NAME}.`,
      ],
    },
  ],
});
