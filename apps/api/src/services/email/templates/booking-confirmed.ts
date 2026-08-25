import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderBookingConfirmed(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const code = v(vars, 'publicCode');
  const propertyAr = v(vars, 'propertyTitleAr');
  const propertyEn = v(vars, 'propertyTitleEn');
  const propertyFallback = v(vars, 'propertyTitle');
  const property = locale === 'en' ? propertyEn || propertyFallback : propertyAr || propertyFallback;
  if (locale === 'en') {
    const text = `Your booking ${code} is confirmed${property ? ` for ${property}` : ''}.\n\nThank you for using Mazare3 Jordan.`;
    return {
      subject: `Booking confirmed — ${code}`,
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `تم تأكيد حجزك ${code}${property ? ` على ${property}` : ''}.\n\nشكرًا لاستخدامك مزارع الأردن.`;
  return {
    subject: `تأكيد الحجز — ${code}`,
    text,
    html: simpleHtml(text, locale),
  };
}
