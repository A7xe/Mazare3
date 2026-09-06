import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@mazare3/shared';

export const routing = defineRouting({
  locales: [...LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  /**
   * Product default is Arabic. Do not negotiate from Accept-Language
   * (e.g. English browsers must not override Mazare3's AR default).
   * Explicit `/en` URLs and the language switcher still work via prefixes.
   */
  localeDetection: false,
});
