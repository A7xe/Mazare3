import type { HomeFaqItem } from '@/components/home/home-faq';

const AR: HomeFaqItem[] = [
  {
    id: '1',
    question: 'كيف يمكنني حجز مزرعة أو شاليه على مزارع؟',
    answer:
      'ابحث بالمدينة والتاريخ وعدد الضيوف، اختر العقار المناسب، ثم أكّد الحجز وادفع العربون عبر المنصة بأمان.',
  },
  {
    id: '2',
    question: 'ما هي سياسة الإلغاء والتعديل؟',
    answer:
      'تختلف سياسة الإلغاء حسب العقار. تظهر التفاصيل قبل تأكيد الحجز، ويمكنك مراجعة الشروط في صفحة العقار أو من حجوزاتك.',
  },
  {
    id: '3',
    question: 'ما هي طرق الدفع المتاحة؟',
    answer:
      'ندعم الدفع الإلكتروني الآمن عبر مزود الدفع المعتمد في المنصة. يتم دفع العربون عند الحجز حسب سياسة العقار.',
  },
  {
    id: '4',
    question: 'ما هو وقت تسجيل الدخول والخروج؟',
    answer:
      'أوقات الدخول والخروج تظهر في تفاصيل كل عقار قبل الحجز، وقد تختلف بين يومي ومبيت. راجع الجدول الزمني عند اختيار الفترة.',
  },
  {
    id: '5',
    question: 'كيف يمكنني التواصل مع دعم العملاء؟',
    answer:
      'يمكنك فتح طلب دعم من حسابك بعد تسجيل الدخول، أو التواصل عبر صفحة الدعم. نتابع الطلبات المتعلقة بالحجوزات والمدفوعات.',
  },
];

const EN: HomeFaqItem[] = [
  {
    id: '1',
    question: 'How do I book a farm or chalet on Mazare3?',
    answer:
      'Search by city, date, and guests, choose a listing, then confirm and pay the deposit securely through the platform.',
  },
  {
    id: '2',
    question: 'What is the cancellation and modification policy?',
    answer:
      'Cancellation rules vary by listing and are shown before you confirm. You can also review them on the property page or in your bookings.',
  },
  {
    id: '3',
    question: 'What payment methods are available?',
    answer:
      'We support secure online payment through our approved payment provider. The deposit is paid at booking according to the listing policy.',
  },
  {
    id: '4',
    question: 'What are the check-in and check-out times?',
    answer:
      'Check-in and check-out times are listed on each property and may differ for day-use and overnight stays. Review them when selecting your slot.',
  },
  {
    id: '5',
    question: 'How can I contact customer support?',
    answer:
      'Signed-in users can open a support request from their account, or use the support page. We handle booking and payment related requests.',
  },
];

export function getHomeFaqItems(locale: string): HomeFaqItem[] {
  return locale === 'en' ? EN : AR;
}
