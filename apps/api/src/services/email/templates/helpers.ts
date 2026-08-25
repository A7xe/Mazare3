import type { EmailLocale, EmailTemplateVariables } from './types.js';

export function v(vars: EmailTemplateVariables, key: string, fallback = ''): string {
  const val = vars[key];
  return val == null ? fallback : String(val);
}

export function pickLocale(locale: string | undefined): EmailLocale {
  return locale === 'en' ? 'en' : 'ar';
}

export function simpleHtml(text: string, locale: EmailLocale): string {
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const lang = locale === 'ar' ? 'ar' : 'en';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
  return `<!DOCTYPE html><html lang="${lang}" dir="${dir}"><body style="font-family:sans-serif;line-height:1.5">${escaped}</body></html>`;
}
