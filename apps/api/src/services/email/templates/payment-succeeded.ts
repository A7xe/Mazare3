import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderPaymentSucceeded(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const code = v(vars, 'publicCode');
  if (locale === 'en') {
    const text = `We received your payment for booking ${code}.\n\nYour booking is now confirmed.`;
    return {
      subject: `Payment received — ${code}`,
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `تم استلام دفعتك للحجز ${code}.\n\nحجزك مؤكد الآن.`;
  return {
    subject: `تم استلام الدفع — ${code}`,
    text,
    html: simpleHtml(text, locale),
  };
}
