import type { LegalDocument } from '@/lib/legal/types';

export const privacyEn: LegalDocument = {
  slug: 'privacy',
  title: 'Privacy Policy',
  intro:
    'This policy describes the information Mazare3 Jordan actually handles to run accounts, bookings, listings, and payments. It is not a claim of a particular legal certification.',
  sections: [
    {
      id: 'who',
      title: 'Who this covers',
      paragraphs: [
        'It covers customers, property partners, and visitors of the public website. The product name is Mazare3 Jordan. A registered legal entity name appears on Contact only if the operator has published one.',
      ],
    },
    {
      id: 'categories',
      title: 'Information we handle',
      paragraphs: ['Depending on how you use Mazare3, this can include:'],
      bullets: [
        'Account and profile: email, name, password (stored as a hash), language, and role.',
        'Bookings: property, date and period, guest count, amounts, status, and related messages.',
        'Partner information: application details, listing content, and internal contact fields used to operate the partner account.',
        'Partner verification documents (KYC): identity or business files uploaded in onboarding. These are stored privately and are not public listing photos.',
        'Payment metadata: amounts, currency, status, method chosen at checkout, and provider references. Mazare3 does not store card PAN or CVV. Card entry happens with the payment provider.',
        'Reviews and favorites you choose to save or publish.',
        'Location: city, area, and approximate coordinates on public pages. Exact address, exact coordinates, and arrival notes are stored for operations and are shown to a customer only when that customer’s booking is confirmed and eligible.',
        'Session cookies needed to keep you signed in, plus operational and security logs such as audit trails of important account and payment actions.',
      ],
    },
    {
      id: 'location',
      title: 'Approximate vs exact location',
      paragraphs: [
        'Public listing pages and search show an approximate location only. They do not include the exact pin.',
        'Exact location and arrival instructions are revealed to the booked customer after the booking is confirmed with a successful deposit or full payment, while the booking remains valid. They are hidden again for cancelled, expired, unpaid, or fully refunded bookings, and they are never shown to another customer’s account.',
      ],
    },
    {
      id: 'media',
      title: 'Public photos vs private documents',
      paragraphs: [
        'Property gallery images are public listing media. Partner verification files are private. Those two stores are not mixed. Do not upload identity documents as listing photos.',
      ],
    },
    {
      id: 'why',
      title: 'Why we use this information',
      paragraphs: [
        'To create accounts, show availability, complete bookings and payments, share eligible arrival details, run partner onboarding, prevent abuse, send in-app (and where configured, email) notifications, and improve reliability.',
      ],
    },
    {
      id: 'sharing',
      title: 'Sharing and service providers',
      paragraphs: [
        'We share what is needed to operate the service: the payment provider processes card payments; hosting, database, email, and file-storage providers hold the data required for those jobs. Property partners see booking details they need to host the stay, not another customer’s payment card data.',
        'We do not sell personal information as a product.',
      ],
    },
    {
      id: 'retention',
      title: 'Retention',
      paragraphs: [
        'We keep booking, payment, dispute, and account records for as long as needed to operate the stay, complete refunds, handle disputes, and meet accounting or legal duties that apply. We do not publish a fabricated statutory retention period on this page.',
      ],
    },
    {
      id: 'security',
      title: 'Security',
      paragraphs: [
        'Access to partner verification files and exact location is restricted in product rules. Session cookies are used to authenticate you. No website can promise that transmissions are risk-free.',
      ],
    },
    {
      id: 'rights',
      title: 'Your choices',
      paragraphs: [
        'You can update profile details available in the product, manage favorites, and cancel eligible bookings. For a copy or deletion request, use a published privacy email on the Contact page when one exists, or your account pages. We may need to keep records that a booking or payment lawfully requires.',
      ],
    },
    {
      id: 'contact',
      title: 'Privacy contact',
      paragraphs: [
        'See the Contact page. If no privacy email is published, Mazare3 has not listed a public privacy mailbox yet — that is an operator detail still to supply, not a hidden address.',
      ],
    },
  ],
};

