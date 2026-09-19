# Mazare3 — Privacy Policy Phase 3C.4B.2C Final Review Export

**Status:** DRAFT only — advisor-final text for counsel/provider input — NOT counsel-approved — NOT Production-active  
**Version:** 1.1.2-advisor-final  
**Preserved:** 1.1.1-advisor-revised, 1.1.0-advisor-revised, 1.0.1-launch-candidate  
**Contractual Terms/Booking/Cancellation:** unchanged at 1.1.2-advisor-final (different documentType)

---

## Unresolved placeholders

- `[[LEGAL_ENTITY_INTRO_EN]]`
- `[[PRIVACY_POLICY_EFFECTIVE_DATE]]`
- `[[PRIVACY_POLICY_LAST_UPDATED_DATE]]`
- `[[LEGAL_ENTITY_NAME_EN]]`
- `[[LEGAL_ENTITY_NAME_AR]]`
- `[[LEGAL_FORM_EN]]`
- `[[LEGAL_FORM_AR]]`
- `[[COMMERCIAL_REGISTRATION_NUMBER]]`
- `[[REGISTERED_ADDRESS_EN]]`
- `[[REGISTERED_ADDRESS_AR]]`
- `[[PRIVACY_CONTACT_EMAIL]]`
- `[[DPO_OR_PRIVACY_CONTACT]]`
- `[[PAYMENT_PROVIDER_LEGAL_NAME]]`
- `[[DATABASE_PROVIDER_LEGAL_NAME]]`
- `[[DATABASE_PROVIDER_PRIVACY_CONTACT]]`
- `[[PROCESSOR_REGION_NEON]]`
- `[[OBJECT_STORAGE_PROVIDER_LEGAL_NAME]]`
- `[[OBJECT_STORAGE_PROVIDER_PRIVACY_CONTACT]]`
- `[[PROCESSOR_REGION_R2]]`
- `[[PAYMENT_PROVIDER_PRIVACY_CONTACT]]`
- `[[PAYMENT_PROVIDER_PROCESSING_REGION]]`
- `[[GOOGLE_SIGNIN_PROVIDER_LEGAL_NAME]]`
- `[[GOOGLE_SIGNIN_PROVIDER_PRIVACY_CONTACT]]`
- `[[GOOGLE_SIGNIN_PROCESSING_REGION]]`
- `[[ACTIVE_EMAIL_PROVIDER_LEGAL_NAME]]`
- `[[ACTIVE_EMAIL_PROVIDER_PRIVACY_CONTACT]]`
- `[[ACTIVE_EMAIL_PROVIDER_PROCESSING_REGION]]`
- `[[APP_HOSTING_PROVIDER]]`
- `[[APP_HOSTING_PROVIDER_PRIVACY_CONTACT]]`
- `[[APP_HOSTING_REGION]]`
- `[[RETENTION_ACCOUNTS]]`
- `[[RETENTION_BOOKINGS]]`
- `[[RETENTION_PAYMENTS]]`
- `[[RETENTION_KYC]]`
- `[[RETENTION_SETTLEMENTS]]`
- `[[RETENTION_LEGAL_ACCEPTANCES]]`
- `[[RETENTION_CONSENT_HISTORY]]`
- `[[RETENTION_AUDIT_LOGS]]`
- `[[RETENTION_SUPPORT]]`
- `[[RETENTION_EXACT_LOCATION]]`
- `[[RETENTION_REVIEWS]]`
- `[[RETENTION_LISTING_MEDIA]]`
- `[[RETENTION_PRIVACY_REQUESTS]]`
- `[[RETENTION_BREACH_RECORDS]]`
- `[[LEGAL_ENTITY_INTRO_AR]]`

---

## Remaining external blockers

- privacyContactEmail / DPO contact (dpoAppointed=false)
- PSP / database / object storage / Google / email / hosting legal names, privacy contacts, and processing regions
- Retention schedule tokens
- Prior Consent durations
- Cross-border DPIAs (must be completed before Production reliance)
- `PRIVACY_TRACKER_RUNTIME_VERIFICATION_REQUIRED`
- Article 14 transfer register legal sufficiency: COUNSEL_REVIEW_REQUIRED
- Article 9 notice legal sufficiency: COUNSEL_REVIEW_REQUIRED
- Privacy Policy counsel review + founder publication approval

### Profiling audit

```json
{
  "phase": "3C.4B.2C",
  "jordanDefinedProfilingPresent": false,
  "publicDisclosureRequired": "STATE_NO_CURRENT_PROFILING",
  "notes": [
    "recommended ranking scores Properties, not Data Subject behavioural profiles",
    "favourites and search are not treated as Profiling under Jordan PDPL definition",
    "optional analytics consent exists for future use but is not active Profiling"
  ]
}
```

### Article 9 notice audit (summary)

- Purposes covered: 9
- Evidence reuse: consentText / hash / purposeVersion / privacyNoticeVersionId
- Start events are purpose-specific (not invented calendar dates)

### Article 14 transfer evidence

```json
{
  "phase": "3C.4B.2C",
  "status": "SUFFICIENT_ONCE_PROCESSORS_AND_DISCLOSURE_FINALISED",
  "evidenceFields": [
    "consentText",
    "consentTextHash",
    "purposeVersion",
    "privacyNoticeVersionId",
    "language",
    "grantedAt",
    "sourceSurface"
  ],
  "transferRegisterModel": "PersonalDataTransferRegisterEntry",
  "transferRegisterLegalSufficiency": "COUNSEL_REVIEW_REQUIRED",
  "productionBlocker": "PROCESSOR_IDENTITY_UNRESOLVED — do not mark Article 14 transfer consent ready until active processor legal names/contacts and recipient disclosures are confirmed; transfer register legal sufficiency remains COUNSEL_REVIEW_REQUIRED",
  "googleMinimalPreConsentLegalBasis": "LEGAL_BASIS_COUNSEL_REVIEW_REQUIRED",
  "note": "Prior Consent evidence proves what the Data Subject was shown. PersonalDataTransferRegisterEntry records transfer/exchange relationships (categories + recipient + purpose + consent linkage) without copying raw Personal Data."
}
```

---

## FULL Arabic (1.1.2-advisor-final)

