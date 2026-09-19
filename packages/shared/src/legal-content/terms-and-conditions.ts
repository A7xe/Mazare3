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
  RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS,
} from './ssot-values';
import {
  ADVISOR_REVISED_VERSION,
  PUBLIC_PLATFORM_TIME_ZONE_AR,
  PUBLIC_PLATFORM_TIME_ZONE_EN,
  finalizeLaunchDocument,
  type LaunchLegalDocument,
} from './build-legal-markdown';

export const termsAndConditions: LaunchLegalDocument = finalizeLaunchDocument({
  version: ADVISOR_REVISED_VERSION,
  includeInternalBanner: false,
  documentType: 'terms_and_conditions',
  titleEn: 'Terms & Conditions',
  titleAr: 'الشروط والأحكام',
  introEn: `These Terms & Conditions govern access to and use of the Mazare3 marketplace (Mazare3 / Mazare3 Jordan) operated by ${P.LEGAL_ENTITY_INTRO_EN}.`,
  introAr: `تحكم هذه الشروط والأحكام الوصول إلى سوق مزارع واستخدامه (مزارع / مزارع الأردن) الذي تشغّله ${P.LEGAL_ENTITY_INTRO_AR}.`,
  sections: [
    {
      id: 'introduction',
      titleEn: '1. Introduction',
      titleAr: '1. المقدمة',
      paragraphsEn: [
        `These Terms & Conditions ("Terms") govern your access to and use of the Mazare3 marketplace (product name: Mazare3 / Mazare3 Jordan) operated by ${P.LEGAL_ENTITY_INTRO_EN}.`,
        `Contractual Booking documents include these Terms, the Booking Terms presented at checkout, the Cancellation & Refund Policy, and other contractual marketplace rules where applicable. Privacy and data notices include the Privacy Policy and Cookie Policy. Community and Verification policies apply to their respective subject matter. These documents should be read together according to the subject they govern.`,
        `The Privacy Policy and Cookie Policy are not Booking economic terms that set price, cancellation percentages, or refund obligations. Where these Terms conflict with a more specific Mazare3 contractual policy on a Booking topic (for example cancellation), that specific policy controls for that topic, to the extent permitted by applicable law.`,
      ],
      paragraphsAr: [
        `تحكم هذه الشروط والأحكام («الشروط») وصولك إلى سوق مزارع واستخدامك له (اسم المنتج: مزارع / مزارع الأردن)، وتشغّله ${P.LEGAL_ENTITY_INTRO_AR}.`,
        `تشمل مستندات الحجز التعاقدية هذه الشروط، وشروط الحجز المعروضة عند إتمام الدفع، وسياسة الإلغاء والاسترداد، وغيرها من قواعد السوق التعاقدية حيث تنطبق. وتشمل إشعارات الخصوصية والبيانات سياسة الخصوصية وسياسة ملفات تعريف الارتباط. وتنطبق سياسات المجتمع والتحقق على موضوع كلٍّ منهما. وتُقرأ هذه المستندات معاً بحسب الموضوع الذي تحكمه.`,
        `سياسة الخصوصية وسياسة ملفات تعريف الارتباط ليستا شروطاً اقتصادية للحجز تحدد السعر أو نسب الإلغاء أو التزامات الاسترداد. وعند تعارض هذه الشروط مع سياسة تعاقدية أكثر تخصيصاً لموضوع حجز معيّن (مثل الإلغاء)، تُطبَّق تلك السياسة على ذلك الموضوع، بالقدر الذي يسمح به القانون المعمول به.`,
      ],
    },
    {
      id: 'definitions',
      titleEn: '2. Definitions',
      titleAr: '2. التعريفات',
      paragraphsEn: [`In these Terms:`],
      paragraphsAr: [`في هذه الشروط:`],
      bulletsEn: [
        `“Customer” means a user who searches for or books a Property.`,
        `“Owner” (also “Partner”) means a user who lists and hosts a Property. After this definition, “Owner” and “Partner” refer to the same role.`,
        `“Property” means a farm, chalet, or other venue listing on Mazare3.`,
        `“Booking” means a reservation for a specific Property, date, and period.`,
        `“Deposit” means the partial payment when a ${DEPOSIT_PERCENT}% deposit plan applies.`,
        `“Balance” means the remaining amount due after a Deposit.`,
        `“Captured Amount” means money successfully collected for a Booking.`,
        `“Refund Due” or “Approved Refund” means an amount Mazare3 has determined should be returned to the Customer under the applicable policy, which may still be pending payment-provider processing.`,
        `“Refunded Amount” means money whose refund has successfully completed or been confirmed through the payment process.`,
        `“Net Collected Amount” means the Captured Amount minus successfully completed Refunded Amounts where context requires a net figure.`,
        `“Booking Value for Cancellation Purposes” means the authoritative booking amount used to calculate cancellation charges under Mazare3’s financial policy for that Booking (before applying the retention cap described in these Terms).`,
        `“Cancellation charge” means the policy percentage of the Booking Value for Cancellation Purposes. The amount Mazare3 retains is the lesser of (a) the Captured Amount still available for retention and (b) that policy charge. Mazare3 does not collect additional uncaptured money merely to satisfy a cancellation percentage.`,
        `“Commission” means Mazare3’s platform fee charged in the Owner/marketplace commercial relationship. Customers do not pay Owner commission as a separate checkout line item unless another explicit Customer fee is actually shown before payment.`,
        `“Verified by Mazare3” means the listing has completed Mazare3’s platform review process. It is not government certification.`,
        `“Payment service provider” means Mazare3’s configured payment service provider that processes card and related payment flows.`,
      ],
      bulletsAr: [
        `«العميل» مستخدم يبحث عن عقار أو يحجزه.`,
        `«المالك» (ويُسمّى أيضاً «الشريك») مستخدم يعرض عقاراً ويستضيف الزيارة. بعد هذا التعريف، يُقصد بـ«المالك» و«الشريك» الدور نفسه.`,
        `«العقار» مزرعة أو شاليه أو موقع/عقار آخر معروض للحجز على مزارع.`,
        `«الحجز» حجز لعقار وتاريخ وفترة محددة.`,
        `«العربون» الدفعة الجزئية عند تطبيق خطة عربون ${DEPOSIT_PERCENT}٪.`,
        `«الرصيد المتبقي» المبلغ المتبقي بعد العربون.`,
        `«المبلغ المحصّل» المال الذي جُمع بنجاح للحجز.`,
        `«مبلغ الاسترداد المستحق» أو «الاسترداد المعتمد» مبلغ قررت مزارع أنه ينبغي إعادته إلى العميل بموجب السياسة المعمول بها، وقد يبقى معلّقاً ريثما تكتمل معالجته لدى مزود الدفع.`,
        `«المبلغ المسترد فعلياً» المال الذي اكتمل استرداده أو تأكد عبر عملية الدفع.`,
        `«صافي المبلغ المحصّل» المبلغ المحصّل ناقص المبالغ المستردة فعلياً المكتملة حيث يقتضي السياق رقماً صافياً.`,
        `«قيمة الحجز المعتمدة لأغراض الإلغاء» المبلغ المعتمد لحساب رسوم الإلغاء وفق السياسة المالية لمزارع لذلك الحجز (قبل تطبيق حد الاحتفاظ الموضّح في هذه الشروط).`,
        `«رسوم الإلغاء» نسبة السياسة من قيمة الحجز المعتمدة لأغراض الإلغاء. والمبلغ الذي تحتفظ به مزارع هو الأقل بين (أ) المبلغ المحصّل المتاح للاحتفاظ و(ب) رسوم السياسة تلك. ولا تجمع مزارع مالاً إضافياً غير محصّل لمجرد استيفاء نسبة إلغاء.`,
        `«العمولة» أجر منصة مزارع في العلاقة التجارية مع المالك/السوق. ولا يدفع العميل عمولة المالك كبند منفصل عند الدفع ما لم تظهر رسوم عميل صريحة أخرى قبل الدفع.`,
        `«تم التحقق بواسطة Mazare3» تعني أن الإعلان أتمّ عملية مراجعة منصة مزارع. وليست شهادة حكومية.`,
        `«مزود خدمة الدفع» مزود الدفع الذي تُهيّئه مزارع لمعالجة مدفوعات البطاقات وما يتصل بها.`,
      ],
    },
    {
      id: 'acceptance',
      titleEn: '3. Acceptance of Terms',
      titleAr: '3. قبول الشروط',
      paragraphsEn: [
        `The applicable version of these Terms becomes binding when you complete the explicit electronic acceptance action presented by Mazare3 — for example the acceptance checkbox at registration, the checkout legal acknowledgement, or a required re-acceptance flow after a material update.`,
        `Merely browsing Mazare3, creating an account draft without accepting, or continuing to use the platform without completing a required acceptance action does not constitute acceptance of a new Terms version.`,
        `Where an updated version requires re-acceptance, Mazare3 may require you to complete that explicit action before you perform a new contractual step or continue using functionality that depends on the updated Terms.`,
        `Mazare3 records immutable acceptance evidence (document version, language, time, and context). Acknowledgement of the Privacy Policy is separate from optional marketing or analytics consent.`,
      ],
      paragraphsAr: [
        `تسري النسخة ذات الصلة من هذه الشروط عليك عند إتمام إجراء القبول الإلكتروني الذي تعرضه مزارع لك — مثل خانة القبول عند إنشاء الحساب، أو إقرار شروط الحجز عند إتمام الدفع، أو مسار إعادة القبول المطلوب بعد تحديث جوهري.`,
        `مجرد تصفّح مزارع، أو إنشاء مسودة حساب دون قبول، أو مواصلة استخدام المنصة دون إتمام إجراء القبول المطلوب، لا يُعدّ قبولاً لنسخة جديدة من الشروط.`,
        `عندما تتطلب نسخة محدَّثة إعادة القبول، يجوز لمزارع أن تشترط إتمام ذلك الإجراء الصريح قبل قيامك بخطوة تعاقدية جديدة أو مواصلة استخدام وظائف تعتمد على الشروط المحدَّثة.`,
        `تسجّل مزارع أدلة قبول غير قابلة للتعديل (إصدار المستند واللغة والوقت والسياق). الإقرار بسياسة الخصوصية منفصل عن موافقة التسويق أو التحليلات الاختيارية.`,
      ],
    },
    {
      id: 'eligibility',
      titleEn: '4. Eligibility and legal capacity',
      titleAr: '4. الأهلية القانونية',
      paragraphsEn: [
        `You must have legal capacity under Jordanian law to enter binding contracts. If you use Mazare3 on behalf of a business, you represent that you are authorised to bind that business.`,
        `Mazare3 is not directed at children who lack legal capacity.`,
      ],
      paragraphsAr: [
        `يجب أن تتمتع بالأهلية القانونية بموجب القانون الأردني لإبرام عقود ملزمة. إذا استخدمت مزارع نيابة عن منشأة، فإنك تقر بأنك مخوّل بإلزام تلك المنشأة.`,
        `مزارع ليست موجّهة للقاصرين عديمي الأهلية.`,
      ],
    },
    {
      id: 'accounts',
      titleEn: '5. Account registration and security',
      titleAr: '5. تسجيل الحساب وأمانه',
      paragraphsEn: [
        `Provide accurate registration details and keep credentials confidential. You are responsible for activity under your account unless you promptly notify Mazare3 of unauthorised access.`,
        `You may sign in with email/password or supported Google sign-in. Mazare3 may restrict or suspend accounts used for fraud, abuse, or repeated policy breaches. Such decisions are operational and are not court findings.`,
      ],
      paragraphsAr: [
        `قدّم بيانات تسجيل صحيحة واحفظ بيانات الدخول بسرية. أنت مسؤول عن النشاط عبر حسابك ما لم تُبلغ مزارع فوراً بوصول غير مصرّح به.`,
        `يمكنك تسجيل الدخول بالبريد وكلمة المرور أو عبر تسجيل الدخول المدعوم عبر Google. قد تقيّد مزارع أو توقّف حسابات تُستخدم للاحتيال أو الإساءة أو تكرار مخالفة السياسات. هذه قرارات تشغيلية وليست أحكاماً قضائية.`,
      ],
    },
    {
      id: 'role',
      titleEn: '6. Role of Mazare3',
      titleAr: '6. دور مزارع',
      paragraphsEn: [
        `Mazare3 operates a marketplace platform. It provides search, listing tools, booking facilitation, payment facilitation through its configured payment service provider, policy enforcement, support, verification processes, refund administration, and settlement infrastructure.`,
        `Mazare3 is not the owner or day-to-day operator of listed Properties, does not itself provide the hosted Property service, is not an insurer, is not an escrow service, and is not a government verifier.`,
        `The hospitality/venue service for a Booking is supplied by the Owner. Mazare3 facilitates the marketplace relationship and related platform services described in these Terms.`,
      ],
      paragraphsAr: [
        `تشغّل مزارع منصة سوق. توفر البحث وأدوات الإعلان وتسهيل الحجز وتسهيل الدفع عبر مزود خدمة الدفع الذي تُهيّئه، وإنفاذ السياسات والدعم وعمليات التحقق وإدارة الاسترداد وبنية التسوية.`,
        `مزارع ليست مالكاً أو مشغّلاً يومياً للعقارات المعروضة، ولا تقدّم بنفسها الخدمة المتعلقة باستخدام العقار المحجوز، وليست مؤمِّناً، ولا تقدم خدمة حفظ الأموال في حساب ضمان (Escrow)، وليست جهة تحقق حكومية.`,
        `خدمة الضيافة/المكان للحجز يقدّمها المالك. تسهّل مزارع علاقة السوق والخدمات المنصّية الموضحة في هذه الشروط.`,
      ],
    },
    {
      id: 'owners-relationship',
      titleEn: '7. Relationship with property Owners',
      titleAr: '7. العلاقة مع مالكي العقارات',
      paragraphsEn: [
        `Owners are independent marketplace participants. Commercial terms between Mazare3 and an Owner (including commission and settlement) are governed by the Owner Agreement and any accepted partner commercial terms.`,
        `Customers do not pay Owner commission as a separate checkout line item unless another explicit Customer fee is actually shown before payment.`,
        `Owner financial and reliability consequences for Owner-caused problems may apply under the Owner Agreement. Those commercial percentages and penalty details are Owner-facing and do not change the Customer’s checkout price unless an explicit Customer fee is shown.`,
      ],
      paragraphsAr: [
        `المالكون مشاركون مستقلون في السوق. الشروط التجارية بين مزارع والمالك (بما فيها العمولة والتسوية) يحكمها اتفاق المالك وأي شروط تجارية للشريك مقبولة.`,
        `لا يدفع العميل عمولة المالك كبند منفصل عند الدفع ما لم تظهر رسوم عميل صريحة أخرى قبل الدفع.`,
        `قد تُطبَّق عواقب مالية وموثوقية على المالك عند المشاكل المنسوبة إليه بموجب اتفاق المالك. وتلك النسب التجارية وتفاصيل الغرامات موجّهة للمالك ولا تغيّر سعر العميل عند الدفع ما لم تظهر رسوم عميل صريحة.`,
      ],
    },
    {
      id: 'listings',
      titleEn: '8. Property listings',
      titleAr: '8. إعلانات العقارات',
      paragraphsEn: [
        `Listings must be truthful regarding photos, capacity, amenities, house rules, location presentation, and availability. Public pages show approximate location only; exact address and arrival notes are revealed to an eligible Customer after confirmation under product rules.`,
        `A slot is bookable only if Mazare3 still shows it as available when the Booking request completes.`,
      ],
      paragraphsAr: [
        `يجب أن تكون الإعلانات صادقة بخصوص الصور والسعة والمرافق وقواعد البيت وعرض الموقع والتوفر. الصفحات العامة تعرض موقعاً تقريبياً فقط؛ ويُكشف العنوان الدقيق وملاحظات الوصول لعميل مؤهل بعد التأكيد وفق قواعد المنتج.`,
        `الفترة قابلة للحجز فقط إذا ما زالت مزارع تعرضها متاحة عند اكتمال طلب الحجز.`,
      ],
    },
    {
      id: 'pricing',
      titleEn: '9. Pricing',
      titleAr: '9. التسعير',
      paragraphsEn: [
        `Prices shown for a slot on the booking panel (including any valid coupon Mazare3 accepts) are the amounts used for that Booking. Currency is Jordanian dinar (JOD) unless otherwise stated.`,
        `Applicable taxes, charges, or invoicing requirements, if any, are handled in accordance with applicable law and disclosed where required or where they are due within the transaction.`,
      ],
      paragraphsAr: [
        `الأسعار الظاهرة للفترة في لوحة الحجز (بما في ذلك أي كوبون مقبول) هي المبالغ المستخدمة لذلك الحجز. العملة الدينار الأردني ما لم يُذكر خلاف ذلك.`,
        `تُطبَّق الضرائب أو الرسوم أو متطلبات الفوترة، إن وجدت، وفق التشريعات السارية، ويجري الإفصاح عنها متى كان ذلك مطلوباً أو كانت مستحقة ضمن المعاملة.`,
      ],
    },
    {
      id: 'booking-formation',
      titleEn: '10. Booking formation',
      titleAr: '10. تكوين الحجز',
      paragraphsEn: [
        `A Booking request may be created in the system before it becomes a confirmed Booking. Creating a request does not by itself mean the hosted Property service is already confirmed.`,
        `A Booking becomes confirmed only after (a) the required payment condition is satisfied, and (b) Owner approval is obtained where the listing requires approval.`,
        `Checkout Booking Terms summarise price, due-now amount, Balance, and cancellation pointers; they complement — and do not replace — these Terms and the Cancellation & Refund Policy.`,
      ],
      paragraphsAr: [
        `قد يُنشأ طلب حجز في النظام قبل أن يصبح حجزاً مؤكداً. وإنشاء الطلب بذاته لا يعني أن الخدمة المتعلقة باستخدام العقار المحجوز مؤكدة بالفعل.`,
        `يصبح الحجز مؤكداً فقط بعد (أ) استيفاء شرط الدفع المطلوب، و(ب) الحصول على موافقة المالك حيث يتطلب الإعلان الموافقة.`,
        `تلخّص شروط الحجز عند إتمام الدفع السعر والمبلغ المستحق فوراً والرصيد المتبقي وإشارات الإلغاء؛ وهي تكمّل هذه الشروط وسياسة الإلغاء والاسترداد ولا تحل محلها.`,
      ],
    },
    {
      id: 'instant-approval',
      titleEn: '11. Owner approval and instant booking',
      titleAr: '11. موافقة المالك والحجز الفوري',
      paragraphsEn: [
        `Some Properties confirm after successful Deposit or full payment (instant booking). Others require Owner acceptance first. Until acceptance, Mazare3 does not collect a Deposit for that request.`,
        `If the Owner declines or does not respond in time, the request ends without payment capture. If they accept, the Customer must pay the required amount to confirm.`,
      ],
      paragraphsAr: [
        `بعض العقارات تتأكد بعد عربون أو دفع كامل ناجح (حجز فوري). وأخرى تتطلب قبول المالك أولاً. حتى القبول لا تجمع مزارع عربوناً لذلك الطلب.`,
        `إذا رفض المالك أو لم يرد في الوقت المحدد ينتهي الطلب دون تحصيل. وإذا قبل يجب على العميل دفع المبلغ المطلوب للتأكيد.`,
      ],
    },
    {
      id: 'payments',
      titleEn: '12. Payments',
      titleAr: '12. المدفوعات',
      paragraphsEn: [
        `Mazare3 facilitates payments through Mazare3’s configured payment service provider. Card number and security code are entered with that provider; Mazare3 stores payment metadata such as amounts, currency, status, method, and provider references — not the full card number.`,
        `Returning from a browser payment page is not itself confirmation. Mazare3 treats payment as successful after it reconciles a trusted authorisation or result from the payment service provider with the Booking.`,
        `Available methods are only those shown at checkout for that Booking.`,
      ],
      paragraphsAr: [
        `تسهّل مزارع المدفوعات عبر مزود خدمة الدفع الذي تُهيّئه. تُدخل رقم البطاقة ورمز الأمان لدى ذلك المزود؛ وتخزّن مزارع بيانات وصفية للدفع مثل المبالغ والعملة والحالة والطريقة ومراجع المزود — وليس رقم البطاقة الكامل.`,
        `العودة من صفحة الدفع في المتصفح ليست تأكيداً بذاتها. تعامل مزارع الدفع ناجحاً بعد مطابقة تفويض أو نتيجة موثوقة من مزود خدمة الدفع مع الحجز.`,
        `الطرق المتاحة هي فقط الظاهرة عند إتمام الدفع لذلك الحجز.`,
      ],
    },
    {
      id: 'deposit-balance',
      titleEn: '13. Deposit and Balance',
      titleAr: '13. العربون والرصيد المتبقي',
      paragraphsEn: [
        `Timing uses the actual booking period start in ${PUBLIC_PLATFORM_TIME_ZONE_EN}.`,
        `If the Booking starts in more than ${FULL_PAYMENT_WITHIN_HOURS} hours, the Customer may choose a ${DEPOSIT_PERCENT}% Deposit or full payment. If the Booking starts in ${FULL_PAYMENT_WITHIN_HOURS} hours or less, 100% payment is required.`,
        `For Deposit bookings, the remaining Balance must be paid by the deadline that is ${BALANCE_DUE_HOURS_BEFORE_START} hours before the actual Booking start. If the Balance remains unpaid at that deadline, the Booking will be automatically cancelled, subject to payment-status reconciliation needed to avoid cancelling a payment that has already completed successfully. The Captured Amount of the Deposit is retained, no additional cancellation money is collected beyond captured funds, and the slot is released.`,
      ],
      paragraphsAr: [
        `يعتمد التوقيت على بداية فترة الحجز الفعلية ${PUBLIC_PLATFORM_TIME_ZONE_AR}.`,
        `إذا بدأت فترة الحجز بعد أكثر من ${FULL_PAYMENT_WITHIN_HOURS} ساعة، يجوز للعميل اختيار عربون ${DEPOSIT_PERCENT}٪ أو الدفع الكامل. وإذا كانت البداية خلال ${FULL_PAYMENT_WITHIN_HOURS} ساعة أو أقل، يُطلب الدفع بنسبة 100٪.`,
        `لحجوزات العربون، يجب سداد الرصيد المتبقي بحلول الموعد الذي يسبق بداية الحجز الفعلية بـ${BALANCE_DUE_HOURS_BEFORE_START} ساعة. إذا بقي الرصيد المتبقي غير مدفوع عند ذلك الموعد، فسيُلغى الحجز تلقائياً، مع مراعاة مطابقة حالة الدفع اللازمة لتجنّب إلغاء دفعة اكتملت بنجاح. ويُحتفظ بالمبلغ المحصّل من العربون، ولا تُجمع مبالغ إلغاء إضافية فوق الأموال المحصّلة، وتُحرَّر الفترة.`,
      ],
    },
    {
      id: 'customer-cancellation',
      titleEn: '14. Customer cancellation',
      titleAr: '14. إلغاء العميل',
      paragraphsEn: [
        `Customer cancellation of a confirmed paid Booking before start follows the Cancellation & Refund Policy. Timing uses actual booking period start in ${PUBLIC_PLATFORM_TIME_ZONE_EN}. Charges are percentages of the Booking Value for Cancellation Purposes. The amount retained is the lesser of the Captured Amount available for retention and the applicable policy charge. Mazare3 does not collect uncaptured money merely to satisfy a cancellation percentage.`,
      ],
      paragraphsAr: [
        `يتبع إلغاء العميل لحجز مؤكد مدفوع قبل البداية سياسة الإلغاء والاسترداد. يعتمد التوقيت على بداية فترة الحجز الفعلية ${PUBLIC_PLATFORM_TIME_ZONE_AR}. والرسوم نسب مئوية من قيمة الحجز المعتمدة لأغراض الإلغاء. والمبلغ المحتفظ به هو الأقل بين المبلغ المحصّل المتاح للاحتفاظ ورسوم السياسة المنطبقة. ولا تجمع مزارع مالاً غير محصّل لمجرد استيفاء نسبة إلغاء.`,
      ],
      bulletsEn: [
        `More than ${CANCELLATION_FREE_UNTIL_HOURS} hours before start: 0% cancellation charge (full Refund Due of the Captured Amount, subject to any already completed Refunded Amounts).`,
        `More than ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours and up to ${CANCELLATION_FREE_UNTIL_HOURS} hours before start: ${CANCELLATION_CHARGE_PERCENT_TIER_30}% cancellation charge.`,
        `More than ${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours and up to ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours before start: ${CANCELLATION_CHARGE_PERCENT_TIER_50}% cancellation charge.`,
        `${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours or less before start: ${CANCELLATION_CHARGE_PERCENT_TIER_100}% cancellation charge.`,
        `After booking start: ordinary pre-arrival cancellation is unavailable; no-show, incident, or dispute processes apply as relevant.`,
      ],
      bulletsAr: [
        `أكثر من ${CANCELLATION_FREE_UNTIL_HOURS} ساعة قبل البداية: رسوم إلغاء 0٪ (مبلغ استرداد مستحق كامل للمبلغ المحصّل، مع مراعاة أي مبالغ مستردة فعلياً مكتملة مسبقاً).`,
        `أكثر من ${CANCELLATION_CHARGE_30_UNTIL_HOURS} ساعة وحتى ${CANCELLATION_FREE_UNTIL_HOURS} ساعة قبل البداية: رسوم إلغاء ${CANCELLATION_CHARGE_PERCENT_TIER_30}٪.`,
        `أكثر من ${CANCELLATION_CHARGE_50_UNTIL_HOURS} ساعة وحتى ${CANCELLATION_CHARGE_30_UNTIL_HOURS} ساعة قبل البداية: رسوم إلغاء ${CANCELLATION_CHARGE_PERCENT_TIER_50}٪.`,
        `${CANCELLATION_CHARGE_50_UNTIL_HOURS} ساعة أو أقل قبل البداية: رسوم إلغاء ${CANCELLATION_CHARGE_PERCENT_TIER_100}٪.`,
        `بعد بداية الحجز: الإلغاء العادي قبل الوصول غير متاح؛ تُطبَّق إجراءات عدم الحضور أو الحوادث أو النزاعات حسب الحالة.`,
      ],
    },
    {
      id: 'owner-cancellation',
      titleEn: '15. Owner cancellation',
      titleAr: '15. إلغاء المالك',
      paragraphsEn: [
        `If an Owner causes cancellation of a confirmed Booking, the Customer is entitled to a 100% refund of eligible Captured Amounts for that Booking; the resulting amount becomes a Refund Due until payment processing confirms completion, and Owner payout for that Booking is zero.`,
        `Owner financial and reliability consequences may also apply under the Owner Agreement. Genuine force majeure: no Owner penalty.`,
      ],
      paragraphsAr: [
        `إذا تسبب المالك في إلغاء حجز مؤكد، يستحق العميل استرداداً بنسبة 100٪ من المبالغ المحصّلة لذلك الحجز (مبلغ استرداد مستحق للمبالغ المحصّلة المؤهلة)، ويكون صرف المالك لذلك الحجز صفراً.`,
        `قد تنطبق أيضاً عواقب مالية وموثوقية على المالك بموجب اتفاق المالك. القوة القاهرة الحقيقية: لا غرامة على المالك.`,
      ],
    },
    {
      id: 'no-show',
      titleEn: '16. No-show',
      titleAr: '16. عدم الحضور',
      paragraphsEn: [
        `Customer no-show is not automatic merely because check-in is missing. It may be finalised only after booking start plus a ${CUSTOMER_NO_SHOW_GRACE_MINUTES}-minute grace period, when payment conditions are met, check-in was not verified, and no unresolved Owner-fault, access-denied, or force-majeure condition applies. Owners may report; Mazare3 review and confirmation are required. Confirmed Customer no-show: Customer Refund Due = 0; the Owner receives normal eligible earnings; Mazare3 receives its normal applicable commission.`,
        `Confirmed Owner no-show or unjustified denied access: the Customer is entitled to a 100% refund of eligible Captured Amounts (Refund Due until payment processing confirms completion); Owner payout = 0; Owner financial and reliability consequences may apply as set out in the Owner Agreement and Cancellation & Refund Policy; Mazare3 does not retain ordinary commission on the refunded booking value in that case.`,
      ],
      paragraphsAr: [
        `عدم حضور العميل ليس تلقائياً لمجرد غياب تسجيل الوصول. قد يُعتمد فقط بعد بداية الحجز مضافاً إليها فترة سماح ${CUSTOMER_NO_SHOW_GRACE_MINUTES} دقيقة، عند استيفاء شروط الدفع وعدم تحقق تسجيل الوصول وعدم وجود حالة غير محسومة منسوبة لخطأ المالك أو منع الوصول أو القوة القاهرة. يجوز للمالك الإبلاغ؛ ويُشترط مراجعة مزارع وتأكيدها. عند التأكيد: مبلغ الاسترداد المستحق للعميل = 0؛ ويتلقى المالك أرباحه المستحقة العادية؛ وتتلقى مزارع عمولتها المنطبقة العادية.`,
        `عدم حضور المالك المؤكد أو منع الوصول غير المبرر: يستحق العميل استرداداً بنسبة 100٪ من المبالغ المحصّلة؛ صرف المالك = 0؛ وقد تنطبق عواقب مالية وموثوقية كما في اتفاق المالك وسياسة الإلغاء والاسترداد؛ ولا تحتفظ مزارع بالعمولة العادية على قيمة الحجز المستردة في تلك الحالة.`,
      ],
    },
    {
      id: 'check-in',
      titleEn: '17. Check-in',
      titleAr: '17. تسجيل الوصول',
      paragraphsEn: [
        `Mazare3 may provide a one-time check-in code as arrival or handover evidence. It typically becomes available ${CHECK_IN_OPEN_HOURS_BEFORE_START} hours before start and expires ${CHECK_IN_EXPIRE_MINUTES_AFTER_START} minutes after start (product rules).`,
        `Check-in proves arrival or handover only. It does not automatically prove property quality, cleanliness, that every amenity worked, absence of defects, or absence of later problems. No GPS check-in requirement currently exists.`,
      ],
      paragraphsAr: [
        `قد توفر مزارع رمزاً لمرة واحدة لتسجيل الوصول كدليل وصول أو تسليم. يتاح عادة قبل ${CHECK_IN_OPEN_HOURS_BEFORE_START} ساعة من البداية وينتهي بعد ${CHECK_IN_EXPIRE_MINUTES_AFTER_START} دقيقة من البداية (وفق قواعد المنتج).`,
        `يثبت تسجيل الوصول الوصول أو التسليم فقط. ولا يثبت تلقائياً جودة العقار أو النظافة أو عمل كل مرفق أو غياب العيوب أو غياب مشاكل لاحقة. لا يوجد حالياً اشتراط تسجيل وصول عبر تحديد الموقع.`,
      ],
    },
    {
      id: 'rescheduling',
      titleEn: '18. Rescheduling',
      titleAr: '18. إعادة الجدولة',
      paragraphsEn: [
        `Neither party may unilaterally change a confirmed Booking. Customer-requested reschedule requires Owner acceptance and is normally limited to ${MAX_CUSTOMER_RESCHEDULES} successful customer-requested reschedule per Booking. Counterparty response windows may expire (for example ${RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS} hours under product rules).`,
        `Customer-initiated: same price → no adjustment; higher → Customer pays the accepted difference before finalisation; lower → eligible difference becomes a Refund Due. Owner-initiated: the Customer cannot be forced to pay a higher price merely because the Owner requested the move; if the accepted replacement results in a lower eligible price, the applicable difference is refunded according to the existing rules.`,
        `After a Customer-requested reschedule, cancellation timing is calculated using the earlier of the original Booking start and the new Booking start, so moving a Booking further into the future cannot create a more favourable cancellation window than the original protection rule. Force-majeure outcomes follow the force-majeure rules in these Terms and the Cancellation & Refund Policy.`,
      ],
      paragraphsAr: [
        `لا يجوز لأي طرف تغيير حجز مؤكد من طرف واحد. إعادة الجدولة بطلب العميل تتطلب قبول المالك وتُحدَّ عادة بـ ${MAX_CUSTOMER_RESCHEDULES} إعادة جدولة ناجحة بطلب العميل لكل حجز. قد تنتهي نوافذ رد الطرف الآخر (مثلاً ${RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS} ساعة وفق قواعد المنتج).`,
        `بمبادرة العميل: نفس السعر → بلا تعديل؛ أعلى → يدفع العميل الفرق المقبول قبل الإتمام؛ أدنى → يصبح الفرق المستحق مبلغ استرداد مستحقاً. بمبادرة المالك: لا يمكن إجبار العميل على دفع مبلغ أعلى لمجرد طلب النقل؛ وإذا نتج عن البديل المقبول سعر مؤهل أدنى، يُسترد الفرق المنطبق وفق القواعد القائمة.`,
        `بعد إعادة الجدولة بطلب العميل، يُحتسب توقيت الإلغاء بالاستناد إلى الأسبق من موعد بداية الحجز الأصلي وموعد البداية الجديد، حتى لا ينشئ نقل الحجز إلى موعد أبعد نافذة إلغاء أفضل من قاعدة الحماية الأصلية. وتتبع نتائج القوة القاهرة قواعد القوة القاهرة في هذه الشروط وسياسة الإلغاء والاسترداد.`,
      ],
    },
    {
      id: 'force-majeure',
      titleEn: '19. Force majeure',
      titleAr: '19. القوة القاهرة',
      paragraphsEn: [
        `Force majeure covers objectively extraordinary circumstances outside reasonable control, subject to Mazare3 review and evidence (for example official closure, officially documented dangerous weather, official road or access closure, natural disaster, or an event rendering the Property objectively unusable). Ordinary rain, preference changes, or inconvenience do not automatically qualify.`,
        `Where Mazare3 confirms a genuine force-majeure event that makes performance of the Booking objectively impossible: the Customer is entitled to a full refund of eligible captured Booking payments. An equivalent reschedule may be offered as an alternative and is not imposed instead of that refund without the Customer’s agreement. Owner penalty = 0. Ordinary cancellation penalties do not apply to that genuine approved force-majeure impossibility. If the Customer voluntarily chooses a more expensive replacement beyond an equivalent replacement, an explicitly accepted price difference may apply. Mazare3 does not promise external cash compensation beyond applicable refunds or reschedules.`,
      ],
      paragraphsAr: [
        `تشمل القوة القاهرة ظروفاً استثنائية موضوعية خارج السيطرة المعقولة، خاضعة لمراجعة مزارع والأدلة (مثل إغلاق رسمي، طقس خطر موثّق رسمياً، إغلاق طريق أو وصول رسمي، كارثة طبيعية، أو حدث يجعل العقار غير قابل للاستخدام موضوعياً). المطر العادي أو تغيّر الرغبة أو الإزعاج لا يُعدّ تلقائياً قوة قاهرة.`,
        `عندما تؤكد مزارع حدث قوة قاهرة حقيقياً يجعل تنفيذ الحجز متعذراً بصورة موضوعية: يستحق العميل استرداداً كاملاً لمدفوعات الحجز المحصّلة المؤهلة. ويجوز عرض إعادة جدولة مكافئة كبديل، ولا تُفرض بدلاً من ذلك الاسترداد دون موافقة العميل. غرامة المالك = 0. ولا تُطبَّق غرامات الإلغاء العادية على حالة القوة القاهرة المعتمدة التي يتعذر معها التنفيذ. وإذا اختار العميل طوعاً بديلاً أعلى سعراً من البديل المكافئ، فقد ينطبق فرق سعر مقبول صراحة. ولا تعد مزارع بتعويض نقدي خارجي يتجاوز الاسترداد أو إعادة الجدولة المعمول بهما.`,
      ],
    },
    {
      id: 'refunds',
      titleEn: '20. Refunds',
      titleAr: '20. الاستردادات',
      paragraphsEn: [
        `Cancellation never causes Mazare3 to collect money that was not already a Captured Amount merely to satisfy a cancellation percentage. The retained amount is the lesser of the Captured Amount available for retention and the applicable policy charge. The Refund Due is what remains of the Captured Amount after that retention (when positive), accounting for any already completed Refunded Amounts.`,
        `Once a refund is finally approved or due under Mazare3 policy, Mazare3 submits and processes it through the configured payment provider without unreasonable delay. Actual bank or card posting time may depend on that provider and the card issuer. A Refund Due or Approved Refund is not a completed Refunded Amount until the payment process confirms completion. Mazare3 does not promise an exact arrival day for funds.`,
        `Refunds follow the Cancellation & Refund Policy. There is no blanket rule that every Captured Amount is final with no refund path.`,
      ],
      paragraphsAr: [
        `لا يؤدي الإلغاء إلى جمع مزارع مالاً لم يكن مبلغاً محصّلاً أصلاً لمجرد استيفاء نسبة إلغاء. المبلغ المحتفظ به هو الأقل بين المبلغ المحصّل المتاح للاحتفاظ ورسوم السياسة المنطبقة. ومبلغ الاسترداد المستحق هو ما يتبقى من المبلغ المحصّل بعد ذلك الاحتفاظ (عند الإيجاب)، مع مراعاة أي مبالغ مستردة فعلياً مكتملة مسبقاً.`,
        `متى أصبح الاسترداد معتمداً نهائياً أو مستحقاً بموجب سياسة مزارع، تقدّمه مزارع وتعالجه عبر مزود الدفع المهيأ دون تأخير غير معقول. قد يعتمد ظهور المبلغ في البنك أو البطاقة على ذلك المزود ومصدر البطاقة. ومبلغ الاسترداد المستحق أو المعتمد ليس مبلغاً مسترداً فعلياً إلى أن تؤكد عملية الدفع اكتماله. ولا تعد مزارع بيوم وصول محدد للأموال.`,
        `تتبع الاستردادات سياسة الإلغاء والاسترداد. ولا تنص هذه الشروط على أن كل مبلغ محصّل نهائي بلا مسار استرداد.`,
      ],
    },
    {
      id: 'property-access',
      titleEn: '21. Property access',
      titleAr: '21. الوصول إلى العقار',
      paragraphsEn: [
        `Owners must provide accurate access arrangements for confirmed eligible Bookings. Customers must follow published house rules, guest limits, and check-in instructions.`,
        `Mazare3 is not on site and does not physically open Properties.`,
      ],
      paragraphsAr: [
        `يجب على المالكين توفير ترتيبات وصول دقيقة للحجوزات المؤكدة المؤهلة. ويجب على العملاء اتباع قواعد البيت المنشورة وحدود الضيوف وتعليمات تسجيل الوصول.`,
        `مزارع ليست في الموقع ولا تفتح العقارات مادياً.`,
      ],
    },
    {
      id: 'customer-conduct',
      titleEn: '22. Customer conduct and access-denied fairness',
      titleAr: '22. سلوك العميل وعدالة منع الوصول',
      paragraphsEn: [
        `Customers must use Properties lawfully, respect neighbours and house rules, and not engage in harassment, illegal activity, or damage. Owners may refuse entry or end a stay for serious rule breaches consistent with applicable law.`,
        `An Owner’s decision to deny access or terminate use does not automatically determine the financial outcome. Where payment or refund responsibility is disputed, Mazare3 may review available evidence, and the applicable cancellation, incident, or dispute rules determine the financial outcome. The Owner cannot unilaterally treat a disputed access-denied case as Customer no-show merely to keep payment.`,
      ],
      paragraphsAr: [
        `يجب على العملاء استخدام العقارات بشكل قانوني واحترام الجيران وقواعد البيت وعدم الإساءة أو النشاط غير القانوني أو الإضرار. يجوز للمالك رفض الدخول أو إنهاء الإقامة عند مخالفات جسيمة بما يتوافق مع القانون المعمول به.`,
        `قرار المالك بمنع الوصول أو إنهاء الاستخدام لا يحدّد تلقائياً النتيجة المالية. وعند النزاع حول مسؤولية الدفع أو الاسترداد، يجوز لمزارع مراجعة الأدلة المتاحة، وتحدّد قواعد الإلغاء أو الحوادث أو النزاعات المنطبقة النتيجة المالية. ولا يجوز للمالك أن يصنّف من طرف واحد حالة منع وصول متنازع عليها على أنها عدم حضور للعميل لمجرد الاحتفاظ بالدفع.`,
      ],
    },
    {
      id: 'owner-rules',
      titleEn: '23. Owner and property rules',
      titleAr: '23. قواعد المالك والعقار',
      paragraphsEn: [
        `Owners must keep listings accurate, honour confirmed Bookings, maintain reasonable safety and cleanliness standards they represent, and comply with permits or licences that apply to their Property. Discrimination or unlawful refusal of service is prohibited to the extent forbidden by applicable law.`,
      ],
      paragraphsAr: [
        `يجب على المالكين الإبقاء على دقة الإعلانات والالتزام بالحجوزات المؤكدة والحفاظ على معايير سلامة ونظافة معقولة كما يعرضونها، والامتثال للتراخيص أو التصاريح المنطبقة على عقارهم. يُحظر التمييز أو الرفض غير المشروع للخدمة بالقدر الذي يمنعه القانون المعمول به.`,
      ],
    },
    {
      id: 'damage',
      titleEn: '24. Damage and responsibility',
      titleAr: '24. الضرر والمسؤولية',
      paragraphsEn: [
        `Mazare3 does not operate a platform damage-deposit hold in the current product. Customers remain responsible under applicable law for damage they cause; Owners remain responsible for their Property and representations.`,
        `Mazare3 does not automatically charge an additional damage amount to the Customer’s payment method merely because an Owner alleges damage. Any damage claim must follow the applicable claim or support process and legal basis. Claims may be handled between the parties with Mazare3 support facilitation where appropriate.`,
      ],
      paragraphsAr: [
        `لا تشغّل مزارع نظام احتجاز عربون ضرر على المنصة في المنتج الحالي. يبقى العميل مسؤولاً بموجب القانون المعمول به عن الضرر الذي يسببه؛ ويبقى المالك مسؤولاً عن عقاره وما يعرضه.`,
        `لا تخصم مزارع تلقائياً مبلغ ضرر إضافي من وسيلة دفع العميل لمجرد ادعاء المالك بوقوع ضرر. أي مطالبة ضرر يجب أن تتبع مسار المطالبة أو الدعم المعمول به والأساس القانوني. قد تُعالَج المطالبات بين الطرفين مع تسهيل دعم مزارع عند الاقتضاء.`,
      ],
    },
    {
      id: 'reviews',
      titleEn: '25. Reviews and content',
      titleAr: '25. المراجعات والمحتوى',
      paragraphsEn: [
        `Eligible Customers may leave ratings or comments under the Community & Review Policy. Mazare3 may moderate, hide, or remove content that violates policy. Mazare3 does not promise independent fact-checking of every review statement.`,
      ],
      paragraphsAr: [
        `يجوز للعملاء المؤهلين ترك تقييمات أو تعليقات وفق سياسة المجتمع والمراجعات. يجوز لمزارع تعديل أو إخفاء أو إزالة محتوى يخالف السياسة. لا تعد مزارع بالتحقق المستقل من كل عبارة في المراجعات.`,
      ],
    },
    {
      id: 'verification',
      titleEn: '26. Verification',
      titleAr: '26. التحقق',
      paragraphsEn: [
        `“Verified by Mazare3” / “تم التحقق بواسطة Mazare3” applies when a listing has completed Mazare3’s platform review process. It reflects Mazare3’s platform review — not government certification — and is not an absolute guarantee of condition, safety, licensing, identity, or future performance. See the Verification Policy.`,
      ],
      paragraphsAr: [
        `تُستخدم عبارة «تم التحقق بواسطة Mazare3» / “Verified by Mazare3” عندما يُتمّ الإعلان عملية مراجعة منصة مزارع. وتعكس مراجعة منصة مزارع — وليست شهادة حكومية — وليست ضماناً مطلقاً للحالة أو السلامة أو الترخيص أو الهوية أو الأداء المستقبلي. راجع سياسة التحقق.`,
      ],
    },
    {
      id: 'prohibited',
      titleEn: '27. Prohibited and fraudulent use',
      titleAr: '27. الاستخدام المحظور والاحتيالي',
      paragraphsEn: [
        `You must not use Mazare3 to commit fraud, test stolen cards, scrape listings unlawfully, harass users, manipulate reviews, misrepresent identity or Property rights, or interfere with platform security. Mazare3 may cancel Bookings, withhold settlement where permitted by policy, and restrict accounts in such cases, to the extent permitted by applicable law.`,
      ],
      paragraphsAr: [
        `يُحظر استخدام مزارع للاحتيال أو اختبار بطاقات مسروقة أو استخراج الإعلانات بشكل غير مشروع أو مضايقة المستخدمين أو التلاعب بالمراجعات أو التضليل في الهوية أو حقوق العقار أو الإضرار بأمن المنصة. يجوز لمزارع إلغاء الحجوزات ووقف التسوية حيث تسمح السياسة وتقييد الحسابات في تلك الحالات، بالقدر الذي يسمح به القانون المعمول به.`,
      ],
    },
    {
      id: 'suspension',
      titleEn: '28. Account suspension and termination',
      titleAr: '28. إيقاف الحساب وإنهاؤه',
      paragraphsEn: [
        `Mazare3 may suspend or terminate access for material breach, fraud risk, or legal requirement. You may stop using Mazare3 and request account closure subject to retention needed for bookings, payments, disputes, and legal obligations. Confirmed Booking obligations survive termination to the extent required to complete or lawfully unwind those Bookings.`,
      ],
      paragraphsAr: [
        `يجوز لمزارع إيقاف أو إنهاء الوصول عند مخالفة جوهرية أو مخاطر احتيال أو متطلب قانوني. يمكنك التوقف عن استخدام مزارع وطلب إغلاق الحساب مع مراعاة الاحتفاظ اللازم للحجوزات والمدفوعات والنزاعات والالتزامات القانونية. تبقى التزامات الحجوزات المؤكدة سارية بعد الإنهاء بالقدر اللازم لإتمامها أو تسويتها قانوناً.`,
      ],
    },
    {
      id: 'support-disputes',
      titleEn: '29. Support and disputes',
      titleAr: '29. الدعم والنزاعات',
      paragraphsEn: [
        `Use in-product support channels and My bookings for reservation issues. Mazare3 may request evidence for incidents (no-show, access denied, force majeure, damage claims). Platform decisions on policy application are operational; they do not waive mandatory consumer rights.`,
      ],
      paragraphsAr: [
        `استخدم قنوات الدعم داخل المنتج و«حجوزاتي» لمسائل الحجز. قد تطلب مزارع أدلة للحوادث (عدم الحضور، منع الوصول، القوة القاهرة، مطالبات الضرر). قرارات المنصة بشأن تطبيق السياسة تشغيلية؛ ولا تُسقط الحقوق الإلزامية للمستهلك.`,
      ],
    },
    {
      id: 'availability',
      titleEn: '30. Platform service availability',
      titleAr: '30. توفر خدمة المنصة',
      paragraphsEn: [
        `Mazare3 aims for reliable availability but does not warrant uninterrupted or error-free service. Maintenance, outages, or third-party failures may occur. To the extent permitted by applicable law, Mazare3 is not liable for delays caused solely by circumstances outside its reasonable control.`,
      ],
      paragraphsAr: [
        `تسعى مزارع لتوفر موثوق لكنها لا تضمن خدمة بلا انقطاع أو بلا أخطاء. قد تحدث صيانة أو انقطاعات أو أعطال لدى أطراف ثالثة. بالقدر الذي يسمح به القانون المعمول به، لا تتحمل مزارع المسؤولية عن تأخيرات ناتجة فقط عن ظروف خارج سيطرتها المعقولة.`,
      ],
    },
    {
      id: 'ip',
      titleEn: '31. Intellectual property',
      titleAr: '31. الملكية الفكرية',
      paragraphsEn: [
        `Mazare3 branding, software, designs, content, and platform materials are protected by applicable intellectual-property rights and are owned by, or licensed for use to, the relevant rights holders/operator as applicable. Owners grant Mazare3 a licence to host and display listing content they upload for marketplace operation. Users must not copy platform materials except as allowed by law or written permission.`,
      ],
      paragraphsAr: [
        `تخضع العلامات والبرمجيات والتصاميم والمحتوى ومواد المنصة لحقوق الملكية الفكرية العائدة لأصحاب الحقوق فيها، وتستخدمها الجهة المشغلة بصفة المالك أو المرخَّص له أو صاحب الحق في استخدامها، بحسب الحالة. يمنح المالكون مزارع ترخيصاً لاستضافة وعرض محتوى الإعلان الذي يرفعونه لتشغيل السوق. يجب على المستخدمين عدم نسخ مواد المنصة إلا بما يسمح به القانون أو إذن كتابي.`,
      ],
    },
    {
      id: 'third-parties',
      titleEn: '32. Third-party services and payment providers',
      titleAr: '32. خدمات الأطراف الثالثة ومزودو الدفع',
      paragraphsEn: [
        `Mazare3 uses processors such as database hosting, object storage for public media and private verification documents where configured, Mazare3’s configured payment service provider for payments, and Google sign-in where enabled. Those providers process data under their roles as described in the Privacy Policy.`,
      ],
      paragraphsAr: [
        `تستخدم مزارع معالجين مثل استضافة قاعدة البيانات وتخزين الكائنات للوسائط العامة ومستندات التحقق الخاصة عند التهيئة، ومزود خدمة الدفع الذي تُهيّئه مزارع للمدفوعات، وتسجيل الدخول عبر Google عند التفعيل. يعالج هؤلاء المزودون البيانات وفق أدوارهم كما في سياسة الخصوصية.`,
      ],
    },
    {
      id: 'privacy',
      titleEn: '33. Privacy',
      titleAr: '33. الخصوصية',
      paragraphsEn: [
        `Personal Data is processed as described in the Privacy Policy. Privacy acknowledgement at signup is not marketing consent. Optional purposes (marketing, optional cookies or analytics) require separate consent where applicable.`,
        `For privacy requests, use the Privacy tools in your Mazare3 account (and the Contact page where published). The Privacy Policy explains Personal Data processing; it is not an economic booking term that sets price or refund amounts.`,
      ],
      paragraphsAr: [
        `تُعالَج البيانات الشخصية كما هو موضح في سياسة الخصوصية. الإقرار بالخصوصية عند التسجيل ليس موافقة تسويقية. الأغراض الاختيارية (التسويق وملفات الارتباط أو التحليلات الاختيارية) تتطلب موافقة منفصلة عند الاقتضاء.`,
        `لطلبات الخصوصية، استخدم أدوات الخصوصية في حسابك على مزارع (وصفحة التواصل عند نشرها). توضّح سياسة الخصوصية معالجة البيانات الشخصية؛ وهي ليست شرطاً اقتصادياً للحجز يحدّد السعر أو مبالغ الاسترداد.`,
      ],
    },
    {
      id: 'liability',
      titleEn: '34. Limitation of liability',
      titleAr: '34. حدود المسؤولية',
      paragraphsEn: [
        `Mazare3 is a marketplace and is not the day-to-day operator of listed Properties. To the extent permitted by applicable law, Mazare3 is not liable for Owner acts or omissions, Property condition beyond Mazare3’s platform obligations, or indirect or consequential losses that are not reasonably foreseeable.`,
        `Nothing in this section excludes responsibility arising from Mazare3’s own contractual obligations, representations, fraud, or other liability that cannot legally be excluded. Nothing in these Terms excludes or limits liability that cannot be excluded or limited under Jordanian mandatory law. Mandatory consumer rights remain preserved.`,
      ],
      paragraphsAr: [
        `مزارع منصة سوق وليست المشغّل اليومي للعقارات المعروضة. بالقدر الذي يسمح به القانون المعمول به، لا تتحمل مزارع المسؤولية عن أفعال أو إغفال المالك، أو حالة العقار بما يتجاوز التزامات المنصة، أو الخسائر غير المباشرة أو التبعية غير المتوقعة بشكل معقول.`,
        `لا يستبعد هذا القسم المسؤولية الناشئة عن التزامات مزارع التعاقدية الخاصة، أو إقراراتها، أو احتيالها، أو أي مسؤولية أخرى لا يجوز قانوناً استبعادها. ولا يستبعد أو يحدّ أي بند في هذه الشروط مسؤولية لا يجوز استبعادها أو تقييدها بموجب القانون الأردني الإلزامي. وتبقى الحقوق الإلزامية للمستهلك محفوظة.`,
      ],
    },
    {
      id: 'consumer-rights',
      titleEn: '35. Consumer statutory rights preserved',
      titleAr: '35. حفظ الحقوق النظامية للمستهلك',
      paragraphsEn: [
        `Nothing in these Terms is intended to waive mandatory rights of consumers under Jordanian Consumer Protection Law No. 7 of 2017 or other mandatory protections. If a term is unfair or unenforceable under mandatory law, it is modified to the minimum extent necessary or severed.`,
      ],
      paragraphsAr: [
        `لا يُقصد بأي بند في هذه الشروط التنازل عن الحقوق الإلزامية للمستهلكين بموجب قانون حماية المستهلك الأردني رقم 7 لسنة 2017 أو أي حماية إلزامية أخرى. إذا كان بنداً مجحفاً أو غير قابل للتنفيذ بموجب القانون الإلزامي، يُعدَّل بالحد الأدنى اللازم أو يُفصل.`,
      ],
    },
    {
      id: 'user-responsibility',
      titleEn: '36. User responsibility',
      titleAr: '36. مسؤولية المستخدم',
      paragraphsEn: [
        `Users remain responsible, under applicable law, for losses or damage resulting from their fraud, unlawful conduct, or intentional or material breach of these Terms where such liability exists.`,
        `Nothing in this section creates disproportionate or automatic penalties. Mandatory consumer rights remain preserved.`,
      ],
      paragraphsAr: [
        `يبقى المستخدمون مسؤولين، بموجب القانون المعمول به، عن الخسائر أو الأضرار الناشئة عن احتيالهم أو سلوكهم غير المشروع أو مخالفتهم العمدية أو الجوهرية لهذه الشروط حيث تقوم تلك المسؤولية.`,
        `لا ينشئ هذا القسم غرامات غير متناسبة أو تلقائية. وتبقى الحقوق الإلزامية للمستهلك محفوظة.`,
      ],
    },
    {
      id: 'changes',
      titleEn: '37. Changes to Terms and versioning',
      titleAr: '37. تعديل الشروط وإصداراتها',
      paragraphsEn: [
        `Mazare3 may publish updated Terms under a new version. Material changes that require re-acceptance become binding for you only when you complete the explicit electronic acceptance action Mazare3 presents — not by browsing or continued use alone.`,
        `Until you complete required re-acceptance, Mazare3 may restrict new contractual actions or functionality that depend on the updated Terms.`,
        `Updates do not retroactively change commercial economics recorded for already-confirmed Bookings, except where required by law or expressly agreed for a specific Booking.`,
      ],
      paragraphsAr: [
        `يجوز لمزارع نشر شروط محدَّثة بإصدار جديد. التغييرات الجوهرية التي تتطلب إعادة القبول تسري عليك فقط عند إتمام إجراء القبول الإلكتروني الصريح الذي تعرضه مزارع — وليس بمجرد التصفّح أو مواصلة الاستخدام وحدهما.`,
        `إلى أن تُتمّ إعادة القبول المطلوبة، يجوز لمزارع تقييد الخطوات التعاقدية الجديدة أو الوظائف التي تعتمد على الشروط المحدَّثة.`,
        `لا تغيّر التحديثات بأثر رجعي الاقتصاديات التجارية المسجّلة لحجوزات مؤكدة سابقاً، إلا حيث يقتضي القانون أو يُتفق صراحة لحجز معيّن.`,
      ],
    },
    {
      id: 'electronic',
      titleEn: '38. Electronic communications and records',
      titleAr: '38. المراسلات والسجلات الإلكترونية',
      paragraphsEn: [
        `You consent to receive notices electronically (in-product, and email where configured). Electronic records of acceptances, Bookings, and payments are intended to have effect under Jordan’s electronic transactions framework as applicable.`,
      ],
      paragraphsAr: [
        `توافق على تلقي الإشعارات إلكترونياً (داخل المنتج، والبريد عند التهيئة). يُقصد بالسجلات الإلكترونية للقبولات والحجوزات والمدفوعات أن يكون لها أثر بموجب إطار المعاملات الإلكترونية الأردني حسب انطباقه.`,
      ],
    },
    {
      id: 'governing-law',
      titleEn: '39. Governing law',
      titleAr: '39. القانون الحاكم',
      paragraphsEn: [
        `These Terms are governed by the laws of the Hashemite Kingdom of Jordan, without prejudice to mandatory consumer protections that apply.`,
      ],
      paragraphsAr: [
        `تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية، دون الإخلال بالحمايات الإلزامية للمستهلك التي تنطبق.`,
      ],
    },
    {
      id: 'forum',
      titleEn: '40. Dispute and forum provision',
      titleAr: '40. تسوية النزاعات والاختصاص',
      paragraphsEn: [
        `Parties should first attempt good-faith resolution via Mazare3 support. Using Mazare3 support is not intended to unlawfully prevent a Customer from contacting a competent regulator or authority, exercising a mandatory legal right, or bringing a matter before a competent Jordanian court where entitled. Subject to mandatory law, disputes may be submitted to the competent courts of Jordan. These Terms do not impose mandatory arbitration.`,
      ],
      paragraphsAr: [
        `ينبغي للطرفين أولاً محاولة التسوية بحسن نية عبر دعم مزارع. وليس المقصود باستخدام دعم مزارع منع العميل بصورة غير مشروعة من التواصل مع جهة رقابية أو سلطة مختصة، أو ممارسة حق قانوني إلزامي، أو عرض الأمر على محكمة أردنية مختصة حيث يحق له ذلك. مع مراعاة القانون الإلزامي، يجوز عرض النزاعات على المحاكم الأردنية المختصة. ولا تفرض هذه الشروط تحكيماً إلزامياً.`,
      ],
    },
    {
      id: 'severability',
      titleEn: '41. Severability',
      titleAr: '41. قابلية الفصل',
      paragraphsEn: [
        `If any provision is held invalid or unenforceable, the remaining provisions continue in effect, and the invalid provision is modified to the minimum extent necessary to make it valid.`,
      ],
      paragraphsAr: [
        `إذا تبيّن بطلان أو عدم قابلية تنفيذ أي حكم، تبقى الأحكام الأخرى سارية، ويُعدَّل الحكم الباطل بالحد الأدنى اللازم ليصبح صالحاً.`,
      ],
    },
    {
      id: 'contact',
      titleEn: '42. Contact',
      titleAr: '42. التواصل',
      paragraphsEn: [
        `Operator: ${P.LEGAL_ENTITY_NAME}. Commercial registration: ${P.COMMERCIAL_REGISTRATION_NUMBER}. Registered address: ${P.REGISTERED_ADDRESS}. Legal contact: ${P.LEGAL_CONTACT_EMAIL}.`,
        `For privacy matters, use the Privacy tools in your Mazare3 account and the Contact page when published details are available.`,
      ],
      paragraphsAr: [
        `المشغّل: ${P.LEGAL_ENTITY_NAME}. السجل التجاري: ${P.COMMERCIAL_REGISTRATION_NUMBER}. العنوان المسجّل: ${P.REGISTERED_ADDRESS}. التواصل القانوني: ${P.LEGAL_CONTACT_EMAIL}.`,
        `لمسائل الخصوصية، استخدم أدوات الخصوصية في حسابك على مزارع وصفحة التواصل عند توفر بيانات منشورة.`,
      ],
    },
  ],
});
