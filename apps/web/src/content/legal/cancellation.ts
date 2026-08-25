import type { LegalDocument } from '@/lib/legal/types';

export const cancellationEn: LegalDocument = {
  slug: 'cancellation-refund',
  title: 'Cancellation & Refund Policy',
  intro:
    'This page matches how Mazare3 currently treats cancellations and refunds. Expected refund amounts are calculated by the platform. Returning money to your original payment method happens only after a refund is processed with the payment provider — it is not always instant.',
  sections: [
    {
      id: 'before-payment',
      title: 'Before any payment is taken',
      paragraphs: [
        'If your booking is still waiting for payment, or waiting for the partner to accept, you can cancel it. The time slot is released. No deposit is collected in the owner-approval waiting stage.',
        'If the partner declines the request, or the request expires because they did not respond in time, no payment is taken.',
      ],
    },
    {
      id: 'expiry',
      title: 'Expired unpaid bookings',
      paragraphs: [
        'If a payment or hold window expires before a successful payment, the booking can move to expired and the slot can return to available. That is not a refund, because nothing was captured.',
      ],
    },
    {
      id: 'after-payment',
      title: 'After a successful deposit or full payment',
      paragraphs: [
        'Once the booking is confirmed and money has been captured, cancellation is allowed only before the booking start. After the start, the platform does not treat the booking as cancellable.',
        'The platform calculates an expected refund from the amount captured, using hours remaining before the booking start. Your booking page shows the tier that applies to that booking at that moment.',
      ],
    },
    {
      id: 'tiers',
      title: 'Current time-based tiers',
      paragraphs: [
        'These are the operational windows the platform uses today when it calculates an expected refund. They can be changed by the operator; always read the summary on your booking.',
      ],
      bullets: [
        '72 hours or more before start: expected refund is 100% of the captured amount used in the calculation.',
        'Less than 72 hours but at least 24 hours before start: expected refund is 50% of that amount.',
        'Less than 24 hours before start: expected refund is 0%.',
        'After the booking start: cancellation is not offered.',
      ],
    },
    {
      id: 'deposit-vs-full',
      title: 'Deposit-only and fully paid bookings',
      paragraphs: [
        'The calculation uses the amount the platform treats as captured for that booking. If only a deposit was captured, the expected refund is based on that captured amount, not on an unpaid remaining balance. If the booking was later fully paid, captured totals include those successful payments, minus refunds already recorded.',
      ],
    },
    {
      id: 'how-money-returns',
      title: 'How money is actually returned',
      paragraphs: [
        'Cancelling a confirmed paid booking records the expected refund and marks the payment for refund handling. It does not by itself prove that your bank or card issuer has already posted a credit.',
        'You can also submit a refund request from My bookings for platform review. When the platform marks a refund as processed, it can instruct the payment provider to refund. Timing after that depends on the provider and your bank.',
        'Mazare3 does not add extra invented percentages on top of the tiers above. Staff review may still be required before a provider refund is sent.',
      ],
    },
    {
      id: 'partial-full',
      title: 'Partial and full refunds',
      paragraphs: [
        'A 100% expected refund is a full refund of the captured amount used in the policy calculation. A 50% expected refund is a partial refund of that amount. A 0% tier means the platform does not calculate a refundable amount for that cancellation.',
        'A booking may later show as partially refunded or fully refunded after recorded refunds. A full refund of captured funds is a platform/payment-provider outcome, not an automatic card credit at the moment you press cancel.',
      ],
    },
    {
      id: 'owner-platform',
      title: 'Partner and platform decisions',
      paragraphs: [
        'Partners accept or decline booking requests that require approval. They do not run the refund calculator. Platform operators can review refund requests and process provider refunds.',
        'Disputes can be opened from eligible bookings for platform review. Opening a dispute is not the same as an automatic refund.',
      ],
    },
  ],
};

