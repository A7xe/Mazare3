/**
 * FROZEN — Phase 3C.4B.2A Privacy Policy DRAFT (1.1.0-advisor-revised).
 * Do not mutate. Current DRAFT lives in privacy-policy.ts (1.1.1-advisor-revised).
 */
import { LEGAL_CONTENT_PLACEHOLDERS as P } from './placeholders';
import {
  PRIVACY_ADVISOR_REVISED_VERSION_110,
  finalizeLaunchDocument,
  type LaunchLegalDocument,
} from './build-legal-markdown';

export const privacyPolicyAdvisorRevised110: LaunchLegalDocument = finalizeLaunchDocument({
  version: PRIVACY_ADVISOR_REVISED_VERSION_110,
  includeInternalBanner: true,
  documentType: 'privacy_policy',
  titleEn: 'Privacy Policy',
  titleAr: 'سياسة الخصوصية',
  introEn: `This Privacy Policy explains how Personal Data is processed in connection with the Mazare3 marketplace (Mazare3 / Mazare3 Jordan / مزارع الأردن), operated by ${P.LEGAL_ENTITY_INTRO_EN}. This document is a transparency notice. Acknowledging this Privacy Policy is not Prior Consent, and is separate from accepting the Terms & Conditions and from any optional marketing or analytics choices.`,
  introAr: `توضّح سياسة الخصوصية هذه كيفية معالجة البيانات الشخصية في إطار سوق مزارع (مزارع / مزارع الأردن)، الذي تشغّله ${P.LEGAL_ENTITY_INTRO_AR}. هذه الوثيقة إشعار شفافية. الإقرار بسياسة الخصوصية لا يُعدّ موافقة مسبقة، وهو منفصل عن قبول الشروط والأحكام وعن أي خيارات اختيارية للتسويق أو التحليلات.`,
  sections: [
    {
      id: 'purpose-scope',
      titleEn: '1. Purpose and scope',
      titleAr: '1. الغرض والنطاق',
      paragraphsEn: [
        `This Privacy Policy describes how Mazare3 processes Personal Data of Customers, Owners/Partners, and website visitors who create accounts, browse listings, make or manage Bookings, make payments or refunds, verify Owner identity, operate Properties, contact support, exercise privacy rights, or otherwise use Mazare3 services.`,
        `It applies to processing carried out for the Mazare3 Jordan marketplace. It does not replace the Terms & Conditions, Booking Terms, Cancellation & Refund Policy, Cookie Policy, Owner Agreement, or other published policies. Where those documents address contractual rights or obligations, they remain separate.`,
      ],
      paragraphsAr: [
        `تصف سياسة الخصوصية هذه كيف تعالج مزارع البيانات الشخصية للزبائن والمالكين/الشركاء وزوار الموقع الذين ينشئون حسابات أو يتصفحون الإعلانات أو يُجرون حجوزات أو يديرونها أو يُجرون مدفوعات أو استرداداً أو يتحققون من هوية المالك أو يشغّلون العقارات أو يتواصلون مع الدعم أو يمارسون حقوق الخصوصية أو يستخدمون خدمات مزارع بأي شكل آخر.`,
        `تنطبق على المعالجة المرتبطة بسوق مزارع الأردن. ولا تحل محل الشروط والأحكام أو شروط الحجز أو سياسة الإلغاء والاسترداد أو سياسة ملفات تعريف الارتباط أو اتفاقية المالك أو السياسات المنشورة الأخرى. وحيث تعالج تلك الوثائق حقوقاً أو التزامات تعاقدية، فإنها تبقى منفصلة.`,
      ],
    },
    {
      id: 'controller',
      titleEn: '2. Controller identity',
      titleAr: '2. هوية المسؤول عن معالجة البيانات',
      paragraphsEn: [
        `The Personal Data controller (the person responsible for processing Personal Data) for Mazare3 processing described in this Policy is ${P.LEGAL_ENTITY_INTRO_EN}.`,
        `Legal name (English): ${P.LEGAL_ENTITY_NAME_EN}. Legal name (Arabic): ${P.LEGAL_ENTITY_NAME_AR}. Legal form: ${P.LEGAL_FORM_EN} / ${P.LEGAL_FORM_AR} (stated separately from the legal name). Commercial Registration No. ${P.COMMERCIAL_REGISTRATION_NUMBER}. Jurisdiction: Hashemite Kingdom of Jordan / Amman.`,
        `Registered address: ${P.REGISTERED_ADDRESS_EN} / ${P.REGISTERED_ADDRESS_AR}.`,
        `Mazare3 / Mazare3 Jordan / مزارع الأردن is the product and marketplace brand. BATMAN TECHNOLOGY / شركة الرجل الوطواط للتكنولوجيا is the legal entity that operates the brand.`,
        `Privacy contact email (publishable mailbox): ${P.PRIVACY_CONTACT_EMAIL}. Until this contact is resolved and published, Data Subjects may use in-account privacy tools where available.`,
        `Where an appointed Data Protection Officer is required and formally designated under applicable Jordanian requirements, Mazare3 will publish the applicable DPO contact details here (${P.DPO_OR_PRIVACY_CONTACT}). Mazare3 does not currently claim that a Data Protection Officer has already been formally appointed or accredited.`,
      ],
      paragraphsAr: [
        `المسؤول عن معالجة البيانات الشخصية لمعالجة مزارع الموصوفة في هذه السياسة هو ${P.LEGAL_ENTITY_INTRO_AR}.`,
        `الاسم القانوني (بالإنجليزية): ${P.LEGAL_ENTITY_NAME_EN}. الاسم القانوني (بالعربية): ${P.LEGAL_ENTITY_NAME_AR}. الشكل القانوني: ${P.LEGAL_FORM_EN} / ${P.LEGAL_FORM_AR} (يُذكر منفصلاً عن الاسم القانوني). رقم السجل التجاري ${P.COMMERCIAL_REGISTRATION_NUMBER}. الاختصاص: المملكة الأردنية الهاشمية / عمّان.`,
        `العنوان المسجّل: ${P.REGISTERED_ADDRESS_EN} / ${P.REGISTERED_ADDRESS_AR}.`,
        `مزارع / مزارع الأردن هو اسم المنتج والعلامة التجارية للسوق. شركة الرجل الوطواط للتكنولوجيا / BATMAN TECHNOLOGY هي الكيان القانوني الذي يشغّل العلامة.`,
        `بريد التواصل للخصوصية (الصندوق القابل للنشر): ${P.PRIVACY_CONTACT_EMAIL}. إلى أن يُحسم هذا التواصل ويُنشر، يمكن للأشخاص المعنيين استخدام أدوات الخصوصية داخل الحساب حيث تتوفر.`,
        `حيث يُشترط تعيين مسؤول لحماية البيانات الشخصية ويُعيَّن رسمياً وفق المتطلبات الأردنية المنطبقة، ستنشر مزارع تفاصيل التواصل الخاصة به هنا (${P.DPO_OR_PRIVACY_CONTACT}). ولا تدّعي مزارع حالياً أن مسؤولاً لحماية البيانات قد عُيّن أو اعتُمد رسمياً بالفعل.`,
      ],
    },
    {
      id: 'customer-categories',
      titleEn: '3. Categories of Personal Data — Customers',
      titleAr: '3. فئات البيانات الشخصية — الزبائن',
      paragraphsEn: [
        `Not every Customer provides every field. Where applicable, Mazare3 may process:`,
      ],
      paragraphsAr: [
        `ليس كل زبون يقدّم كل حقل. وحيث ينطبق ذلك، قد تعالج مزارع:`,
      ],
      bulletsEn: [
        `Identity and contact information such as name, email address, and phone number.`,
        `Account information such as locale/language preferences and account role or status.`,
        `Authentication information such as a password hash (not the plaintext password) and, where Google sign-in is used, a Google account identifier.`,
        `Booking information, guest or party details provided for a Booking, and related scheduling or status information.`,
        `Payment and refund metadata (for example amounts, currency, status, method references, and payment-provider transaction or token references) — not full card PAN or CVV.`,
        `Saved payment-method metadata where that feature is enabled (provider/token references, not full card numbers).`,
        `Check-in evidence associated with an eligible Booking.`,
        `Reviews, favourites, and similar marketplace interactions.`,
        `Support, dispute, or incident communications and related evidence.`,
        `Prior Consent records and related versioned consent evidence.`,
        `Legal acknowledgement evidence for published legal documents (including Privacy Policy acknowledgement and Booking-related legal snapshots where used).`,
        `Privacy-right requests and privacy complaints, and related handling records.`,
      ],
      bulletsAr: [
        `معلومات الهوية والتواصل مثل الاسم وعنوان البريد الإلكتروني ورقم الهاتف.`,
        `معلومات الحساب مثل تفضيلات اللغة/الموقع وحالة الحساب أو الدور.`,
        `معلومات المصادقة مثل تجزئة كلمة المرور (وليس كلمة المرور بنص صريح) ومعرّف حساب Google عند استخدام تسجيل الدخول عبر Google.`,
        `معلومات الحجز وتفاصيل الضيوف أو المجموعة المقدَّمة للحجز وما يرتبط بها من جدولة أو حالة.`,
        `بيانات وصفية للمدفوعات والاسترداد (مثل المبالغ والعملة والحالة ومراجع الطريقة ومراجع معاملة أو رمز لدى مزود الدفع) — وليس رقم البطاقة الكامل أو رمز الأمان.`,
        `بيانات وصفية لوسائل الدفع المحفوظة حيث تكون الميزة مفعّلة (مراجع المزود/الرمز، وليس أرقام البطاقات الكاملة).`,
        `أدلة تسجيل الوصول المرتبطة بحجز مؤهل.`,
        `المراجعات والمفضلة والتفاعلات المماثلة في السوق.`,
        `مراسلات الدعم أو النزاعات أو الحوادث والأدلة ذات الصلة.`,
        `سجلات الموافقة المسبقة وأدلة الموافقة المُصدَّرة حسب الإصدار.`,
        `أدلة الإقرار القانوني بالوثائق القانونية المنشورة (بما في ذلك الإقرار بسياسة الخصوصية ولقطات قانونية مرتبطة بالحجز حيث تُستخدم).`,
        `طلبات حقوق الخصوصية وشكاوى الخصوصية وسجلات المعالجة ذات الصلة.`,
      ],
    },
    {
      id: 'owner-categories',
      titleEn: '4. Categories of Personal Data — Owners / Partners',
      titleAr: '4. فئات البيانات الشخصية — المالكون / الشركاء',
      paragraphsEn: [
        `Where applicable, Mazare3 may process for Owners/Partners:`,
      ],
      paragraphsAr: [
        `وحيث ينطبق ذلك، قد تعالج مزارع للمالكين/الشركاء:`,
      ],
      bulletsEn: [
        `Identity and contact information.`,
        `Owner onboarding and commercial profile information.`,
        `KYC / authority verification documents and related review information (stored in restricted private object storage where configured — not as public listing photos).`,
        `Property and listing data, including approximate public location and, where used under product rules, exact Property address, coordinates, and arrival instructions.`,
        `Bank / IBAN / beneficiary information and settlement or payout information.`,
        `Commercial and legal acceptance evidence related to Owner participation.`,
        `Reliability, incident, support, and dispute information.`,
      ],
      bulletsAr: [
        `معلومات الهوية والتواصل.`,
        `معلومات تهيئة المالك والملف التجاري.`,
        `مستندات التحقق من الهوية/الصلاحية (KYC) ومعلومات المراجعة ذات الصلة (تُخزَّن في تخزين كائنات خاص مقيّد حيث تُهيأ — وليست صوراً عامة للإعلان).`,
        `بيانات العقار والإعلان، بما في ذلك الموقع التقريبي العام، وحيث يُستخدم وفق قواعد المنتج: العنوان الدقيق للعقار والإحداثيات وتعليمات الوصول.`,
        `معلومات البنك / الآيبان / المستفيد ومعلومات التسوية أو الصرف.`,
        `أدلة القبول التجاري والقانوني المرتبطة بمشاركة المالك.`,
        `معلومات الموثوقية والحوادث والدعم والنزاعات.`,
      ],
    },
    {
      id: 'sensitive',
      titleEn: '5. Sensitive Personal Data',
      titleAr: '5. البيانات الشخصية الحساسة',
      paragraphsEn: [
        `Under the Jordanian Personal Data Protection framework, financial information is treated as Sensitive Personal Data. Where applicable, this includes IBAN and bank/beneficiary information, financial transaction information, payout and settlement information, and other financial Personal Data processed for Mazare3 operations.`,
        `Owner KYC / authority documents are high-risk Personal Data and may contain Sensitive Personal Data depending on the contents of the documents provided. Mazare3 does not claim that every KYC document always contains every possible sensitive field.`,
        `Free-text support, dispute, or incident messages may incidentally include Sensitive Personal Data. Mazare3 seeks to minimise unnecessary sensitive content in those channels.`,
        `Mazare3 does not store full payment-card PAN or CVV/security code. Card processing is performed through the configured payment service provider (${P.PAYMENT_PROVIDER_LEGAL_NAME}). Mazare3 may retain payment metadata and provider/token references where required by the product.`,
      ],
      paragraphsAr: [
        `وفقاً لإطار حماية البيانات الشخصية في المملكة الأردنية الهاشمية، تُعدّ المعلومات المالية بيانات شخصية حساسة. وحيث ينطبق ذلك، يشمل ذلك معلومات الآيبان والبنك/المستفيد، ومعلومات المعاملات المالية، ومعلومات الصرف والتسوية، وغيرها من البيانات الشخصية المالية التي تُعالَج لتشغيل مزارع.`,
        `مستندات تحقق المالك/الصلاحية (KYC) بيانات شخصية عالية المخاطر وقد تتضمن بيانات شخصية حساسة بحسب محتوى المستندات المقدَّمة. ولا تدّعي مزارع أن كل مستند تحقق يحتوي دائماً على كل حقل حساس محتمل.`,
        `قد تتضمن رسائل الدعم أو النزاعات أو الحوادث بنص حر بيانات شخصية حساسة بصورة عرضية. وتسعى مزارع إلى تقليل المحتوى الحساس غير الضروري في تلك القنوات.`,
        `لا تخزّن مزارع رقم البطاقة الكامل (PAN) ولا رمز الأمان (CVV). وتُجرى معالجة البطاقة عبر مزود خدمة الدفع المهيأ (${P.PAYMENT_PROVIDER_LEGAL_NAME}). وقد تحتفظ مزارع ببيانات وصفية للدفع ومراجع المزود/الرمز حيث يلزم ذلك للمنتج.`,
      ],
    },
    {
      id: 'collection',
      titleEn: '6. How Mazare3 collects Personal Data',
      titleAr: '6. كيف تجمع مزارع البيانات الشخصية',
      paragraphsEn: [
        `Mazare3 may collect Personal Data:`,
      ],
      paragraphsAr: [
        `قد تجمع مزارع البيانات الشخصية:`,
      ],
      bulletsEn: [
        `Directly from you (account forms, Booking details, Owner onboarding, uploads, messages, privacy requests).`,
        `Automatically from use of the service (session and security logs, Booking lifecycle events, check-in events, and similar operational records).`,
        `From configured processors or service providers acting for stated purposes (for example payment results from the payment service provider, Google sign-in identifiers when you choose Google login, and hosting or storage providers).`,
      ],
      bulletsAr: [
        `مباشرة منك (نماذج الحساب، تفاصيل الحجز، تهيئة المالك، الملفات المرفوعة، الرسائل، طلبات الخصوصية).`,
        `تلقائياً من استخدام الخدمة (سجلات الجلسة والأمن، أحداث دورة الحجز، أحداث تسجيل الوصول، وسجلات تشغيلية مماثلة).`,
        `من معالجين أو مزودي خدمات مهيأين لأغراض مذكورة (مثل نتائج الدفع من مزود خدمة الدفع، ومعرّفات تسجيل الدخول عبر Google عند اختيارك ذلك، ومزودي الاستضافة أو التخزين).`,
      ],
    },
    {
      id: 'purposes',
      titleEn: '7. Purposes of processing',
      titleAr: '7. أغراض المعالجة',
      paragraphsEn: [
        `Mazare3 processes Personal Data for purposes that include, where applicable:`,
      ],
      paragraphsAr: [
        `تعالج مزارع البيانات الشخصية لأغراض تشمل، حيث ينطبق ذلك:`,
      ],
      bulletsEn: [
        `Creating and authenticating accounts.`,
        `Operating the marketplace (search, listings, favourites, reviews).`,
        `Processing Bookings and the Booking lifecycle, including Owner approval where applicable.`,
        `Payments, refunds, and related financial operations.`,
        `Saved payment methods where that feature is enabled.`,
        `Owner identity and authority verification.`,
        `Property and listing operation.`,
        `Exact-location and arrival information under eligible product rules.`,
        `Owner payouts and settlements.`,
        `Customer and Owner support, disputes, and incident handling.`,
        `Responding to Data Subject rights requests and privacy complaints.`,
        `Security, fraud prevention, and accountability.`,
        `Personal-data breach response where applicable.`,
        `Transactional communications about your account, Booking, or payment (these are not optional marketing).`,
        `Optional marketing, only if you give separate optional consent and the feature is enabled.`,
        `Optional analytics or non-essential cookies, only if separately consented and enabled.`,
      ],
      bulletsAr: [
        `إنشاء الحسابات والمصادقة عليها.`,
        `تشغيل السوق (البحث، الإعلانات، المفضلة، المراجعات).`,
        `معالجة الحجوزات ودورة الحجز، بما في ذلك موافقة المالك حيث ينطبق ذلك.`,
        `المدفوعات والاسترداد والعمليات المالية ذات الصلة.`,
        `وسائل الدفع المحفوظة حيث تكون الميزة مفعّلة.`,
        `التحقق من هوية المالك وصلاحياته.`,
        `تشغيل العقار والإعلان.`,
        `معلومات الموقع الدقيق والوصول وفق قواعد المنتج المنطبقة.`,
        `صرف المالك والتسويات.`,
        `دعم الزبائن والمالكين والنزاعات ومعالجة الحوادث.`,
        `الرد على طلبات حقوق الأشخاص المعنيين وشكاوى الخصوصية.`,
        `الأمن ومنع الاحتيال والمساءلة.`,
        `الاستجابة لانتهاك البيانات الشخصية حيث ينطبق ذلك.`,
        `الاتصالات التشغيلية المتعلقة بحسابك أو حجزك أو دفعك (وليست تسويقاً اختيارياً).`,
        `التسويق الاختياري، فقط إذا منحت موافقة اختيارية منفصلة وكانت الميزة مفعّلة.`,
        `التحليلات الاختيارية أو ملفات الارتباط غير الأساسية، فقط بعد موافقة منفصلة وعند التفعيل.`,
      ],
    },
    {
      id: 'legal-basis',
      titleEn: '8. Legal basis and Prior Consent',
      titleAr: '8. الأساس القانوني والموافقة المسبقة',
      paragraphsEn: [
        `Mazare3 applies Jordanian Personal Data Protection requirements. This Policy does not rely on foreign-law labels such as “legitimate interest” or “contract necessity” as Jordanian legal bases.`,
        `Prior Consent: where Jordanian law requires Prior Consent before processing for a stated purpose, Mazare3 obtains explicit, purpose-specific Prior Consent before that processing, records it in a versioned way, and treats it as withdrawable for future consent-dependent processing where applicable. One Prior Consent does not cover every processing purpose.`,
        `Processing permitted or required without Prior Consent: where Jordanian law requires or expressly permits Mazare3 to process Personal Data without Prior Consent, Mazare3 may process only to the extent permitted or required by that legal basis.`,
        `Internal legal-mapping work may remain under counsel review. This public Policy does not present unresolved internal candidate mappings as legally confirmed.`,
        `Privacy Policy acknowledgement is notice and transparency only. It does not replace Prior Consent where Prior Consent is legally required. Terms acceptance is separate. Optional marketing or analytics consent, when used, is also separate.`,
      ],
      paragraphsAr: [
        `تطبّق مزارع متطلبات حماية البيانات الشخصية الأردنية. ولا تعتمد هذه السياسة على تسميات قانون أجنبي مثل «المصلحة المشروعة» أو «ضرورة العقد» كأسس قانونية أردنية.`,
        `الموافقة المسبقة: حيث يشترط القانون الأردني موافقة مسبقة قبل المعالجة لغرض مذكور، تحصل مزارع على موافقة مسبقة صريحة ومحددة بالغرض قبل تلك المعالجة، وتسجّلها بطريقة مُصدَّرة، وتتعامل معها على أنها قابلة للسحب بالنسبة للمعالجة المستقبلية المعتمدة على الموافقة حيث ينطبق ذلك. ولا تغطي موافقة مسبقة واحدة كل أغراض المعالجة.`,
        `المعالجة المسموح بها أو المطلوبة دون موافقة مسبقة: حيث يشترط القانون الأردني أو يجيز صراحةً لمزارع معالجة البيانات الشخصية دون موافقة مسبقة، يجوز لمزارع أن تعالج فقط بالقدر الذي يسمح به أو يطلبه ذلك الأساس القانوني.`,
        `قد تبقى أعمال الربط القانوني الداخلية قيد مراجعة المستشار. ولا تعرض هذه السياسة العامة تعيينات داخلية مرشّحة غير محسومة على أنها مؤكدة قانوناً.`,
        `الإقرار بسياسة الخصوصية إشعار وشفافية فقط. ولا يحل محل الموافقة المسبقة حيث تكون الموافقة المسبقة مطلوبة قانوناً. وقبول الشروط منفصل. وموافقة التسويق أو التحليلات الاختيارية، عند استخدامها، منفصلة أيضاً.`,
      ],
    },
    {
      id: 'consent-duration-withdrawal',
      titleEn: '9. Consent duration, withdrawal, and re-consent',
      titleAr: '9. مدة الموافقة والسحب وإعادة الموافقة',
      paragraphsEn: [
        `The applicable duration or validity event for a Prior Consent is disclosed at the relevant consent point. Mazare3 does not invent a fixed public duration in this Policy.`,
        `A Data Subject may withdraw Prior Consent for future consent-dependent processing. Withdrawal does not rewrite historical consent records, does not retroactively invalidate lawful prior processing, and does not automatically erase records that Mazare3 is legally permitted or required to retain.`,
        `Withdrawal does not prevent statutory privacy-right handling or personal-data breach response processing. Withdrawal may prevent a new optional or service action that cannot lawfully be performed without renewed consent.`,
        `Where processing purpose or scope materially changes, Mazare3 may require renewed acknowledgement and/or renewed Prior Consent as applicable. Mazare3 does not treat continued browsing alone as Prior Consent.`,
        `Exercising privacy rights or withdrawing consent does not attract punitive treatment for the Data Subject.`,
      ],
      paragraphsAr: [
        `تُفصح مدة الموافقة المسبقة أو حدث سريانها المنطبق عند نقطة الموافقة ذات الصلة. ولا تخترع مزارع مدة عامة ثابتة في هذه السياسة.`,
        `يجوز للشخص المعني سحب الموافقة المسبقة بالنسبة للمعالجة المستقبلية المعتمدة على الموافقة. والسحب لا يعيد كتابة سجلات الموافقة التاريخية، ولا يُبطل بأثر رجعي معالجة سابقة مشروعة، ولا يمحو تلقائياً سجلات يُسمح لمزارع أو يُطلب منها الاحتفاظ بها قانوناً.`,
        `ولا يمنع السحب معالجة طلبات حقوق الخصوصية النظامية أو الاستجابة لانتهاك البيانات الشخصية. وقد يمنع السحب إجراءً اختيارياً أو خدمياً جديداً لا يمكن أداؤه قانوناً دون تجديد الموافقة.`,
        `عند تغيير جوهري في غرض المعالجة أو نطاقها، قد تطلب مزارع إقراراً مجدداً و/أو موافقة مسبقة مجددة حسب الاقتضاء. ولا تعامل مزارع مجرد استمرار التصفح على أنه موافقة مسبقة.`,
        `ولا يترتب على ممارسة حقوق الخصوصية أو سحب الموافقة معاملة عقابية للشخص المعني.`,
      ],
    },
    {
      id: 'sharing-processors',
      titleEn: '10. Data sharing, recipients, and processors',
      titleAr: '10. مشاركة البيانات والمستلمون والمعالجون',
      paragraphsEn: [
        `Mazare3 shares Personal Data only as needed for the stated purposes. Mazare3 does not sell Personal Data as a product.`,
        `Depending on active configuration, recipients or processors may include:`,
      ],
      paragraphsAr: [
        `تشارك مزارع البيانات الشخصية فقط بالقدر اللازم للأغراض المذكورة. ولا تبيع مزارع البيانات الشخصية كمنتج.`,
        `وبحسب التهيئة النشطة، قد يشمل المستلمون أو المعالجون:`,
      ],
      tableMarkdownEn: `| Provider / service | Purpose (summary) | Data categories (summary) | Processing / storage region | Cross-border note |
| --- | --- | --- | --- | --- |
| Primary database provider | Application data storage and operation | Account, Booking, payment metadata, consent and legal evidence, support records (as applicable) | ${P.PROCESSOR_REGION_NEON} | Region not publicly confirmed until resolved |
| Object-storage provider | Listing media and restricted Owner verification files | Media files; KYC/authority documents (restricted) | ${P.PROCESSOR_REGION_R2} | Region not publicly confirmed until resolved |
| Configured payment service provider (${P.PAYMENT_PROVIDER_LEGAL_NAME}) | Card processing and payment outcomes | Payment metadata; card data handled by provider (Mazare3 does not store PAN/CVV) | As configured with the provider | Assessed under Jordanian transfer rules when region confirmed |
| Google sign-in (when used) | Account authentication | Google account identifier and related sign-in signals | As operated by Google | Assessed when configuration and region evidence are confirmed |
| Transactional email provider (when enabled) | Operational notices | Email address and message content needed for notices | As configured when enabled | Only if the provider is enabled |
| Application hosting provider (${P.APP_HOSTING_PROVIDER}) | Hosting the application | Operational and application traffic as hosted | ${P.APP_HOSTING_REGION} | Hosting identity/region unresolved until confirmed |
| Counterparties on the platform | Completing Bookings and hosting | Booking and contact details needed to perform the stay (not card PAN) | Jordan marketplace operation | Shared only as needed for the Booking |`,
      tableMarkdownAr: `| المزود / الخدمة | الغرض (ملخص) | فئات البيانات (ملخص) | منطقة المعالجة / التخزين | ملاحظة عبر الحدود |
| --- | --- | --- | --- | --- |
| مزود قاعدة البيانات الأساسي | تخزين بيانات التطبيق وتشغيله | الحساب والحجز وبيانات الدفع الوصفية وأدلة الموافقة والقبول القانوني وسجلات الدعم (حسب الاقتضاء) | ${P.PROCESSOR_REGION_NEON} | المنطقة غير مؤكدة علناً حتى الحسم |
| مزود تخزين الكائنات | وسائط الإعلان وملفات تحقق المالك المقيّدة | ملفات الوسائط؛ مستندات التحقق/الصلاحية (مقيّدة) | ${P.PROCESSOR_REGION_R2} | المنطقة غير مؤكدة علناً حتى الحسم |
| مزود خدمة الدفع المهيأ (${P.PAYMENT_PROVIDER_LEGAL_NAME}) | معالجة البطاقة ونتائج الدفع | بيانات دفع وصفية؛ بيانات البطاقة لدى المزود (لا تخزّن مزارع الرقم الكامل/رمز الأمان) | وفق تهيئة المزود | تُقيَّم وفق قواعد النقل الأردنية عند تأكيد المنطقة |
| تسجيل الدخول عبر Google (عند الاستخدام) | مصادقة الحساب | معرّف حساب Google وإشارات الدخول ذات الصلة | وفق تشغيل Google | تُقيَّم عند تأكيد التهيئة وأدلة المنطقة |
| مزود البريد التشغيلي (عند التفعيل) | إشعارات تشغيلية | عنوان البريد ومحتوى الرسالة اللازم للإشعارات | وفق التهيئة عند التفعيل | فقط إذا كان المزود مفعّلاً |
| مزود استضافة التطبيق (${P.APP_HOSTING_PROVIDER}) | استضافة التطبيق | حركة تشغيلية وتطبيقية حسب الاستضافة | ${P.APP_HOSTING_REGION} | هوية/منطقة الاستضافة غير محسومة حتى التأكيد |
| الأطراف المقابلة على المنصة | إتمام الحجوزات والاستضافة | تفاصيل الحجز والتواصل اللازمة لأداء الإقامة (وليس رقم البطاقة) | تشغيل سوق الأردن | تُشارك فقط بالقدر اللازم للحجز |`,
    },
    {
      id: 'transfers',
      titleEn: '11. Transfers outside Jordan',
      titleAr: '11. النقل خارج الأردن',
      paragraphsEn: [
        `Personal Data may be shared or transferred only for stated purposes and under applicable Jordanian requirements, including rules on transfers outside Jordan.`,
        `Mazare3 does not claim that all Personal Data remains exclusively in Jordan. Some processors or service providers may process or store Personal Data outside Jordan. Exact regions for certain providers remain unresolved in this DRAFT (${P.PROCESSOR_REGION_NEON}, ${P.PROCESSOR_REGION_R2}, ${P.APP_HOSTING_PROVIDER}, ${P.APP_HOSTING_REGION}).`,
        `For transfers outside Jordan, Mazare3 assesses the protection available at the recipient. Where Jordanian law requires additional consent or safeguards, they must be applied before relying on that transfer for Production operations.`,
        `This Policy does not claim that current cross-border arrangements are fully compliant while provider regions and assessments remain unresolved.`,
      ],
      paragraphsAr: [
        `يجوز مشاركة البيانات الشخصية أو نقلها فقط للأغراض المذكورة ووفق المتطلبات الأردنية المنطبقة، بما في ذلك قواعد النقل خارج الأردن.`,
        `ولا تدّعي مزارع أن جميع البيانات الشخصية تبقى حصراً داخل الأردن. وقد يعالج بعض المعالجين أو مزودي الخدمات البيانات الشخصية أو يخزّنونها خارج الأردن. وتبقى المناطق الدقيقة لبعض المزودين غير محسومة في هذه المسودة (${P.PROCESSOR_REGION_NEON}، ${P.PROCESSOR_REGION_R2}، ${P.APP_HOSTING_PROVIDER}، ${P.APP_HOSTING_REGION}).`,
        `وبالنسبة للنقل خارج الأردن، تقيّم مزارع مستوى الحماية المتاح لدى المستلم. وحيث يشترط القانون الأردني موافقة إضافية أو ضمانات، يجب تطبيقها قبل الاعتماد على ذلك النقل في تشغيل الإنتاج.`,
        `ولا تدّعي هذه السياسة اكتمال امتثال ترتيبات النقل عبر الحدود الحالية طالما بقيت مناطق المزودين والتقييمات غير محسومة.`,
      ],
    },
    {
      id: 'retention',
      titleEn: '12. Retention and deletion',
      titleAr: '12. الاحتفاظ والحذف',
      paragraphsEn: [
        `Mazare3 does not retain Personal Data after the purpose ends unless lawful retention is required or permitted. Exact statutory retention periods for many categories remain under legal review and are not invented in this Policy.`,
        `Illustrative category schedule (tokens remain unresolved until approved):`,
      ],
      paragraphsAr: [
        `لا تحتفظ مزارع بالبيانات الشخصية بعد انتهاء الغرض ما لم يكن الاحتفاظ المشروع مطلوباً أو مسموحاً به. وتبقى المدد النظامية الدقيقة للعديد من الفئات قيد المراجعة القانونية ولا تُختلق في هذه السياسة.`,
        `جدول فئات توضيحي (تبقى الرموز غير محسومة حتى الاعتماد):`,
      ],
      tableMarkdownEn: `| Category | Retention rule (pending approval) |
| --- | --- |
| Account / profile | ${P.RETENTION_ACCOUNTS} |
| Bookings | ${P.RETENTION_BOOKINGS} |
| Payments / refunds | ${P.RETENTION_PAYMENTS} |
| Owner KYC | ${P.RETENTION_KYC} |
| Settlements / payouts | ${P.RETENTION_SETTLEMENTS} |
| Legal acceptances / Booking legal evidence | ${P.RETENTION_LEGAL_ACCEPTANCES} |
| Prior Consent history | ${P.RETENTION_CONSENT_HISTORY} |
| Audit / security records | ${P.RETENTION_AUDIT_LOGS} |
| Support / disputes | ${P.RETENTION_SUPPORT} |
| Exact location / arrival data | ${P.RETENTION_EXACT_LOCATION} |
| Privacy requests / complaints and breach records | ${P.RETENTION_BREACH} |`,
      tableMarkdownAr: `| الفئة | قاعدة الاحتفاظ (قيد الاعتماد) |
| --- | --- |
| الحساب / الملف | ${P.RETENTION_ACCOUNTS} |
| الحجوزات | ${P.RETENTION_BOOKINGS} |
| المدفوعات / الاسترداد | ${P.RETENTION_PAYMENTS} |
| تحقق المالك (KYC) | ${P.RETENTION_KYC} |
| التسويات / الصرف | ${P.RETENTION_SETTLEMENTS} |
| القبولات القانونية / الأدلة القانونية للحجز | ${P.RETENTION_LEGAL_ACCEPTANCES} |
| سجل الموافقة المسبقة | ${P.RETENTION_CONSENT_HISTORY} |
| سجلات التدقيق / الأمن | ${P.RETENTION_AUDIT_LOGS} |
| الدعم / النزاعات | ${P.RETENTION_SUPPORT} |
| الموقع الدقيق / بيانات الوصول | ${P.RETENTION_EXACT_LOCATION} |
| طلبات الخصوصية / الشكاوى وسجلات الانتهاك | ${P.RETENTION_BREACH} |`,
    },
    {
      id: 'minimisation',
      titleEn: '13. Data minimisation',
      titleAr: '13. تقليل البيانات',
      paragraphsEn: [
        `Mazare3 seeks to collect and process Personal Data necessary for the stated purpose. Practical examples from current product design include: publishing approximate location publicly while restricting exact location and arrival details to eligible rules; not storing full card PAN or CVV; and restricting access to Owner verification files.`,
        `Mazare3 does not claim that every collection is the absolute theoretical minimum in all circumstances.`,
      ],
      paragraphsAr: [
        `تسعى مزارع إلى جمع ومعالجة البيانات الشخصية اللازمة للغرض المذكور. وتشمل أمثلة عملية من تصميم المنتج الحالي: نشر الموقع التقريبي للعامة مع تقييد الموقع الدقيق وتعليمات الوصول وفق القواعد المنطبقة؛ وعدم تخزين رقم البطاقة الكامل أو رمز الأمان؛ وتقييد الوصول إلى ملفات تحقق المالك.`,
        `ولا تدّعي مزارع أن كل جمع هو الحد الأدنى النظري المطلق في جميع الظروف.`,
      ],
    },
    {
      id: 'rights',
      titleEn: '14. Data Subject rights',
      titleAr: '14. حقوق الشخص المعني',
      paragraphsEn: [
        `Subject to applicable Jordanian law, a Data Subject may request, where available:`,
        `Mazare3 does not promise unconditional deletion of financial records, Booking evidence, legal acceptances, or other records that Mazare3 is legally permitted or required to retain. Lawful retention or another applicable legal basis may limit a request. Mazare3 will explain limitations where required.`,
      ],
      paragraphsAr: [
        `مع مراعاة القانون الأردني المنطبق، يجوز للشخص المعني أن يطلب، حيث يتوفر ذلك:`,
        `ولا تعد مزارع بحذف غير مشروط لسجلات مالية أو أدلة حجز أو قبولات قانونية أو سجلات أخرى يُسمح لمزارع أو يُطلب منها الاحتفاظ بها قانوناً. وقد يقيّد الاحتفاظ المشروع أو أساس قانوني آخر منطبقاً الطلب. وستوضّح مزارع القيود حيث يلزم ذلك.`,
      ],
      bulletsEn: [
        `Access to Personal Data and obtaining a copy.`,
        `Correction or update of inaccurate Personal Data.`,
        `Objection to processing where applicable.`,
        `Withdrawal of Prior Consent where applicable.`,
        `Erasure or hiding of Personal Data where legally available.`,
        `Restriction of processing where applicable.`,
        `Portability / transfer of a copy where applicable.`,
        `Filing a privacy complaint.`,
      ],
      bulletsAr: [
        `الاطلاع على البيانات الشخصية والحصول على نسخة.`,
        `تصحيح البيانات الشخصية غير الدقيقة أو تحديثها.`,
        `الاعتراض على المعالجة حيث ينطبق ذلك.`,
        `سحب الموافقة المسبقة حيث ينطبق ذلك.`,
        `محو البيانات الشخصية أو إخفاؤها حيث يتاح ذلك قانوناً.`,
        `تقييد المعالجة حيث ينطبق ذلك.`,
        `قابلية النقل / نقل نسخة حيث ينطبق ذلك.`,
        `تقديم شكوى خصوصية.`,
      ],
    },
    {
      id: 'exercise-rights',
      titleEn: '15. How to exercise rights',
      titleAr: '15. كيفية ممارسة الحقوق',
      paragraphsEn: [
        `You may submit privacy requests through in-account privacy tools where available, and through the publishable privacy contact once resolved (${P.PRIVACY_CONTACT_EMAIL}).`,
        `Mazare3 aims to respond within 15 working days beginning from the day following receipt, subject to applicable Jordanian rules (including recognition of official non-working days where they apply).`,
      ],
      paragraphsAr: [
        `يمكنك تقديم طلبات الخصوصية عبر أدوات الخصوصية داخل الحساب حيث تتوفر، وعبر تواصل الخصوصية القابل للنشر بعد حسمه (${P.PRIVACY_CONTACT_EMAIL}).`,
        `تسعى مزارع إلى الرد خلال 15 يوم عمل تبدأ من اليوم التالي لتلقّي الطلب، مع مراعاة القواعد الأردنية المنطبقة (بما في ذلك مراعاة أيام العطل الرسمية غير العاملة حيث تنطبق).`,
      ],
    },
    {
      id: 'complaints',
      titleEn: '16. Complaints',
      titleAr: '16. الشكاوى',
      paragraphsEn: [
        `A Data Subject may first submit a privacy complaint to Mazare3. Filing a privacy complaint does not attract adverse consequences from Mazare3 for exercising that right.`,
        `A Data Subject may also escalate under the applicable Jordanian procedure to the Personal Data Protection Directorate / competent Unit.`,
        `Current official contact evidence for the Personal Data Protection Directorate, Ministry of Digital Economy and Entrepreneurship: email PDP@modee.gov.jo; phone +962 6 5805700. Regulator procedures are controlled by the competent authority, not by Mazare3.`,
      ],
      paragraphsAr: [
        `يجوز للشخص المعني أن يقدّم أولاً شكوى خصوصية إلى مزارع. ولا يترتب على تقديم شكوى خصوصية عواقب سلبية من مزارع بسبب ممارسة هذا الحق.`,
        `ويجوز للشخص المعني أيضاً التصعيد وفق الإجراء الأردني المنطبق إلى مديرية حماية البيانات الشخصية / الوحدة المختصة.`,
        `أدلة التواصل الرسمية الحالية لمديرية حماية البيانات الشخصية في وزارة الاقتصاد الرقمي والريادة: البريد PDP@modee.gov.jo؛ الهاتف +962 6 5805700. وتخضع إجراءات الجهة الرقابية للسلطة المختصة وليس لمزارع.`,
      ],
    },
    {
      id: 'security',
      titleEn: '17. Security measures',
      titleAr: '17. تدابير الأمن',
      paragraphsEn: [
        `Mazare3 applies technical and organisational measures appropriate to the processing, including access controls, password hashing, encryption of selected sensitive financial fields where implemented, private restricted storage for Owner verification files, audit and accountability controls, exact-location access gating, the payment-card boundary described above, and personal-data breach response controls.`,
        `No security programme eliminates all risk. Mazare3 does not claim perfect security.`,
      ],
      paragraphsAr: [
        `تطبّق مزارع تدابير تقنية وتنظيمية مناسبة للمعالجة، بما في ذلك ضوابط الوصول، وتجزئة كلمات المرور، وتشفير حقول مالية حساسة مختارة حيث طُبّق ذلك، وتخزين خاص مقيّد لملفات تحقق المالك، وضوابط التدقيق والمساءلة، وتقييد الوصول إلى الموقع الدقيق، وحدود بيانات البطاقة الموضحة أعلاه، وضوابط الاستجابة لانتهاك البيانات الشخصية.`,
        `ولا يلغي أي برنامج أمني جميع المخاطر. ولا تدّعي مزارع أمناً مطلقاً.`,
      ],
    },
    {
      id: 'breaches',
      titleEn: '18. Personal Data breaches',
      titleAr: '18. انتهاكات البيانات الشخصية',
      paragraphsEn: [
        `Where a qualifying personal-data breach is likely to cause severe harm, Mazare3 notifies Affected Data Subjects within the applicable 24-hour period from discovery, and notifies the competent Unit within the applicable 72-hour period, subject to legal requirements and circumstances.`,
        `Not every technical security incident is a personal-data breach that triggers those notification duties. Mazare3 assesses incidents under applicable Jordanian requirements.`,
      ],
      paragraphsAr: [
        `حيث يكون انتهاك بيانات شخصية مؤهلاً ويُرجَّح أن يسبب ضرراً جسيماً، تُخطر مزارع الأشخاص المعنيين المتأثرين خلال مدة الـ 24 ساعة المنطبقة من الاكتشاف، وتُخطر الوحدة المختصة خلال مدة الـ 72 ساعة المنطبقة، مع مراعاة المتطلبات والظروف القانونية.`,
        `وليس كل حادث أمني تقني انتهاكاً للبيانات الشخصية يستدعي تلك واجبات الإخطار. وتقيّم مزارع الحوادث وفق المتطلبات الأردنية المنطبقة.`,
      ],
    },
    {
      id: 'cookies',
      titleEn: '19. Cookies and similar technologies',
      titleAr: '19. ملفات تعريف الارتباط والتقنيات المماثلة',
      paragraphsEn: [
        `Mazare3 uses essential cookies and similar technologies needed to run the service (for example authentication/session, locale or preference storage, security protections, and payment-related necessary technologies on payment-provider pages where applicable).`,
        `At the time of this DRAFT, Mazare3 does not treat Google Analytics or Meta Pixel as confirmed active tracking in the application based on the existing cookie audit. Non-essential cookies or analytics require explicit optional consent before activation.`,
        `For more detail, see the Cookie Policy. This Privacy Policy does not rewrite the Cookie Policy.`,
      ],
      paragraphsAr: [
        `تستخدم مزارع ملفات تعريف ارتباط وتقنيات مماثلة أساسية لتشغيل الخدمة (مثل المصادقة/الجلسة، وتخزين اللغة أو التفضيلات، والحمايات الأمنية، وتقنيات الدفع اللازمة على صفحات مزود الدفع عند الاقتضاء).`,
        `وفي وقت هذه المسودة، لا تعامل مزارع Google Analytics أو Meta Pixel على أنهما تتبع نشط مؤكد في التطبيق استناداً إلى تدقيق ملفات الارتباط القائم. وتتطلب ملفات الارتباط أو التحليلات غير الأساسية موافقة اختيارية صريحة قبل التفعيل.`,
        `وللمزيد من التفصيل، راجع سياسة ملفات تعريف الارتباط. ولا تعيد سياسة الخصوصية هذه كتابة سياسة ملفات تعريف الارتباط.`,
      ],
    },
    {
      id: 'listing-media',
      titleEn: '20. Listing media',
      titleAr: '20. وسائط الإعلان',
      paragraphsEn: [
        `Owners may upload listing media. Such media may incidentally contain identifiable persons. Mazare3 does not perform facial recognition or biometric analysis on listing media. Owners should upload only content they are entitled to provide. Detailed Owner content obligations remain in the Owner Agreement and related community or content policies.`,
      ],
      paragraphsAr: [
        `قد يرفع المالكون وسائط للإعلان. وقد تتضمن تلك الوسائط بصورة عرضية أشخاصاً يمكن التعرف عليهم. ولا تُجري مزارع تعرّفاً على الوجوه أو تحليلاً حيوياً لوسائط الإعلان. وينبغي للمالكين رفع محتوى يحق لهم تقديمه فقط. وتبقى التزامات محتوى المالك التفصيلية في اتفاقية المالك وسياسات المجتمع أو المحتوى ذات الصلة.`,
      ],
    },
    {
      id: 'children',
      titleEn: '21. Children and persons without legal capacity',
      titleAr: '21. الأطفال ومن ليس لديهم أهلية قانونية',
      paragraphsEn: [
        `Mazare3 is not intended to obtain service or account consent from persons who lack the legal capacity to provide it without the legally appropriate guardian or representative process.`,
        `Mazare3 does not currently provide a dedicated guardian-consent flow for such cases. Processing and account features remain aligned with that limitation. This Policy does not invent a fixed numerical age threshold for all processing.`,
      ],
      paragraphsAr: [
        `ليست مزارع مخصصة للحصول على موافقة الخدمة أو الحساب من أشخاص يفتقرون إلى الأهلية القانونية لتقديمها دون مسار الولي أو الممثل القانوني المناسب.`,
        `ولا توفّر مزارع حالياً مساراً مخصصاً لموافقة الولي في تلك الحالات. وتبقى المعالجة وخصائص الحساب متوافقة مع هذا القيد. ولا تخترع هذه السياسة حداً عمرِياً رقمياً ثابتاً لكل معالجة.`,
      ],
    },
    {
      id: 'updates',
      titleEn: '22. Policy updates and versioning',
      titleAr: '22. تحديثات السياسة والإصدارات',
      paragraphsEn: [
        `This Privacy Policy is versioned. Material changes may require renewed acknowledgement and/or renewed Prior Consent where the processing purpose or scope requires it. Continued browsing alone is not treated as Prior Consent. Users may be notified of material changes through available channels.`,
      ],
      paragraphsAr: [
        `تصدر سياسة الخصوصية هذه بإصدارات. وقد تتطلب التغييرات الجوهرية إقراراً مجدداً و/أو موافقة مسبقة مجددة حيث يقتضي غرض المعالجة أو نطاقها ذلك. ولا يُعامل مجرد استمرار التصفح على أنه موافقة مسبقة. وقد يُخطَر المستخدمون بالتغييرات الجوهرية عبر القنوات المتاحة.`,
      ],
    },
    {
      id: 'contact',
      titleEn: '23. Contact information',
      titleAr: '23. معلومات التواصل',
      paragraphsEn: [
        `Controller: ${P.LEGAL_ENTITY_INTRO_EN}. Registered address: ${P.REGISTERED_ADDRESS_EN}. Privacy contact: ${P.PRIVACY_CONTACT_EMAIL}. Related documents: Terms & Conditions, Cookie Policy, and in-account privacy tools where available.`,
      ],
      paragraphsAr: [
        `المسؤول عن المعالجة: ${P.LEGAL_ENTITY_INTRO_AR}. العنوان المسجّل: ${P.REGISTERED_ADDRESS_AR}. تواصل الخصوصية: ${P.PRIVACY_CONTACT_EMAIL}. الوثائق ذات الصلة: الشروط والأحكام، وسياسة ملفات تعريف الارتباط، وأدوات الخصوصية داخل الحساب حيث تتوفر.`,
      ],
    },
  ],
});
