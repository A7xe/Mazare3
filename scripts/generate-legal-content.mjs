/**
 * One-shot generator for Phase 3C.1 launch-candidate legal modules.
 * Run: node scripts/generate-legal-content.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

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
  // Keep ${...} intact for TypeScript template literal interpolation of SSOT values.
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

// Interpolate markers: {{NAME}} replaced in final template strings with ${NAME}
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

// ========== TERMS (42 sections) ==========
const termsSections = [
  {
    id: 'introduction',
    n: 1,
    titleEn: 'Introduction',
    titleAr: 'المقدمة',
    paragraphsEn: [
      'These Terms & Conditions ("Terms") govern your access to and use of the Mazare3 marketplace operated by {{pe}} (product name: Mazare3 / Mazare3 Jordan). They are launch-candidate text for Jordanian counsel review and do not constitute legal advice.',
      'By creating an account, submitting a booking, listing a Property, or otherwise using the platform, you agree to these Terms and the policies they incorporate by reference (Privacy Policy, Cancellation & Refund Policy, Booking Terms at checkout, Verification Policy, Community & Review Policy, and Cookie Policy). If you do not agree, do not use Mazare3.',
      'Where these Terms conflict with a more specific Mazare3 policy on a topic (for example cancellation), that specific policy controls for that topic, to the extent permitted by applicable law.',
    ],
    paragraphsAr: [
      'تحكم هذه الشروط والأحكام («الشروط») وصولك إلى سوق مزارع واستخدامك له، وتشغّله {{pe}} (اسم المنتج: مزارع / مزارع الأردن). هذا نص مرشّح للإطلاق لمراجعة المستشار القانوني الأردني وليس استشارة قانونية.',
      'بإنشاء حساب أو تقديم حجز أو عرض عقار أو استخدام المنصة بأي شكل آخر، فإنك توافق على هذه الشروط والسياسات المُشار إليها (سياسة الخصوصية، وسياسة الإلغاء والاسترداد، وشروط الحجز عند إتمام الدفع، وسياسة التحقق، وسياسة المجتمع والمراجعات، وسياسة ملفات تعريف الارتباط). إذا لم توافق، فلا تستخدم مزارع.',
      'عند تعارض هذه الشروط مع سياسة مزارع أكثر تخصيصاً لموضوع معيّن (مثل الإلغاء)، تُطبَّق تلك السياسة على ذلك الموضوع، بالقدر الذي يسمح به القانون المعمول به.',
    ],
  },
  {
    id: 'definitions',
    n: 2,
    titleEn: 'Definitions',
    titleAr: 'التعريفات',
    paragraphsEn: ['In these Terms:'],
    paragraphsAr: ['في هذه الشروط:'],
    bulletsEn: [
      '“Customer” means a user who searches for or books a Property.',
      '“Owner” (also “Partner”) means a user who lists and hosts a Property.',
      '“Property” means a farm, chalet, or other venue listing on Mazare3.',
      '“Booking” means a reservation for a specific Property, date, and period.',
      '“Deposit” means the partial payment when a {{DEPOSIT_PERCENT}}% deposit plan applies.',
      '“Balance” means the remaining amount due after a Deposit.',
      '“Captured” means amounts successfully collected and recorded for the Booking (net of recorded refunds).',
      '“Cancellation charge” means the policy percentage of merchant booking value; retained equals min(captured, policy charge).',
      '“Commission” means Mazare3’s platform fee (standard {{STANDARD_COMMISSION_PERCENT}}%; {{VERIFIED_COMMISSION_PERCENT}}% when Property.verificationStatus is platform_verified, unless valid custom commercial terms apply).',
      '“Verified by Mazare3” means platform_verified status under Mazare3 review — not government certification.',
      '“PSP” means the payment service provider (legal name: {{psp}}).',
    ],
    bulletsAr: [
      '«الزبون» مستخدم يبحث عن عقار أو يحجزه.',
      '«المالك» (أو «الشريك») مستخدم يعرض عقاراً ويستضيف الزيارة.',
      '«العقار» مزرعة أو شاليه أو مكان إقامة منشور على مزارع.',
      '«الحجز» حجز لعقار وتاريخ وفترة محددة.',
      '«العربون» الدفعة الجزئية عند تطبيق خطة عربون {{DEPOSIT_PERCENT}}٪.',
      '«الرصيد المتبقي» المبلغ المتبقي بعد العربون.',
      '«المحصّل» المبالغ التي جُمعت وسُجّلت بنجاح للحجز (بعد خصم الاستردادات المسجّلة).',
      '«رسوم الإلغاء» نسبة السياسة من قيمة الحجز للشريك؛ المحتفظ = الحد الأدنى بين المحصّل ورسوم السياسة.',
      '«العمولة» أجر منصة مزارع (قياسي {{STANDARD_COMMISSION_PERCENT}}٪؛ و{{VERIFIED_COMMISSION_PERCENT}}٪ عند platform_verified، ما لم تُطبَّق شروط تجارية مخصّصة سارية).',
      '«تم التحقق بواسطة Mazare3» تعني حالة platform_verified وفق مراجعة مزارع — وليست شهادة حكومية.',
      '«مزود الدفع» الجهة التي تعالج المدفوعات (الاسم القانوني: {{psp}}).',
    ],
  },
  {
    id: 'acceptance',
    n: 3,
    titleEn: 'Acceptance of Terms',
    titleAr: 'قبول الشروط',
    paragraphsEn: [
      'You accept these Terms by checking the applicable acceptance box, completing registration, completing checkout acknowledgements, or continuing to use Mazare3 after a published update that requires re-acceptance.',
      'Mazare3 records immutable acceptance evidence (document version, language, time, and context). Acknowledgement of the Privacy Policy is separate from optional marketing or analytics consent.',
    ],
    paragraphsAr: [
      'تقبل هذه الشروط بتحديد خانة القبول ذات الصلة، أو إكمال التسجيل، أو إقرارات إتمام الدفع، أو مواصلة استخدام مزارع بعد تحديث منشور يتطلب إعادة القبول.',
      'تسجّل مزارع أدلة قبول غير قابلة للتعديل (إصدار المستند واللغة والوقت والسياق). الإقرار بسياسة الخصوصية منفصل عن موافقة التسويق أو التحليلات الاختيارية.',
    ],
  },
  {
    id: 'eligibility',
    n: 4,
    titleEn: 'Eligibility and legal capacity',
    titleAr: 'الأهلية والأهلية القانونية',
    paragraphsEn: [
      'You must have legal capacity under Jordanian law to enter binding contracts. If you use Mazare3 on behalf of a business, you represent that you are authorised to bind that business.',
      'Mazare3 is not directed at children who lack legal capacity. <!-- REQUIRES JORDANIAN LEGAL REVIEW: age threshold and parental consent rules under PDPL / Consumer Protection -->',
    ],
    paragraphsAr: [
      'يجب أن تتمتع بالأهلية القانونية بموجب القانون الأردني لإبرام عقود ملزمة. إذا استخدمت مزارع نيابة عن منشأة، فإنك تقر بأنك مخوّل بإلزام تلك المنشأة.',
      'مزارع ليست موجّهة للقاصرين عديمي الأهلية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: سن الأهلية وموافقة ولي الأمر وفق قانون حماية البيانات الشخصية / حماية المستهلك -->',
    ],
  },
  {
    id: 'accounts',
    n: 5,
    titleEn: 'Account registration and security',
    titleAr: 'تسجيل الحساب وأمانه',
    paragraphsEn: [
      'Provide accurate registration details and keep credentials confidential. You are responsible for activity under your account unless you promptly notify Mazare3 of unauthorised access.',
      'You may sign in with email/password or supported Google OAuth. Mazare3 may restrict or suspend accounts used for fraud, abuse, or repeated policy breaches. Such decisions are operational and are not court findings.',
    ],
    paragraphsAr: [
      'قدّم بيانات تسجيل صحيحة واحفظ بيانات الدخول بسرية. أنت مسؤول عن النشاط عبر حسابك ما لم تُبلغ مزارع فوراً بوصول غير مصرّح به.',
      'يمكنك تسجيل الدخول بالبريد وكلمة المرور أو عبر Google OAuth المدعوم. قد تقيّد مزارع أو توقّف حسابات تُستخدم للاحتيال أو الإساءة أو تكرار مخالفة السياسات. هذه قرارات تشغيلية وليست أحكاماً قضائية.',
    ],
  },
  {
    id: 'role',
    n: 6,
    titleEn: 'Role of Mazare3',
    titleAr: 'دور مزارع',
    paragraphsEn: [
      'Mazare3 operates a marketplace platform. It provides search, listing tools, booking facilitation, payment workflow via a PSP, policy enforcement, support, verification processes, refund administration, and settlement infrastructure.',
      'Mazare3 is not the owner or day-to-day operator of listed Properties, is not an insurer, is not an escrow service, is not a government verifier, and is not a travel agency unless separately and expressly stated in writing.',
      'The hospitality/venue service for a Booking is supplied by the Owner. Mazare3 facilitates the marketplace relationship and related platform services described in these Terms.',
    ],
    paragraphsAr: [
      'تشغّل مزارع منصة سوق. توفر البحث وأدوات الإعلان وتسهيل الحجز ومسار الدفع عبر مزود دفع وإنفاذ السياسات والدعم وعمليات التحقق وإدارة الاسترداد وبنية التسوية.',
      'مزارع ليست مالكاً أو مشغّلاً يومياً للعقارات المعروضة، وليست مؤمِّناً، وليست خدمة ضمان (escrow)، وليست جهة تحقق حكومية، وليست وكالة سفر ما لم يُنص على خلاف ذلك صراحةً وكتابةً.',
      'خدمة الضيافة/المكان للحجز يقدّمها المالك. تسهّل مزارع علاقة السوق والخدمات المنصّية الموضحة في هذه الشروط.',
    ],
  },
  {
    id: 'owners-relationship',
    n: 7,
    titleEn: 'Relationship with property Owners',
    titleAr: 'العلاقة مع مالكي العقارات',
    paragraphsEn: [
      'Owners are independent parties. Commercial terms between Mazare3 and an Owner (commission, settlement, verification) are governed by the Owner Agreement and any accepted PartnerCommercialTerms.',
      'Customers do not pay Owner commission as a separate checkout line item unless another explicit customer fee is actually shown before payment.',
    ],
    paragraphsAr: [
      'المالكون أطراف مستقلة. الشروط التجارية بين مزارع والمالك (العمولة والتسوية والتحقق) يحكمها اتفاق المالك وأي شروط تجارية للشريك مقبولة.',
      'لا يدفع الزبون عمولة المالك كبند منفصل عند الدفع ما لم تظهر رسوم زبون صريحة أخرى قبل الدفع.',
    ],
  },
  {
    id: 'listings',
    n: 8,
    titleEn: 'Property listings',
    titleAr: 'إعلانات العقارات',
    paragraphsEn: [
      'Listings must be truthful regarding photos, capacity, amenities, house rules, location presentation, and availability. Public pages show approximate location only; exact address and arrival notes are revealed to an eligible Customer after confirmation under product rules.',
      'A slot is bookable only if Mazare3 still shows it as available when the Booking request completes.',
    ],
    paragraphsAr: [
      'يجب أن تكون الإعلانات صادقة بخصوص الصور والسعة والمرافق وقواعد البيت وعرض الموقع والتوفر. الصفحات العامة تعرض موقعاً تقريبياً فقط؛ ويُكشف العنوان الدقيق وملاحظات الوصول لزبون مؤهل بعد التأكيد وفق قواعد المنتج.',
      'الفترة قابلة للحجز فقط إذا ما زالت مزارع تعرضها متاحة عند اكتمال طلب الحجز.',
    ],
  },
  {
    id: 'pricing',
    n: 9,
    titleEn: 'Pricing',
    titleAr: 'التسعير',
    paragraphsEn: [
      'Prices shown for a slot on the booking panel (including any valid coupon Mazare3 accepts) are the amounts used for that Booking. Currency is Jordanian dinar (JOD) unless otherwise stated.',
      'Mazare3 does not invent tax rules in these Terms. Any taxes or invoices follow applicable law and the parties’ respective obligations. <!-- REQUIRES JORDANIAN LEGAL REVIEW: tax characterisation -->',
    ],
    paragraphsAr: [
      'الأسعار الظاهرة للفترة في لوحة الحجز (بما في ذلك أي كوبون مقبول) هي المبالغ المستخدمة لذلك الحجز. العملة الدينار الأردني ما لم يُذكر خلاف ذلك.',
      'لا تخترع مزارع قواعد ضريبية في هذه الشروط. أي ضرائب أو فواتير تخضع للقانون المعمول به والتزامات كل طرف. <!-- REQUIRES JORDANIAN LEGAL REVIEW: التكييف الضريبي -->',
    ],
  },
  {
    id: 'booking-formation',
    n: 10,
    titleEn: 'Booking formation',
    titleAr: 'تكوين الحجز',
    paragraphsEn: [
      'A Booking is created when Mazare3 successfully records a booking request for an available slot under the Customer’s account. Confirmation status depends on payment success and, where applicable, Owner approval.',
      'Checkout Booking Terms summarise price, due-now amount, balance, and cancellation pointers; they complement — and do not replace — these Terms and the Cancellation & Refund Policy.',
    ],
    paragraphsAr: [
      'يُنشأ الحجز عندما تسجّل مزارع بنجاح طلب حجز لفترة متاحة تحت حساب الزبون. تعتمد حالة التأكيد على نجاح الدفع، وعند الاقتضاء، موافقة المالك.',
      'تلخّص شروط الحجز عند إتمام الدفع السعر والمبلغ المستحق فوراً والرصيد وإشارات الإلغاء؛ وهي تكمّل هذه الشروط وسياسة الإلغاء والاسترداد ولا تحل محلها.',
    ],
  },
  {
    id: 'instant-approval',
    n: 11,
    titleEn: 'Owner approval and instant booking',
    titleAr: 'موافقة المالك والحجز الفوري',
    paragraphsEn: [
      'Some Properties confirm after successful Deposit or full payment (instant booking). Others require Owner acceptance first. Until acceptance, Mazare3 does not collect a Deposit for that request.',
      'If the Owner declines or does not respond in time, the request ends without payment capture. If they accept, the Customer must pay the required amount to confirm.',
    ],
    paragraphsAr: [
      'بعض العقارات تتأكد بعد عربون أو دفع كامل ناجح (حجز فوري). وأخرى تتطلب قبول المالك أولاً. حتى القبول لا تجمع مزارع عربوناً لذلك الطلب.',
      'إذا رفض المالك أو لم يرد في الوقت المحدد ينتهي الطلب دون تحصيل. وإذا قبل يجب على الزبون دفع المبلغ المطلوب للتأكيد.',
    ],
  },
  {
    id: 'payments',
    n: 12,
    titleEn: 'Payments',
    titleAr: 'المدفوعات',
    paragraphsEn: [
      'Mazare3 facilitates payments through a payment service provider ({{psp}}). Card PAN/CVV are entered with the PSP; Mazare3 stores payment metadata such as amounts, currency, status, method, and provider references — not full card PAN.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: who is merchant of record for card transactions --> Returning from a browser payment page is not itself confirmation. Mazare3 treats payment as successful after it reconciles a trusted PSP authorisation/result with the Booking.',
      'Available methods are only those shown at checkout for that Booking.',
    ],
    paragraphsAr: [
      'تسهّل مزارع المدفوعات عبر مزود خدمة دفع ({{psp}}). تُدخل بيانات البطاقة لدى مزود الدفع؛ وتخزّن مزارع بيانات وصفية للدفع مثل المبالغ والعملة والحالة والطريقة ومراجع المزود — وليس رقم البطاقة الكامل.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: من هو التاجر المسجّل لمعاملات البطاقة --> العودة من صفحة الدفع في المتصفح ليست تأكيداً بذاتها. تعامل مزارع الدفع ناجحاً بعد مطابقة تفويض/نتيجة موثوقة من مزود الدفع مع الحجز.',
      'الطرق المتاحة هي فقط الظاهرة عند إتمام الدفع لذلك الحجز.',
    ],
  },
  {
    id: 'deposit-balance',
    n: 13,
    titleEn: 'Deposit and balance',
    titleAr: 'العربون والرصيد المتبقي',
    paragraphsEn: [
      'Timing uses the actual booking period start in Asia/Amman.',
      'If the Booking starts in more than {{FULL_PAYMENT_WITHIN_HOURS}} hours, the Customer may choose a {{DEPOSIT_PERCENT}}% Deposit or full payment. If the Booking starts in {{FULL_PAYMENT_WITHIN_HOURS}} hours or less, 100% payment is required.',
      'For Deposit bookings, the Balance is due no later than {{BALANCE_DUE_HOURS_BEFORE_START}} hours before actual start. If unpaid at that deadline, the Booking may be auto-cancelled, the captured Deposit retained, no additional cancellation money collected beyond captured funds, and the slot released.',
    ],
    paragraphsAr: [
      'يعتمد التوقيت على بداية فترة الحجز الفعلية بتوقيت Asia/Amman.',
      'إذا بدأت فترة الحجز بعد أكثر من {{FULL_PAYMENT_WITHIN_HOURS}} ساعة، يجوز للزبون اختيار عربون {{DEPOSIT_PERCENT}}٪ أو الدفع الكامل. وإذا كانت البداية خلال {{FULL_PAYMENT_WITHIN_HOURS}} ساعة أو أقل، يُطلب الدفع بنسبة 100٪.',
      'لحجوزات العربون، يُستحق الرصيد المتبقي قبل {{BALANCE_DUE_HOURS_BEFORE_START}} ساعة من البداية الفعلية على الأكثر. إذا لم يُدفع عند الموعد، قد يُلغى الحجز تلقائياً ويُحتفظ بالعربون المحصّل دون جمع مبالغ إلغاء إضافية فوق المحصّل، وتُحرَّر الفترة.',
    ],
  },
  {
    id: 'customer-cancellation',
    n: 14,
    titleEn: 'Customer cancellation',
    titleAr: 'إلغاء الزبون',
    paragraphsEn: [
      'Customer cancellation of a confirmed paid Booking before start follows the Cancellation & Refund Policy. Charges as a percentage of merchant booking value:',
    ],
    paragraphsAr: [
      'يتبع إلغاء الزبون لحجز مؤكد مدفوع قبل البداية سياسة الإلغاء والاسترداد. الرسوم كنسبة من قيمة الحجز للشريك:',
    ],
    bulletsEn: [
      'More than {{CANCELLATION_FREE_UNTIL_HOURS}} hours before start: 0% charge (full refund of captured funds).',
      'More than {{CANCELLATION_CHARGE_30_UNTIL_HOURS}} and up to {{CANCELLATION_FREE_UNTIL_HOURS}} hours: {{CANCELLATION_CHARGE_PERCENT_TIER_30}}% charge.',
      'More than {{CANCELLATION_CHARGE_50_UNTIL_HOURS}} and up to {{CANCELLATION_CHARGE_30_UNTIL_HOURS}} hours: {{CANCELLATION_CHARGE_PERCENT_TIER_50}}% charge.',
      '{{CANCELLATION_CHARGE_50_UNTIL_HOURS}} hours or less before start: {{CANCELLATION_CHARGE_PERCENT_TIER_100}}% charge.',
      'After booking start: ordinary pre-arrival cancellation is unavailable; no-show / incident / dispute processes apply as relevant.',
    ],
    bulletsAr: [
      'أكثر من {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة قبل البداية: رسوم 0٪ (استرداد كامل للمحصّل).',
      'أكثر من {{CANCELLATION_CHARGE_30_UNTIL_HOURS}} وحتى {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة: رسوم {{CANCELLATION_CHARGE_PERCENT_TIER_30}}٪.',
      'أكثر من {{CANCELLATION_CHARGE_50_UNTIL_HOURS}} وحتى {{CANCELLATION_CHARGE_30_UNTIL_HOURS}} ساعة: رسوم {{CANCELLATION_CHARGE_PERCENT_TIER_50}}٪.',
      '{{CANCELLATION_CHARGE_50_UNTIL_HOURS}} ساعة أو أقل قبل البداية: رسوم {{CANCELLATION_CHARGE_PERCENT_TIER_100}}٪.',
      'بعد بداية الحجز: الإلغاء العادي قبل الوصول غير متاح؛ تُطبَّق إجراءات عدم الحضور / الحوادث / النزاعات حسب الحالة.',
    ],
  },
  {
    id: 'owner-cancellation',
    n: 15,
    titleEn: 'Owner cancellation',
    titleAr: 'إلغاء المالك',
    paragraphsEn: [
      'If an Owner cancels a confirmed Booking they caused, the Customer receives a 100% refund of captured booking payments, Owner payout for that Booking is zero, and a reliability incident may apply.',
      'Owner financial penalty (settlement adjustment — not an automatic card charge): 0% if more than {{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}} hours before start; {{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}% of merchant booking value between {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}} and {{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}} hours; {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}% if {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}} hours or less; {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}% for confirmed Owner no-show or unjustified denied access. Penalty is clamped between {{OWNER_PENALTY_MIN_JOD}} JOD and {{OWNER_PENALTY_MAX_JOD}} JOD and may be deducted from future eligible settlement. Force majeure: no Owner penalty.',
    ],
    paragraphsAr: [
      'إذا ألغى المالك حجزاً مؤكداً لسبب يرجع إليه، يسترد الزبون 100٪ من مدفوعات الحجز المحصّلة، ويكون صرف المالك لذلك الحجز صفراً، وقد تُسجَّل حادثة موثوقية.',
      'الغرامة المالية على المالك (تعديل تسوية — وليست خصماً تلقائياً من البطاقة): 0٪ إذا بقي أكثر من {{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}} ساعة؛ و{{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}٪ من قيمة الحجز للشريك بين {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}} و{{OWNER_CANCEL_PENALTY_FREE_UNTIL_HOURS}} ساعة؛ و{{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}٪ إذا بقي {{OWNER_CANCEL_PENALTY_TIER_10_UNTIL_HOURS}} ساعة أو أقل؛ و{{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}٪ لعدم حضور المالك المؤكد أو منع الوصول غير المبرر. تُقيَّد الغرامة بين {{OWNER_PENALTY_MIN_JOD}} و{{OWNER_PENALTY_MAX_JOD}} د.أ وقد تُخصم من تسوية لاحقة مستحقة. القوة القاهرة: لا غرامة على المالك.',
    ],
  },
  {
    id: 'no-show',
    n: 16,
    titleEn: 'No-show',
    titleAr: 'عدم الحضور',
    paragraphsEn: [
      'Customer no-show may be finalised only after booking start plus a {{CUSTOMER_NO_SHOW_GRACE_MINUTES}}-minute grace period, when payment conditions are met, check-in was not verified, and no Owner-fault case is open. Owners may report; admin confirmation is required. Confirmed Customer no-show: Customer refund = 0; Owner receives normal eligible earnings; Mazare3 receives normal snapshotted commission.',
      'Confirmed Owner no-show or unjustified denied access: Customer = 100% refund of captured payments; Owner payout = 0; Owner penalty as above; reliability incident; platform does not retain normal commission on the refunded booking value.',
    ],
    paragraphsAr: [
      'قد يُعتمد عدم حضور الزبون فقط بعد بداية الحجز مضافاً إليها فترة سماح {{CUSTOMER_NO_SHOW_GRACE_MINUTES}} دقيقة، عند استيفاء شروط الدفع وعدم تحقق تسجيل الوصول وعدم وجود حالة خطأ منسوبة للمالك. يجوز للمالك الإبلاغ؛ ويُشترط تأكيد الإدارة. عند التأكيد: استرداد الزبون = 0؛ ويتلقى المالك أرباحه المستحقة العادية؛ وتتلقى مزارع العمولة الملتقطة عادة.',
      'عدم حضور المالك المؤكد أو منع الوصول غير المبرر: الزبون = استرداد 100٪ للمحصّل؛ صرف المالك = 0؛ غرامة المالك كما ورد؛ حادثة موثوقية؛ ولا تحتفظ المنصة بالعمولة العادية على قيمة الحجز المستردة.',
    ],
  },
  {
    id: 'check-in',
    n: 17,
    titleEn: 'Check-in',
    titleAr: 'تسجيل الوصول',
    paragraphsEn: [
      'Mazare3 may provide a one-time check-in PIN/code as arrival/handover evidence. It typically becomes available {{CHECK_IN_OPEN_HOURS_BEFORE_START}} hours before start and expires {{CHECK_IN_EXPIRE_MINUTES_AFTER_START}} minutes after start (product rules).',
      'Check-in proves arrival/handover only. It does not prove property quality, cleanliness, that every amenity worked, or absence of later problems. No GPS check-in requirement currently exists.',
    ],
    paragraphsAr: [
      'قد توفر مزارع رمزاً لمرة واحدة لتسجيل الوصول كدليل وصول/تسليم. يتاح عادة قبل {{CHECK_IN_OPEN_HOURS_BEFORE_START}} ساعة من البداية وينتهي بعد {{CHECK_IN_EXPIRE_MINUTES_AFTER_START}} دقيقة من البداية (وفق قواعد المنتج).',
      'يثبت تسجيل الوصول الوصول/التسليم فقط. ولا يثبت جودة العقار أو النظافة أو عمل كل مرفق أو غياب مشاكل لاحقة. لا يوجد حالياً اشتراط تسجيل وصول عبر GPS.',
    ],
  },
  {
    id: 'rescheduling',
    n: 18,
    titleEn: 'Rescheduling',
    titleAr: 'إعادة الجدولة',
    paragraphsEn: [
      'Neither party may unilaterally change a confirmed Booking. Customer-requested reschedule requires Owner acceptance and is normally limited to {{MAX_CUSTOMER_RESCHEDULES}} successful customer-requested reschedule per Booking. Counterparty response windows may expire (for example {{RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS}} hours under product rules).',
      'Customer-initiated: same price → no adjustment; higher → Customer pays accepted difference before finalisation; lower → eligible difference refunded. Owner-initiated: Customer cannot be forced to pay more merely because the Owner requested the move; higher replacement list price is absorbed per system rules; cheaper replacement may create an eligible refund.',
      'Rescheduling must not reset the cancellation clock in a way that softens policy after a customer-requested change. Force-majeure/admin exceptions follow system exemptions.',
    ],
    paragraphsAr: [
      'لا يجوز لأي طرف تغيير حجز مؤكد من طرف واحد. إعادة الجدولة بطلب الزبون تتطلب قبول المالك وتُحدَّ عادة بـ {{MAX_CUSTOMER_RESCHEDULES}} إعادة جدولة ناجحة بطلب الزبون لكل حجز. قد تنتهي نوافذ رد الطرف الآخر (مثلاً {{RESCHEDULE_COUNTERPARTY_EXPIRE_HOURS}} ساعة وفق قواعد المنتج).',
      'بمبادرة الزبون: نفس السعر → بلا تعديل؛ أعلى → يدفع الزبون الفرق المقبول قبل الإتمام؛ أدنى → يُسترد الفرق المستحق. بمبادرة المالك: لا يُفرض على الزبون دفع مبلغ أعلى لمجرد طلب النقل؛ ويُستوعب السعر الأعلى البديل وفق قواعد النظام؛ والسعر الأرخص قد ينشئ استرداداً مستحقاً.',
      'لا يجوز استخدام إعادة الجدولة لإعادة ضبط ساعة الإلغاء بطريقة تُليّن السياسة بعد تغيير بطلب الزبون. استثناءات القوة القاهرة/الإدارة تتبع إعفاءات النظام.',
    ],
  },
  {
    id: 'force-majeure',
    n: 19,
    titleEn: 'Force majeure',
    titleAr: 'القوة القاهرة',
    paragraphsEn: [
      'Force majeure covers objectively extraordinary circumstances outside reasonable control, subject to Mazare3 review and evidence (for example official closure, officially documented dangerous weather, official road/access closure, natural disaster, or an event rendering the Property objectively unusable). Ordinary rain, preference changes, or inconvenience do not automatically qualify.',
      'Possible outcomes: free/equivalent reschedule or full refund where the Booking cannot reasonably proceed. Owner penalty = 0 for genuine force majeure. Mazare3 does not promise external cash compensation beyond applicable refunds/reschedules.',
    ],
    paragraphsAr: [
      'تشمل القوة القاهرة ظروفاً استثنائية موضوعية خارج السيطرة المعقولة، خاضعة لمراجعة مزارع والأدلة (مثل إغلاق رسمي، طقس خطر موثّق رسمياً، إغلاق طريق/وصول رسمي، كارثة طبيعية، أو حدث يجعل العقار غير قابل للاستخدام موضوعياً). المطر العادي أو تغيّر الرغبة أو الإزعاج لا يُعدّ تلقائياً قوة قاهرة.',
      'النتائج المحتملة: إعادة جدولة مجانية/مكافئة أو استرداد كامل عندما يتعذّر المضي في الحجز بشكل معقول. غرامة المالك = 0 للقوة القاهرة الحقيقية. لا تعد مزارع بتعويض نقدي خارجي يتجاوز الاسترداد/إعادة الجدولة المعمول بهما.',
    ],
  },
  {
    id: 'refunds',
    n: 20,
    titleEn: 'Refunds',
    titleAr: 'الاستردادات',
    paragraphsEn: [
      'Cancellation never causes Mazare3 to collect money that was not already captured merely to satisfy a cancellation percentage. Retained = min(captured booking payment, applicable policy charge). Refund = captured − retained (when positive).',
      'Refunds use Mazare3’s durable refund / PSP process. Actual bank or card posting time may depend on the PSP and card issuer. Mazare3 does not promise an unsupported fixed arrival date for refunded funds.',
      'These Terms do not state that all payments are non-refundable.',
    ],
    paragraphsAr: [
      'لا يؤدي الإلغاء إلى جمع مزارع مالاً لم يُحصَّل أصلاً لمجرد استيفاء نسبة إلغاء. المحتفظ = الحد الأدنى بين مدفوعات الحجز المحصّلة ورسوم السياسة. الاسترداد = المحصّل − المحتفظ (عند الإيجاب).',
      'تتم الاستردادات عبر عملية الاسترداد المستدامة / مزود الدفع. قد يعتمد ظهور المبلغ في البنك أو البطاقة على مزود الدفع ومصدر البطاقة. لا تعد مزارع بموعد وصول ثابت غير مدعوم للأموال المستردة.',
      'لا تنص هذه الشروط على أن جميع المدفوعات غير قابلة للاسترداد.',
    ],
  },
  {
    id: 'property-access',
    n: 21,
    titleEn: 'Property access',
    titleAr: 'الوصول إلى العقار',
    paragraphsEn: [
      'Owners must provide accurate access arrangements for confirmed eligible Bookings. Customers must follow published house rules, guest limits, and check-in instructions.',
      'Mazare3 is not on site and does not physically open Properties.',
    ],
    paragraphsAr: [
      'يجب على المالكين توفير ترتيبات وصول دقيقة للحجوزات المؤكدة المؤهلة. ويجب على الزبائن اتباع قواعد البيت المنشورة وحدود الضيوف وتعليمات تسجيل الوصول.',
      'مزارع ليست في الموقع ولا تفتح العقارات مادياً.',
    ],
  },
  {
    id: 'customer-conduct',
    n: 22,
    titleEn: 'Customer conduct',
    titleAr: 'سلوك الزبون',
    paragraphsEn: [
      'Customers must use Properties lawfully, respect neighbours and house rules, and not engage in harassment, illegal activity, or damage. Owners may refuse entry or end a stay for serious rule breaches consistent with applicable law; disputes may be reviewed by Mazare3 support.',
    ],
    paragraphsAr: [
      'يجب على الزبائن استخدام العقارات بشكل قانوني واحترام الجيران وقواعد البيت وعدم الإساءة أو النشاط غير القانوني أو الإضرار. يجوز للمالك رفض الدخول أو إنهاء الإقامة عند مخالفات جسيمة بما يتوافق مع القانون المعمول به؛ وقد تراجع مزارع النزاعات عبر الدعم.',
    ],
  },
  {
    id: 'owner-rules',
    n: 23,
    titleEn: 'Owner and property rules',
    titleAr: 'قواعد المالك والعقار',
    paragraphsEn: [
      'Owners must keep listings accurate, honour confirmed Bookings, maintain reasonable safety and cleanliness standards they represent, and comply with permits/licences that apply to their Property. Discrimination or unlawful refusal of service is prohibited to the extent forbidden by applicable law. <!-- REQUIRES JORDANIAN LEGAL REVIEW: discrimination / public accommodation framing -->',
    ],
    paragraphsAr: [
      'يجب على المالكين الإبقاء على دقة الإعلانات والالتزام بالحجوزات المؤكدة والحفاظ على معايير سلامة ونظافة معقولة كما يعرضونها، والامتثال للتراخيص/التصاريح المنطبقة على عقارهم. يُحظر التمييز أو الرفض غير المشروع للخدمة بالقدر الذي يمنعه القانون المعمول به. <!-- REQUIRES JORDANIAN LEGAL REVIEW: صياغة التمييز / المرافق العامة -->',
    ],
  },
  {
    id: 'damage',
    n: 24,
    titleEn: 'Damage and responsibility',
    titleAr: 'الضرر والمسؤولية',
    paragraphsEn: [
      'Mazare3 does not operate a platform damage-deposit hold system in the current product. Customers remain responsible under applicable law for damage they cause; Owners remain responsible for their Property and representations. Claims may be handled between the parties with Mazare3 support facilitation where appropriate. These Terms do not invent a damage-deposit scheme.',
    ],
    paragraphsAr: [
      'لا تشغّل مزارع نظام احتجاز عربون ضرر على المنصة في المنتج الحالي. يبقى الزبون مسؤولاً بموجب القانون المعمول به عن الضرر الذي يسببه؛ ويبقى المالك مسؤولاً عن عقاره وما يعرضه. قد تُعالَج المطالبات بين الطرفين مع تسهيل دعم مزارع عند الاقتضاء. لا تخترع هذه الشروط نظام عربون ضرر.',
    ],
  },
  {
    id: 'reviews',
    n: 25,
    titleEn: 'Reviews and content',
    titleAr: 'المراجعات والمحتوى',
    paragraphsEn: [
      'Eligible Customers may leave ratings/comments under the Community & Review Policy. Mazare3 may moderate, hide, or remove content that violates policy. Mazare3 does not promise independent fact-checking of every review statement.',
    ],
    paragraphsAr: [
      'يجوز للزبائن المؤهلين ترك تقييمات/تعليقات وفق سياسة المجتمع والمراجعات. يجوز لمزارع تعديل أو إخفاء أو إزالة محتوى يخالف السياسة. لا تعد مزارع بالتحقق المستقل من كل عبارة في المراجعات.',
    ],
  },
  {
    id: 'verification',
    n: 26,
    titleEn: 'Verification',
    titleAr: 'التحقق',
    paragraphsEn: [
      '“Verified by Mazare3” / “تم التحقق بواسطة Mazare3” applies only when Property.verificationStatus === platform_verified. It reflects Mazare3’s platform review process. It is not government certification and is not an absolute guarantee of condition, safety, licensing, identity, or future performance. See the Verification Policy.',
    ],
    paragraphsAr: [
      'تُستخدم عبارة «تم التحقق بواسطة Mazare3» / “Verified by Mazare3” فقط عندما تكون حالة التحقق platform_verified. وتعكس عملية مراجعة منصة مزارع. وليست شهادة حكومية وليست ضماناً مطلقاً للحالة أو السلامة أو الترخيص أو الهوية أو الأداء المستقبلي. راجع سياسة التحقق.',
    ],
  },
  {
    id: 'prohibited',
    n: 27,
    titleEn: 'Prohibited and fraudulent use',
    titleAr: 'الاستخدام المحظور والاحتيالي',
    paragraphsEn: [
      'You must not use Mazare3 to commit fraud, test stolen cards, scrape listings unlawfully, harass users, manipulate reviews, misrepresent identity or Property rights, or interfere with platform security. Mazare3 may cancel Bookings, withhold settlement where permitted by policy, and restrict accounts in such cases, to the extent permitted by applicable law.',
    ],
    paragraphsAr: [
      'يُحظر استخدام مزارع للاحتيال أو اختبار بطاقات مسروقة أو استخراج الإعلانات بشكل غير مشروع أو مضايقة المستخدمين أو التلاعب بالمراجعات أو التضليل في الهوية أو حقوق العقار أو الإضرار بأمن المنصة. يجوز لمزارع إلغاء الحجوزات ووقف التسوية حيث تسمح السياسة وتقييد الحسابات في تلك الحالات، بالقدر الذي يسمح به القانون المعمول به.',
    ],
  },
  {
    id: 'suspension',
    n: 28,
    titleEn: 'Account suspension and termination',
    titleAr: 'إيقاف الحساب وإنهاؤه',
    paragraphsEn: [
      'Mazare3 may suspend or terminate access for material breach, fraud risk, or legal requirement. You may stop using Mazare3 and request account closure subject to retention needed for bookings, payments, disputes, and legal obligations. Confirmed Booking obligations survive termination to the extent required to complete or lawfully unwind those Bookings.',
    ],
    paragraphsAr: [
      'يجوز لمزارع إيقاف أو إنهاء الوصول عند مخالفة جوهرية أو مخاطر احتيال أو متطلب قانوني. يمكنك التوقف عن استخدام مزارع وطلب إغلاق الحساب مع مراعاة الاحتفاظ اللازم للحجوزات والمدفوعات والنزاعات والالتزامات القانونية. تبقى التزامات الحجوزات المؤكدة سارية بعد الإنهاء بالقدر اللازم لإتمامها أو تسويتها قانوناً.',
    ],
  },
  {
    id: 'support-disputes',
    n: 29,
    titleEn: 'Support and disputes',
    titleAr: 'الدعم والنزاعات',
    paragraphsEn: [
      'Use in-product support channels and My bookings for reservation issues. Mazare3 may request evidence for incidents (no-show, access denied, force majeure, damage claims). Platform decisions on policy application are operational; they do not waive mandatory consumer rights.',
    ],
    paragraphsAr: [
      'استخدم قنوات الدعم داخل المنتج و«حجوزاتي» لمسائل الحجز. قد تطلب مزارع أدلة للحوادث (عدم الحضور، منع الوصول، القوة القاهرة، مطالبات الضرر). قرارات المنصة بشأن تطبيق السياسة تشغيلية؛ ولا تُسقط الحقوق الإلزامية للمستهلك.',
    ],
  },
  {
    id: 'availability',
    n: 30,
    titleEn: 'Platform service availability',
    titleAr: 'توفر خدمة المنصة',
    paragraphsEn: [
      'Mazare3 aims for reliable availability but does not warrant uninterrupted or error-free service. Maintenance, outages, or third-party failures may occur. To the extent permitted by applicable law, Mazare3 is not liable for delays caused solely by circumstances outside its reasonable control.',
    ],
    paragraphsAr: [
      'تسعى مزارع لتوفر موثوق لكنها لا تضمن خدمة بلا انقطاع أو بلا أخطاء. قد تحدث صيانة أو انقطاعات أو أعطال لدى أطراف ثالثة. بالقدر الذي يسمح به القانون المعمول به، لا تتحمل مزارع المسؤولية عن تأخيرات ناتجة فقط عن ظروف خارج سيطرتها المعقولة.',
    ],
  },
  {
    id: 'ip',
    n: 31,
    titleEn: 'Intellectual property',
    titleAr: 'الملكية الفكرية',
    paragraphsEn: [
      'Mazare3 branding, software, and platform content are owned by {{pe}} or its licensors. Owners grant Mazare3 a licence to host and display listing content they upload for marketplace operation. Users must not copy platform materials except as allowed by law or written permission.',
    ],
    paragraphsAr: [
      'علامات مزارع والبرمجيات ومحتوى المنصة مملوكة لـ {{pe}} أو مرخّصيها. يمنح المالكون مزارع ترخيصاً لاستضافة وعرض محتوى الإعلان الذي يرفعونه لتشغيل السوق. يجب على المستخدمين عدم نسخ مواد المنصة إلا بما يسمح به القانون أو إذن كتابي.',
    ],
  },
  {
    id: 'third-parties',
    n: 32,
    titleEn: 'Third-party services and payment providers',
    titleAr: 'خدمات الأطراف الثالثة ومزودو الدفع',
    paragraphsEn: [
      'Mazare3 uses processors such as database hosting (Neon), object storage (Cloudflare R2 for public media and private KYC where configured), PSP ({{psp}} / PayTabs integration as configured), and Google OAuth for login where enabled. Those providers process data under their roles as described in the Privacy Policy.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: contractual payment intermediary vs merchant-of-record characterisation -->',
    ],
    paragraphsAr: [
      'تستخدم مزارع معالجين مثل استضافة قاعدة البيانات (Neon) وتخزين الكائنات (Cloudflare R2 للوسائط العامة ومستندات التحقق الخاصة عند التهيئة) ومزود الدفع ({{psp}} / تكامل PayTabs حسب التهيئة) وGoogle OAuth لتسجيل الدخول عند التفعيل. يعالج هؤلاء المزودون البيانات وفق أدوارهم كما في سياسة الخصوصية.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: تكييف وسيط الدفع التعاقدي مقابل التاجر المسجّل -->',
    ],
  },
  {
    id: 'privacy',
    n: 33,
    titleEn: 'Privacy',
    titleAr: 'الخصوصية',
    paragraphsEn: [
      'Personal Data is processed as described in the Privacy Policy. Privacy acknowledgement at signup is not marketing consent. Optional purposes (marketing, optional cookies/analytics) require separate consent where applicable.',
    ],
    paragraphsAr: [
      'تُعالَج البيانات الشخصية كما هو موضح في سياسة الخصوصية. الإقرار بالخصوصية عند التسجيل ليس موافقة تسويقية. الأغراض الاختيارية (التسويق وملفات الارتباط/التحليلات الاختيارية) تتطلب موافقة منفصلة عند الاقتضاء.',
    ],
  },
  {
    id: 'liability',
    n: 34,
    titleEn: 'Limitation of liability',
    titleAr: 'حدود المسؤولية',
    paragraphsEn: [
      'To the extent permitted by applicable law, Mazare3 is not liable for Owner acts or omissions, Property condition beyond Mazare3’s platform obligations, or indirect/consequential losses that are not reasonably foreseeable.',
      'Nothing in these Terms excludes or limits liability that cannot be excluded or limited under Jordanian mandatory law, including liability for fraud or gross negligence where such limitation is forbidden.',
    ],
    paragraphsAr: [
      'بالقدر الذي يسمح به القانون المعمول به، لا تتحمل مزارع المسؤولية عن أفعال أو إغفال المالك، أو حالة العقار بما يتجاوز التزامات المنصة، أو الخسائر غير المباشرة/التبعية غير المتوقعة بشكل معقول.',
      'لا يستبعد أو يحدّ أي بند في هذه الشروط مسؤولية لا يجوز استبعادها أو تقييدها بموجب القانون الأردني الإلزامي، بما في ذلك مسؤولية الاحتيال أو الإهمال الجسيم حيث يُحظر ذلك التقييد.',
    ],
  },
  {
    id: 'consumer-rights',
    n: 35,
    titleEn: 'Consumer statutory rights preserved',
    titleAr: 'حفظ الحقوق النظامية للمستهلك',
    paragraphsEn: [
      'Nothing in these Terms is intended to waive mandatory rights of consumers under Jordanian Consumer Protection Law No. 7 of 2017 or other mandatory protections. If a term is unfair or unenforceable under mandatory law, it is modified to the minimum extent necessary or severed.',
    ],
    paragraphsAr: [
      'لا يُقصد بأي بند في هذه الشروط التنازل عن الحقوق الإلزامية للمستهلكين بموجب قانون حماية المستهلك الأردني رقم 7 لسنة 2017 أو أي حماية إلزامية أخرى. إذا كان بنداً مجحفاً أو غير قابل للتنفيذ بموجب القانون الإلزامي، يُعدَّل بالحد الأدنى اللازم أو يُفصل.',
    ],
  },
  {
    id: 'indemnity',
    n: 36,
    titleEn: 'Indemnity',
    titleAr: 'التعويض',
    paragraphsEn: [
      'To the extent permitted by applicable law, you agree to indemnify Mazare3 against reasonable losses arising from your material breach of these Terms, your unlawful content, or your fraud — except to the extent caused by Mazare3’s own wilful misconduct or gross negligence. <!-- REQUIRES JORDANIAN LEGAL REVIEW: enforceability of indemnity vs consumers/owners -->',
    ],
    paragraphsAr: [
      'بالقدر الذي يسمح به القانون المعمول به، توافق على تعويض مزارع عن خسائر معقولة ناشئة عن مخالفتك الجوهرية لهذه الشروط أو محتواك غير المشروع أو احتيالك — باستثناء ما ينجم عن سوء سلوك مزارع العمدي أو إهمالها الجسيم. <!-- REQUIRES JORDANIAN LEGAL REVIEW: قابلية تنفيذ التعويض تجاه المستهلكين/المالكين -->',
    ],
  },
  {
    id: 'changes',
    n: 37,
    titleEn: 'Changes to Terms and versioning',
    titleAr: 'تعديل الشروط وإصداراتها',
    paragraphsEn: [
      'Mazare3 may publish updated Terms under a new version. Material changes may require re-acceptance. Updates do not retroactively change commercial economics snapshotted for already-confirmed Bookings, except where required by law or expressly agreed for a specific Booking.',
    ],
    paragraphsAr: [
      'يجوز لمزارع نشر شروط محدَّثة بإصدار جديد. قد تتطلب التغييرات الجوهرية إعادة القبول. لا تغيّر التحديثات بأثر رجعي الاقتصاديات التجارية الملتقطة لحجوزات مؤكدة سابقاً، إلا حيث يقتضي القانون أو يُتفق صراحة لحجز معيّن.',
    ],
  },
  {
    id: 'electronic',
    n: 38,
    titleEn: 'Electronic communications and records',
    titleAr: 'المراسلات والسجلات الإلكترونية',
    paragraphsEn: [
      'You consent to receive notices electronically (in-product, email where configured). Electronic records of acceptances, Bookings, and payments are intended to have effect under Jordan’s Electronic Transactions Law framework as applicable. <!-- REQUIRES JORDANIAN LEGAL REVIEW: ETL 15/2015 as amended by Law 1/2026 application -->',
    ],
    paragraphsAr: [
      'توافق على تلقي الإشعارات إلكترونياً (داخل المنتج، والبريد عند التهيئة). يُقصد بالسجلات الإلكترونية للقبولات والحجوزات والمدفوعات أن يكون لها أثر بموجب إطار قانون المعاملات الإلكترونية الأردني حسب انطباقه. <!-- REQUIRES JORDANIAN LEGAL REVIEW: تطبيق قانون المعاملات الإلكترونية 15/2015 المعدّل بالقانون 1/2026 -->',
    ],
  },
  {
    id: 'governing-law',
    n: 39,
    titleEn: 'Governing law',
    titleAr: 'القانون الحاكم',
    paragraphsEn: [
      'These Terms are governed by the laws of the Hashemite Kingdom of Jordan, without prejudice to mandatory consumer protections that apply.',
    ],
    paragraphsAr: [
      'تخضع هذه الشروط لقوانين المملكة الأردنية الهاشمية، دون الإخلال بالحمايات الإلزامية للمستهلك التي تنطبق.',
    ],
  },
  {
    id: 'forum',
    n: 40,
    titleEn: 'Dispute and forum provision',
    titleAr: 'تسوية النزاعات والاختصاص',
    paragraphsEn: [
      'Parties should first attempt good-faith resolution via Mazare3 support. <!-- REQUIRES JORDANIAN LEGAL REVIEW: exclusive courts, arbitration, and consumer venue rules --> Subject to mandatory law, disputes may be submitted to the competent courts of Jordan. Final forum language requires Jordanian legal review.',
    ],
    paragraphsAr: [
      'ينبغي للطرفين أولاً محاولة التسوية بحسن نية عبر دعم مزارع. <!-- REQUIRES JORDANIAN LEGAL REVIEW: المحاكم الحصرية والتحكيم وقواعد مقر المستهلك --> مع مراعاة القانون الإلزامي، يجوز عرض النزاعات على المحاكم الأردنية المختصة. الصياغة النهائية للاختصاص تتطلب مراجعة قانونية أردنية.',
    ],
  },
  {
    id: 'severability',
    n: 41,
    titleEn: 'Severability',
    titleAr: 'قابلية الفصل',
    paragraphsEn: [
      'If any provision is held invalid or unenforceable, the remaining provisions continue in effect, and the invalid provision is modified to the minimum extent necessary to make it valid.',
    ],
    paragraphsAr: [
      'إذا تبيّن بطلان أو عدم قابلية تنفيذ أي حكم، تبقى الأحكام الأخرى سارية، ويُعدَّل الحكم الباطل بالحد الأدنى اللازم ليصبح صالحاً.',
    ],
  },
  {
    id: 'contact',
    n: 42,
    titleEn: 'Contact',
    titleAr: 'التواصل',
    paragraphsEn: [
      'Operator: {{pe}}. Commercial registration: {{cr}}. Registered address: {{addr}}. Legal contact: {{legalEmail}}. Privacy contact: {{privacyEmail}}. DPO / privacy contact: {{dpo}}.',
      'FOUNDER INPUT REQUIRED for all [[PLACEHOLDER]] fields above. Use the Contact page and account support tools when published details exist.',
    ],
    paragraphsAr: [
      'المشغّل: {{pe}}. السجل التجاري: {{cr}}. العنوان المسجّل: {{addr}}. التواصل القانوني: {{legalEmail}}. تواصل الخصوصية: {{privacyEmail}}. مسؤول حماية البيانات / تواصل الخصوصية: {{dpo}}.',
      'يُطلب إدخال المؤسس لجميع حقول [[PLACEHOLDER]] أعلاه. استخدم صفحة التواصل وأدوات الدعم في الحساب عند توفر بيانات منشورة.',
    ],
  },
];

writeDoc(
  'terms-and-conditions.ts',
  'termsAndConditions',
  'terms_and_conditions',
  'Terms & Conditions',
  'الشروط والأحكام',
  'These Terms govern use of the Mazare3 marketplace (Mazare3 Jordan / مزارع الأردن) operated by {{pe}}. Launch-candidate text — not counsel-approved.',
  'تحكم هذه الشروط استخدام سوق مزارع (مزارع الأردن) الذي يشغّله {{pe}}. نص مرشّح للإطلاق — غير معتمد من المستشار القانوني.',
  termsSections,
);

// ========== PRIVACY ==========
const privacySections = [
  {
    id: 'controller',
    n: 1,
    titleEn: 'Who controls your data',
    titleAr: 'من يتحكم ببياناتك',
    paragraphsEn: [
      'The data controller for Mazare3 personal data processing is {{pe}}, registered address {{addr}}, commercial registration {{cr}}. Privacy contact: {{privacyEmail}}. DPO or privacy contact: {{dpo}}.',
      'Mazare3 Jordan / مزارع الأردن is the product name. <!-- REQUIRES JORDANIAN LEGAL REVIEW: controller identity once founder fields are filled; PDPL registration / DPO accreditation triggers -->',
    ],
    paragraphsAr: [
      'المتحكم بالبيانات الشخصية لمعالجة مزارع هو {{pe}}، العنوان المسجّل {{addr}}، السجل التجاري {{cr}}. تواصل الخصوصية: {{privacyEmail}}. مسؤول حماية البيانات أو تواصل الخصوصية: {{dpo}}.',
      'مزارع الأردن هو اسم المنتج. <!-- REQUIRES JORDANIAN LEGAL REVIEW: هوية المتحكم بعد تعبئة حقول المؤسس؛ ومتطلبات التسجيل/تعيين مسؤول حماية البيانات -->',
    ],
  },
  {
    id: 'scope',
    n: 2,
    titleEn: 'Who this policy covers',
    titleAr: 'من تشملهم هذه السياسة',
    paragraphsEn: [
      'This Privacy Policy covers Customers, Owners/Partners, and visitors of the public website who interact with Mazare3 accounts, bookings, listings, payments metadata, check-in, incidents, or support.',
    ],
    paragraphsAr: [
      'تغطي سياسة الخصوصية هذه الزبائن والمالكين/الشركاء وزوار الموقع العام الذين يتعاملون مع حسابات مزارع أو الحجوزات أو الإعلانات أو بيانات الدفع الوصفية أو تسجيل الوصول أو الحوادث أو الدعم.',
    ],
  },
  {
    id: 'customer-data',
    n: 3,
    titleEn: 'Customer personal data',
    titleAr: 'بيانات الزبون الشخصية',
    paragraphsEn: ['Depending on use, Mazare3 may process:'],
    paragraphsAr: ['حسب الاستخدام، قد تعالج مزارع:'],
    bulletsEn: [
      'Identity and contact: name, email, phone (where provided).',
      'Account/auth identifiers, password hash (not plaintext), locale/role.',
      'Booking history, favourites, reviews, support communications.',
      'Incident/dispute evidence and check-in records.',
      'Payment transaction metadata (amounts, currency, status, method, PSP references) — not card PAN/CVV.',
    ],
    bulletsAr: [
      'الهوية والتواصل: الاسم والبريد والهاتف (إن وُفر).',
      'معرّفات الحساب/المصادقة وتجزئة كلمة المرور (وليس النص الصريح) واللغة/الدور.',
      'سجل الحجوزات والمفضلة والمراجعات ومراسلات الدعم.',
      'أدلة الحوادث/النزاعات وسجلات تسجيل الوصول.',
      'بيانات معاملات الدفع الوصفية (المبالغ والعملة والحالة والطريقة ومراجع مزود الدفع) — وليس رقم البطاقة/CVV.',
    ],
  },
  {
    id: 'owner-data',
    n: 4,
    titleEn: 'Owner personal and KYC data',
    titleAr: 'بيانات المالك والتحقق (KYC)',
    paragraphsEn: ['For Owners, Mazare3 may process:'],
    paragraphsAr: ['بالنسبة للمالكين، قد تعالج مزارع:'],
    bulletsEn: [
      'Profile and contact details; identity/KYC documents stored in private object storage (Cloudflare R2 private where configured) — not as public listing photos.',
      'Property information, commercial terms, settlement/payout records, bank/IBAN or payout details (encrypted at rest where implemented).',
      'Reliability incidents and support/dispute evidence.',
    ],
    bulletsAr: [
      'بيانات الملف والتواصل؛ ومستندات الهوية/التحقق في تخزين خاص (Cloudflare R2 الخاص عند التهيئة) — وليست صوراً عامة للإعلان.',
      'معلومات العقار والشروط التجارية وسجلات التسوية/الصرف وتفاصيل البنك/الآيبان أو الصرف (مشفّرة عند التخزين حيث طُبّق ذلك).',
      'حوادث الموثوقية وأدلة الدعم/النزاعات.',
    ],
  },
  {
    id: 'technical',
    n: 5,
    titleEn: 'Technical and location data',
    titleAr: 'البيانات التقنية والموقع',
    paragraphsEn: [
      'Technical: session/authentication cookies, security and audit logs, and limited device/browser metadata needed for security and operation.',
      'Location: public approximate listing location; exact address/coordinates and arrival notes are stored for operations and revealed only to an eligible booked Customer under product rules.',
    ],
    paragraphsAr: [
      'تقنياً: ملفات جلسة/مصادقة، وسجلات أمن وتدقيق، وبيانات جهاز/متصفح محدودة لازمة للأمن والتشغيل.',
      'الموقع: موقع تقريبي عام للإعلان؛ العنوان/الإحداثيات الدقيقة وملاحظات الوصول تُحفظ للتشغيل وتُكشف فقط لزبون حجز مؤهل وفق قواعد المنتج.',
    ],
  },
  {
    id: 'sources',
    n: 6,
    titleEn: 'Collection sources',
    titleAr: 'مصادر الجمع',
    paragraphsEn: [
      'We collect data you provide (forms, uploads, messages), data generated by your use (bookings, check-in, logs), and data from processors such as the PSP (payment results), Google OAuth (if you choose that login), and hosting/storage providers.',
    ],
    paragraphsAr: [
      'نجمع بيانات تقدّمها (نماذج، رفع، رسائل)، وبيانات يولّدها استخدامك (حجوزات، تسجيل وصول، سجلات)، وبيانات من معالجين مثل مزود الدفع (نتائج الدفع) وGoogle OAuth (إن اخترت ذلك الدخول) ومزودي الاستضافة/التخزين.',
    ],
  },
  {
    id: 'purposes',
    n: 7,
    titleEn: 'Processing purposes',
    titleAr: 'أغراض المعالجة',
    paragraphsEn: [
      'Purposes include: account creation; marketplace performance (search, booking, messaging); payments and refunds; fraud/security; Owner KYC and commercial onboarding; customer support; Owner settlements; legal obligations; and optional consent-based marketing or analytics if introduced.',
    ],
    paragraphsAr: [
      'تشمل الأغراض: إنشاء الحساب؛ أداء السوق (بحث، حجز، رسائل)؛ المدفوعات والاسترداد؛ الاحتيال/الأمن؛ تحقق المالك والتهيئة التجارية؛ دعم الزبائن؛ تسويات المالك؛ الالتزامات القانونية؛ والتسويق أو التحليلات الاختيارية القائمة على الموافقة إن وُجدت.',
    ],
  },
  {
    id: 'lawful-basis',
    n: 8,
    titleEn: 'Lawful basis framework',
    titleAr: 'إطار الأساس القانوني',
    paragraphsEn: [
      'Mazare3 intends to rely on bases compatible with Jordan PDPL No. 24 of 2013/2023 framework as applicable — typically contract performance for accounts/bookings/payments, legitimate interests or legal obligation for security/fraud/audit (REQUIRES JORDANIAN LEGAL REVIEW), and consent for optional marketing/optional cookies.',
      'Uncertain classifications are flagged for counsel: <!-- REQUIRES JORDANIAN LEGAL REVIEW: mapping each purpose to PDPL lawful basis, including KYC and financial metadata -->',
    ],
    paragraphsAr: [
      'تعتزم مزارع الاعتماد على أسس متوافقة مع إطار قانون حماية البيانات الشخصية الأردني رقم 24 لسنة 2023 حسب انطباقه — عادة تنفيذ العقد للحسابات/الحجوزات/المدفوعات، ومصلحة مشروعة أو التزام قانوني للأمن/الاحتيال/التدقيق (يتطلب مراجعة قانونية أردنية)، والموافقة للتسويق/ملفات الارتباط الاختيارية.',
      'التصنيفات غير المؤكدة معلَّمة للمستشار: <!-- REQUIRES JORDANIAN LEGAL REVIEW: ربط كل غرض بأساس قانوني في قانون حماية البيانات، بما فيها KYC وبيانات الدفع الوصفية -->',
    ],
  },
  {
    id: 'payments-privacy',
    n: 9,
    titleEn: 'Payments and card data',
    titleAr: 'المدفوعات وبيانات البطاقة',
    paragraphsEn: [
      'Card entry occurs with the PSP ({{psp}} / PayTabs integration as configured). Mazare3 does not store card PAN or CVV. Mazare3 does store payment transaction metadata needed to confirm Bookings, refunds, and disputes.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: merchant of record and controller/processor roles for payment data -->',
    ],
    paragraphsAr: [
      'تُدخل البطاقة لدى مزود الدفع ({{psp}} / تكامل PayTabs حسب التهيئة). لا تخزّن مزارع رقم البطاقة أو CVV. وتخزّن بيانات معاملات الدفع الوصفية اللازمة لتأكيد الحجوزات والاستردادات والنزاعات.',
      '<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: التاجر المسجّل وأدوار المتحكم/المعالج لبيانات الدفع -->',
    ],
  },
  {
    id: 'recipients',
    n: 10,
    titleEn: 'Disclosure and recipients',
    titleAr: 'الإفصاح والمستلمون',
    paragraphsEn: [
      'We share what is needed to operate: Owners see booking details needed to host (not card PAN); PSP processes payments; Neon hosts the database; Cloudflare R2 stores media/KYC files; Google processes OAuth if used; email provider if transactional email is enabled. We do not sell Personal Data as a product.',
    ],
    paragraphsAr: [
      'نشارك ما يلزم للتشغيل: يرى المالكون تفاصيل الحجز اللازمة للاستضافة (وليس رقم البطاقة)؛ ويعالج مزود الدفع المدفوعات؛ ويستضيف Neon قاعدة البيانات؛ ويخزّن Cloudflare R2 الوسائط/ملفات التحقق؛ وتعالج Google بيانات OAuth إن استُخدمت؛ ومزود البريد إن فُعّل البريد التشغيلي. لا نبيع البيانات الشخصية كمنتج.',
    ],
  },
  {
    id: 'transfers',
    n: 11,
    titleEn: 'International transfers',
    titleAr: 'النقل عبر الحدود',
    paragraphsEn: [
      'Some processors may store or process data outside Jordan. Exact hosting countries for Neon, R2, Google, and PSP are UNKNOWN — LEGAL REVIEW REQUIRED. <!-- REQUIRES JORDANIAN LEGAL REVIEW: cross-border transfer safeguards under PDPL -->',
    ],
    paragraphsAr: [
      'قد يخزّن بعض المعالجين البيانات أو يعالجونها خارج الأردن. دول الاستضافة الدقيقة لـ Neon وR2 وGoogle ومزود الدفع غير معروفة — تتطلب مراجعة قانونية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: ضمانات النقل عبر الحدود بموجب قانون حماية البيانات -->',
    ],
  },
  {
    id: 'retention',
    n: 12,
    titleEn: 'Retention',
    titleAr: 'الاحتفاظ',
    paragraphsEn: [
      'We retain data as long as needed for the purpose (account life, Booking completion, refunds, disputes, fraud prevention, accounting/legal duties). Exact statutory periods: RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW. LegalAcceptance evidence is kept to prove contract acceptance; optional PrivacyConsent history is retained after withdrawal.',
    ],
    paragraphsAr: [
      'نحتفظ بالبيانات طالما لزم الغرض (عمر الحساب، إتمام الحجز، الاسترداد، النزاعات، منع الاحتيال، الواجبات المحاسبية/القانونية). المدد النظامية الدقيقة: تتطلب مراجعة قانونية أردنية. تُحفظ أدلة القبول القانوني لإثبات قبول العقد؛ ويُحتفظ بسجل موافقات الخصوصية الاختيارية بعد السحب.',
    ],
  },
  {
    id: 'security',
    n: 13,
    titleEn: 'Security',
    titleAr: 'الأمن',
    paragraphsEn: [
      'Mazare3 applies access controls for KYC and exact location, encrypted payout fields where implemented, session authentication, and audit logging of important actions. No transmission is risk-free.',
    ],
    paragraphsAr: [
      'تطبّق مزارع ضوابط وصول لمستندات التحقق والموقع الدقيق، وتشفير حقول الصرف حيث طُبّق، ومصادقة الجلسة، وتسجيل تدقيق للإجراءات المهمة. لا يوجد إرسال بلا مخاطر.',
    ],
  },
  {
    id: 'rights',
    n: 14,
    titleEn: 'Data-subject rights and DSR',
    titleAr: 'حقوق صاحب البيانات وطلبات الخصوصية',
    paragraphsEn: [
      'Subject to Jordanian law, you may request access, correction, erasure/anonymisation, objection, portability/copy where supported, or a privacy inquiry via account privacy tools or {{privacyEmail}}. Requests are handled through DataSubjectRequest workflows; fulfilment may be partial or refused with reason where lawful retention applies (bookings, payments, disputes, fraud, legal holds).',
      'Consent for optional purposes may be withdrawn without affecting essential processing needed for contracts or security.',
    ],
    paragraphsAr: [
      'مع مراعاة القانون الأردني، يمكنك طلب الاطلاع أو التصحيح أو المحو/إخفاء الهوية أو الاعتراض أو قابلية النقل/نسخة حيث تُدعم، أو استفسار خصوصية عبر أدوات خصوصية الحساب أو {{privacyEmail}}. تُعالَج الطلبات عبر مسارات طلبات أصحاب البيانات؛ وقد يكون التنفيذ جزئياً أو مرفوضاً مع سبب عند انطباق احتفاظ مشروع (حجوزات، مدفوعات، نزاعات، احتيال، حجز قانوني).',
      'يمكن سحب الموافقة للأغراض الاختيارية دون التأثير على المعالجة الأساسية اللازمة للعقود أو الأمن.',
    ],
  },
  {
    id: 'children',
    n: 15,
    titleEn: 'Children and capacity',
    titleAr: 'القاصرون والأهلية',
    paragraphsEn: [
      'Mazare3 is not directed at users lacking legal capacity. <!-- REQUIRES JORDANIAN LEGAL REVIEW: children’s data rules -->',
    ],
    paragraphsAr: [
      'مزارع ليست موجّهة لمن يفتقرون للأهلية القانونية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: قواعد بيانات الأطفال -->',
    ],
  },
  {
    id: 'updates-contact',
    n: 16,
    titleEn: 'Updates and contact',
    titleAr: 'التحديثات والتواصل',
    paragraphsEn: [
      'We may update this Policy under a new published version. Contact: {{privacyEmail}} / {{dpo}}. Operator: {{pe}}, {{addr}}.',
    ],
    paragraphsAr: [
      'قد نحدّث هذه السياسة بإصدار منشور جديد. التواصل: {{privacyEmail}} / {{dpo}}. المشغّل: {{pe}}، {{addr}}.',
    ],
  },
];

writeDoc(
  'privacy-policy.ts',
  'privacyPolicy',
  'privacy_policy',
  'Privacy Policy',
  'سياسة الخصوصية',
  'This Privacy Policy describes how Mazare3 ({{pe}}) processes Personal Data for the Mazare3 Jordan marketplace. Launch-candidate — not counsel-approved.',
  'تصف سياسة الخصوصية هذه كيف تعالج مزارع ({{pe}}) البيانات الشخصية لسوق مزارع الأردن. نص مرشّح للإطلاق — غير معتمد من المستشار القانوني.',
  privacySections,
);

// ========== CANCELLATION ==========
const cancelSections = [
  {
    id: 'overview',
    n: 1,
    titleEn: 'Overview',
    titleAr: 'نظرة عامة',
    paragraphsEn: [
      'This customer-friendly Cancellation & Refund Policy explains how Mazare3 treats cancellations and refunds. Timing uses actual booking period start in Asia/Amman. Retained = min(captured, policy charge). Mazare3 never collects uncaptured money merely to satisfy a cancellation percentage.',
    ],
    paragraphsAr: [
      'توضح سياسة الإلغاء والاسترداد هذه بأسلوب مبسّط كيف تعامل مزارع الإلغاء والاسترداد. يعتمد التوقيت على بداية فترة الحجز الفعلية بتوقيت Asia/Amman. المحتفظ = الحد الأدنى بين المحصّل ورسوم السياسة. لا تجمع مزارع مالاً غير محصّل لمجرد استيفاء نسبة إلغاء.',
    ],
  },
  {
    id: 'before-payment',
    n: 2,
    titleEn: 'Before payment is captured',
    titleAr: 'قبل تحصيل الدفع',
    paragraphsEn: [
      'Unpaid requests (including Owner-approval waiting) can be cancelled without a charge. If the Owner declines or the request expires, nothing is captured.',
    ],
    paragraphsAr: [
      'يمكن إلغاء الطلبات غير المدفوعة (بما فيها انتظار موافقة المالك) دون رسوم. إذا رفض المالك أو انتهت مهلة الطلب، لا يُحصَّل شيء.',
    ],
  },
  {
    id: 'payment-plan',
    n: 3,
    titleEn: 'Deposit vs full payment',
    titleAr: 'العربون مقابل الدفع الكامل',
    paragraphsEn: [
      'More than {{FULL_PAYMENT_WITHIN_HOURS}} hours before start: choose {{DEPOSIT_PERCENT}}% Deposit or pay in full. Within {{FULL_PAYMENT_WITHIN_HOURS}} hours: full payment required. Deposit Balance due {{BALANCE_DUE_HOURS_BEFORE_START}} hours before start; unpaid Balance may auto-cancel the Booking and retain the captured Deposit.',
    ],
    paragraphsAr: [
      'أكثر من {{FULL_PAYMENT_WITHIN_HOURS}} ساعة قبل البداية: اختر عربون {{DEPOSIT_PERCENT}}٪ أو ادفع كاملاً. خلال {{FULL_PAYMENT_WITHIN_HOURS}} ساعة: يُطلب الدفع الكامل. يستحق رصيد العربون قبل {{BALANCE_DUE_HOURS_BEFORE_START}} ساعة من البداية؛ وعدم الدفع قد يلغي الحجز تلقائياً ويحتفظ بالعربون المحصّل.',
    ],
  },
  {
    id: 'customer-tiers',
    n: 4,
    titleEn: 'Customer cancellation tiers',
    titleAr: 'شرائح إلغاء الزبون',
    paragraphsEn: [
      'Charge % of merchant booking value. Retained = min(captured, policy charge). Refund = captured − retained.',
    ],
    paragraphsAr: [
      'نسبة الرسوم من قيمة الحجز للشريك. المحتفظ = الحد الأدنى بين المحصّل ورسوم السياسة. الاسترداد = المحصّل − المحتفظ.',
    ],
    bulletsEn: [
      '| Hours before start | Charge |',
      '| --- | --- |',
      '| More than {{CANCELLATION_FREE_UNTIL_HOURS}}h | 0% |',
      '| {{CANCELLATION_CHARGE_30_UNTIL_HOURS}}h–{{CANCELLATION_FREE_UNTIL_HOURS}}h | {{CANCELLATION_CHARGE_PERCENT_TIER_30}}% |',
      '| {{CANCELLATION_CHARGE_50_UNTIL_HOURS}}h–{{CANCELLATION_CHARGE_30_UNTIL_HOURS}}h | {{CANCELLATION_CHARGE_PERCENT_TIER_50}}% |',
      '| 0–{{CANCELLATION_CHARGE_50_UNTIL_HOURS}}h | {{CANCELLATION_CHARGE_PERCENT_TIER_100}}% |',
      '| After start | Ordinary cancel unavailable |',
    ],
    bulletsAr: [
      '| الساعات قبل البداية | الرسوم |',
      '| --- | --- |',
      '| أكثر من {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة | 0٪ |',
      '| {{CANCELLATION_CHARGE_30_UNTIL_HOURS}}–{{CANCELLATION_FREE_UNTIL_HOURS}} ساعة | {{CANCELLATION_CHARGE_PERCENT_TIER_30}}٪ |',
      '| {{CANCELLATION_CHARGE_50_UNTIL_HOURS}}–{{CANCELLATION_CHARGE_30_UNTIL_HOURS}} ساعة | {{CANCELLATION_CHARGE_PERCENT_TIER_50}}٪ |',
      '| 0–{{CANCELLATION_CHARGE_50_UNTIL_HOURS}} ساعة | {{CANCELLATION_CHARGE_PERCENT_TIER_100}}٪ |',
      '| بعد البداية | الإلغاء العادي غير متاح |',
    ],
  },
  {
    id: 'examples-200',
    n: 5,
    titleEn: 'Examples (200 JOD booking)',
    titleAr: 'أمثلة (حجز بقيمة 200 د.أ)',
    paragraphsEn: [
      'Assume merchant booking value = 200 JOD.',
    ],
    paragraphsAr: [
      'افترض أن قيمة الحجز للشريك = 200 د.أ.',
    ],
    bulletsEn: [
      'Fully paid 200 JOD, cancel >{{CANCELLATION_FREE_UNTIL_HOURS}}h: charge 0; retained 0; refund 200.',
      'Fully paid 200 JOD, cancel in 48–72h window: charge {{CANCELLATION_CHARGE_PERCENT_TIER_30}}% = 60 JOD; retained 60; refund 140.',
      'Fully paid 200 JOD, cancel in 24–48h window: charge {{CANCELLATION_CHARGE_PERCENT_TIER_50}}% = 100 JOD; retained 100; refund 100.',
      'Fully paid 200 JOD, cancel ≤{{CANCELLATION_CHARGE_50_UNTIL_HOURS}}h: charge 100% = 200; retained 200; refund 0.',
      'Deposit-only captured 60 JOD ({{DEPOSIT_PERCENT}}% of 200), cancel in 48–72h: policy charge 60 but retained = min(60, 60) = 60; refund 0. Mazare3 does not collect the unpaid 140 merely to hit the percentage.',
      'Deposit-only captured 60 JOD, cancel >{{CANCELLATION_FREE_UNTIL_HOURS}}h: retained 0; refund 60.',
    ],
    bulletsAr: [
      'مدفوع بالكامل 200 د.أ، إلغاء بعد أكثر من {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة: رسوم 0؛ محتفظ 0؛ استرداد 200.',
      'مدفوع بالكامل 200 د.أ، إلغاء في نافذة 48–72 ساعة: رسوم {{CANCELLATION_CHARGE_PERCENT_TIER_30}}٪ = 60 د.أ؛ محتفظ 60؛ استرداد 140.',
      'مدفوع بالكامل 200 د.أ، إلغاء في نافذة 24–48 ساعة: رسوم {{CANCELLATION_CHARGE_PERCENT_TIER_50}}٪ = 100 د.أ؛ محتفظ 100؛ استرداد 100.',
      'مدفوع بالكامل 200 د.أ، إلغاء خلال {{CANCELLATION_CHARGE_50_UNTIL_HOURS}} ساعة أو أقل: رسوم 100٪ = 200؛ محتفظ 200؛ استرداد 0.',
      'عربون محصّل فقط 60 د.أ ({{DEPOSIT_PERCENT}}٪ من 200)، إلغاء في 48–72 ساعة: رسوم السياسة 60 لكن المحتفظ = الحد الأدنى(60، 60) = 60؛ استرداد 0. لا تجمع مزارع الـ 140 غير المدفوعة لمجرد بلوغ النسبة.',
      'عربون محصّل 60 د.أ، إلغاء بعد أكثر من {{CANCELLATION_FREE_UNTIL_HOURS}} ساعة: محتفظ 0؛ استرداد 60.',
    ],
  },
  {
    id: 'owner-cancel',
    n: 6,
    titleEn: 'Owner cancellation',
    titleAr: 'إلغاء المالك',
    paragraphsEn: [
      'Owner-caused cancel of a confirmed Booking: Customer receives 100% refund of captured payments; Owner payout = 0. Owner penalty is a future settlement adjustment (0% / {{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}% / {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}% tiers; min {{OWNER_PENALTY_MIN_JOD}} JOD; max {{OWNER_PENALTY_MAX_JOD}} JOD) — not an automatic card charge. Force majeure: no Owner penalty.',
    ],
    paragraphsAr: [
      'إلغاء المالك لسبب يرجع إليه لحجز مؤكد: يسترد الزبون 100٪ من المحصّل؛ صرف المالك = 0. غرامة المالك تعديل تسوية لاحق (شرائح 0٪ / {{OWNER_CANCEL_PENALTY_PERCENT_TIER_10}}٪ / {{OWNER_CANCEL_PENALTY_PERCENT_TIER_20}}٪؛ حد أدنى {{OWNER_PENALTY_MIN_JOD}} د.أ؛ حد أقصى {{OWNER_PENALTY_MAX_JOD}} د.أ) — وليست خصماً تلقائياً من البطاقة. القوة القاهرة: لا غرامة.',
    ],
  },
  {
    id: 'no-shows',
    n: 7,
    titleEn: 'No-shows and access denied',
    titleAr: 'عدم الحضور ومنع الوصول',
    paragraphsEn: [
      'Customer no-show (after {{CUSTOMER_NO_SHOW_GRACE_MINUTES}} minutes grace + admin confirmation): refund 0; normal Owner earnings and commission. Owner no-show / unjustified access denied (confirmed): Customer 100% refund; Owner payout 0; penalty up to policy limits.',
    ],
    paragraphsAr: [
      'عدم حضور الزبون (بعد سماح {{CUSTOMER_NO_SHOW_GRACE_MINUTES}} دقيقة + تأكيد الإدارة): استرداد 0؛ أرباح المالك والعمولة عادية. عدم حضور المالك / منع وصول غير مبرر (مؤكد): استرداد 100٪ للزبون؛ صرف المالك 0؛ غرامة ضمن الحدود.',
    ],
  },
  {
    id: 'reschedule-fm',
    n: 8,
    titleEn: 'Rescheduling and force majeure',
    titleAr: 'إعادة الجدولة والقوة القاهرة',
    paragraphsEn: [
      'Reschedule requires mutual agreement (max {{MAX_CUSTOMER_RESCHEDULES}} successful customer-requested change). It must not soft-reset cancellation clocks after customer-requested moves. Force majeure may yield equivalent reschedule or full refund after review — no Owner penalty.',
    ],
    paragraphsAr: [
      'إعادة الجدولة تتطلب اتفاق الطرفين (حد أقصى {{MAX_CUSTOMER_RESCHEDULES}} تغيير ناجح بطلب الزبون). ولا يجوز أن تُليّن ساعة الإلغاء بعد نقل بطلب الزبون. القوة القاهرة قد تؤدي لإعادة جدولة مكافئة أو استرداد كامل بعد المراجعة — بلا غرامة على المالك.',
    ],
  },
  {
    id: 'refund-process',
    n: 9,
    titleEn: 'How refunds are processed',
    titleAr: 'كيف تُعالَج الاستردادات',
    paragraphsEn: [
      'Eligible refunds go through Mazare3’s refund / PSP workflow. Status may stay pending until the provider confirms. Bank/card posting time depends on the PSP and issuer — Mazare3 does not promise an exact arrival day. Failed or stuck refunds may be retried by operations.',
    ],
    paragraphsAr: [
      'تمر الاستردادات المستحقة عبر مسار الاسترداد / مزود الدفع. قد تبقى الحالة معلّقة حتى يؤكد المزود. يعتمد ظهور المبلغ على المزود ومصدر البطاقة — ولا تعد مزارع بيوم وصول محدد. قد تعيد العمليات محاولة الاستردادات الفاشلة أو العالقة.',
    ],
  },
  {
    id: 'contact',
    n: 10,
    titleEn: 'Contact',
    titleAr: 'التواصل',
    paragraphsEn: [
      'Questions: {{legalEmail}}. Operator: {{pe}}.',
    ],
    paragraphsAr: [
      'للاستفسار: {{legalEmail}}. المشغّل: {{pe}}.',
    ],
  },
];

writeDoc(
  'cancellation-refund-policy.ts',
  'cancellationRefundPolicy',
  'cancellation_refund_policy',
  'Cancellation & Refund Policy',
  'سياسة الإلغاء والاسترداد',
  'Customer-friendly rules for cancellations and refunds on Mazare3. Numbers come from the live marketplace financial policy SSOT.',
  'قواعد مبسّطة لإلغاء الحجوزات والاسترداد على مزارع. الأرقام مستمدة من سياسة السوق المالية المعتمدة في النظام.',
  cancelSections,
);

console.log('privacy + cancellation done');
