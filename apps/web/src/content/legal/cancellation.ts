import type { LegalDocument } from '@/lib/legal/types';
import {
  BALANCE_DUE_HOURS_BEFORE_START,
  CANCELLATION_CHARGE_30_UNTIL_HOURS,
  CANCELLATION_CHARGE_50_UNTIL_HOURS,
  CANCELLATION_CHARGE_PERCENT_TIER_100,
  CANCELLATION_CHARGE_PERCENT_TIER_30,
  CANCELLATION_CHARGE_PERCENT_TIER_50,
  CANCELLATION_FREE_UNTIL_HOURS,
  DEPOSIT_PERCENT,
  FULL_PAYMENT_WITHIN_HOURS,
} from '@mazare3/shared';

export const cancellationEn: LegalDocument = {
  slug: 'cancellation-refund',
  title: 'Cancellation & Refund Policy',
  intro:
    'This page matches how Mazare3 currently treats cancellations and refunds. Expected refund amounts are calculated by the platform from captured funds and merchant booking value. Returning money to your original payment method happens only after a refund is processed with the payment provider — it is not always instant.',
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
      id: 'payment-plan',
      title: 'Deposit vs full payment',
      paragraphs: [
        `When your booking start is more than ${FULL_PAYMENT_WITHIN_HOURS} hours away, you may pay a ${DEPOSIT_PERCENT}% deposit or pay in full.`,
        `When your booking start is ${FULL_PAYMENT_WITHIN_HOURS} hours away or less, full payment is required before confirmation proceeds.`,
        `For deposit bookings, the remaining balance is due ${BALANCE_DUE_HOURS_BEFORE_START} hours before the actual booking start (Jordan local time). If the balance is not paid by then, the booking may be auto-cancelled and the captured deposit retained.`,
      ],
    },
    {
      id: 'after-payment',
      title: 'After a successful deposit or full payment',
      paragraphs: [
        'Once the booking is confirmed and money has been captured, cancellation is allowed only before the booking start. After the start, the platform does not treat the booking as cancellable.',
        'The platform calculates retention from merchant booking value and caps it at captured funds — you are never charged extra on cancel.',
        'Your booking page shows the tier that applies using the actual booking period start, not midnight UTC.',
      ],
    },
    {
      id: 'tiers',
      title: 'Current time-based tiers',
      paragraphs: [
        'These charge percentages apply to merchant booking value. Retained amount is min(captured, policy charge). Refund is captured minus retained.',
      ],
      bullets: [
        `More than ${CANCELLATION_FREE_UNTIL_HOURS} hours before start: 0% charge — full refund of captured funds.`,
        `Between ${CANCELLATION_CHARGE_30_UNTIL_HOURS + 1} and ${CANCELLATION_FREE_UNTIL_HOURS} hours before start: ${CANCELLATION_CHARGE_PERCENT_TIER_30}% charge on merchant value.`,
        `Between ${CANCELLATION_CHARGE_50_UNTIL_HOURS + 1} and ${CANCELLATION_CHARGE_30_UNTIL_HOURS} hours before start: ${CANCELLATION_CHARGE_PERCENT_TIER_50}% charge on merchant value.`,
        `Up to ${CANCELLATION_CHARGE_50_UNTIL_HOURS} hours before start: ${CANCELLATION_CHARGE_PERCENT_TIER_100}% charge on merchant value.`,
        'After the booking start: cancellation is not offered.',
      ],
    },
    {
      id: 'deposit-vs-full',
      title: 'Deposit-only and fully paid bookings',
      paragraphs: [
        'If only a deposit was captured, retention and refund use that captured amount only — never an unpaid remaining balance. If fully paid later, captured totals include successful payments minus recorded refunds.',
      ],
    },
    {
      id: 'how-money-returns',
      title: 'How money is actually returned',
      paragraphs: [
        'Cancelling a confirmed paid booking creates a refund obligation when refund > 0. Mazare3 attempts provider refund when safe; otherwise the request stays pending for admin retry.',
        'You can also submit a refund request from My bookings for platform review.',
      ],
    },
    {
      id: 'partial-full',
      title: 'Partial and full refunds',
      paragraphs: [
        'Refund equals captured minus retained. A 0 JOD refund tier means nothing is returned — not an extra charge beyond captured funds.',
      ],
    },
    {
      id: 'owner-platform',
      title: 'Partner and platform decisions',
      paragraphs: [
        'Partners accept or decline booking requests that require approval. Platform operators review refund requests and process provider refunds when needed.',
      ],
    },
  ],
};