export const privacyAr: LegalDocument = {
  slug: 'privacy',
  title: 'سياسة الخصوصية',
  intro:
    'تصف هذه السياسة المعلومات التي تتعامل معها مزارع الأردن فعلاً لتشغيل الحسابات والحجوزات والإعلانات والدفع. وهي ليست ادّعاء شهادة قانونية معيّنة.',
  sections: [
    {
      id: 'who',
      title: 'من تشملهم',
      paragraphs: [
        'تشمل الزبائن وشركاء العقارات وزوار الموقع العام. الاسم التجاري للمنتج هو مزارع الأردن. يظهر اسم كيان قانوني مسجّل في صفحة التواصل فقط إذا نشره المشغّل.',
      ],
    },
    {
      id: 'categories',
      title: 'المعلومات التي نتعامل معها',
      paragraphs: ['حسب استخدامك لمزارع قد يشمل ذلك:'],
      bullets: [
        'الحساب والملف: البريد والاسم وكلمة المرور (تُحفظ كهاش) واللغة والدور.',
        'الحجوزات: العقار والتاريخ والفترة وعدد الضيوف والمبالغ والحالة والرسائل المرتبطة.',
        'بيانات الشريك: تفاصيل الطلب ومحتوى الإعلان وحقول تواصل داخلية لتشغيل حساب الشريك.',
        'مستندات تحقق الشريك (اعرف عميلك): ملفات هوية أو عمل تُرفع في الانضمام. تُحفظ بشكل خاص وليست صور الإعلان العامة.',
        'بيانات وصفية للدفع: المبالغ والعملة والحالة والطريقة المختارة عند إتمام الدفع ومراجع المزود. لا تخزّن مزارع رقم البطاقة (PAN) ولا رمز CVV. إدخال البطاقة يتم لدى مزود الدفع.',
        'التقييمات والمفضلة التي تختار حفظها أو نشرها.',
        'الموقع: المدينة والمنطقة والإحداثيات التقريبية في الصفحات العامة. العنوان الدقيق والإحداثيات الدقيقة وتعليمات الوصول تُحفظ للتشغيل وتُعرض للزبون فقط عندما يكون حجزه مؤكداً ومؤهلاً.',
        'ملفات تعريف الجلسة اللازمة لإبقائك مسجّلاً، وسجلات تشغيل وأمن مثل مسار التدقيق لإجراءات الحساب والدفع المهمة.',
      ],
    },
    {
      id: 'location',
      title: 'الموقع التقريبي والدقيق',
      paragraphs: [
        'صفحات الإعلان العامة والبحث تعرض موقعاً تقريبياً فقط. ولا تتضمن النقطة الدقيقة.',
        'يُكشف الموقع الدقيق وتعليمات الوصول للزبون صاحب الحجز بعد تأكيد الحجز بعربون أو دفع كامل ناجح، ما دام الحجز صالحاً. وتُخفى مجدداً للحجوزات الملغاة أو المنتهية أو غير المدفوعة أو المستردة بالكامل، ولا تُعرض لحساب زبون آخر.',
      ],
    },
    {
      id: 'media',
      title: 'الصور العامة والمستندات الخاصة',
      paragraphs: [
        'صور معرض العقار وسائط إعلان عامة. ملفات تحقق الشريك خاصة. لا يُخلط المخزنان. لا ترفع مستندات هوية كصور إعلان.',
      ],
    },
    {
      id: 'why',
      title: 'لماذا نستخدم هذه المعلومات',
      paragraphs: [
        'لإنشاء الحسابات وعرض التوفر وإتمام الحجوزات والدفع ومشاركة تفاصيل الوصول المؤهلة وتشغيل انضمام الشريك ومنع الإساءة وإرسال إشعارات داخل التطبيق (والبريد عند ضبطه) وتحسين الاعتمادية.',
      ],
    },
    {
      id: 'sharing',
      title: 'المشاركة ومزودو الخدمة',
      paragraphs: [
        'نشارك ما يلزم لتشغيل الخدمة: يعالج مزود الدفع دفعات البطاقة؛ وتحتفظ خدمات الاستضافة وقاعدة البيانات والبريد وتخزين الملفات بالبيانات اللازمة لتلك المهام. يرى شركاء العقار تفاصيل الحجز اللازمة لاستضافة الإقامة، وليس بيانات بطاقة زبون آخر.',
        'لا نبيع المعلومات الشخصية كمنتج.',
      ],
    },
    {
      id: 'retention',
      title: 'الاحتفاظ',
      paragraphs: [
        'نحتفظ بسجلات الحجز والدفع والنزاع والحساب طالما لزم تشغيل الإقامة وإتمام الاسترداد ومعالجة النزاعات والوفاء بالواجبات المحاسبية أو القانونية المنطبقة. لا ننشر في هذه الصفحة مدة احتفاظ نظامية مخترعة.',
      ],
    },
    {
      id: 'security',
      title: 'الأمن',
      paragraphs: [
        'الوصول إلى ملفات تحقق الشريك والموقع الدقيق مقيّد بقواعد المنتج. تُستخدم ملفات تعريف الجلسة لمصادقتك. لا يمكن لأي موقع أن يعد بأن النقل بلا مخاطر.',
      ],
    },
    {
      id: 'rights',
      title: 'خياراتك',
      paragraphs: [
        'يمكنك تحديث تفاصيل الملف المتاحة في المنتج وإدارة المفضلة وإلغاء الحجوزات المؤهلة. لطلب نسخة أو حذف استخدم بريد الخصوصية المنشور في صفحة التواصل إن وُجد، أو صفحات حسابك. قد نحتاج إلى الإبقاء على سجلات يتطلبها الحجز أو الدفع قانوناً.',
      ],
    },
    {
      id: 'contact',
      title: 'التواصل بشأن الخصوصية',
      paragraphs: [
        'انظر صفحة التواصل. إذا لم يُنشر بريد خصوصية فلم تُدرج مزارع صندوق بريد خصوصية عاماً بعد — هذه تفاصيل مشغّل ما زال يجب توفيرها، وليست عنواناً مخفياً.',
      ],
    },
  ],
};
