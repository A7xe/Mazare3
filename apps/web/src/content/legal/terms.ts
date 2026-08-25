import type { LegalDocument } from '@/lib/legal/types';

export const termsEn: LegalDocument = {
  slug: 'terms',
  title: 'Terms & Conditions',
  intro:
    'These terms describe how Mazare3 Jordan currently works as a booking marketplace. They are product rules for using the site, not a substitute for independent legal advice.',
  sections: [
    {
      id: 'role',
      title: 'Mazare3’s role',
      paragraphs: [
        'Mazare3 operates an online marketplace. Property partners list stays; customers book published time slots. Mazare3 provides search, booking, in-platform messaging where available, and the payment path shown at checkout.',
        'The partner hosts the visit and is responsible for the property, listing accuracy, house rules, and arrival arrangements that Mazare3 is allowed to share with an eligible booked customer.',
      ],
    },
    {
      id: 'accounts',
      title: 'Customer accounts',
      paragraphs: [
        'You need an account to book. Provide accurate email and password details and keep them confidential. Booking is available to customer accounts; owner and admin roles use separate dashboards.',
        'The platform may restrict or suspend an account that is used for fraud, abuse, or repeated policy breaches. That decision is operational, not a court finding.',
      ],
    },
    {
      id: 'partners',
      title: 'Property partners',
      paragraphs: [
        'Partners apply through the owner flow, may be asked for verification documents, and must keep listings truthful: photos, capacity, amenities, house rules, location, and availability.',
        'Commercial terms between Mazare3 and a partner (such as commission) are handled in the partner relationship. They are not a customer checkout fee unless a service fee is actually shown before you pay.',
      ],
    },
    {
      id: 'listings',
      title: 'Listings, availability, and booking requests',
      paragraphs: [
        'A slot is only bookable if the platform still shows it as available when you confirm. Prices and deposits on the booking panel are the amounts used for that slot, including any valid coupon you applied.',
        'If the slot is taken before your request completes, the booking will not go through and you can choose another time.',
      ],
    },
    {
      id: 'instant-approval',
      title: 'Instant booking and owner approval',
      paragraphs: [
        'Some properties confirm after a successful deposit or full payment (instant booking). Others require the partner to accept first. Until that acceptance, Mazare3 does not collect a deposit for that request.',
        'If the partner declines or does not respond in time, the request ends without a payment being taken. If they accept, you are asked to pay the deposit to confirm.',
      ],
    },
    {
      id: 'payments',
      title: 'Deposits, balance, and confirmation',
      paragraphs: [
        'Most bookings collect a deposit first and a remaining balance later. The amounts, due time, and methods you can use are shown at checkout for that booking.',
        'A booking becomes confirmed after Mazare3 records a successful payment according to the provider result it trusts (not merely because a browser returned from a payment page). Remaining balance, when used, is due by the time shown on the booking.',
      ],
    },
    {
      id: 'conduct',
      title: 'Conduct and house rules',
      paragraphs: [
        'Follow the guest count, house rules, and check-in notes for the listing. The partner may refuse entry or end a stay if rules are broken; Mazare3 is not on site.',
        'Do not use the platform to scam, harass, test stolen cards, or scrape listings. We may cancel bookings and restrict accounts in those cases.',
      ],
    },
    {
      id: 'cancel-refund',
      title: 'Cancellations and refunds',
      paragraphs: [
        'Cancellations and refunds follow the Cancellation & Refund Policy. Unpaid requests can be cancelled without a charge. Confirmed paid bookings use time-based expected refund amounts shown on the booking, and any return of funds is processed through the payment provider after the platform records it.',
      ],
    },
    {
      id: 'promos',
      title: 'Promotions and coupons',
      paragraphs: [
        'A property or platform coupon changes the price only if the platform accepts the code for that slot. If availability or pricing changes before you book, you will be asked to review the new amount.',
      ],
    },
    {
      id: 'reviews',
      title: 'Reviews',
      paragraphs: [
        'Eligible guests may leave a star rating and optional comment after the visit window. Mazare3 may hide reviews that are abusive or clearly unrelated to a stay. Reviews are not paid advertising.',
      ],
    },
    {
      id: 'changes',
      title: 'Platform changes',
      paragraphs: [
        'Mazare3 may update these pages, listing tools, and payment options. The date at the top of each policy page is when that page was last revised. Continued use after an update means you are using the current version.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      paragraphs: [
        'Use My bookings for an existing reservation, or the Contact page for published operator details when they exist. Partner applications use the owner onboarding flow.',
      ],
    },
  ],
};

