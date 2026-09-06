import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const handleI18nRouting = createMiddleware(routing);

/**
 * next-intl with `localeDetection: false` ignores Accept-Language (good —
 * Arabic is the product default) and also ignores NEXT_LOCALE for bare `/`.
 * Honor an explicit prior choice stored in NEXT_LOCALE when visiting `/`,
 * so switching to English is not wiped by the next root visit.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/') {
    const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
    if (
      cookieLocale &&
      routing.locales.includes(cookieLocale as (typeof routing.locales)[number]) &&
      cookieLocale !== routing.defaultLocale
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${cookieLocale}`;
      return NextResponse.redirect(url);
    }
  }

  return handleI18nRouting(request);
}

export const config = {
  matcher: ['/', '/(ar|en)/:path*'],
};
