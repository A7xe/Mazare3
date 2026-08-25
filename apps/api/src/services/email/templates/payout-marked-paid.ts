import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderPayoutMarkedPaid(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const amount = v(vars, 'amount');
  const currency = v(vars, 'currency');
  const ref = v(vars, 'manualReference');
  if (locale === 'en') {
    const text = `A payout of ${amount} ${currency} was recorded (reference: ${ref}).`;
    return {
      subject: 'Payout recorded',
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `تم تسجيل تحويل ${amount} ${currency} (مرجع: ${ref}).`;
  return {
    subject: 'تم تسجيل التحويل',
    text,
    html: simpleHtml(text, locale),
  };
}