export const termsAr: LegalDocument = {
  slug: 'terms',
  title: 'الشروط والأحكام',
  intro:
    'تصف هذه الشروط كيف تعمل مزارع الأردن حالياً كسوق حجز. هي قواعد استخدام للمنتج، وليست بديلاً عن استشارة قانونية مستقلة.',
  sections: [
    {
      id: 'role',
      title: 'دور مزارع',
      paragraphs: [
        'تشغّل مزارع سوقاً إلكترونياً. يعرض شركاء العقارات الإقامات، ويحجز الزبائن الفترات المنشورة. توفر مزارع البحث والحجز والرسائل داخل المنصة عند توفرها، ومسار الدفع الظاهر عند إتمام الدفع.',
        'الشريك يستضيف الزيارة وهو المسؤول عن العقار ودقة الإعلان وقواعد البيت وترتيبات الوصول التي يُسمح لمزارع بمشاركتها مع زبون حجز مؤهل.',
      ],
    },
    {
      id: 'accounts',
      title: 'حسابات الزبائن',
      paragraphs: [
        'تحتاج إلى حساب للحجز. قدّم بريداً وكلمة مرور صحيحة واحفظهما. الحجز متاح لحسابات الزبائن؛ ولوحتا المالك والإدارة منفصلتان.',
        'قد تقيّد المنصة أو توقف حساباً يُستخدم للاحتيال أو الإساءة أو تكرار مخالفة السياسات. هذا قرار تشغيلي وليس حكماً قضائياً.',
      ],
    },
    {
      id: 'partners',
      title: 'شركاء العقارات',
      paragraphs: [
        'يتقدّم الشركاء عبر مسار المالك، وقد يُطلب منهم مستندات تحقق، ويجب أن تبقى الإعلانات صادقة: الصور والسعة والمرافق وقواعد البيت والموقع والتوفر.',
        'الشروط التجارية بين مزارع والشريك (مثل العمولة) تُدار في علاقة الشريك. ليست رسماً على الزبون عند الدفع ما لم تظهر رسوم خدمة فعلاً قبل الدفع.',
      ],
    },
    {
      id: 'listings',
      title: 'الإعلانات والتوفر وطلبات الحجز',
      paragraphs: [
        'الفترة قابلة للحجز فقط إذا ما زالت المنصة تعرضها متاحة عند التأكيد. الأسعار والعربون في لوحة الحجز هي المبالغ المستخدمة لتلك الفترة، بما في ذلك أي كوبون مقبول طبّقته.',
        'إذا أُخذت الفترة قبل اكتمال طلبك فلن يتم الحجز ويمكنك اختيار وقت آخر.',
      ],
    },
    {
      id: 'instant-approval',
      title: 'الحجز الفوري وموافقة المالك',
      paragraphs: [
        'بعض العقارات تتأكد بعد عربون أو دفع كامل ناجح (حجز فوري). وأخرى تتطلب قبول الشريك أولاً. حتى ذلك القبول لا تجمع مزارع عربوناً لذلك الطلب.',
        'إذا رفض الشريك أو لم يرد في الوقت المحدد ينتهي الطلب دون خصم. وإذا قبل يُطلب منك دفع العربون للتأكيد.',
      ],
    },
    {
      id: 'payments',
      title: 'العربون والرصيد والتأكيد',
      paragraphs: [
        'معظم الحجوزات تجمع عربوناً أولاً ثم الرصيد المتبقي لاحقاً. تظهر المبالغ ووقت الاستحقاق وطرق الدفع المتاحة عند إتمام الدفع لذلك الحجز.',
        'يصبح الحجز مؤكداً بعد أن تسجّل مزارع دفعاً ناجحاً وفق نتيجة مزود الدفع التي تعتمدها (وليس لمجرد عودة المتصفح من صفحة الدفع). والرصيد المتبقي عند استخدامه يستحق في الوقت الظاهر على الحجز.',
      ],
    },
    {
      id: 'conduct',
      title: 'السلوك وقواعد البيت',
      paragraphs: [
        'التزم بعدد الضيوف وقواعد البيت وملاحظات الدخول. قد يرفض الشريك الدخول أو ينهي الإقامة عند مخالفة القواعد؛ مزارع ليست في الموقع.',
        'لا تستخدم المنصة للاحتيال أو المضايقة أو تجربة بطاقات مسروقة أو سحب بيانات الإعلانات. قد نلغي حجوزات ونقيّد حسابات في تلك الحالات.',
      ],
    },
    {
      id: 'cancel-refund',
      title: 'الإلغاء والاسترداد',
      paragraphs: [
        'تتبع الإلغاءات والاستردادات سياسة الإلغاء والاسترداد. يمكن إلغاء الطلبات غير المدفوعة دون خصم. والحجوزات المؤكدة المدفوعة تستخدم مبالغ استرداد متوقعة حسب الوقت ظاهرة على الحجز، وأي إعادة أموال تتم عبر مزود الدفع بعد أن تسجّلها المنصة.',
      ],
    },
    {
      id: 'promos',
      title: 'العروض والكوبونات',
      paragraphs: [
        'يغيّر كوبون العقار أو المنصة السعر فقط إذا قبلته المنصة لتلك الفترة. إذا تغيّر التوفر أو السعر قبل الحجز سيُطلب منك مراجعة المبلغ الجديد.',
      ],
    },
    {
      id: 'reviews',
      title: 'التقييمات',
      paragraphs: [
        'يجوز للضيوف المؤهلين ترك تقييم نجوم وتعليق اختياري بعد نافذة الزيارة. قد تخفي مزارع التقييمات المسيئة أو غير المرتبطة بالإقامة. التقييمات ليست إعلاناً مدفوعاً.',
      ],
    },
    {
      id: 'changes',
      title: 'تغييرات المنصة',
      paragraphs: [
        'قد تحدّث مزارع هذه الصفحات وأدوات الإعلان وخيارات الدفع. التاريخ أعلى كل سياسة هو آخر مراجعة لتلك الصفحة. الاستمرار بعد التحديث يعني استخدام النسخة الحالية.',
      ],
    },
    {
      id: 'contact',
      title: 'التواصل',
      paragraphs: [
        'استخدم «حجوزاتي» لحجز قائم، أو صفحة التواصل لتفاصيل المشغّل المنشورة إن وُجدت. طلبات الشركاء تتم عبر مسار انضمام المالك.',
      ],
    },
  ],
};