export const cancellationAr: LegalDocument = {
  slug: 'cancellation-refund',
  title: 'سياسة الإلغاء والاسترداد',
  intro:
    'تطابق هذه الصفحة معاملة مزارع الحالية للإلغاء والاسترداد. تحسب المنصة مبلغ الاسترداد المتوقع. إعادة المال إلى وسيلة الدفع الأصلية تتم فقط بعد معالجة الاسترداد مع مزود الدفع — وليست فورية دائماً.',
  sections: [
    {
      id: 'before-payment',
      title: 'قبل تحصيل أي مبلغ',
      paragraphs: [
        'إذا كان حجزك ما زال بانتظار الدفع، أو بانتظار قبول الشريك، يمكنك إلغاءه. تُعاد الفترة إلى التوفر. لا يُجمع عربون في مرحلة انتظار موافقة المالك.',
        'إذا رفض الشريك الطلب، أو انتهت مهلة الرد دون رد، لا يُخصم أي مبلغ.',
      ],
    },
    {
      id: 'expiry',
      title: 'الحجوزات المنتهية غير المدفوعة',
      paragraphs: [
        'إذا انتهت نافذة الدفع أو التثبيت قبل دفع ناجح، قد ينتقل الحجز إلى منتهٍ وتعود الفترة متاحة. هذا ليس استرداداً، لأنه لم يُحصَّل مبلغ.',
      ],
    },
    {
      id: 'after-payment',
      title: 'بعد عربون أو دفع كامل ناجح',
      paragraphs: [
        'بعد تأكيد الحجز وتحصيل المبلغ، يُسمح بالإلغاء فقط قبل بداية الحجز. بعد البداية لا تعامل المنصة الحجز على أنه قابل للإلغاء.',
        'تحسب المنصة استرداداً متوقعاً من المبلغ المحصّل حسب الساعات المتبقية قبل بداية الحجز. صفحة حجزك تعرض الشريحة التي تنطبق في تلك اللحظة.',
      ],
    },
    {
      id: 'tiers',
      title: 'الشرائح الزمنية الحالية',
      paragraphs: [
        'هذه نوافذ التشغيل التي تستخدمها المنصة اليوم عند حساب الاسترداد المتوقع. يمكن للمشغّل تغييرها؛ اقرأ دائماً الملخص على حجزك.',
      ],
      bullets: [
        'قبل البداية بـ 72 ساعة أو أكثر: الاسترداد المتوقع 100% من المبلغ المحصّل المستخدم في الحساب.',
        'أقل من 72 ساعة وعلى الأقل 24 ساعة قبل البداية: الاسترداد المتوقع 50% من ذلك المبلغ.',
        'أقل من 24 ساعة قبل البداية: الاسترداد المتوقع 0%.',
        'بعد بداية الحجز: لا يُعرض إلغاء.',
      ],
    },
    {
      id: 'deposit-vs-full',
      title: 'العربون فقط والحجز المدفوع بالكامل',
      paragraphs: [
        'يستخدم الحساب المبلغ الذي تعتبره المنصة محصّلاً لذلك الحجز. إذا حُصّل العربون فقط، يُبنى الاسترداد المتوقع على ذلك المبلغ لا على رصيد غير مدفوع. وإذا دُفع الحجز لاحقاً بالكامل، تشمل المجاميع المحصّلة تلك الدفعات الناجحة ناقص أي استرداد مسجّل.',
      ],
    },
    {
      id: 'how-money-returns',
      title: 'كيف يُعاد المال فعلاً',
      paragraphs: [
        'إلغاء حجز مؤكد مدفوع يسجّل الاسترداد المتوقع ويعلّم الدفعة لمعالجة الاسترداد. هذا وحده لا يثبت أن المصرف أو جهة البطاقة قد أضافت الرصيد.',
        'يمكنك أيضاً إرسال طلب استرداد من «حجوزاتي» لمراجعة المنصة. عندما تعلّم المنصة الاسترداد كمعالَج يمكنها توجيه مزود الدفع بالرد. الوقت بعد ذلك يعتمد على المزود ومصرفك.',
        'لا تضيف مزارع نسباً مخترعة فوق الشرائح أعلاه. قد تبقى مراجعة تشغيلية مطلوبة قبل إرسال استرداد المزود.',
      ],
    },
    {
      id: 'partial-full',
      title: 'الاسترداد الجزئي والكامل',
      paragraphs: [
        'استرداد متوقع 100% يعني استرداداً كاملاً للمبلغ المحصّل المستخدم في الحساب. و50% استرداد جزئي لذلك المبلغ. وشريحة 0% تعني أن المنصة لا تحسب مبلغاً قابلاً للرد لذلك الإلغاء.',
        'قد يظهر الحجز لاحقاً كمسترد جزئياً أو بالكامل بعد استردادات مسجّلة. الاسترداد الكامل للأموال المحصّلة نتيجة للمنصة/مزود الدفع، وليس رصيداً تلقائياً على البطاقة لحظة الضغط على إلغاء.',
      ],
    },
    {
      id: 'owner-platform',
      title: 'قرارات الشريك والمنصة',
      paragraphs: [
        'يقبل الشركاء طلبات الحجز التي تتطلب موافقة أو يرفضونها. لا يشغّلون حاسبة الاسترداد. ويمكن لمشغّلي المنصة مراجعة طلبات الاسترداد ومعالجة استرداد المزود.',
        'يمكن فتح نزاع من الحجوزات المؤهلة لمراجعة المنصة. فتح النزاع ليس استرداداً تلقائياً.',
      ],
    },
  ],
};
