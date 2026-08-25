import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderRefundRequested(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const code = v(vars, 'publicCode');
  if (locale === 'en') {
    const text = `A new refund request for booking ${code} needs admin review.`;
    return {
      subject: `Refund request — ${code}`,
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `طلب استرداد جديد للحجز ${code} بانتظار مراجعة الأدمن.`;
  return {
    subject: `طلب استرداد — ${code}`,
    text,
    html: simpleHtml(text, locale),
  };
}
