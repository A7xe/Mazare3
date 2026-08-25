import type { LegalDocument } from '@/lib/legal/types';

export const aboutEn: LegalDocument = {
  slug: 'about',
  title: 'About Mazare3',
  intro:
    'Mazare3 Jordan is a bilingual marketplace for booking private recreational farms, chalets, and similar stays in Jordan. Customers find a place and a time slot; property partners list and host those stays.',
  sections: [
    {
      id: 'what',
      title: 'What Mazare3 is',
      paragraphs: [
        'Mazare3 connects people who want to book a private recreational property with partners who list that property. “Farm” here means a recreational stay — a chalet, villa, istiraha, or similar place — not an agricultural business.',
        'The platform is built for Jordan: Arabic and English, local dates and times, and listings organised by city and area.',
      ],
    },
    {
      id: 'how',
      title: 'How booking works',
      paragraphs: [
        'You search by place, date, and guests, then choose an available time slot at a published price. Some listings confirm instantly after a successful payment; others wait for the property partner to accept the request before any deposit is collected.',
        'Mazare3 is the marketplace and the payment collection path shown at checkout. The stay itself is hosted by the property partner, who is responsible for the listing, house rules, and the visit.',
      ],
    },
    {
      id: 'trust',
      title: 'What we show — and what we do not claim',
      paragraphs: [
        'Listings may carry platform labels such as verified photos, featured, or sponsored when those statuses are actually true for that listing. Guest reviews appear when a stay is eligible for review.',
        'Approximate location is shown while you browse. The exact pin and arrival notes are shared only with the customer who has an eligible confirmed booking.',
      ],
      bullets: [
        'We do not publish user, booking, or partner counts on this page.',
        'Featured and sponsored placements are labeled when they are used.',
        'Mazare3 does not claim government licensing, insurance cover, or marketplace awards on this site.',
      ],
    },
  ],
};

export const aboutAr: LegalDocument = {
  slug: 'about',
  title: 'عن مزارع',
  intro:
    'مزارع الأردن سوق ثنائي اللغة لحجز المزارع الترفيهية الخاصة والشاليهات والإقامات المشابهة في الأردن. يجد الزبون المكان والفترة، ويعرض الشريك العقار ويستضيف الإقامة.',
  sections: [
    {
      id: 'what',
      title: 'ما هي مزارع',
      paragraphs: [
        'تربط مزارع بين من يريد حجز عقار ترفيهي خاص وبين الشركاء الذين يعرضون ذلك العقار. كلمة «مزرعة» هنا تعني إقامة ترفيهية — شاليه أو فيلا أو استراحة أو ما يشبهها — وليست نشاطاً زراعياً.',
        'المنصة مصممة للأردن: العربية والإنجليزية، والتواريخ والأوقات المحلية، وعقارات مرتبة حسب المدينة والمنطقة.',
      ],
    },
    {
      id: 'how',
      title: 'كيف يتم الحجز',
      paragraphs: [
        'تبحث حسب المكان والتاريخ وعدد الضيوف، ثم تختار فترة متاحة بسعر منشور. بعض العقارات تتأكد فوراً بعد دفع ناجح، وأخرى تنتظر قبول شريك العقار قبل جمع أي عربون.',
        'مزارع هي السوق ومسار تحصيل الدفع الظاهر عند إتمام الدفع. الإقامة نفسها يقدمها شريك العقار، وهو المسؤول عن الإعلان وقواعد البيت والزيارة.',
      ],
    },
    {
      id: 'trust',
      title: 'ماذا نعرض — وما لا ندّعيه',
      paragraphs: [
        'قد تظهر على الإعلان علامات من المنصة مثل صور موثقة أو مميز أو ممول عندما تكون هذه الحالة صحيحة لذلك الإعلان. وتظهر تقييمات الضيوف عندما تكون الإقامة مؤهلة للتقييم.',
        'يظهر الموقع التقريبي أثناء التصفح. النقطة الدقيقة وتعليمات الوصول تُشارك فقط مع الزبون صاحب الحجز المؤكد المؤهل.',
      ],
      bullets: [
        'لا ننشر في هذه الصفحة أعداد مستخدمين أو حجوزات أو شركاء.',
        'يُوسم الإعلان المميز أو الممول عند استخدام هذه التصنيفات.',
        'لا تدّعي مزارع على هذا الموقع ترخيصاً حكومياً أو تغطية تأمين أو جوائز سوق.',
      ],
    },
  ],
};
