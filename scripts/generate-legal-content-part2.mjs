/**
 * Part 2 — owner, booking, verification, community, cookie
 * Run: node scripts/generate-legal-content-part2.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

// Duplicate minimal helpers from generate-legal-content.mjs
const root = path.resolve('packages/shared/src/legal-content');

const HEADER = `import { LEGAL_CONTENT_PLACEHOLDERS as P } from './placeholders';
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

`;

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
}

function sec(id, n, titleEn, titleAr, paragraphsEn, paragraphsAr, bulletsEn, bulletsAr) {
  const pe = paragraphsEn.map((p) => `\`${esc(p)}\``).join(',\n        ');
  const pa = paragraphsAr.map((p) => `\`${esc(p)}\``).join(',\n        ');
  let bullets = '';
  if (bulletsEn?.length) {
    bullets += `,\n      bulletsEn: [\n        ${bulletsEn.map((b) => `\`${esc(b)}\``).join(',\n        ')}\n      ]`;
  }
  if (bulletsAr?.length) {
    bullets += `,\n      bulletsAr: [\n        ${bulletsAr.map((b) => `\`${esc(b)}\``).join(',\n        ')}\n      ]`;
  }
  return `    {
      id: '${id}',
      titleEn: '${n}. ${esc(titleEn).replace(/'/g, "\\'")}',
      titleAr: '${n}. ${esc(titleAr).replace(/'/g, "\\'")}',
      paragraphsEn: [
        ${pe}
      ],
      paragraphsAr: [
        ${pa}
      ]${bullets}
    }`;
}

function T(s) {
  return s
    .replaceAll('{{DEPOSIT_PERCENT}}', '${DEPOSIT_PERCENT}')
    .replaceAll('{{FULL_PAYMENT_WITHIN_HOURS}}', '${FULL_PAYMENT_WITHIN_HOURS}')
    .replaceAll('{{BALANCE_DUE_HOURS_BEFORE_START}}', '${BALANCE_DUE_HOURS_BEFORE_START}')
    .replaceAll('{{CANCELLATION_FREE_UNTIL_HOURS}}', '${CANCELLATION_FREE_UNTIL_HOURS}')
    .replaceAll('{{CANCELLATION_CHARGE_30_UNTIL_HOURS}}', '${CANCELLATION_CHARGE_30_UNTIL_HOURS}')
    .replaceAll('{{CANCELLATION_CHARGE_50_UNTIL_HOURS}}', '${CANCELLATION_CHARGE_50_UNTIL_HOURS}')
    .replaceAll('{{CANCELLATION_CHARGE_PERCENT_TIER_30}}', '${CANCELLATION_CHARGE_PERCENT_TIER_30}')
    .replaceAll('{{CANCELLATION_CHARGE_PERCENT_TIER_50}}', '${CANCELLATION_CHARGE_PERCENT_TIER_50}')
    .replaceAll('{{CANCELLATION_CHARGE_PERCENT_TIER_100}}', '${CANCELLATION_CHARGE_PERCENT_TIER_100}')
    .replaceAll('{{STANDARD_COMMISSION_PERCENT}}', '${STANDARD_COMMISSION_PERCENT}')
    .replaceAll('{{VERIFIED_COMMISSION_PERCENT}}', '${VERIFIED_COMMISSION_PERCENT}')
    .replaceAll('{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}}', '${OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}')
    .replaceAll('{{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}}', '${OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}')
    .replaceAll('{{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}', '${OWNER_CANCEL_PENALTY_PERCENT_TIER_10}')
    .replaceAll('{{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}', '${OWNER_CANCEL_PENALTY_PERCENT_TIER_20}')
    .replaceAll('{{OWNER_PENALTY_MIN_JOD}}', '${OWNER_PENALTY_MIN_JOD}')
    .replaceAll('{{OWNER_PENALTY_MAX_JOD}}', '${OWNER_PENALTY_MAX_JOD}')
    .replaceAll('{{CUSTOMER_NO_SHOW_GRACE_MINUTES}}', '${CUSTOMER_NO_SHOW_GRACE_MINUTES}')
    .replaceAll('{{MAX_CUSTOMER_RESCHEDULES}}', '${MAX_CUSTOMER_RESCHEDULES}')
    .replaceAll('{{CHECK_IN_OPEN_HOURS_BEFORE_START}}', '${CHECK_IN_OPEN_HOURS_BEFORE_START}')
    .replaceAll('{{CHECK_IN_EXPIRE_MINUTES_AFTER_START}}', '${CHECK_IN_EXPIRE_MINUTES_AFTER_START}')
    .replaceAll('{{RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS}}', '${RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS}')
    .replaceAll('{{pe}}', '${P.LEGAL_ENTITY_NAME}')
    .replaceAll('{{addr}}', '${P.REGISTERED_ADDRESS}')
    .replaceAll('{{legalEmail}}', '${P.LEGAL_CONTACT_EMAIL}')
    .replaceAll('{{privacyEmail}}', '${P.PRIVACY_CONTACT_EMAIL}')
    .replaceAll('{{cr}}', '${P.COMMERCIAL_REGISTRATION_NUMBER}')
    .replaceAll('{{dpo}}', '${P.DPO_OR_PRIVACY_CONTACT}')
    .replaceAll('{{psp}}', '${P.PAYMENT_PROVIDER_LEGAL_NAME}');
}

function writeDoc(filename, exportName, documentType, titleEn, titleAr, introEn, introAr, sections) {
  const body = `${HEADER}export const ${exportName}: LaunchLegalDocument = finalizeLaunchDocument({
  documentType: '${documentType}',
  titleEn: '${titleEn.replace(/'/g, "\\'")}',
  titleAr: '${titleAr.replace(/'/g, "\\'")}',
  introEn: \`${esc(T(introEn))}\`,
  introAr: \`${esc(T(introAr))}\`,
  sections: [
${sections.map((s) => sec(s.id, s.n, s.titleEn, s.titleAr, s.paragraphsEn.map(T), s.paragraphsAr.map(T), s.bulletsEn?.map(T), s.bulletsAr?.map(T))).join(',\n')}
  ],
});
`;
  fs.writeFileSync(path.join(root, filename), body, 'utf8');
  console.log('wrote', filename);
}

const ownerSections = [
  { id: 'parties', n: 1, titleEn: 'Parties and acceptance', titleAr: 'الأطراف والقبول',
    paragraphsEn: [
      'This Owner / Partner Agreement (“Agreement”) is between {{pe}} (“Mazare3”) and the Owner/Partner who accepts it during onboarding or re-acceptance.',
      'Acceptance is recorded as evidence. Material updates may require re-acceptance before listing tools remain fully available.',
    ],
    paragraphsAr: [
      'اتفاق المالك / الشريك («الاتفاق») بين {{pe}} («مزارع») والمالك/الشريك الذي يقبله أثناء التهيئة أو إعادة القبول.',
      'يُسجَّل القبول كدليل. قد تتطلب التحديثات الجوهرية إعادة القبول قبل استمرار أدوات الإعلان بالكامل.',
    ]},
  { id: 'eligibility', n: 2, titleEn: 'Eligibility and authority', titleAr: 'الأهلية والصلاحية',
    paragraphsEn: [
      'You must have legal capacity and authority to list the Property (ownership or lawful management authorisation). You are responsible for permits and licences required for your Property under applicable law. Mazare3 does not supply those permits.',
    ],
    paragraphsAr: [
      'يجب أن تتمتع بالأهلية والصلاحية لعرض العقار (ملكية أو تفويض إدارة مشروع). وأنت مسؤول عن التصاريح والتراخيص المطلوبة لعقارك بموجب القانون المعمول به. مزارع لا تمنح تلك التصاريح.',
    ]},
  { id: 'kyc', n: 3, titleEn: 'Onboarding and KYC', titleAr: 'التهيئة والتحقق من الهوية',
    paragraphsEn: [
      'You must complete partner onboarding and submit accurate KYC/identity and related documents to private storage. Basic KYC approval does not by itself mean “Verified by Mazare3” (platform_verified) or the {{VERIFIED_COMMISSION_PERCENT}}% commission rate.',
    ],
    paragraphsAr: [
      'يجب إكمال تهيئة الشريك وتقديم مستندات الهوية/التحقق بدقة إلى التخزين الخاص. موافقة التحقق الأساسية وحدها لا تعني «تم التحقق بواسطة Mazare3» (platform_verified) ولا نسبة العمولة {{VERIFIED_COMMISSION_PERCENT}}٪.',
    ]},
  { id: 'listings', n: 4, titleEn: 'Listings, photos, pricing, availability', titleAr: 'الإعلانات والصور والتسعير والتوفر',
    paragraphsEn: [
      'Keep listing content accurate (photos, capacity, amenities, house rules, location presentation, availability). You grant Mazare3 a licence to host and display your content for marketplace operation. You set prices and availability subject to platform rules and any accepted commercial terms.',
    ],
    paragraphsAr: [
      'حافظ على دقة محتوى الإعلان (الصور، السعة، المرافق، قواعد البيت، عرض الموقع، التوفر). تمنح مزارع ترخيصاً لاستضافة وعرض محتواك لتشغيل السوق. تحدد الأسعار والتوفر مع مراعاة قواعد المنصة وأي شروط تجارية مقبولة.',
    ]},
  { id: 'booking-obligations', n: 5, titleEn: 'Booking obligations and access', titleAr: 'التزامات الحجز والوصول',
    paragraphsEn: [
      'Honour confirmed Bookings. Provide accurate access arrangements. Maintain reasonable safety and cleanliness consistent with your listing. Instant booking vs approval behaviour must match how your listing is configured.',
      'Unlawful discrimination or unlawful refusal of service is prohibited to the extent forbidden by applicable law. <!-- REQUIRES JORDANIAN LEGAL REVIEW -->',
    ],
    paragraphsAr: [
      'التزم بالحجوزات المؤكدة. ووفّر ترتيبات وصول دقيقة. وحافظ على سلامة ونظافة معقولة بما يتوافق مع إعلانك. يجب أن يطابق سلوك الحجز الفوري/الموافقة إعداد إعلانك.',
      'يُحظر التمييز غير المشروع أو رفض الخدمة غير المشروع بالقدر الذي يمنعه القانون. <!-- REQUIRES JORDANIAN LEGAL REVIEW -->',
    ]},
  { id: 'cancel-noshow', n: 6, titleEn: 'Cancellation, no-show, check-in, reschedule, force majeure', titleAr: 'الإلغاء وعدم الحضور وتسجيل الوصول وإعادة الجدولة والقوة القاهرة',
    paragraphsEn: [
      'Owner-caused cancellation of a confirmed Booking: Customer receives 100% refund of captured payments; your payout for that Booking is 0; reliability incident may apply. Penalties: 0% if >{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}}h; {{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}% between {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}}–{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}}h; {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}% if ≤{{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}}h or confirmed Owner no-show/unjustified denied access; clamped {{OWNER_PENALTY_MIN_JOD}}–{{OWNER_PENALTY_MAX_JOD}} JOD; deducted from future eligible settlement — not an automatic card charge. Force majeure: no penalty.',
      'Check-in PIN proves handover only. Rescheduling requires mutual acceptance; you cannot force a Customer to pay more solely because you requested a move. Customer-facing cancellation/refund detail is in the Cancellation & Refund Policy.',
    ],
    paragraphsAr: [
      'إلغاء المالك لسبب يرجع إليه لحجز مؤكد: يسترد الزبون 100٪ من المحصّل؛ صرفك لذلك الحجز = 0؛ وقد تُسجَّل حادثة موثوقية. الغرامات: 0٪ إذا >{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}} ساعة؛ {{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}٪ بين {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}}–{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}}؛ {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}٪ إذا ≤{{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}} أو عدم حضور مالك مؤكد/منع وصول غير مبرر؛ مقيدة بين {{OWNER_PENALTY_MIN_JOD}}–{{OWNER_PENALTY_MAX_JOD}} د.أ؛ وتُخصم من تسوية لاحقة مستحقة — وليست خصماً تلقائياً من البطاقة. القوة القاهرة: بلا غرامة.',
      'رمز تسجيل الوصول يثبت التسليم فقط. إعادة الجدولة تتطلب قبولاً متبادلاً؛ ولا يجوز إجبار الزبون على دفع أكثر لمجرد أنك طلبت النقل. تفاصيل الإلغاء/الاسترداد للزبون في سياسة الإلغاء والاسترداد.',
    ]},
  { id: 'commission', n: 7, titleEn: 'Commission and commercial terms', titleAr: 'العمولة والشروط التجارية',
    paragraphsEn: [
      'Standard commission is {{STANDARD_COMMISSION_PERCENT}}% of applicable commission basis. If Property.verificationStatus is platform_verified, commission is {{VERIFIED_COMMISSION_PERCENT}}% unless valid, active, admin-controlled, accepted PartnerCommercialTerms provide otherwise. The {{VERIFIED_COMMISSION_PERCENT}}% rate is not permanent if verification is later revoked.',
      'Commission for a Booking is snapshotted and does not change retroactively for that Booking. Customers do not pay this Owner commission as a separate fee unless another explicit customer fee is shown.',
    ],
    paragraphsAr: [
      'العمولة القياسية {{STANDARD_COMMISSION_PERCENT}}٪ من أساس العمولة المنطبق. إذا كانت حالة التحقق platform_verified تكون العمولة {{VERIFIED_COMMISSION_PERCENT}}٪ ما لم تنص شروط تجارية للشريك سارية ومقبولة ومُدارة من الإدارة على خلاف ذلك. نسبة {{VERIFIED_COMMISSION_PERCENT}}٪ ليست دائمة إذا أُلغي التحقق لاحقاً.',
      'تُلتقط عمولة الحجز ولا تتغير بأثر رجعي لذلك الحجز. لا يدفع الزبون عمولة المالك كبند منفصل ما لم تظهر رسوم زبون صريحة أخرى.',
    ]},
  { id: 'settlement', n: 8, titleEn: 'Settlement, payouts, holds, adjustments', titleAr: 'التسوية والصرف والاحتجاز والتعديلات',
    paragraphsEn: [
      'Eligible earnings are paid to your approved payout destination after settlement rules, refunds, disputes, and owner financial adjustments (including penalties) are applied. Mazare3 may delay or hold payouts while investigating fraud, chargebacks, or open incidents, to the extent permitted by applicable law and policy — not arbitrary confiscation.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: payout rails and merchant-of-record settlement flow -->',
    ],
    paragraphsAr: [
      'تُدفع الأرباح المستحقة إلى وجهة الصرف المعتمدة بعد تطبيق قواعد التسوية والاستردادات والنزاعات والتعديلات المالية على المالك (بما فيها الغرامات). قد تؤخر مزارع أو تحتجز الصرف أثناء التحقيق في احتيال أو استرداد من الجهة المصدرة أو حوادث مفتوحة، بالقدر الذي يسمح به القانون والسياسة — وليس مصادرة تعسفية.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: مسارات الصرف وتدفق تسوية التاجر المسجّل -->',
    ]},
  { id: 'promos', n: 9, titleEn: 'Promotions and coupons', titleAr: 'العروض والكوبونات',
    paragraphsEn: [
      'Platform-funded vs owner-funded promotions follow the rules shown when a promotion is created or accepted. Coupons change Customer price only if Mazare3 accepts them for that slot.',
    ],
    paragraphsAr: [
      'تتبع العروض المموّلة من المنصة مقابل المموّلة من المالك القواعد الظاهرة عند إنشاء العرض أو قبوله. تغيّر الكوبونات سعر الزبون فقط إذا قبلتها مزارع لتلك الفترة.',
    ]},
  { id: 'reviews-verification', n: 10, titleEn: 'Reviews and verification', titleAr: 'المراجعات والتحقق',
    paragraphsEn: [
      'Customers may leave eligible reviews under the Community & Review Policy. “Verified by Mazare3” is platform review only — not government certification — and may be suspended or revoked.',
    ],
    paragraphsAr: [
      'يجوز للزبائن ترك مراجعات مؤهلة وفق سياسة المجتمع والمراجعات. «تم التحقق بواسطة Mazare3» مراجعة منصة فقط — وليست شهادة حكومية — وقد تُعلَّق أو تُلغى.',
    ]},
  { id: 'taxes', n: 11, titleEn: 'Taxes and accounting', titleAr: 'الضرائب والمحاسبة',
    paragraphsEn: [
      'You are responsible for your own tax and accounting obligations. These Terms do not invent final Jordanian tax rules. <!-- REQUIRES JORDANIAN LEGAL REVIEW: VAT/income characterisation -->',
    ],
    paragraphsAr: [
      'أنت مسؤول عن التزاماتك الضريبية والمحاسبية. لا تخترع هذه الشروط قواعد ضريبية أردنية نهائية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: تكييف ضريبة المبيعات/الدخل -->',
    ]},
  { id: 'data-ip', n: 12, titleEn: 'Personal data, confidentiality, IP', titleAr: 'البيانات الشخصية والسرية والملكية الفكرية',
    paragraphsEn: [
      'Process Customer Personal Data only to host Bookings and as allowed by the Privacy Policy and applicable law. Keep non-public Customer contact details confidential except as needed for the stay. Mazare3 IP remains Mazare3’s; your listing content licence is as stated above.',
    ],
    paragraphsAr: [
      'عالج بيانات الزبون الشخصية فقط لاستضافة الحجوزات وكما تسمح سياسة الخصوصية والقانون. حافظ على سرية بيانات تواصل الزبون غير العامة إلا بما يلزم للإقامة. تبقى ملكية مزارع الفكرية لمزارع؛ وترخيص محتوى إعلانك كما ورد أعلاه.',
    ]},
  { id: 'liability', n: 13, titleEn: 'Liability and mandatory rights', titleAr: 'المسؤولية والحقوق الإلزامية',
    paragraphsEn: [
      'To the extent permitted by applicable law, Mazare3’s marketplace role limitations in the Terms & Conditions apply. Nothing waives mandatory legal rights that cannot be waived.',
    ],
    paragraphsAr: [
      'بالقدر الذي يسمح به القانون المعمول به، تنطبق حدود دور السوق في الشروط والأحكام. لا يسقط أي بند حقوقاً قانونية إلزامية لا يجوز التنازل عنها.',
    ]},
  { id: 'term-termination', n: 14, titleEn: 'Term, termination, survival', titleAr: 'المدة والإنهاء والبقاء',
    paragraphsEn: [
      'Either party may terminate this Agreement prospectively as allowed by onboarding/status rules. Termination does not excuse obligations for already-confirmed Bookings, settlements, refunds, penalties, or confidentiality. Surviving financial obligations remain until discharged.',
    ],
    paragraphsAr: [
      'يجوز لأي طرف إنهاء هذا الاتفاق للمستقبل وفق قواعد التهيئة/الحالة. الإنهاء لا يعفي من التزامات الحجوزات المؤكدة مسبقاً أو التسويات أو الاستردادات أو الغرامات أو السرية. تبقى الالتزامات المالية السارية حتى الوفاء بها.',
    ]},
  { id: 'law', n: 15, titleEn: 'Governing law and contact', titleAr: 'القانون الحاكم والتواصل',
    paragraphsEn: [
      'Governed by the laws of the Hashemite Kingdom of Jordan. <!-- REQUIRES JORDANIAN LEGAL REVIEW: forum --> Contact: {{legalEmail}}. Operator: {{pe}}, {{addr}}, {{cr}}.',
    ],
    paragraphsAr: [
      'يخضع لقوانين المملكة الأردنية الهاشمية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: الاختصاص --> التواصل: {{legalEmail}}. المشغّل: {{pe}}، {{addr}}، {{cr}}.',
    ]},
];

writeDoc('owner-agreement.ts', 'ownerAgreement', 'owner_agreement', 'Owner / Partner Agreement', 'اتفاق المالك / الشريك',
  'Commercial agreement between Mazare3 ({{pe}}) and participating Owners. Launch-candidate — not counsel-approved.',
  'اتفاق تجاري بين مزارع ({{pe}}) والمالكين المشاركين. نص مرشّح للإطلاق — غير معتمد من المستشار القانوني.',
  ownerSections);

const bookingSections = [
  { id: 'what-you-confirm', n: 1, titleEn: 'What you confirm at checkout', titleAr: 'ما تؤكده عند إتمام الدفع',
    paragraphsEn: [
      'You are requesting or confirming a Booking for a specific Property, date, and period at the price shown, including any valid coupon Mazare3 accepts.',
    ],
    paragraphsAr: [
      'أنت تطلب أو تؤكد حجزاً لعقار وتاريخ وفترة محددة بالسعر الظاهر، بما في ذلك أي كوبون مقبول من مزارع.',
    ]},
  { id: 'amounts', n: 2, titleEn: 'Amounts due', titleAr: 'المبالغ المستحقة',
    paragraphsEn: [
      'Checkout shows the due-now amount (Deposit or full payment) and any future Balance. If start is more than {{FULL_PAYMENT_WITHIN_HOURS}} hours away you may choose {{DEPOSIT_PERCENT}}% Deposit or full payment; within {{FULL_PAYMENT_WITHIN_HOURS}} hours full payment is required. Balance (if any) is due {{BALANCE_DUE_HOURS_BEFORE_START}} hours before start.',
    ],
    paragraphsAr: [
      'يُظهر إتمام الدفع المبلغ المستحق فوراً (عربون أو دفع كامل) وأي رصيد متبقٍ. إذا بقي أكثر من {{FULL_PAYMENT_WITHIN_HOURS}} ساعة قد تختار عربون {{DEPOSIT_PERCENT}}٪ أو الدفع الكامل؛ وخلال {{FULL_PAYMENT_WITHIN_HOURS}} ساعة يُطلب الدفع الكامل. يستحق أي رصيد قبل {{BALANCE_DUE_HOURS_BEFORE_START}} ساعة من البداية.',
    ]},
  { id: 'approval', n: 3, titleEn: 'Owner approval', titleAr: 'موافقة المالك',
    paragraphsEn: [
      'If the listing requires Owner approval, payment is not collected until acceptance. Instant-booking listings proceed to payment after you confirm.',
    ],
    paragraphsAr: [
      'إذا تطلب الإعلان موافقة المالك، لا يُحصَّل الدفع حتى القبول. عقارات الحجز الفوري تنتقل للدفع بعد تأكيدك.',
    ]},
  { id: 'cancel-rules', n: 4, titleEn: 'Cancellation snapshot', titleAr: 'ملخص الإلغاء',
    paragraphsEn: [
      'Customer cancellation charges (of merchant value; retained = min(captured, charge)): 0% >{{CANCELLATION_FREE_UNTIL_HOURS}}h; {{CANCELLATION_CHARGE_PERCENT_TIER_30}}% in the {{CANCELLATION_CHARGE_30_UNTIL_HOURS}}–{{CANCELLATION_FREE_UNTIL_HOURS}}h window; {{CANCELLATION_CHARGE_PERCENT_TIER_50}}% in the {{CANCELLATION_CHARGE_50_UNTIL_HOURS}}–{{CANCELLATION_CHARGE_30_UNTIL_HOURS}}h window; {{CANCELLATION_CHARGE_PERCENT_TIER_100}}% at {{CANCELLATION_CHARGE_50_UNTIL_HOURS}}h or less. Full detail: Cancellation & Refund Policy.',
    ],
    paragraphsAr: [
      'رسوم إلغاء الزبون (من قيمة الشريك؛ المحتفظ = الحد الأدنى بين المحصّل والرسوم): 0٪ لأكثر من {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة؛ {{CANCELLATION_CHARGE_PERCENT_TIER_30}}٪ في نافذة {{CANCELLATION_CHARGE_30_UNTIL_HOURS}}–{{CANCELLATION_FREE_UNTIL_HOURS}}؛ {{CANCELLATION_CHARGE_PERCENT_TIER_50}}٪ في نافذة {{CANCELLATION_CHARGE_50_UNTIL_HOURS}}–{{CANCELLATION_CHARGE_30_UNTIL_HOURS}}؛ {{CANCELLATION_CHARGE_PERCENT_TIER_100}}٪ خلال {{CANCELLATION_CHARGE_50_UNTIL_HOURS}} ساعة أو أقل. التفاصيل الكاملة: سياسة الإلغاء والاسترداد.',
    ]},
  { id: 'stay-rules', n: 5, titleEn: 'Property rules, check-in, no-show, reschedule', titleAr: 'قواعد العقار وتسجيل الوصول وعدم الحضور وإعادة الجدولة',
    paragraphsEn: [
      'Follow house rules and guest limits. Check-in code proves handover only. Customer no-show may apply after {{CUSTOMER_NO_SHOW_GRACE_MINUTES}} minutes grace with admin confirmation. Reschedule needs agreement (normally max {{MAX_CUSTOMER_RESCHEDULES}} customer-requested success). Refunds follow the Cancellation & Refund Policy and PSP timing.',
    ],
    paragraphsAr: [
      'اتبع قواعد البيت وحدود الضيوف. رمز تسجيل الوصول يثبت التسليم فقط. قد يُطبَّق عدم حضور الزبون بعد سماح {{CUSTOMER_NO_SHOW_GRACE_MINUTES}} دقيقة مع تأكيد الإدارة. إعادة الجدولة تحتاج اتفاقاً (عادة حد أقصى {{MAX_CUSTOMER_RESCHEDULES}} نجاح بطلب الزبون). الاسترداد وفق سياسة الإلغاء والاسترداد وتوقيت مزود الدفع.',
    ]},
  { id: 'controlling-docs', n: 6, titleEn: 'Controlling documents', titleAr: 'المستندات الحاكمة',
    paragraphsEn: [
      'These Booking Terms are a short checkout companion. They complement the Terms & Conditions, Privacy Policy acknowledgement, and Cancellation & Refund Policy. Mazare3 is a marketplace, not an insurer or escrow. <!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: merchant of record --> Operator: {{pe}}.',
    ],
    paragraphsAr: [
      'شروط الحجز هذه مرافقة مختصرة عند إتمام الدفع. وهي تكمّل الشروط والأحكام وإقرار سياسة الخصوصية وسياسة الإلغاء والاسترداد. مزارع سوق وليست مؤمِّناً أو خدمة ضمان. <!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: التاجر المسجّل --> المشغّل: {{pe}}.',
    ]},
];

writeDoc('booking-terms.ts', 'bookingTerms', 'booking_terms', 'Booking Terms', 'شروط الحجز',
  'Short checkout terms for Mazare3 Bookings. Not a substitute for the full Terms & Conditions.',
  'شروط حجز مختصرة عند إتمام الدفع في مزارع. ليست بديلاً عن الشروط والأحكام الكاملة.',
  bookingSections);

const verificationSections = [
  { id: 'meaning', n: 1, titleEn: 'What “Verified by Mazare3” means', titleAr: 'معنى «تم التحقق بواسطة Mazare3»',
    paragraphsEn: [
      'The badge “Verified by Mazare3” / “تم التحقق بواسطة Mazare3” appears only when Property.verificationStatus === platform_verified after Mazare3’s platform review process.',
      'It is not government certification, licensing approval, or an absolute guarantee of property condition, safety, identity, or future performance.',
    ],
    paragraphsAr: [
      'تظهر شارة «تم التحقق بواسطة Mazare3» / “Verified by Mazare3” فقط عندما تكون حالة التحقق platform_verified بعد عملية مراجعة منصة مزارع.',
      'وليست شهادة حكومية أو اعتماد ترخيص أو ضماناً مطلقاً لحالة العقار أو السلامة أو الهوية أو الأداء المستقبلي.',
    ]},
  { id: 'vs-kyc', n: 2, titleEn: 'Difference from basic Owner KYC', titleAr: 'الفرق عن تحقق المالك الأساسي',
    paragraphsEn: [
      'Owner onboarding/KYC checks identity and listing authority documents for partnership. Platform verification is a separate review that may examine listing quality and related signals. Passing KYC alone does not grant the badge.',
      'For Owners, platform_verified may apply a {{VERIFIED_COMMISSION_PERCENT}}% commission instead of {{STANDARD_COMMISSION_PERCENT}}% unless custom commercial terms apply — this commercial detail is primarily an Owner matter.',
    ],
    paragraphsAr: [
      'تهيئة المالك/التحقق تفحص الهوية ومستندات صلاحية العرض للشراكة. التحقق المنصّي مراجعة منفصلة قد تنظر في جودة الإعلان وإشارات ذات صلة. اجتياز التحقق الأساسي وحده لا يمنح الشارة.',
      'للمالكين، قد تطبّق platform_verified عمولة {{VERIFIED_COMMISSION_PERCENT}}٪ بدل {{STANDARD_COMMISSION_PERCENT}}٪ ما لم تُطبَّق شروط تجارية مخصّصة — وهذا تفصيل تجاري يخص المالك أساساً.',
    ]},
  { id: 'changes', n: 3, titleEn: 'Suspension and changes', titleAr: 'التعليق والتغيير',
    paragraphsEn: [
      'Verification may be suspended or revoked if standards are no longer met or information changes. Listing information can become outdated; Customers should still read the live listing and house rules.',
      'Mazare3 does not publish internal antifraud methods in this Policy.',
    ],
    paragraphsAr: [
      'قد يُعلَّق التحقق أو يُلغى إذا لم تعد المعايير مستوفاة أو تغيّرت المعلومات. قد يصبح محتوى الإعلان قديماً؛ وينبغي للزبائن قراءة الإعلان الحي وقواعد البيت.',
      'لا تنشر مزارع أساليب مكافحة الاحتيال الداخلية في هذه السياسة.',
    ]},
];

writeDoc('verification-policy.ts', 'verificationPolicy', 'verification_policy', 'Verification Policy', 'سياسة التحقق',
  'Explains “Verified by Mazare3” for Mazare3 Jordan listings.',
  'توضح معنى «تم التحقق بواسطة Mazare3» لإعلانات مزارع الأردن.',
  verificationSections);

const communitySections = [
  { id: 'eligibility', n: 1, titleEn: 'Eligibility', titleAr: 'الأهلية',
    paragraphsEn: [
      'Reviews come from eligible Bookings under Mazare3’s review system. Write about firsthand experience only.',
    ],
    paragraphsAr: [
      'تنشأ المراجعات من حجوزات مؤهلة وفق نظام مراجعات مزارع. اكتب عن تجربة مباشرة فقط.',
    ]},
  { id: 'prohibited', n: 2, titleEn: 'Prohibited content', titleAr: 'المحتوى المحظور',
    paragraphsEn: [
      'Do not post fake reviews, paid or coerced reviews, threats, harassment, illegal content, or another person’s private information. Do not manipulate ratings.',
    ],
    paragraphsAr: [
      'يُحظر نشر مراجعات مزيفة أو مدفوعة أو مُكره عليها، أو تهديدات أو مضايقة أو محتوى غير قانوني أو بيانات خاصة لشخص آخر. ويُحظر التلاعب بالتقييمات.',
    ]},
  { id: 'moderation', n: 3, titleEn: 'Moderation', titleAr: 'الإشراف',
    paragraphsEn: [
      'Mazare3 may hide or remove reviews that violate this Policy. Mazare3 does not promise to fact-check every statement. Contact support to appeal a moderation decision where a path is offered.',
    ],
    paragraphsAr: [
      'يجوز لمزارع إخفاء أو إزالة مراجعات تخالف هذه السياسة. لا تعد مزارع بالتحقق من كل عبارة. تواصل مع الدعم للتظلم من قرار إشراف عند توفر مسار لذلك.',
    ]},
];

writeDoc('community-review-policy.ts', 'communityReviewPolicy', 'community_review_policy', 'Community & Review Policy', 'سياسة المجتمع والمراجعات',
  'Short rules for Mazare3 property reviews and user content.',
  'قواعد مختصرة لمراجعات عقارات مزارع ومحتوى المستخدمين.',
  communitySections);

const cookieSections = [
  { id: 'essentials', n: 1, titleEn: 'Essential cookies and storage', titleAr: 'ملفات الارتباط والتخزين الأساسية',
    paragraphsEn: [
      'Mazare3 currently uses essential technologies needed to run the service: authentication/session cookies, locale or preference storage, security protections, and payment-related necessary technologies on PSP-hosted pages where applicable.',
      'Phase 3B audit found no Google Analytics or Meta Pixel in application source at drafting time.',
    ],
    paragraphsAr: [
      'تستخدم مزارع حالياً تقنيات أساسية لتشغيل الخدمة: ملفات مصادقة/جلسة، وتخزين اللغة أو التفضيلات، وحمايات أمنية، وتقنيات دفع لازمة على صفحات مزود الدفع عند الاقتضاء.',
      'لم يظهر تدقيق المرحلة 3B وجود Google Analytics أو Meta Pixel في مصدر التطبيق وقت الصياغة.',
    ]},
  { id: 'optional', n: 2, titleEn: 'Optional analytics or marketing', titleAr: 'التحليلات أو التسويق الاختياري',
    paragraphsEn: [
      'If optional analytics or marketing trackers are introduced later, Mazare3 will update this Policy and obtain appropriate consent before non-essential tracking, separate from Terms acceptance.',
    ],
    paragraphsAr: [
      'إذا أُدخلت لاحقاً أدوات تحليلات أو تسويق اختيارية، ستحدّث مزارع هذه السياسة وتحصل على الموافقة المناسبة قبل التتبع غير الأساسي، منفصلة عن قبول الشروط.',
    ]},
  { id: 'contact', n: 3, titleEn: 'Contact', titleAr: 'التواصل',
    paragraphsEn: [
      'Privacy questions: {{privacyEmail}}. Operator: {{pe}}.',
    ],
    paragraphsAr: [
      'استفسارات الخصوصية: {{privacyEmail}}. المشغّل: {{pe}}.',
    ]},
];

writeDoc('cookie-policy.ts', 'cookiePolicy', 'cookie_policy', 'Cookie Policy', 'سياسة ملفات تعريف الارتباط',
  'Concise essentials-only cookie and local storage notice for Mazare3.',
  'إشعار مختصر لملفات الارتباط والتخزين المحلي الأساسية في مزارع.',
  cookieSections);

console.log('part2 done');