```markdown
# سياسة الخصوصية

توضّح سياسة الخصوصية هذه كيفية معالجة البيانات الشخصية في إطار سوق مزارع (مزارع / مزارع الأردن)، الذي تشغّله [[LEGAL_ENTITY_INTRO_AR]]. هذه الوثيقة إشعار شفافية. الإقرار بسياسة الخصوصية لا يُعدّ موافقة مسبقة، وهو منفصل عن قبول الشروط والأحكام وعن أي خيارات اختيارية للتسويق أو التحليلات. الإصدار: 1.1.2-advisor-final. تاريخ السريان: [[PRIVACY_POLICY_EFFECTIVE_DATE]]. آخر تحديث: [[PRIVACY_POLICY_LAST_UPDATED_DATE]].

## 1. الغرض والنطاق

تصف سياسة الخصوصية هذه كيف تعالج مزارع البيانات الشخصية للعملاء والمالكين/الشركاء وزوار الموقع الذين ينشئون حسابات أو يتصفحون الإعلانات أو يُجرون حجوزات أو يديرونها أو يُجرون مدفوعات أو استرداداً أو يتحققون من هوية المالك أو يشغّلون العقارات أو يتواصلون مع الدعم أو يمارسون حقوق الخصوصية أو يستخدمون خدمات مزارع بأي شكل آخر.

تنطبق على المعالجة المرتبطة بسوق مزارع الأردن. ولا تحل محل الشروط والأحكام أو شروط الحجز أو سياسة الإلغاء والاسترداد أو سياسة ملفات تعريف الارتباط أو اتفاقية المالك أو السياسات المنشورة الأخرى. وحيث تعالج تلك الوثائق حقوقاً أو التزامات تعاقدية، فإنها تبقى منفصلة.


## 2. هوية المسؤول عن معالجة البيانات

المسؤول عن معالجة البيانات الشخصية لمعالجة مزارع الموصوفة في هذه السياسة هو [[LEGAL_ENTITY_INTRO_AR]].

الاسم القانوني (بالإنجليزية): [[LEGAL_ENTITY_NAME_EN]]. الاسم القانوني (بالعربية): [[LEGAL_ENTITY_NAME_AR]]. الشكل القانوني: [[LEGAL_FORM_EN]] / [[LEGAL_FORM_AR]] (يُذكر منفصلاً عن الاسم القانوني). رقم السجل التجاري [[COMMERCIAL_REGISTRATION_NUMBER]]. الاختصاص: المملكة الأردنية الهاشمية / عمّان.

العنوان المسجّل: [[REGISTERED_ADDRESS_EN]] / [[REGISTERED_ADDRESS_AR]].

مزارع / مزارع الأردن هو اسم المنتج والعلامة التجارية للسوق. شركة الرجل الوطواط للتكنولوجيا / BATMAN TECHNOLOGY هي الكيان القانوني الذي يشغّل العلامة.

تواصل الخصوصية: [[PRIVACY_CONTACT_EMAIL]]. ويمكن للأشخاص المعنيين أيضاً استخدام أدوات الخصوصية داخل الحساب حيث تتوفر.

تواصل مراقب حماية البيانات الشخصية: [[DPO_OR_PRIVACY_CONTACT]].


## 3. المعلومات المقدَّمة قبل المعالجة

قبل بدء معالجة البيانات الشخصية، ومع مراعاة الاستثناءات النظامية المنطبقة، تزوّد مزارع الشخص المعني إلكترونياً أو خطياً بالمعلومات التي يقتضيها القانون الأردني، بما في ذلك: البيانات الشخصية التي ستُعالَج؛ وموعد بدء المعالجة (بحسب حدث البدء المنطبق لذلك الغرض)؛ وغرض المعالجة؛ ومدة المعالجة؛ والمعالج أو المعالجين المعنيين؛ ومعلومات مناسبة وغير حسّاسة عن تدابير الأمن والحماية المنطبقة؛ ومعلومات عن التنميط إن وُجد.

وتوقيت بدء المعالجة مرتبط بالغرض. وعلى سبيل المثال: تبدأ معالجة الحساب بعد الموافقة أو البوابة المنطبقة للحساب؛ وتبدأ معالجة الحجز عند بدء إجراء حجز جديد؛ وتبدأ معالجة التحقق قبل رفع مستندات التحقق أو تخزينها؛ وتبدأ معالجة الصرف قبل جمع تفاصيل الصرف أو الآيبان؛ وتبدأ معالجة الموقع الدقيق قبل تخزين بيانات الموقع الدقيق.

لا تستخدم مزارع حالياً التنميط الآلي للأشخاص المعنيين بالمعنى المحدد في قانون حماية البيانات الشخصية الأردني.


## 4. فئات البيانات الشخصية — العملاء

ليس كل عميل يقدّم كل حقل. وحيث ينطبق ذلك، قد تعالج مزارع:

- معلومات الهوية والتواصل مثل الاسم وعنوان البريد الإلكتروني ورقم الهاتف.
- معلومات الحساب مثل تفضيلات اللغة أو الإعدادات المحلية وحالة الحساب أو الدور.
- معلومات المصادقة مثل تجزئة كلمة المرور (وليس كلمة المرور بنص صريح)، وعند استخدام تسجيل الدخول عبر Google: معرّف حساب Google، والاسم وعنوان البريد الإلكتروني المستلمين من Google لإنشاء الحساب أو ربطه حيث ينطبق ذلك.
- معلومات الحجز وتفاصيل الضيوف أو المجموعة المقدَّمة للحجز وما يرتبط بها من جدولة أو حالة.
- بيانات وصفية للمدفوعات والاسترداد (مثل المبالغ والعملة والحالة ومراجع الطريقة ومراجع معاملة أو رمز لدى مزود الدفع) — وليس رقم البطاقة الكامل أو رمز الأمان.
- بيانات وصفية لوسائل الدفع المحفوظة حيث تكون الميزة مفعّلة (مراجع المزود/الرمز، وليس أرقام البطاقات الكاملة).
- أدلة تسجيل الوصول المرتبطة بحجز مؤهل.
- المراجعات والمفضلة والتفاعلات المماثلة في السوق.
- مراسلات الدعم أو النزاعات أو الحوادث والأدلة ذات الصلة.
- سجلات الموافقة المسبقة وأدلة الموافقة الموثقة والمرتبطة بإصدار نص الموافقة.
- أدلة الإقرار القانوني بالوثائق القانونية المنشورة (بما في ذلك الإقرار بسياسة الخصوصية ولقطات قانونية مرتبطة بالحجز حيث تُستخدم).
- طلبات حقوق الخصوصية وشكاوى الخصوصية وسجلات المعالجة ذات الصلة.


## 5. فئات البيانات الشخصية — المالكون / الشركاء

وحيث ينطبق ذلك، قد تعالج مزارع للمالكين/الشركاء:

- معلومات الهوية والتواصل.
- معلومات تهيئة المالك والملف التجاري.
- مستندات التحقق من الهوية/الصلاحية ومعلومات المراجعة ذات الصلة (تُخزَّن في تخزين كائنات خاص مقيّد حيث تُهيأ — وليست صوراً عامة للإعلان).
- بيانات العقار والإعلان، بما في ذلك الموقع التقريبي العام، وحيث يُستخدم وفق قواعد المنتج: العنوان الدقيق للعقار والإحداثيات وتعليمات الوصول.
- معلومات البنك / الآيبان / المستفيد ومعلومات التسوية أو الصرف.
- أدلة القبول التجاري والقانوني المرتبطة بمشاركة المالك.
- معلومات الموثوقية والحوادث والدعم والنزاعات.


## 6. البيانات الشخصية الحساسة

وفقاً لإطار حماية البيانات الشخصية في المملكة الأردنية الهاشمية، تُعدّ المعلومات المالية بيانات شخصية حساسة. وحيث ينطبق ذلك، يشمل ذلك معلومات الآيبان والبنك/المستفيد، ومعلومات المعاملات المالية، ومعلومات الصرف والتسوية، وغيرها من البيانات الشخصية المالية التي تُعالَج لتشغيل مزارع.

مستندات تحقق المالك/الصلاحية بيانات شخصية عالية المخاطر وقد تتضمن بيانات شخصية حساسة بحسب محتوى المستندات المقدَّمة. ولا تدّعي مزارع أن كل مستند تحقق يحتوي دائماً على كل حقل حساس محتمل.

قد تتضمن رسائل الدعم أو النزاعات أو الحوادث بنص حر بيانات شخصية حساسة بصورة عرضية. وتسعى مزارع إلى تقليل المحتوى الحساس غير الضروري في تلك القنوات.

لا تخزّن مزارع رقم البطاقة الكامل (PAN) ولا رمز الأمان (CVV). وتُجرى معالجة البطاقة عبر مزود خدمة الدفع المهيأ ([[PAYMENT_PROVIDER_LEGAL_NAME]]). وقد تحتفظ مزارع ببيانات وصفية للدفع ومراجع المزود/الرمز حيث يلزم ذلك للمنتج.


## 7. كيف تجمع مزارع البيانات الشخصية

قد تجمع مزارع البيانات الشخصية:

- مباشرة منك (نماذج الحساب، تفاصيل الحجز، تهيئة المالك، الملفات المرفوعة، الرسائل، طلبات الخصوصية).
- تلقائياً من استخدام الخدمة (سجلات الجلسة والأمن، أحداث دورة الحجز، أحداث تسجيل الوصول، وسجلات تشغيلية مماثلة).
- من معالجين أو مزودي خدمات مهيأين لأغراض مذكورة (مثل نتائج الدفع من مزود خدمة الدفع؛ وعند اختيار تسجيل الدخول عبر Google: معرّف الحساب والاسم والبريد الإلكتروني كما تُستلم للمصادقة وإنشاء الحساب أو ربطه؛ ومزودي الاستضافة أو التخزين).


## 8. أغراض المعالجة

تعالج مزارع البيانات الشخصية لأغراض تشمل، حيث ينطبق ذلك:

- إنشاء الحسابات والمصادقة عليها.
- تشغيل السوق (البحث، الإعلانات، المفضلة، المراجعات).
- معالجة الحجوزات ودورة الحجز، بما في ذلك موافقة المالك حيث ينطبق ذلك.
- المدفوعات والاسترداد والعمليات المالية ذات الصلة.
- وسائل الدفع المحفوظة حيث تكون الميزة مفعّلة.
- التحقق من هوية المالك وصلاحياته.
- تشغيل العقار والإعلان.
- معلومات الموقع الدقيق والوصول وفق قواعد المنتج المنطبقة.
- صرف المالك والتسويات.
- دعم العملاء والمالكين والنزاعات ومعالجة الحوادث.
- الرد على طلبات حقوق الأشخاص المعنيين وشكاوى الخصوصية.
- الأمن ومنع الاحتيال والمساءلة.
- الاستجابة لإخلال بأمن وسلامة البيانات الشخصية حيث ينطبق ذلك.
- الاتصالات التشغيلية المتعلقة بحسابك أو حجزك أو دفعك (وليست تسويقاً اختيارياً).
- التسويق الاختياري، فقط إذا منحت موافقة اختيارية منفصلة وكانت الميزة مفعّلة.
- التحليلات الاختيارية أو ملفات الارتباط غير الأساسية، فقط بعد موافقة منفصلة وعند التفعيل.


## 9. الأساس القانوني والموافقة المسبقة

تطبّق مزارع متطلبات حماية البيانات الشخصية الأردنية. ولا تعتمد هذه السياسة على تسميات قانون أجنبي مثل «المصلحة المشروعة» أو «ضرورة العقد» كأسس قانونية أردنية لمعالجة مزارع ذاتها.

وحيث تُشترط الموافقة المسبقة، تحصل عليها مزارع بصورة صريحة وموثقة خطياً أو إلكترونياً؛ ومحددة بالغرض؛ ومحددة بالمدة؛ ومطلوبة بلغة واضحة وبسيطة وغير مضللة؛ ويمكن الوصول إليها بسهولة. ولا تغطي موافقة مسبقة واحدة كل أغراض المعالجة.

وحيث يشترط القانون الأردني أو يجيز صراحةً لمزارع معالجة البيانات الشخصية دون موافقة مسبقة، يجوز لمزارع أن تعالج فقط بالقدر الذي يسمح به أو يطلبه ذلك الأساس القانوني.

الإقرار بسياسة الخصوصية إشعار وشفافية فقط. ولا يحل محل الموافقة المسبقة حيث تكون الموافقة المسبقة مطلوبة قانوناً. وقبول الشروط منفصل. وموافقة التسويق أو التحليلات الاختيارية، عند استخدامها، منفصلة أيضاً.


## 10. مدة الموافقة والسحب وإعادة الموافقة

تُفصح مدة الموافقة المسبقة أو حدث سريانها المنطبق عند نقطة الموافقة ذات الصلة.

يجوز للشخص المعني سحب الموافقة المسبقة بالنسبة للمعالجة المستقبلية المعتمدة على الموافقة. والسحب لا يعيد كتابة سجلات الموافقة التاريخية، ولا يُبطل بأثر رجعي معالجة سابقة مشروعة، ولا يمحو تلقائياً سجلات يُسمح لمزارع أو يُطلب منها الاحتفاظ بها قانوناً.

ولا يمنع السحب معالجة طلبات حقوق الخصوصية النظامية أو الاستجابة لإخلال بأمن وسلامة البيانات الشخصية. وإذا جعل سحب الموافقة إجراء معالجة جديداً مستقبلياً مستحيلاً قانوناً، فقد تتعذّر على مزارع أداء ذلك الإجراء الجديد المعتمد على الموافقة. وهذا ليس عقوبة على ممارسة حق خصوصية.

إذا تغيّرت طبيعة أو نوع أو غرض أو نطاق جوهري ذي صلة لمعالجة معتمدة على الموافقة بما يستوجب موافقة مسبقة جديدة، تحصل مزارع على موافقة مسبقة جديدة قبل تنفيذ تلك المعالجة المتغيّرة. ولا تستوجب بذاتها التعديلات الشكلية أو التصحيحات الكتابية العادية لهذه السياسة التي لا تغيّر المعالجة المعتمدة على الموافقة إعادة موافقة. وقد تبقى التغييرات التي تقتصر على الإقرار خاضعة للإقرار حيث يكون ذلك مناسباً قانوناً. ولا تعامل مزارع مجرد استمرار التصفح على أنه موافقة مسبقة.

ولا يترتب بذاته على ممارسة حقوق الشخص المعني أو سحب الموافقة أثر مالي أو تعاقدي، دون الإخلال بحقوق مزارع المشروعة. ولا تلغي مزارع استرداداً مستحقاً، ولا تلغي صرفاً مستحقاً للمالك، ولا تغيّر اقتصاديات حجز قائم، ولا تفرض رسماً على حق خصوصية لمجرد ممارسة حق خصوصية.


## 11. مشاركة البيانات والمستلمون والمعالجون

تشارك مزارع البيانات الشخصية فقط بالقدر اللازم للأغراض المذكورة. لا تبيع مزارع البيانات الشخصية.

وحيث تنطبق المادة 14 من قانون حماية البيانات الشخصية الأردني على نقل أو تبادل بيانات شخصية مع شخص أو مستلم آخر، تحصل مزارع على موافقة الشخص المعني المنطبقة لذلك النقل أو التبادل ما لم ينطبق استثناء نظامي، ويجب أن يستوفي النقل أو التبادل الشروط النظامية المنطبقة، بما في ذلك أن يخدم المصالح المشروعة للمسؤول عن المعالجة وللمستلم. وهذا الشرط الخاص بنقل المادة 14 ليس أساساً قانونياً أردنياً عاماً لمعالجة مزارع ذاتها، وليس أساس معالجة أجنبي تحت مسمّى «المصلحة المشروعة».

ويجب أن تتوافر لدى الشخص المعني معلومات كافية عن المستلم والغرض الذي ستُستخدم من أجله البيانات. ويتطلب النقل لغايات التسويق الموافقة التسويقية المنطبقة. وتحتفظ مزارع بسجلات عمليات نقل وتبادل البيانات وفق ما يقتضيه القانون الأردني المنطبق.

وبحسب التهيئة النشطة، قد يشمل المستلمون أو المعالجون:

| المزود | الغرض (ملخص) | فئات البيانات (ملخص) | تواصل الخصوصية | منطقة المعالجة / التخزين |
| --- | --- | --- | --- | --- |
| [[DATABASE_PROVIDER_LEGAL_NAME]] | تخزين بيانات التطبيق وتشغيله | الحساب والحجز وبيانات الدفع الوصفية وأدلة الموافقة والقبول القانوني وسجلات الدعم (حسب الاقتضاء) | [[DATABASE_PROVIDER_PRIVACY_CONTACT]] | [[PROCESSOR_REGION_NEON]] |
| [[OBJECT_STORAGE_PROVIDER_LEGAL_NAME]] | وسائط الإعلان وملفات تحقق المالك المقيّدة | ملفات الوسائط؛ مستندات التحقق/الصلاحية (مقيّدة) | [[OBJECT_STORAGE_PROVIDER_PRIVACY_CONTACT]] | [[PROCESSOR_REGION_R2]] |
| [[PAYMENT_PROVIDER_LEGAL_NAME]] | معالجة البطاقة ونتائج الدفع | بيانات دفع وصفية؛ بيانات البطاقة لدى المزود (لا تخزّن مزارع الرقم الكامل/رمز الأمان) | [[PAYMENT_PROVIDER_PRIVACY_CONTACT]] | [[PAYMENT_PROVIDER_PROCESSING_REGION]] |
| [[GOOGLE_SIGNIN_PROVIDER_LEGAL_NAME]] (عند استخدام تسجيل الدخول عبر Google) | مصادقة الحساب | معرّف حساب Google والاسم والبريد الإلكتروني كما تُستلم لتسجيل الدخول / إنشاء الحساب أو ربطه | [[GOOGLE_SIGNIN_PROVIDER_PRIVACY_CONTACT]] | [[GOOGLE_SIGNIN_PROCESSING_REGION]] |
| [[ACTIVE_EMAIL_PROVIDER_LEGAL_NAME]] (عند تفعيل البريد التشغيلي) | إشعارات تشغيلية | عنوان البريد ومحتوى الرسالة اللازم للإشعارات | [[ACTIVE_EMAIL_PROVIDER_PRIVACY_CONTACT]] | [[ACTIVE_EMAIL_PROVIDER_PROCESSING_REGION]] |
| [[APP_HOSTING_PROVIDER]] | استضافة التطبيق | حركة تشغيلية وتطبيقية حسب الاستضافة | [[APP_HOSTING_PROVIDER_PRIVACY_CONTACT]] | [[APP_HOSTING_REGION]] |
| الأطراف المقابلة على المنصة | إتمام الحجوزات والاستضافة | تفاصيل الحجز والتواصل اللازمة لإتمام الحجز وتقديم الخدمة المتعلقة باستخدام العقار المحجوز (وليس رقم البطاقة) | — | تشغيل سوق الأردن |


## 12. النقل خارج الأردن

يجوز مشاركة البيانات الشخصية أو نقلها فقط للأغراض المذكورة ووفق المتطلبات الأردنية المنطبقة.

وقبل نقل البيانات الشخصية خارج الأردن، تتحقق مزارع من مستوى الحماية الذي يوفّره المستلم وفق ما يقتضيه القانون الأردني. وحيث لا يوفّر المستلم المستوى المطلوب، لا يجوز النقل إلا حيث يسمح استثناء قانوني منطبقاً بموجب المادة 15. وحيث يُراد الاعتماد على موافقة الشخص المعني على نقل رغم عدم كفاية الحماية، يجب أولاً إعلام الشخص المعني بعدم كفاية الحماية وفق ما يقتضيه القانون. ولا تدّعي مزارع أنها تعتمد حالياً على ذلك الاستثناء القائم على الموافقة.

وقبل نقل البيانات الشخصية إلى خارج المملكة، تجري مزارع تقييم أثر حماية البيانات الشخصية الذي تقتضيه التعليمات الأردنية المنطبقة.

وتُحدَّد مواقع المعالجة والتخزين للمستلمين والمعالجين النشطين في القسم 11.


## 13. الاحتفاظ والحذف

لا تحتفظ مزارع بالبيانات الشخصية بعد استنفاد الغرض من المعالجة، إلا إذا نص تشريع منطبق على خلاف ذلك. ويكون الاحتفاظ لكل فئة كما يلي:

| الفئة | الاحتفاظ |
| --- | --- |
| الحساب / الملف | [[RETENTION_ACCOUNTS]] |
| الحجوزات | [[RETENTION_BOOKINGS]] |
| المدفوعات / الاسترداد | [[RETENTION_PAYMENTS]] |
| تحقق المالك | [[RETENTION_KYC]] |
| التسويات / الصرف | [[RETENTION_SETTLEMENTS]] |
| القبولات القانونية / الأدلة القانونية للحجز | [[RETENTION_LEGAL_ACCEPTANCES]] |
| سجل الموافقة المسبقة | [[RETENTION_CONSENT_HISTORY]] |
| سجلات التدقيق / الأمن | [[RETENTION_AUDIT_LOGS]] |
| الدعم / النزاعات | [[RETENTION_SUPPORT]] |
| الموقع الدقيق / بيانات الوصول | [[RETENTION_EXACT_LOCATION]] |
| المراجعات | [[RETENTION_REVIEWS]] |
| وسائط الإعلان | [[RETENTION_LISTING_MEDIA]] |
| طلبات الخصوصية / الشكاوى | [[RETENTION_PRIVACY_REQUESTS]] |
| سجلات خرق أمن وسلامة البيانات الشخصية | [[RETENTION_BREACH_RECORDS]] |


## 14. تقليل البيانات

تسعى مزارع إلى جمع ومعالجة البيانات الشخصية اللازمة للغرض المذكور. وتشمل أمثلة عملية من تصميم المنتج الحالي: نشر الموقع التقريبي للعامة مع تقييد الموقع الدقيق وتعليمات الوصول وفق القواعد المنطبقة؛ وعدم تخزين رقم البطاقة الكامل أو رمز الأمان؛ وتقييد الوصول إلى ملفات تحقق المالك.

ولا تدّعي مزارع أن كل جمع هو الحد الأدنى النظري المطلق في جميع الظروف.


## 15. حقوق الشخص المعني

مع مراعاة شروط وحدود القانون الأردني المنطبق، للشخص المعني الحقوق التالية:

- العلم ببياناته الشخصية والاطلاع عليها والوصول إليها والحصول على نسخة منها.
- سحب الموافقة المسبقة حيث ينطبق ذلك.
- تصحيح البيانات الشخصية أو تعديلها أو الإضافة إليها أو تحديثها.
- تقييد المعالجة بنطاق محدد حيث ينطبق ذلك.
- محو البيانات الشخصية أو إخفاؤها بموجب القانون.
- الاعتراض على المعالجة أو التنميط في الحالات المنطبقة قانوناً.
- نقل نسخة من البيانات الشخصية إلى مسؤول معالجة آخر حيث ينطبق ذلك.
- الإعلام / الإحاطة بخرق أو إخلال أو مساس بأمن وسلامة بياناتهم الشخصية حيث تنطبق الشروط القانونية.
- تقديم شكوى خصوصية.


## 16. كيفية ممارسة الحقوق

يمكنك تقديم طلبات الخصوصية عبر أدوات الخصوصية داخل الحساب حيث تتوفر، وعبر تواصل الخصوصية القابل للنشر ([[PRIVACY_CONTACT_EMAIL]]).

تتعامل مزارع مع طلب الشخص المعني وتنفذه ضمن المهلة القانونية البالغة 15 يوم عمل، وتبدأ من اليوم التالي لتاريخ تسلّم الطلب، وفق القواعد الأردنية المنطبقة.

وقد يقيّد الاحتفاظ المشروع أو أساس قانوني آخر منطبقاً الطلب. وستوضّح مزارع القيود حيث يلزم ذلك. ولا تعد مزارع بحذف غير مشروط لسجلات مالية أو أدلة حجز أو قبولات قانونية أو سجلات أخرى يُسمح لمزارع أو يُطلب منها الاحتفاظ بها قانوناً.


## 17. الشكاوى والملاحظة الرقابية

يقدّم الشخص المعني شكوى الخصوصية إلى مزارع أولاً. ولا يترتب على تقديم شكوى خصوصية عواقب سلبية من مزارع بسبب ممارسة هذا الحق.

وإذا لم تتخذ مزارع الإجراء المناسب، يجوز للشخص المعني التصعيد إلى مديرية حماية البيانات الشخصية. وتحتفظ المديرية بصلاحية السير مباشرة حيث تسمح القواعد المنطبقة أو حيث ترى مبرراً لذلك. وتخضع إجراءات الجهة الرقابية للسلطة المختصة وليس لمزارع.

مديرية حماية البيانات الشخصية، وزارة الاقتصاد الرقمي والريادة — البريد: PDP@modee.gov.jo؛ الهاتف: +962 6 5805700. وقد تتاح أيضاً الشكاوى والخدمات الإلكترونية الرسمية عبر قنوات الوزارة المنشورة ومسار خدمات «بخدمتكم».

وقد يترتب على مخالفة متطلبات حماية البيانات الشخصية المنطبقة تدابير تصحيحية أو رقابية أو إنذارات أو غرامات أو آثار أخرى ينص عليها القانون الأردني المنطبق. وليس كل شكوى تثبت مخالفة.


## 18. تدابير الأمن

تطبّق مزارع تدابير تقنية وتنظيمية مناسبة للمعالجة، بما في ذلك ضوابط الوصول، وتجزئة كلمات المرور، وتشفير حقول مالية حساسة مختارة حيث طُبّق ذلك، وتخزين خاص مقيّد لملفات تحقق المالك، وضوابط التدقيق والمساءلة، وتقييد الوصول إلى الموقع الدقيق، وحدود بيانات البطاقة الموضحة أعلاه، وضوابط الاستجابة لإخلال بأمن وسلامة البيانات الشخصية.

ولا يلغي أي برنامج أمني جميع المخاطر. ولا تدّعي مزارع أمناً مطلقاً.


## 19. خرق أمن وسلامة البيانات الشخصية

حيث يُرجَّح أن يسبب خرق أمن وسلامة البيانات الشخصية ضرراً جسيماً، تُخطر مزارع الأشخاص المعنيين المتأثرين خلال 24 ساعة من الاكتشاف، وتُخطر الوحدة المختصة خلال 72 ساعة من الاكتشاف. ويتضمن الإخطار الموجه إلى الأشخاص المعنيين المتأثرين الإجراءات العملية اللازمة للمساعدة في تفادي أو الحد من الآثار المترتبة على الإخلال.

وليس كل حادث أمني تقني خرقاً لأمن وسلامة البيانات الشخصية يستدعي تلك واجبات الإخطار. وتقيّم مزارع الحوادث وفق المتطلبات الأردنية المنطبقة.


## 20. ملفات تعريف الارتباط والتقنيات المماثلة

تستخدم مزارع ملفات تعريف ارتباط وتقنيات مماثلة أساسية من الطرف الأول لتشغيل الخدمة (مثل المصادقة/الجلسة، وتخزين اللغة أو التفضيلات، والحمايات الأمنية).

والتقنيات المستخدمة على صفحات الدفع المستضافة لدى مزود الدفع تعمل في بيئة المزود وبموجب إشعاراته؛ وليست ملفات ارتباط من الطرف الأول لمزارع.

ولا تستخدم مزارع حالياً Google Analytics أو Meta Pixel. وتتطلب ملفات الارتباط أو التحليلات غير الأساسية موافقة اختيارية صريحة قبل التفعيل.

وللمزيد من التفصيل، راجع سياسة ملفات تعريف الارتباط. ولا تعيد سياسة الخصوصية هذه كتابة سياسة ملفات تعريف الارتباط.


## 21. وسائط الإعلان

قد يرفع المالكون وسائط للإعلان. وقد تتضمن تلك الوسائط بصورة عرضية أشخاصاً يمكن التعرف عليهم. ولا تُجري مزارع تعرّفاً على الوجوه أو تحليلاً حيوياً لوسائط الإعلان. وينبغي للمالكين رفع محتوى يحق لهم تقديمه فقط. وتبقى التزامات محتوى المالك التفصيلية في اتفاقية المالك وسياسات المجتمع أو المحتوى ذات الصلة.


## 22. الأطفال ومن ليس لديهم أهلية قانونية

ليست مسارات الحساب والحجز في مزارع مخصصة لشخص يفتقر إلى الأهلية القانونية لتقديم الموافقة المسبقة. وحيث يقتضي القانون الأردني موافقة مسبقة من أحد الوالدين أو الوصي القانوني، أو آلية أخرى يجيزها صراحة القانون الأردني المنطبق، لا توفّر مزارع حالياً مسار موافقة الولي/الوصي. ولا تخترع هذه السياسة حداً عمرِياً رقمياً ثابتاً لكل معالجة.


## 23. تحديثات السياسة والإصدارات

تصدر سياسة الخصوصية هذه بإصدارات. الإصدار: 1.1.2-advisor-final. تاريخ السريان: [[PRIVACY_POLICY_EFFECTIVE_DATE]]. آخر تحديث: [[PRIVACY_POLICY_LAST_UPDATED_DATE]].

وقد تتطلب التغييرات الجوهرية إقراراً مجدداً. وحيث تتغيّر المعالجة المعتمدة على الموافقة كما في القسم 10، تحصل مزارع على موافقة مسبقة جديدة قبل تلك المعالجة المتغيّرة. ولا يُعامل مجرد استمرار التصفح على أنه موافقة مسبقة. وقد يُخطَر المستخدمون بالتغييرات الجوهرية عبر القنوات المتاحة.


## 24. معلومات التواصل

المسؤول عن المعالجة: [[LEGAL_ENTITY_INTRO_AR]]. العنوان المسجّل: [[REGISTERED_ADDRESS_AR]]. تواصل الخصوصية: [[PRIVACY_CONTACT_EMAIL]]. تواصل مراقب حماية البيانات الشخصية: [[DPO_OR_PRIVACY_CONTACT]]. الوثائق ذات الصلة: الشروط والأحكام، وسياسة ملفات تعريف الارتباط، وأدوات الخصوصية داخل الحساب حيث تتوفر.
```

