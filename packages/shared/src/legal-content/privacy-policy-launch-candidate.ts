/**
 * FROZEN historical Privacy Policy corpus — Phase 3C.3 / 1.0.1-launch-candidate.
 * Do not mutate. Phase 3C.4B.2A DRAFT lives in privacy-policy.ts (1.1.0-advisor-revised).
 */
import { LEGAL_CONTENT_PLACEHOLDERS as P } from './placeholders';
import {
  LAUNCH_CANDIDATE_VERSION,
  finalizeLaunchDocument,
  type LaunchLegalDocument,
} from './build-legal-markdown';

export const privacyPolicyLaunchCandidate: LaunchLegalDocument = finalizeLaunchDocument({
  version: LAUNCH_CANDIDATE_VERSION,
  documentType: 'privacy_policy',
  titleEn: 'Privacy Policy',
  titleAr: 'سياسة الخصوصية',
  introEn: `This Privacy Policy describes how Mazare3 (${P.LEGAL_ENTITY_NAME}) processes Personal Data for the Mazare3 Jordan marketplace. Launch-candidate — not counsel-approved.`,
  introAr: `تصف سياسة الخصوصية هذه كيف تعالج مزارع (${P.LEGAL_ENTITY_NAME}) البيانات الشخصية لسوق مزارع الأردن. نص مرشّح للإطلاق — غير معتمد من المستشار القانوني.`,
  sections: [
    {
      id: 'controller',
      titleEn: '1. Who controls your data',
      titleAr: '1. من يتحكم ببياناتك',
      paragraphsEn: [
        `The data controller for Mazare3 personal data processing is ${P.LEGAL_ENTITY_INTRO_EN}. Registered address: ${P.REGISTERED_ADDRESS}. Privacy contact: ${P.PRIVACY_CONTACT_EMAIL} (not yet appointed as a dedicated privacy mailbox unless configured).`,
        `If a Data Protection Officer is appointed, contact: ${P.DPO_OR_PRIVACY_CONTACT}. Appointment is not claimed until configured (LEGAL_DPO_APPOINTED). <!-- REQUIRES JORDANIAN LEGAL REVIEW: controller identity once founder fields are filled; PDPL registration / DPO accreditation triggers -->`,
        `Mazare3 Jordan / مزارع الأردن is the product name.`,
      ],
      paragraphsAr: [
        `المتحكم بالبيانات الشخصية لمعالجة مزارع هو ${P.LEGAL_ENTITY_INTRO_AR}. العنوان المسجّل: ${P.REGISTERED_ADDRESS}. تواصل الخصوصية: ${P.PRIVACY_CONTACT_EMAIL} (لم يُعيَّن بريد خصوصية مخصص بعد ما لم يُضبط).`,
        `إذا عُيّن مسؤول حماية بيانات، فالتواصل: ${P.DPO_OR_PRIVACY_CONTACT}. لا يُدّعى التعيين حتى يُفعَّل الإعداد (LEGAL_DPO_APPOINTED). <!-- REQUIRES JORDANIAN LEGAL REVIEW: هوية المتحكم بعد تعبئة حقول المؤسس؛ ومتطلبات التسجيل/تعيين مسؤول حماية البيانات -->`,
        `مزارع الأردن هو اسم المنتج.`,
      ],
    },
    {
      id: 'scope',
      titleEn: '2. Who this policy covers',
      titleAr: '2. من تشملهم هذه السياسة',
      paragraphsEn: [
        `This Privacy Policy covers Customers, Owners/Partners, and visitors of the public website who interact with Mazare3 accounts, bookings, listings, payments metadata, check-in, incidents, or support.`
      ],
      paragraphsAr: [
        `تغطي سياسة الخصوصية هذه الزبائن والمالكين/الشركاء وزوار الموقع العام الذين يتعاملون مع حسابات مزارع أو الحجوزات أو الإعلانات أو بيانات الدفع الوصفية أو تسجيل الوصول أو الحوادث أو الدعم.`
      ]
    },
    {
      id: 'customer-data',
      titleEn: '3. Customer personal data',
      titleAr: '3. بيانات الزبون الشخصية',
      paragraphsEn: [
        `Depending on use, Mazare3 may process:`
      ],
      paragraphsAr: [
        `حسب الاستخدام، قد تعالج مزارع:`
      ],
      bulletsEn: [
        `Identity and contact: name, email, phone (where provided).`,
        `Account/auth identifiers, password hash (not plaintext), locale/role.`,
        `Booking history, favourites, reviews, support communications.`,
        `Incident/dispute evidence and check-in records.`,
        `Payment transaction metadata (amounts, currency, status, method, PSP references) — not card PAN/CVV.`
      ],
      bulletsAr: [
        `الهوية والتواصل: الاسم والبريد والهاتف (إن وُفر).`,
        `معرّفات الحساب/المصادقة وتجزئة كلمة المرور (وليس النص الصريح) واللغة/الدور.`,
        `سجل الحجوزات والمفضلة والمراجعات ومراسلات الدعم.`,
        `أدلة الحوادث/النزاعات وسجلات تسجيل الوصول.`,
        `بيانات معاملات الدفع الوصفية (المبالغ والعملة والحالة والطريقة ومراجع مزود الدفع) — وليس رقم البطاقة/CVV.`
      ]
    },
    {
      id: 'owner-data',
      titleEn: '4. Owner personal and KYC data',
      titleAr: '4. بيانات المالك والتحقق (KYC)',
      paragraphsEn: [
        `For Owners, Mazare3 may process:`
      ],
      paragraphsAr: [
        `بالنسبة للمالكين، قد تعالج مزارع:`
      ],
      bulletsEn: [
        `Profile and contact details; identity/KYC documents stored in private object storage (Cloudflare R2 private where configured) — not as public listing photos.`,
        `Property information, commercial terms, settlement/payout records, bank/IBAN or payout details (encrypted at rest where implemented).`,
        `Reliability incidents and support/dispute evidence.`
      ],
      bulletsAr: [
        `بيانات الملف والتواصل؛ ومستندات الهوية/التحقق في تخزين خاص (Cloudflare R2 الخاص عند التهيئة) — وليست صوراً عامة للإعلان.`,
        `معلومات العقار والشروط التجارية وسجلات التسوية/الصرف وتفاصيل البنك/الآيبان أو الصرف (مشفّرة عند التخزين حيث طُبّق ذلك).`,
        `حوادث الموثوقية وأدلة الدعم/النزاعات.`
      ]
    },
    {
      id: 'technical',
      titleEn: '5. Technical and location data',
      titleAr: '5. البيانات التقنية والموقع',
      paragraphsEn: [
        `Technical: session/authentication cookies, security and audit logs, and limited device/browser metadata needed for security and operation.`,
        `Location: public approximate listing location; exact address/coordinates and arrival notes are stored for operations and revealed only to an eligible booked Customer under product rules.`
      ],
      paragraphsAr: [
        `تقنياً: ملفات جلسة/مصادقة، وسجلات أمن وتدقيق، وبيانات جهاز/متصفح محدودة لازمة للأمن والتشغيل.`,
        `الموقع: موقع تقريبي عام للإعلان؛ العنوان/الإحداثيات الدقيقة وملاحظات الوصول تُحفظ للتشغيل وتُكشف فقط لزبون حجز مؤهل وفق قواعد المنتج.`
      ]
    },
    {
      id: 'sources',
      titleEn: '6. Collection sources',
      titleAr: '6. مصادر الجمع',
      paragraphsEn: [
        `We collect data you provide (forms, uploads, messages), data generated by your use (bookings, check-in, logs), and data from processors such as the PSP (payment results), Google OAuth (if you choose that login), and hosting/storage providers.`
      ],
      paragraphsAr: [
        `نجمع بيانات تقدّمها (نماذج، رفع، رسائل)، وبيانات يولّدها استخدامك (حجوزات، تسجيل وصول، سجلات)، وبيانات من معالجين مثل مزود الدفع (نتائج الدفع) وGoogle OAuth (إن اخترت ذلك الدخول) ومزودي الاستضافة/التخزين.`
      ]
    },
    {
      id: 'purposes',
      titleEn: '7. Processing purposes',
      titleAr: '7. أغراض المعالجة',
      paragraphsEn: [
        `Purposes include: account creation; marketplace performance (search, booking, messaging); payments and refunds; fraud/security; Owner KYC and commercial onboarding; customer support; Owner settlements; legal obligations; and optional consent-based marketing or analytics if introduced.`
      ],
      paragraphsAr: [
        `تشمل الأغراض: إنشاء الحساب؛ أداء السوق (بحث، حجز، رسائل)؛ المدفوعات والاسترداد؛ الاحتيال/الأمن؛ تحقق المالك والتهيئة التجارية؛ دعم الزبائن؛ تسويات المالك؛ الالتزامات القانونية؛ والتسويق أو التحليلات الاختيارية القائمة على الموافقة إن وُجدت.`
      ]
    },
    {
      id: 'lawful-basis',
      titleEn: '8. Lawful basis framework',
      titleAr: '8. إطار الأساس القانوني',
      paragraphsEn: [
        `Mazare3 intends to rely on bases compatible with Jordan PDPL No. 24 of 2023 framework as applicable — typically contract performance for accounts/bookings/payments, legitimate interests or legal obligation for security/fraud/audit (REQUIRES JORDANIAN LEGAL REVIEW), and consent for optional marketing/optional cookies.`,
        `Uncertain classifications are flagged for counsel: <!-- REQUIRES JORDANIAN LEGAL REVIEW: mapping each purpose to PDPL lawful basis, including KYC and financial metadata -->`
      ],
      paragraphsAr: [
        `تعتزم مزارع الاعتماد على أسس متوافقة مع إطار قانون حماية البيانات الشخصية الأردني رقم 24 لسنة 2023 حسب انطباقه — عادة تنفيذ العقد للحسابات/الحجوزات/المدفوعات، ومصلحة مشروعة أو التزام قانوني للأمن/الاحتيال/التدقيق (يتطلب مراجعة قانونية أردنية)، والموافقة للتسويق/ملفات الارتباط الاختيارية.`,
        `التصنيفات غير المؤكدة معلَّمة للمستشار: <!-- REQUIRES JORDANIAN LEGAL REVIEW: ربط كل غرض بأساس قانوني في قانون حماية البيانات، بما فيها KYC وبيانات الدفع الوصفية -->`
      ]
    },
    {
      id: 'payments-privacy',
      titleEn: '9. Payments and card data',
      titleAr: '9. المدفوعات وبيانات البطاقة',
      paragraphsEn: [
        `Card entry occurs with the PSP (${P.PAYMENT_PROVIDER_LEGAL_NAME} / PayTabs integration as configured). Mazare3 does not store card PAN or CVV. Mazare3 does store payment transaction metadata needed to confirm Bookings, refunds, and disputes.`,
        `<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: merchant of record and controller/processor roles for payment data -->`
      ],
      paragraphsAr: [
        `تُدخل البطاقة لدى مزود الدفع (${P.PAYMENT_PROVIDER_LEGAL_NAME} / تكامل PayTabs حسب التهيئة). لا تخزّن مزارع رقم البطاقة أو CVV. وتخزّن بيانات معاملات الدفع الوصفية اللازمة لتأكيد الحجوزات والاستردادات والنزاعات.`,
        `<!-- REQUIRES PSP / JORDANIAN LEGAL REVIEW: التاجر المسجّل وأدوار المتحكم/المعالج لبيانات الدفع -->`
      ]
    },
    {
      id: 'recipients',
      titleEn: '10. Disclosure and recipients',
      titleAr: '10. الإفصاح والمستلمون',
      paragraphsEn: [
        `We share what is needed to operate: Owners see booking details needed to host (not card PAN); PSP processes payments; Neon hosts the database; Cloudflare R2 stores media/KYC files; Google processes OAuth if used; email provider if transactional email is enabled. We do not sell Personal Data as a product.`
      ],
      paragraphsAr: [
        `نشارك ما يلزم للتشغيل: يرى المالكون تفاصيل الحجز اللازمة للاستضافة (وليس رقم البطاقة)؛ ويعالج مزود الدفع المدفوعات؛ ويستضيف Neon قاعدة البيانات؛ ويخزّن Cloudflare R2 الوسائط/ملفات التحقق؛ وتعالج Google بيانات OAuth إن استُخدمت؛ ومزود البريد إن فُعّل البريد التشغيلي. لا نبيع البيانات الشخصية كمنتج.`
      ]
    },
    {
      id: 'transfers',
      titleEn: '11. International transfers',
      titleAr: '11. النقل عبر الحدود',
      paragraphsEn: [
        `Some processors may store or process data outside Jordan. Exact hosting countries for Neon, R2, Google, and PSP are UNKNOWN — LEGAL REVIEW REQUIRED. <!-- REQUIRES JORDANIAN LEGAL REVIEW: cross-border transfer safeguards under PDPL -->`
      ],
      paragraphsAr: [
        `قد يخزّن بعض المعالجين البيانات أو يعالجونها خارج الأردن. دول الاستضافة الدقيقة لـ Neon وR2 وGoogle ومزود الدفع غير معروفة — تتطلب مراجعة قانونية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: ضمانات النقل عبر الحدود بموجب قانون حماية البيانات -->`
      ]
    },
    {
      id: 'retention',
      titleEn: '12. Retention',
      titleAr: '12. الاحتفاظ',
      paragraphsEn: [
        `We retain data as long as needed for the purpose (account life, Booking completion, refunds, disputes, fraud prevention, accounting/legal duties). Exact statutory periods: RETENTION PERIOD REQUIRES JORDANIAN LEGAL REVIEW. LegalAcceptance evidence is kept to prove contract acceptance; optional PrivacyConsent history is retained after withdrawal.`
      ],
      paragraphsAr: [
        `نحتفظ بالبيانات طالما لزم الغرض (عمر الحساب، إتمام الحجز، الاسترداد، النزاعات، منع الاحتيال، الواجبات المحاسبية/القانونية). المدد النظامية الدقيقة: تتطلب مراجعة قانونية أردنية. تُحفظ أدلة القبول القانوني لإثبات قبول العقد؛ ويُحتفظ بسجل موافقات الخصوصية الاختيارية بعد السحب.`
      ]
    },
    {
      id: 'security',
      titleEn: '13. Security',
      titleAr: '13. الأمن',
      paragraphsEn: [
        `Mazare3 applies access controls for KYC and exact location, encrypted payout fields where implemented, session authentication, and audit logging of important actions. No transmission is risk-free.`
      ],
      paragraphsAr: [
        `تطبّق مزارع ضوابط وصول لمستندات التحقق والموقع الدقيق، وتشفير حقول الصرف حيث طُبّق، ومصادقة الجلسة، وتسجيل تدقيق للإجراءات المهمة. لا يوجد إرسال بلا مخاطر.`
      ]
    },
    {
      id: 'rights',
      titleEn: '14. Data-subject rights and DSR',
      titleAr: '14. حقوق صاحب البيانات وطلبات الخصوصية',
      paragraphsEn: [
        `Subject to Jordanian law, you may request access, correction, erasure/anonymisation, objection, portability/copy where supported, or a privacy inquiry via account privacy tools or ${P.PRIVACY_CONTACT_EMAIL}. Requests are handled through DataSubjectRequest workflows; fulfilment may be partial or refused with reason where lawful retention applies (bookings, payments, disputes, fraud, legal holds).`,
        `Consent for optional purposes may be withdrawn without affecting essential processing needed for contracts or security.`
      ],
      paragraphsAr: [
        `مع مراعاة القانون الأردني، يمكنك طلب الاطلاع أو التصحيح أو المحو/إخفاء الهوية أو الاعتراض أو قابلية النقل/نسخة حيث تُدعم، أو استفسار خصوصية عبر أدوات خصوصية الحساب أو ${P.PRIVACY_CONTACT_EMAIL}. تُعالَج الطلبات عبر مسارات طلبات أصحاب البيانات؛ وقد يكون التنفيذ جزئياً أو مرفوضاً مع سبب عند انطباق احتفاظ مشروع (حجوزات، مدفوعات، نزاعات، احتيال، حجز قانوني).`,
        `يمكن سحب الموافقة للأغراض الاختيارية دون التأثير على المعالجة الأساسية اللازمة للعقود أو الأمن.`
      ]
    },
    {
      id: 'children',
      titleEn: '15. Children and capacity',
      titleAr: '15. القاصرون والأهلية',
      paragraphsEn: [
        `Mazare3 is not directed at users lacking legal capacity. <!-- REQUIRES JORDANIAN LEGAL REVIEW: children’s data rules -->`
      ],
      paragraphsAr: [
        `مزارع ليست موجّهة لمن يفتقرون للأهلية القانونية. <!-- REQUIRES JORDANIAN LEGAL REVIEW: قواعد بيانات الأطفال -->`
      ]
    },
    {
      id: 'updates-contact',
      titleEn: '16. Updates and contact',
      titleAr: '16. التحديثات والتواصل',
      paragraphsEn: [
        `We may update this Policy under a new published version. Privacy contact: ${P.PRIVACY_CONTACT_EMAIL}. If a Data Protection Officer is appointed: ${P.DPO_OR_PRIVACY_CONTACT}. Operator: ${P.LEGAL_ENTITY_NAME}, ${P.REGISTERED_ADDRESS}.`,
      ],
      paragraphsAr: [
        `قد نحدّث هذه السياسة بإصدار منشور جديد. تواصل الخصوصية: ${P.PRIVACY_CONTACT_EMAIL}. إذا عُيّن مسؤول حماية بيانات: ${P.DPO_OR_PRIVACY_CONTACT}. المشغّل: ${P.LEGAL_ENTITY_NAME}، ${P.REGISTERED_ADDRESS}.`,
      ],
    }
  ],
});
