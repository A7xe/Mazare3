/**
 * FROZEN historical Owner Agreement corpus — Phase 3C.3 / 1.0.1-launch-candidate.
 * Do not mutate. Phase 3C.4C.2 DRAFT lives in owner-agreement.ts (1.1.0-advisor-revised).
 */
import { LEGAL_CONTENT_PLACEHOLDERS as P } from './placeholders';
import {
  OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_10,
  OWNER_CANCEL_PENALTY_PERCENT_TIER_20,
  OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS,
  OWNER_PENALTY_MAX_JOD,
  OWNER_PENALTY_MIN_JOD,
  STANDARD_COMMISSION_PERCENT,
  VERIFIED_COMMISSION_PERCENT,
} from './ssot-values';
import {
  LAUNCH_CANDIDATE_VERSION,
  finalizeLaunchDocument,
  type LaunchLegalDocument,
} from './build-legal-markdown';

export const ownerAgreementLaunchCandidate: LaunchLegalDocument = finalizeLaunchDocument({
  version: LAUNCH_CANDIDATE_VERSION,
  documentType: 'owner_agreement',
  titleEn: 'Owner / Partner Agreement',
  titleAr: 'اتفاق المالك / الشريك',
  introEn: `Commercial agreement between Mazare3 (${P.LEGAL_ENTITY_NAME}) and participating Owners. Launch-candidate — not counsel-approved.`,
  introAr: `اتفاق تجاري بين مزارع (${P.LEGAL_ENTITY_NAME}) والمالكين المشاركين. نص مرشّح للإطلاق — غير معتمد من المستشار القانوني.`,
  sections: [
    {
      id: 'parties',
      titleEn: '1. Parties and acceptance',
      titleAr: '1. الأطراف والقبول',
      paragraphsEn: [
        `This Owner / Partner Agreement (“Agreement”) is between ${P.LEGAL_ENTITY_NAME} (“Mazare3”) and the Owner/Partner who accepts it during onboarding or re-acceptance.`,
        `Acceptance is recorded as evidence. Material updates may require re-acceptance before listing tools remain fully available.`
      ],
      paragraphsAr: [
        `اتفاق المالك / الشريك («الاتفاق») بين ${P.LEGAL_ENTITY_NAME} («مزارع») والمالك/الشريك الذي يقبله أثناء التهيئة أو إعادة القبول.`,
        `يُسجَّل القبول كدليل. قد تتطلب التحديثات الجوهرية إعادة القبول قبل استمرار أدوات الإعلان بالكامل.`
      ]
    },
    {
      id: 'eligibility',
      titleEn: '2. Eligibility and authority',
      titleAr: '2. الأهلية والصلاحية',
      paragraphsEn: [
        `You must have legal capacity and authority to list the Property (ownership or lawful management authorisation). You are responsible for permits and licences required for your Property under applicable law. Mazare3 does not supply those permits.`
      ],
      paragraphsAr: [
        `يجب أن تتمتع بالأهلية والصلاحية لعرض العقار (ملكية أو تفويض إدارة مشروع). وأنت مسؤول عن التصاريح والتراخيص المطلوبة لعقارك بموجب القانون المعمول به. مزارع لا تمنح تلك التصاريح.`
      ]
    },
    {
      id: 'kyc',
      titleEn: '3. Onboarding and KYC',
      titleAr: '3. التهيئة والتحقق من الهوية',
      paragraphsEn: [
        `You must complete partner onboarding and submit accurate KYC/identity and related documents to private storage. Basic KYC approval does not by itself mean “Verified by Mazare3” (platform_verified) or the ${VERIFIED_COMMISSION_PERCENT}% commission rate.`
      ],
      paragraphsAr: [
        `يجب إكمال تهيئة الشريك وتقديم مستندات الهوية/التحقق بدقة إلى التخزين الخاص. موافقة التحقق الأساسية وحدها لا تعني «تم التحقق بواسطة Mazare3» (platform_verified) ولا نسبة العمولة ${VERIFIED_COMMISSION_PERCENT}٪.`
      ]
    },
    {
      id: 'listings',
      titleEn: '4. Listings, photos, pricing, availability',
      titleAr: '4. الإعلانات والصور والتسعير والتوفر',
      paragraphsEn: [
        `Keep listing content accurate (photos, capacity, amenities, house rules, location presentation, availability). You grant Mazare3 a licence to host and display your content for marketplace operation. You set prices and availability subject to platform rules and any accepted commercial terms.`
      ],
      paragraphsAr: [
        `حافظ على دقة محتوى الإعلان (الصور، السعة، المرافق، قواعد البيت، عرض الموقع، التوفر). تمنح مزارع ترخيصاً لاستضافة وعرض محتواك لتشغيل السوق. تحدد الأسعار والتوفر مع مراعاة قواعد المنصة وأي شروط تجارية مقبولة.`
      ]
    },
    {
      id: 'booking-obligations',
      titleEn: '5. Booking obligations and access',
      titleAr: '5. التزامات الحجز والوصول',
      paragraphsEn: [
        `Honour confirmed Bookings. Provide accurate access arrangements. Maintain reasonable safety and cleanliness consistent with your listing. Instant booking vs approval behaviour must match how your listing is configured.`,
        `Unlawful discrimination or unlawful refusal of service is prohibited to the extent forbidden by applicable law. <!-- REQUIRES JORDANIAN LEGAL REVIEW -->`
      ],
      paragraphsAr: [
        `التزم بالحجوزات المؤكدة. ووفّر ترتيبات وصول دقيقة. وحافظ على سلامة ونظافة معقولة بما يتوافق مع إعلانك. يجب أن يطابق سلوك الحجز الفوري/الموافقة إعداد إعلانك.`,
        `يُحظر التمييز غير المشروع أو رفض الخدمة غير المشروع بالقدر الذي يمنعه القانون. <!-- REQUIRES JORDANIAN LEGAL REVIEW -->`
      ]
    },
    {
      id: 'cancel-noshow',
      titleEn: '6. Cancellation, no-show, check-in, reschedule, force majeure',
      titleAr: '6. الإلغاء وعدم الحضور وتسجيل الوصول وإعادة الجدولة والقوة القاهرة',
      paragraphsEn: [
        `Owner-caused cancellation of a confirmed Booking: Customer receives 100% refund of captured payments; your payout for that Booking is 0; reliability incident may apply. Penalties: 0% if >${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}h; ${OWNER_CANCEL_PENALTY_PERCENT_TIER_10}% between ${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}–${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}h; ${OWNER_CANCEL_PENALTY_PERCENT_TIER_20}% if ≤${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}h or confirmed Owner no-show/unjustified denied access; clamped ${OWNER_PENALTY_MIN_JOD}–${OWNER_PENALTY_MAX_JOD} JOD; deducted from future eligible settlement — not an automatic card charge. Force majeure: no penalty.`,
        `Check-in PIN proves handover only. Rescheduling requires mutual acceptance; you cannot force a Customer to pay more solely because you requested a move. Customer-facing cancellation/refund detail is in the Cancellation & Refund Policy.`
      ],
      paragraphsAr: [
        `إلغاء المالك لسبب يرجع إليه لحجز مؤكد: يسترد الزبون 100٪ من المحصّل؛ صرفك لذلك الحجز = 0؛ وقد تُسجَّل حادثة موثوقية. الغرامات: 0٪ إذا >${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS} ساعة؛ ${OWNER_CANCEL_PENALTY_PERCENT_TIER_10}٪ بين ${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}–${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}؛ ${OWNER_CANCEL_PENALTY_PERCENT_TIER_20}٪ إذا ≤${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS} أو عدم حضور مالك مؤكد/منع وصول غير مبرر؛ مقيدة بين ${OWNER_PENALTY_MIN_JOD}–${OWNER_PENALTY_MAX_JOD} د.أ؛ وتُخصم من تسوية لاحقة مستحقة — وليست خصماً تلقائياً من البطاقة. القوة القاهرة: بلا غرامة.`,
        `رمز تسجيل الوصول يثبت التسليم فقط. إعادة الجدولة تتطلب قبولاً متبادلاً؛ ولا يجوز إجبار الزبون على دفع أكثر لمجرد أنك طلبت النقل. تفاصيل الإلغاء/الاسترداد للزبون في سياسة الإلغاء والاسترداد.`
      ]
    },
    {
      id: 'commission',
      titleEn: '7. Commission and commercial terms',
      titleAr: '7. العمولة والشروط التجارية',
      paragraphsEn: [
        `Standard commission is ${STANDARD_COMMISSION_PERCENT}% of applicable commission basis. If Property.verificationStatus is platform_verified, commission is ${VERIFIED_COMMISSION_PERCENT}% unless valid, active, admin-controlled, accepted PartnerCommercialTerms provide otherwise. The ${VERIFIED_COMMISSION_PERCENT}% rate is not permanent if verification is later revoked.`,
        `Commission for a Booking is snapshotted and does not change retroactively for that Booking. Customers do not pay this Owner commission as a separate fee unless another explicit customer fee is shown.`
      ],
      paragraphsAr: [
        `العمولة القياسية ${STANDARD_COMMISSION_PERCENT}٪ من أساس العمولة المنطبق. إذا كانت حالة التحقق platform_verified تكون العمولة ${VERIFIED_COMMISSION_PERCENT}٪ ما لم تنص شروط تجارية للشريك سارية ومقبولة ومُدارة من الإدارة على خلاف ذلك. نسبة ${VERIFIED_COMMISSION_PERCENT}٪ ليست دائمة إذا أُلغي التحقق لاحقاً.`,
        `تُلتقط عمولة الحجز ولا تتغير بأثر رجعي لذلك الحجز. لا يدفع الزبون عمولة المالك كبند منفصل ما لم تظهر رسوم زبون صريحة أخرى.`
      ]
    },
    {
      id: 'settlement',
      titleEn: '8. Settlement, payouts, holds, adjustments',
      titleAr: '8. التسوية والصرف والاحتجاز والتعديلات',
      paragraphsEn: [
        `Eligible earnings are paid to your approved payout destination after settlement rules, refunds, disputes, and owner financial adjustments (including penalties) are applied. Mazare3 may delay or hold payouts while investigating fraud, chargebacks, or open incidents, to the extent permitted by applicable law and policy — not arbitrary confiscation.`,
        `<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: payout rails and merchant-of-record settlement flow -->`
      ],
      paragraphsAr: [
        `تُدفع الأرباح المستحقة إلى وجهة الصرف المعتمدة بعد تطبيق قواعد التسوية والاستردادات والنزاعات والتعديلات المالية على المالك (بما فيها الغرامات). قد تؤخر مزارع أو تحتجز الصرف أثناء التحقيق في احتيال أو استرداد من الجهة المصدرة أو حوادث مفتوحة، بالقدر الذي يسمح به القانون والسياسة — وليس مصادرة تعسفية.`,
        `<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: مسارات الصرف وتدفق تسوية التاجر المسجّل -->`
      ]
    },
    {
      id: 'promos',
      titleEn: '9. Promotions and coupons',
      titleAr: '9. العروض والكوبونات',
      paragraphsEn: [
        `Platform-funded vs owner-funded promotions follow the rules shown when a promotion is created or accepted. Coupons change Customer price only if Mazare3 accepts them for that slot.`
      ],
      paragraphsAr: [
        `تتبع العروض المموّلة من المنصة مقابل المموّلة من المالك القواعد الظاهرة عند إنشاء العرض أو قبوله. تغيّر الكوبونات سعر الزبون فقط إذا قبلتها مزارع لتلك الفترة.`
      ]
    },
    {
      id: 'reviews-verification',
      titleEn: '10. Reviews and verification',
      titleAr: '10. المراجعات والتحقق',
      paragraphsEn: [
        `Customers may leave eligible reviews under the Community & Review Policy. “Verified by Mazare3” is platform review only — not government certification — and may be suspended or revoked.`
      ],
      paragraphsAr: [
        `يجوز للزبائن ترك مراجعات مؤهلة وفق سياسة المجتمع والمراجعات. «تم التحقق بواسطة Mazare3» مراجعة منصة فقط — وليست شهادة حكومية — وقد تُعلَّق أو تُلغى.`
      ]
    },
    {
      id: 'taxes',
      titleEn: '11. Taxes and accounting',
      titleAr: '11. الضرائب والمحاسبة',
      paragraphsEn: [
        `You are responsible for your own tax and accounting obligations. These Terms do not invent final Jordanian tax rules. <!-- REQUIRES JORDANIAN LEGAL REVIEW: VAT/income characterisation -->`
      ],
      paragraphsAr: [
        `أنت مسؤول عن التزاماتك الضريبية والمحاسبية. لا تخترع هذه الشروط قواعد ضريبية أردنية نهائية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: تكييف ضريبة المبيعات/الدخل -->`
      ]
    },
    {
      id: 'data-ip',
      titleEn: '12. Personal data, confidentiality, IP',
      titleAr: '12. البيانات الشخصية والسرية والملكية الفكرية',
      paragraphsEn: [
        `Process Customer Personal Data only to host Bookings and as allowed by the Privacy Policy and applicable law. Keep non-public Customer contact details confidential except as needed for the stay. Mazare3 IP remains Mazare3’s; your listing content licence is as stated above.`
      ],
      paragraphsAr: [
        `عالج بيانات الزبون الشخصية فقط لاستضافة الحجوزات وكما تسمح سياسة الخصوصية والقانون. حافظ على سرية بيانات تواصل الزبون غير العامة إلا بما يلزم للإقامة. تبقى ملكية مزارع الفكرية لمزارع؛ وترخيص محتوى إعلانك كما ورد أعلاه.`
      ]
    },
    {
      id: 'liability',
      titleEn: '13. Liability and mandatory rights',
      titleAr: '13. المسؤولية والحقوق الإلزامية',
      paragraphsEn: [
        `To the extent permitted by applicable law, Mazare3’s marketplace role limitations in the Terms & Conditions apply. Nothing waives mandatory legal rights that cannot be waived.`
      ],
      paragraphsAr: [
        `بالقدر الذي يسمح به القانون المعمول به، تنطبق حدود دور السوق في الشروط والأحكام. لا يسقط أي بند حقوقاً قانونية إلزامية لا يجوز التنازل عنها.`
      ]
    },
    {
      id: 'term-termination',
      titleEn: '14. Term, termination, survival',
      titleAr: '14. المدة والإنهاء والبقاء',
      paragraphsEn: [
        `Either party may terminate this Agreement prospectively as allowed by onboarding/status rules. Termination does not excuse obligations for already-confirmed Bookings, settlements, refunds, penalties, or confidentiality. Surviving financial obligations remain until discharged.`
      ],
      paragraphsAr: [
        `يجوز لأي طرف إنهاء هذا الاتفاق للمستقبل وفق قواعد التهيئة/الحالة. الإنهاء لا يعفي من التزامات الحجوزات المؤكدة مسبقاً أو التسويات أو الاستردادات أو الغرامات أو السرية. تبقى الالتزامات المالية السارية حتى الوفاء بها.`
      ]
    },
    {
      id: 'law',
      titleEn: '15. Governing law and contact',
      titleAr: '15. القانون الحاكم والتواصل',
      paragraphsEn: [
        `Governed by the laws of the Hashemite Kingdom of Jordan. <!-- REQUIRES JORDANIAN LEGAL REVIEW: forum --> Contact: ${P.LEGAL_CONTACT_EMAIL}. Operator: ${P.LEGAL_ENTITY_NAME}, ${P.REGISTERED_ADDRESS}, ${P.COMMERCIAL_REGISTRATION_NUMBER}.`
      ],
      paragraphsAr: [
        `يخضع لقوانين المملكة الأردنية الهاشمية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: الاختصاص --> التواصل: ${P.LEGAL_CONTACT_EMAIL}. المشغّل: ${P.LEGAL_ENTITY_NAME}، ${P.REGISTERED_ADDRESS}، ${P.COMMERCIAL_REGISTRATION_NUMBER}.`
      ]
    }
  ],
});
