import type { LegalDocument } from '@/lib/legal/types';

export const contactEn: LegalDocument = {
  slug: 'contact',
  title: 'Contact us',
  intro:
    'Use your Mazare3 account for anything tied to a booking. Public email or phone appear below only when the operator has published them.',
  sections: [
    {
      id: 'bookings',
      title: 'If you already have a booking',
      paragraphs: [
        'Open My bookings to see payment status, cancellation options, refund requests, and — when your booking is eligible — exact arrival details.',
        'For a problem with a specific reservation, use Get help with this booking on My bookings so the request is linked to that booking. Do not use this page to change payments or refunds.',
      ],
    },
    {
      id: 'general-support',
      title: 'General questions',
      paragraphs: [
        'You can send a general support request with the form on this page. Submitting a message does not cancel a booking, capture a payment, or issue a refund.',
      ],
    },
    {
      id: 'partners',
      title: 'If you want to list a property',
      paragraphs: [
        'Use Become a partner to start an owner application. Partner onboarding and verification documents are handled inside that flow, not through a public contact form.',
      ],
    },
    {
      id: 'privacy-requests',
      title: 'Privacy requests',
      paragraphs: [
        'If a privacy email is published in the details below, you may use it for access or deletion questions. Otherwise, start from your account pages. We do not invent a contact address on this page.',
      ],
    },
  ],
};

export const contactAr: LegalDocument = {
  slug: 'contact',
  title: 'تواصل معنا',
  intro:
    'استخدم حسابك في مزارع لكل ما يتعلق بحجز قائم. يظهر البريد أو الهاتف العام أدناه فقط إذا نشره مشغّل المنصة.',
  sections: [
    {
      id: 'bookings',
      title: 'إذا كان لديك حجز',
      paragraphs: [
        'افتح «حجوزاتي» لمعرفة حالة الدفع وخيارات الإلغاء وطلبات الاسترداد، وتفاصيل الوصول الدقيقة عندما يكون حجزك مؤهلاً.',
        'لمشكلة على حجز معيّن استخدم «مشكلة في الحجز» من صفحة حجوزاتي حتى يُربط الطلب بذلك الحجز. لا تستخدم هذه الصفحة لتغيير المدفوعات أو الاسترداد.',
      ],
    },
    {
      id: 'general-support',
      title: 'أسئلة عامة',
      paragraphs: [
        'يمكنك إرسال طلب دعم عام عبر النموذج في هذه الصفحة. إرسال الرسالة لا يلغي حجزاً ولا يحصّل دفعة ولا يُصدر استرداداً.',
      ],
    },
    {
      id: 'partners',
      title: 'إذا أردت عرض عقار',
      paragraphs: [
        'استخدم «أضف مزرعتك» لبدء طلب الشريك. يتم التعامل مع الانضمام ومستندات التحقق داخل ذلك المسار، وليس عبر نموذج تواصل عام.',
      ],
    },
    {
      id: 'privacy-requests',
      title: 'طلبات الخصوصية',
      paragraphs: [
        'إذا نُشر بريد للخصوصية في التفاصيل أدناه يمكنك استخدامه لأسئلة الوصول أو الحذف. وإلا فابدأ من صفحات حسابك. لا نخترع عنوان تواصل في هذه الصفحة.',
      ],
    },
  ],
};
