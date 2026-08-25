import { simpleHtml } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderOwnerApplicationApproved(
  locale: EmailLocale,
  _vars: EmailTemplateVariables,
): RenderedEmail {
  if (locale === 'en') {
    const text =
      'Your owner account has been approved.\n\nYou can now add properties and manage bookings from your owner dashboard.';
    return {
      subject: 'Owner account approved',
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text =
    'تمت الموافقة على حسابك كمالك.\n\nيمكنك الآن إضافة عقاراتك وإدارة الحجوزات من لوحة المالك.';
  return {
    subject: 'تمت الموافقة على حساب المالك',
    text,
    html: simpleHtml(text, locale),
  };
}