---

## FULL English (1.1.2-advisor-final)

```markdown
# Privacy Policy

This Privacy Policy explains how Personal Data is processed in connection with the Mazare3 marketplace (Mazare3 / Mazare3 Jordan / مزارع الأردن), operated by [[LEGAL_ENTITY_INTRO_EN]]. This document is a transparency notice. Acknowledging this Privacy Policy is not Prior Consent, and is separate from accepting the Terms & Conditions and from any optional marketing or analytics choices. Version: 1.1.2-advisor-final. Effective date: [[PRIVACY_POLICY_EFFECTIVE_DATE]]. Last updated: [[PRIVACY_POLICY_LAST_UPDATED_DATE]].

## 1. Purpose and scope

This Privacy Policy describes how Mazare3 processes Personal Data of Customers, Owners/Partners, and website visitors who create accounts, browse listings, make or manage Bookings, make payments or refunds, verify Owner identity, operate Properties, contact support, exercise privacy rights, or otherwise use Mazare3 services.

It applies to processing carried out for the Mazare3 Jordan marketplace. It does not replace the Terms & Conditions, Booking Terms, Cancellation & Refund Policy, Cookie Policy, Owner Agreement, or other published policies. Where those documents address contractual rights or obligations, they remain separate.


## 2. Controller identity

The Personal Data controller (the person responsible for processing Personal Data) for Mazare3 processing described in this Policy is [[LEGAL_ENTITY_INTRO_EN]].

Legal name (English): [[LEGAL_ENTITY_NAME_EN]]. Legal name (Arabic): [[LEGAL_ENTITY_NAME_AR]]. Legal form: [[LEGAL_FORM_EN]] / [[LEGAL_FORM_AR]] (stated separately from the legal name). Commercial Registration No. [[COMMERCIAL_REGISTRATION_NUMBER]]. Jurisdiction: Hashemite Kingdom of Jordan / Amman.

Registered address: [[REGISTERED_ADDRESS_EN]] / [[REGISTERED_ADDRESS_AR]].

Mazare3 / Mazare3 Jordan / مزارع الأردن is the product and marketplace brand. BATMAN TECHNOLOGY / شركة الرجل الوطواط للتكنولوجيا is the legal entity that operates the brand.

Privacy contact: [[PRIVACY_CONTACT_EMAIL]]. Data Subjects may also use in-account privacy tools where available.

Data Protection Officer (DPO) contact: [[DPO_OR_PRIVACY_CONTACT]].


## 3. Information provided before processing

Before Personal Data processing begins, and subject to applicable statutory exceptions, Mazare3 provides the Data Subject electronically or in writing with the information required by Jordanian law, including: the Personal Data that will be processed; when processing begins (by the applicable starting event for that purpose); the processing purpose; the processing duration; the Processor(s) involved; appropriate non-sensitive information about applicable security and protection measures; and information about Profiling, if any.

Processing start timing is purpose-specific. For example: account processing begins after the applicable account consent or gate; Booking processing begins when a new Booking action begins; KYC processing begins before KYC upload or storage; payout processing begins before payout or IBAN details are collected; exact-location processing begins before exact-location data is stored.

Mazare3 does not currently use automated Profiling of Data Subjects as defined by the Jordanian Personal Data Protection Law.


## 4. Categories of Personal Data — Customers

Not every Customer provides every field. Where applicable, Mazare3 may process:

- Identity and contact information such as name, email address, and phone number.
- Account information such as language preferences or locale settings and account role or status.
- Authentication information such as a password hash (not the plaintext password) and, where Google sign-in is used, the Google account identifier (subject), and the name and email address received from Google for account creation or linking where applicable.
- Booking information, guest or party details provided for a Booking, and related scheduling or status information.
- Payment and refund metadata (for example amounts, currency, status, method references, and payment-provider transaction or token references) — not full card PAN or CVV.
- Saved payment-method metadata where that feature is enabled (provider/token references, not full card numbers).
- Check-in evidence associated with an eligible Booking.
- Reviews, favourites, and similar marketplace interactions.
- Support, dispute, or incident communications and related evidence.
- Prior Consent records and documented consent evidence linked to the consent-text version.
- Legal acknowledgement evidence for published legal documents (including Privacy Policy acknowledgement and Booking-related legal snapshots where used).
- Privacy-right requests and privacy complaints, and related handling records.


## 5. Categories of Personal Data — Owners / Partners

Where applicable, Mazare3 may process for Owners/Partners:

- Identity and contact information.
- Owner onboarding and commercial profile information.
- KYC / authority verification documents and related review information (stored in restricted private object storage where configured — not as public listing photos).
- Property and listing data, including approximate public location and, where used under product rules, exact Property address, coordinates, and arrival instructions.
- Bank / IBAN / beneficiary information and settlement or payout information.
- Commercial and legal acceptance evidence related to Owner participation.
- Reliability, incident, support, and dispute information.


## 6. Sensitive Personal Data

Under the Jordanian Personal Data Protection framework, financial information is treated as Sensitive Personal Data. Where applicable, this includes IBAN and bank/beneficiary information, financial transaction information, payout and settlement information, and other financial Personal Data processed for Mazare3 operations.

Owner KYC / authority documents are high-risk Personal Data and may contain Sensitive Personal Data depending on the contents of the documents provided. Mazare3 does not claim that every KYC document always contains every possible sensitive field.

Free-text support, dispute, or incident messages may incidentally include Sensitive Personal Data. Mazare3 seeks to minimise unnecessary sensitive content in those channels.

Mazare3 does not store full payment-card PAN or CVV/security code. Card processing is performed through the configured payment service provider ([[PAYMENT_PROVIDER_LEGAL_NAME]]). Mazare3 may retain payment metadata and provider/token references where required by the product.


## 7. How Mazare3 collects Personal Data

Mazare3 may collect Personal Data:

- Directly from you (account forms, Booking details, Owner onboarding, uploads, messages, privacy requests).
- Automatically from use of the service (session and security logs, Booking lifecycle events, check-in events, and similar operational records).
- From configured processors or service providers acting for stated purposes (for example payment results from the payment service provider; when you choose Google sign-in, Google account identifier, name, and email as received for authentication and account creation or linking; and hosting or storage providers).


## 8. Purposes of processing

Mazare3 processes Personal Data for purposes that include, where applicable:

- Creating and authenticating accounts.
- Operating the marketplace (search, listings, favourites, reviews).
- Processing Bookings and the Booking lifecycle, including Owner approval where applicable.
- Payments, refunds, and related financial operations.
- Saved payment methods where that feature is enabled.
- Owner identity and authority verification.
- Property and listing operation.
- Exact-location and arrival information under eligible product rules.
- Owner payouts and settlements.
- Customer and Owner support, disputes, and incident handling.
- Responding to Data Subject rights requests and privacy complaints.
- Security, fraud prevention, and accountability.
- Responding to a compromise of the security and integrity of Personal Data where applicable.
- Transactional communications about your account, Booking, or payment (these are not optional marketing).
- Optional marketing, only if you give separate optional consent and the feature is enabled.
- Optional analytics or non-essential cookies, only if separately consented and enabled.


## 9. Legal basis and Prior Consent

Mazare3 applies Jordanian Personal Data Protection requirements. This Policy does not rely on foreign-law labels such as “legitimate interest” or “contract necessity” as Jordanian legal bases for Mazare3’s own processing.

Where Prior Consent is required, Mazare3 obtains it in a manner that is: explicit and documented in writing or electronically; specific as to purpose; specific as to duration; requested in clear, simple, non-misleading language; and easily accessible. One Prior Consent does not cover every processing purpose.

Where Jordanian law requires or expressly permits Mazare3 to process Personal Data without Prior Consent, Mazare3 may process only to the extent permitted or required by that legal basis.

Privacy Policy acknowledgement is notice and transparency only. It does not replace Prior Consent where Prior Consent is legally required. Terms acceptance is separate. Optional marketing or analytics consent, when used, is also separate.


## 10. Consent duration, withdrawal, and re-consent

The applicable duration or validity event for a Prior Consent is disclosed at the relevant consent point.

A Data Subject may withdraw Prior Consent for future consent-dependent processing. Withdrawal does not rewrite historical consent records, does not retroactively invalidate lawful prior processing, and does not automatically erase records that Mazare3 is legally permitted or required to retain.

Withdrawal does not prevent statutory privacy-right handling or response to a compromise of the security and integrity of Personal Data. If withdrawn consent makes a future new processing action legally impossible, Mazare3 may be unable to perform that new consent-dependent action. That is not a penalty for exercising a privacy right.

If the nature, type, purpose, or materially relevant scope of consent-dependent processing changes in a way that requires new Prior Consent, Mazare3 obtains new Prior Consent before carrying out that changed processing. Ordinary typographical or formatting changes to this Policy that do not change consent-dependent processing do not, by themselves, require re-consent. Acknowledgement-only changes may still use acknowledgement where legally appropriate. Mazare3 does not treat continued browsing alone as Prior Consent.

Exercising Data Subject rights or withdrawing consent does not, by itself, result in financial or contractual consequences, without prejudice to Mazare3’s lawful rights. Mazare3 does not cancel earned refunds, cancel due Owner payouts, alter existing Booking economics, or charge a privacy-right fee merely because a privacy right was exercised.


## 11. Data sharing, recipients, and processors

Mazare3 shares Personal Data only as needed for the stated purposes. Mazare3 does not sell Personal Data.

Where Article 14 of the Jordanian Personal Data Protection Law applies to a transfer or exchange of Personal Data with another person or recipient, Mazare3 obtains the Data Subject’s applicable consent for that transfer or exchange unless a statutory exception applies, and the transfer or exchange must satisfy the applicable statutory conditions, including that it serves the legitimate interests of the Controller and the Recipient. That Article 14 transfer condition is not a general Jordanian legal basis for Mazare3’s own processing, and is not a foreign-law “legitimate interest” processing basis.

The Data Subject must have sufficient information about the recipient and the purpose for which the Data will be used. Marketing transfers require the applicable marketing consent. Mazare3 maintains records of transfers and exchanges as required by applicable Jordanian law.

Depending on active configuration, recipients or processors may include:

| Provider | Purpose (summary) | Data categories (summary) | Privacy contact | Processing / storage region |
| --- | --- | --- | --- | --- |
| [[DATABASE_PROVIDER_LEGAL_NAME]] | Application data storage and operation | Account, Booking, payment metadata, consent and legal evidence, support records (as applicable) | [[DATABASE_PROVIDER_PRIVACY_CONTACT]] | [[PROCESSOR_REGION_NEON]] |
| [[OBJECT_STORAGE_PROVIDER_LEGAL_NAME]] | Listing media and restricted Owner verification files | Media files; KYC/authority documents (restricted) | [[OBJECT_STORAGE_PROVIDER_PRIVACY_CONTACT]] | [[PROCESSOR_REGION_R2]] |
| [[PAYMENT_PROVIDER_LEGAL_NAME]] | Card processing and payment outcomes | Payment metadata; card data handled by the provider (Mazare3 does not store PAN/CVV) | [[PAYMENT_PROVIDER_PRIVACY_CONTACT]] | [[PAYMENT_PROVIDER_PROCESSING_REGION]] |
| [[GOOGLE_SIGNIN_PROVIDER_LEGAL_NAME]] (when Google sign-in is used) | Account authentication | Google account identifier, name, and email as received for sign-in / account creation or linking | [[GOOGLE_SIGNIN_PROVIDER_PRIVACY_CONTACT]] | [[GOOGLE_SIGNIN_PROCESSING_REGION]] |
| [[ACTIVE_EMAIL_PROVIDER_LEGAL_NAME]] (when transactional email is enabled) | Operational notices | Email address and message content needed for notices | [[ACTIVE_EMAIL_PROVIDER_PRIVACY_CONTACT]] | [[ACTIVE_EMAIL_PROVIDER_PROCESSING_REGION]] |
| [[APP_HOSTING_PROVIDER]] | Hosting the application | Operational and application traffic as hosted | [[APP_HOSTING_PROVIDER_PRIVACY_CONTACT]] | [[APP_HOSTING_REGION]] |
| Counterparties on the platform | Completing Bookings and hosting | Booking and contact details needed to complete the Booking and provide the booked Property service (not card PAN) | — | Jordan marketplace operation |


## 12. Transfers outside Jordan

Personal Data may be shared or transferred only for stated purposes and under applicable Jordanian requirements.

Before transferring Personal Data outside Jordan, Mazare3 verifies the level of protection provided by the recipient as required by Jordanian law. Where the recipient does not provide the required level, transfer may occur only where a legally applicable Article 15 exception permits it. Where reliance would be placed on Data Subject consent to a transfer despite insufficient protection, the Data Subject must first be informed of that insufficient protection as required by law. Mazare3 does not claim that it currently relies on that consent-based exception.

Before transferring Personal Data outside Jordan, Mazare3 conducts the Data Protection Impact Assessment required by the applicable Jordanian instructions.

Processing and storage locations for active recipients and Processors are identified in Section 11.


## 13. Retention and deletion

Mazare3 does not retain Personal Data after the processing purpose has been fulfilled unless applicable legislation requires or otherwise provides for continued retention. Retention for each category is as follows:

| Category | Retention |
| --- | --- |
| Account / profile | [[RETENTION_ACCOUNTS]] |
| Bookings | [[RETENTION_BOOKINGS]] |
| Payments / refunds | [[RETENTION_PAYMENTS]] |
| Owner KYC | [[RETENTION_KYC]] |
| Settlements / payouts | [[RETENTION_SETTLEMENTS]] |
| Legal acceptances / Booking legal evidence | [[RETENTION_LEGAL_ACCEPTANCES]] |
| Prior Consent history | [[RETENTION_CONSENT_HISTORY]] |
| Audit / security records | [[RETENTION_AUDIT_LOGS]] |
| Support / disputes | [[RETENTION_SUPPORT]] |
| Exact location / arrival data | [[RETENTION_EXACT_LOCATION]] |
| Reviews | [[RETENTION_REVIEWS]] |
| Listing media | [[RETENTION_LISTING_MEDIA]] |
| Privacy requests / complaints | [[RETENTION_PRIVACY_REQUESTS]] |
| Personal Data breach records | [[RETENTION_BREACH_RECORDS]] |


## 14. Data minimisation

Mazare3 seeks to collect and process Personal Data necessary for the stated purpose. Practical examples from current product design include: publishing approximate location publicly while restricting exact location and arrival details to eligible rules; not storing full card PAN or CVV; and restricting access to Owner verification files.

Mazare3 does not claim that every collection is the absolute theoretical minimum in all circumstances.


## 15. Data Subject rights

Subject to the conditions and limits of applicable Jordanian law, the Data Subject has the following rights:

- To know, review and access their Personal Data and obtain a copy.
- To withdraw Prior Consent where applicable.
- To correct, amend, add to, or update Personal Data.
- To restrict processing to a specific scope where applicable.
- To erasure or concealment of Personal Data under the law.
- To object to processing or profiling in the legally applicable cases.
- To transfer a copy of Personal Data to another controller where applicable.
- To be informed / made aware of a breach, infringement, or prejudice to the security and integrity of their Personal Data where the legal conditions apply.
- To submit a privacy complaint.


## 16. How to exercise rights

You may submit privacy requests through in-account privacy tools where available, and through the publishable privacy contact ([[PRIVACY_CONTACT_EMAIL]]).

Mazare3 handles Data Subject requests within the applicable legal period of 15 working days beginning on the day following receipt, in accordance with applicable Jordanian rules.

Lawful retention or another applicable legal basis may limit a request. Mazare3 will explain limitations where required. Mazare3 does not promise unconditional deletion of financial records, Booking evidence, legal acceptances, or other records that Mazare3 is legally permitted or required to retain.


## 17. Complaints and regulatory note

The Data Subject submits the privacy complaint to Mazare3 first. Filing a privacy complaint does not attract adverse consequences from Mazare3 for exercising that right.

If Mazare3 does not take the appropriate action, the Data Subject may escalate to the Personal Data Protection Directorate. The Directorate retains authority to proceed directly where the applicable rules allow or where it finds justification. Regulator procedures are controlled by the competent authority, not by Mazare3.

Personal Data Protection Directorate, Ministry of Digital Economy and Entrepreneurship — email: PDP@modee.gov.jo; phone: +962 6 5805700. Official complaints and e-services may also be available through the Ministry’s published channels and the Bekhidmetkom government services route.

Violations of applicable Personal Data Protection requirements may result in corrective or regulatory measures, warnings, penalties, or other consequences provided by applicable Jordanian law. Not every complaint proves a violation.


## 18. Security measures

Mazare3 applies technical and organisational measures appropriate to the processing, including access controls, password hashing, encryption of selected sensitive financial fields where implemented, private restricted storage for Owner verification files, audit and accountability controls, exact-location access gating, the payment-card boundary described above, and controls for responding to a compromise of the security and integrity of Personal Data.

No security programme eliminates all risk. Mazare3 does not claim perfect security.


## 19. Compromise of the security and integrity of Personal Data

Where a Personal Data breach is likely to cause severe harm, Mazare3 notifies the Affected Data Subjects within 24 hours from discovery, and notifies the competent Unit within 72 hours from discovery. Within that affected-person notice, Mazare3 also provides the practical measures necessary to help avoid or mitigate consequences of the breach.

Not every technical security incident is a Personal Data breach that triggers those notification duties. Mazare3 assesses incidents under applicable Jordanian requirements.


## 20. Cookies and similar technologies

Mazare3 uses first-party essential cookies and similar technologies needed to run the service (for example authentication/session, locale or preference storage, and security protections).

Technologies used on payment-provider hosted payment pages operate in the provider’s own environment and under the provider’s own notices; they are not Mazare3 first-party cookies.

Mazare3 does not currently use Google Analytics or Meta Pixel. Non-essential cookies or analytics require explicit optional consent before activation.

For more detail, see the Cookie Policy. This Privacy Policy does not rewrite the Cookie Policy.


## 21. Listing media

Owners may upload listing media. Such media may incidentally contain identifiable persons. Mazare3 does not perform facial recognition or biometric analysis on listing media. Owners should upload only content they are entitled to provide. Detailed Owner content obligations remain in the Owner Agreement and related community or content policies.


## 22. Children and persons without legal capacity

Mazare3 account and Booking flows are not intended for a person who lacks legal capacity to provide Prior Consent. Where Jordanian law requires Prior Consent from a parent or legal guardian, or another mechanism expressly permitted by applicable Jordanian law, Mazare3 does not currently provide that guardian-consent workflow. This Policy does not invent a fixed numerical age threshold for all processing.


## 23. Policy updates and versioning

This Privacy Policy is versioned. Version: 1.1.2-advisor-final. Effective date: [[PRIVACY_POLICY_EFFECTIVE_DATE]]. Last updated: [[PRIVACY_POLICY_LAST_UPDATED_DATE]].

Material changes may require renewed acknowledgement. Where consent-dependent processing changes as described in section 10, Mazare3 obtains new Prior Consent before that changed processing. Continued browsing alone is not treated as Prior Consent. Users may be notified of material changes through available channels.


## 24. Contact information

Controller: [[LEGAL_ENTITY_INTRO_EN]]. Registered address: [[REGISTERED_ADDRESS_EN]]. Privacy contact: [[PRIVACY_CONTACT_EMAIL]]. Data Protection Officer (DPO) contact: [[DPO_OR_PRIVACY_CONTACT]]. Related documents: Terms & Conditions, Cookie Policy, and in-account privacy tools where available.
```