export const cancellationAr: LegalDocument = {
  slug: 'cancellation-refund',
  title: 'سياسة الإلغاء والاسترداد',
  intro:
    'تطابق هذه الصفحة معاملة مزارع الحالية للإلغاء والاسترداد. تحسب المنصة الاسترداد من الأموال المحصّلة وقيمة الحجز للشريك. إعادة المال إلى وسيلة الدفع الأصلية تتم فقط بعد معالجة الاسترداد مع مزود الدفع.',
  sections: [
    {
      id: 'before-payment',
      title: 'قبل تحصيل أي مبلغ',
      paragraphs: [
        'إذا كان حجزك ما زال بانتظار الدفع، أو بانتظار قبول الشريك، يمكنك إلغاءه. تُعاد الفترة إلى التوفر.',
        'إذا رفض الشريك الطلب، أو انتهت مهلة الرد دون رد، لا يُخصم أي مبلغ.',
      ],
    },
    {
      id: 'expiry',
      title: 'الحجوزات المنتهية غير المدفوعة',
      paragraphs: [
        'إذا انتهت نافذة الدفع قبل دفع ناجح، قد ينتقل الحجز إلى منتهٍ. هذا ليس استرداداً لأنه لم يُحصَّل مبلغ.',
      ],
    },
    {
      id: 'payment-plan',
      title: 'العربون مقابل الدفع الكامل',
      paragraphs: [
        `إذا كانت بداية الحجز بعد أكثر من ${FULL_PAYMENT_WITHIN_HOURS} ساعة، يمكنك دفع عربون ${DEPOSIT_PERCENT}% أو المبلغ كاملاً.`,
        `إذا كانت البداية خلال ${FULL_PAYMENT_WITHIN_HOURS} ساعة أو أقل، يُطلب الدفع الكامل.`,
        `لحجوزات العربون، يُستحق الرصيد قبل ${BALANCE_DUE_HOURS_BEFORE_START} ساعة من بداية الحجز الفعلية. إذا لم يُدفع، قد يُلغى الحجز تلقائياً ويُحتفظ بالعربون المحصّل.`,
      ],
    },
    {
      id: 'after-payment',
      title: 'بعد عربون أو دفع كامل ناجح',
      paragraphs: [
        'يُسمح بالإلغاء فقط قبل بداية الحجز. بعد البداية لا يُعرض إلغاء.',
        'تحسب المنصة الاحتفاظ من قيمة الحجز للشريك بحد أقصى المبلغ المحصّل — لا تُخصم مبالغ إضافية عند الإلغاء.',
      ],
    },
    {
      id: 'tiers',
      title: 'الشرائح الزمنية الحالية',
      paragraphs: [
        'نسب الاحتفاظ تُطبَّق على قيمة الحجز للشريك. المبلغ المحتفظ = min(المحصّل، رسوم السياسة).',
      ],
      bullets: [
        `أكثر من ${CANCELLATION_FREE_UNTIL_HOURS} ساعة: 0% — استرداد كامل للمحصّل.`,
        `بين ${CANCELLATION_CHARGE_30_UNTIL_HOURS + 1} و${CANCELLATION_FREE_UNTIL_HOURS} ساعة: ${CANCELLATION_CHARGE_PERCENT_TIER_30}%.`,
        `بين ${CANCELLATION_CHARGE_50_UNTIL_HOURS + 1} و${CANCELLATION_CHARGE_30_UNTIL_HOURS} ساعة: ${CANCELLATION_CHARGE_PERCENT_TIER_50}%.`,
        `حتى ${CANCELLATION_CHARGE_50_UNTIL_HOURS} ساعة: ${CANCELLATION_CHARGE_PERCENT_TIER_100}%.`,
        'بعد البداية: لا إلغاء.',
      ],
    },
    {
      id: 'deposit-vs-full',
      title: 'العربون فقط والحجز المدفوع بالكامل',
      paragraphs: [
        'إذا حُصّل العربون فقط، يُبنى الاحتفاظ والاسترداد على المحصّل فقط.',
      ],
    },
    {
      id: 'how-money-returns',
      title: 'كيف يُعاد المال',
      paragraphs: [
        'إلغاء حجز مدفوع ينشئ التزام استرداد عند refund > 0. تحاول مزارع استرداد المزود عندما يكون آمناً.',
      ],
    },
    {
      id: 'partial-full',
      title: 'الاسترداد الجزئي والكامل',
      paragraphs: ['الاسترداد = المحصّل − المحتفظ.'],
    },
    {
      id: 'owner-platform',
      title: 'قرارات الشريك والمنصة',
      paragraphs: ['يراجع مشغّلو المنصة طلبات الاسترداد ويعالجون استرداد المزود عند الحاجة.'],
    },
  ],
};
