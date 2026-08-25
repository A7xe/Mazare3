import { simpleHtml, v } from './helpers.js';
import type { EmailLocale, EmailTemplateVariables, RenderedEmail } from './types.js';

export function renderPropertyPublished(
  locale: EmailLocale,
  vars: EmailTemplateVariables,
): RenderedEmail {
  const titleAr = v(vars, 'propertyTitleAr');
  const titleEn = v(vars, 'propertyTitleEn');
  const titleFallback = v(vars, 'propertyTitle');
  const title = locale === 'en' ? titleEn || titleFallback : titleAr || titleFallback;
  if (locale === 'en') {
    const text = `Your property "${title}" is now published and available for bookings on Mazare3 Jordan.`;
    return {
      subject: `Property published — ${title}`,
      text,
      html: simpleHtml(text, locale),
    };
  }
  const text = `العقار «${title}» أصبح منشورًا ومتاحًا للحجز على مزارع الأردن.`;
  return {
    subject: `تم نشر العقار — ${title}`,
    text,
    html: simpleHtml(text, locale),
  };
}
