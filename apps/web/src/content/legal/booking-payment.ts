import type { LegalDocument } from '@/lib/legal/types';

export const bookingPaymentEn: LegalDocument = {
  slug: 'booking-payment',
  title: 'Booking & Payment Policy',
  intro:
    'This is the customer path Mazare3 uses today: find a slot, request the booking, pay what checkout shows, then wait for Mazare3 to record a successful payment before the booking is treated as confirmed.',
  sections: [
    {
      id: 'flow',
      title: 'The booking flow',
      paragraphs: [
        'Search and open a listing, pick a date and period that is still available, and review the price, deposit, and remaining balance shown for that slot. You may apply a valid coupon before you book.',
        'When you confirm, Mazare3 creates a booking for that slot. Instant-booking listings go to payment next. Listings that need partner approval wait for accept or decline first; the deposit is not collected during that wait.',
      ],
      bullets: [
        'Search and select an available slot',
        'Send the booking request',
        'Partner approval, only when that listing requires it',
        'Pay the deposit (or the full amount if checkout asks for full payment)',
        'Booking confirmed after a successful payment Mazare3 accepts',
        'Pay any remaining balance by the due time shown on the booking',
        'Fully paid when no captured balance remains',
      ],
    },
    {
      id: 'methods',
      title: 'How you pay',
      paragraphs: [
        'Available methods are only those shown at checkout for that booking — typically a card payment page hosted by the payment provider, and other options if they appear on the same screen.',
        'Mazare3 does not ask you to type a card number into a Mazare3 form. Card details are entered with the payment provider. Mazare3 stores payment amounts, status, and provider references, not your card number or CVV.',
      ],
    },
    {
      id: 'confirmation',
      title: 'When payment is treated as final',
      paragraphs: [
        'Returning from a payment page in the browser is not enough on its own. Mazare3 confirms payment after it reconciles a successful authorization from the payment provider (for example a server notification) with the booking.',
        'Until that happens, the booking may still show as awaiting payment. Refresh My bookings or wait for the status to update rather than paying twice unless checkout clearly asks you to retry a failed attempt.',
      ],
    },
    {
      id: 'deposit-balance',
      title: 'Deposit and remaining balance',
      paragraphs: [
        'When the booking uses a deposit, checkout shows the deposit percent and amount and when the remaining balance is due. Paying the deposit is what confirms an instant-booking stay (and an approved request). The remaining balance is a later payment on the same booking, not a new reservation.',
        'If a listing uses full payment instead, checkout will say so and collect that amount in one step. Any extra customer service fee appears only if it is greater than zero on that booking.',
      ],
    },
    {
      id: 'failed',
      title: 'Failed or abandoned payment',
      paragraphs: [
        'If payment does not succeed, the slot may still be held for a limited time while the booking is awaiting payment, then expire. You can return to checkout to retry when the booking still allows it, or book another slot if the original one is gone.',
      ],
    },
  ],
};

export const bookingPaymentAr: LegalDocument = {
  slug: 'booking-payment',
  title: 'سياسة الحجز والدفع',
  intro:
    'هذا مسار الزبون الذي تستخدمه مزارع اليوم: اختر فترة، اطلب الحجز، ادفع ما يظهر عند إتمام الدفع، ثم انتظر حتى تسجّل مزارع دفعاً ناجحاً قبل معاملة الحجز كمؤكد.',
  sections: [
    {
      id: 'flow',
      title: 'مسار الحجز',
      paragraphs: [
        'ابحث وافتح إعلاناً، واختر تاريخاً وفترة ما زالت متاحة، وراجع السعر والعربون والرصيد المتبقي لتلك الفترة. يمكنك تطبيق كوبون مقبول قبل الحجز.',
        'عند التأكيد تنشئ مزارع حجزاً لتلك الفترة. عقارات الحجز الفوري تنتقل إلى الدفع. والعقارات التي تحتاج موافقة الشريك تنتظر القبول أو الرفض أولاً؛ لا يُجمع العربون أثناء ذلك الانتظار.',
      ],
      bullets: [
        'البحث واختيار فترة متاحة',
        'إرسال طلب الحجز',
        'موافقة الشريك عندما يتطلبها ذلك الإعلان',
        'دفع العربون (أو المبلغ الكامل إذا طلب إتمام الدفع ذلك)',
        'تأكيد الحجز بعد دفع ناجح تقبله مزارع',
        'دفع أي رصيد متبقٍ في وقت الاستحقاق الظاهر على الحجز',
        'مدفوع بالكامل عندما لا يبقى رصيد محصّل غير مسدَّد',
      ],
    },
    {
      id: 'methods',
      title: 'كيف تدفع',
      paragraphs: [
        'الطرق المتاحة هي فقط تلك الظاهرة عند إتمام الدفع لذلك الحجز — عادة صفحة بطاقة يستضيفها مزود الدفع، وخيارات أخرى إذا ظهرت على الشاشة نفسها.',
        'لا تطلب منك مزارع إدخال رقم بطاقة في نموذج مزارع. تُدخل بيانات البطاقة لدى مزود الدفع. تخزّن مزارع مبالغ الدفع والحالة ومراجع المزود، وليس رقم بطاقتك أو رمز CVV.',
      ],
    },
    {
      id: 'confirmation',
      title: 'متى يُعد الدفع نهائياً',
      paragraphs: [
        'العودة من صفحة الدفع في المتصفح لا تكفي وحدها. تؤكد مزارع الدفع بعد مطابقة تفويض ناجح من مزود الدفع (مثل إشعار من الخادم) مع الحجز.',
        'حتى يحدث ذلك قد يبقى الحجز بانتظار الدفع. حدّث «حجوزاتي» أو انتظر تحديث الحالة بدلاً من الدفع مرتين ما لم يطلب إتمام الدفع بوضوح إعادة محاولة فاشلة.',
      ],
    },
    {
      id: 'deposit-balance',
      title: 'العربون والرصيد المتبقي',
      paragraphs: [
        'عندما يستخدم الحجز عربوناً، يظهر إتمام الدفع نسبة العربون ومبلغه وموعد استحقاق الرصيد. دفع العربون هو ما يؤكد إقامة الحجز الفوري (والطلب المقبول). الرصيد المتبقي دفعة لاحقة على الحجز نفسه وليس حجزاً جديداً.',
        'إذا استخدم الإعلان دفعاً كاملاً فسيوضح إتمام الدفع ذلك ويجمع المبلغ في خطوة واحدة. وأي رسوم خدمة للزبون تظهر فقط إذا كانت أكبر من صفر على ذلك الحجز.',
      ],
    },
    {
      id: 'failed',
      title: 'فشل الدفع أو التراجع عنه',
      paragraphs: [
        'إذا لم ينجح الدفع قد تبقى الفترة مثبتة وقتاً محدوداً بينما الحجز بانتظار الدفع، ثم تنتهي. يمكنك العودة لإتمام الدفع لإعادة المحاولة إذا كان الحجز ما زال يسمح، أو حجز فترة أخرى إذا لم تعد الأصلية متاحة.',
      ],
    },
  ],
};
