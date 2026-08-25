import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderDisputeOpened(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const code = v(vars, 'publicCode');
  if (locale === 'en') {
    const text = `A dispute was opened for booking ${code}. Please review it in the admin dashboard.`;
    return {
      subject: `Dispute opened — ${code}`,
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `تم فتح نزاع للحجز ${code}. يرجى مراجعته من لوحة الأدمن.`;
  return {
    subject: `نزاع جديد — ${code}`,
    text,
    html: simpleHtml(text, locale),
  };
}
