export type HelpCenterFaqItem = {
  id: string;
  question: string;
  answer: string;
  /** Free-text tokens used by the in-page search filter. */
  keywords: string[];
};

const AR: HelpCenterFaqItem[] = [
  {
    id: 'booking',
    question: 'كيف يمكنني إتمام عملية الحجز؟',
    answer:
      'ابحث عن العقار المناسب، اختر التاريخ والفترة وعدد الضيوف، ثم أكّد الحجز وادفع العربون عبر المنصة بأمان. ستصلك تفاصيل الحجز في حسابك بعد التأكيد.',
    keywords: ['حجز', 'إتمام', 'تأكيد', 'عربون', 'book'],
  },
  {
    id: 'payment',
    question: 'ما هي طرق الدفع المتاحة؟',
    answer:
      'ندعم الدفع الإلكتروني الآمن عبر مزود الدفع المعتمد في المنصة. يتم دفع العربون عند الحجز حسب سياسة العقار، ويمكنك إدارة البطاقات المحفوظة من طرق الدفع في حسابك.',
    keywords: ['دفع', 'بطاقة', 'عربون', 'فاتورة', 'payment', 'card'],
  },
  {
    id: 'cancel-refund',
    question: 'هل يمكنني إلغاء الحجز واسترداد المبلغ؟',
    answer:
      'تختلف سياسة الإلغاء والاسترداد حسب العقار وتظهر قبل تأكيد الحجز. يمكنك طلب الإلغاء من حجوزاتي وفق الشروط المعروضة لكل حجز.',
    keywords: ['إلغاء', 'استرداد', 'refund', 'cancel', 'سياسة'],
  },
  {
    id: 'modify',
    question: 'كيف يمكنني تعديل موعد الحجز؟',
    answer:
      'تعديل الموعد يعتمد على توفر العقار وسياسة الحجز. راجع تفاصيل الحجز في حجوزاتي أو تواصل مع الدعم إذا احتجت مساعدة في التعديل.',
    keywords: ['تعديل', 'موعد', 'تاريخ', 'تغيير', 'modify'],
  },
  {
    id: 'contact',
    question: 'كيف أستطيع التواصل مع فريق الدعم؟',
    answer:
      'استخدم زر تواصل معنا لإرسال طلب دعم، أو افتح طلب مساعدة من صفحة الحجوزات للحجوزات المرتبطة. يمكنك متابعة حالة الطلبات من مركز المساعدة.',
    keywords: ['دعم', 'تواصل', 'مساعدة', 'support', 'contact'],
  },
];

const EN: HelpCenterFaqItem[] = [
  {
    id: 'booking',
    question: 'How do I complete a booking?',
    answer:
      'Find a listing, choose the date, period, and guests, then confirm and pay the deposit securely on the platform. Booking details appear in your account after confirmation.',
    keywords: ['book', 'confirm', 'deposit', 'حجز'],
  },
  {
    id: 'payment',
    question: 'What payment methods are available?',
    answer:
      'We support secure online payment through our approved provider. The deposit is charged at booking per the listing policy, and you can manage saved cards under Payment methods.',
    keywords: ['payment', 'card', 'deposit', 'invoice', 'دفع'],
  },
  {
    id: 'cancel-refund',
    question: 'Can I cancel a booking and get a refund?',
    answer:
      'Cancellation and refund rules vary by listing and are shown before you confirm. You can request cancellation from My bookings according to that booking’s policy.',
    keywords: ['cancel', 'refund', 'policy', 'إلغاء', 'استرداد'],
  },
  {
    id: 'modify',
    question: 'How can I change my booking date?',
    answer:
      'Date changes depend on availability and the booking policy. Check the booking details in My bookings, or contact support if you need help modifying it.',
    keywords: ['modify', 'change', 'date', 'تعديل', 'موعد'],
  },
  {
    id: 'contact',
    question: 'How can I reach the support team?',
    answer:
      'Use Contact us to send a support request, or open help from a booking in My bookings. You can track request status from the Help Center.',
    keywords: ['support', 'contact', 'help', 'دعم', 'تواصل'],
  },
];

export function getHelpCenterFaqItems(locale: string): HelpCenterFaqItem[] {
  return locale === 'en' ? EN : AR;
}
