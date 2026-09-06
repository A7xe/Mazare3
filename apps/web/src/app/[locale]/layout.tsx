import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Cairo } from 'next/font/google';
import { LOCALES, type Locale } from '@mazare3/shared';
import { routing } from '@/i18n/routing';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteChrome } from '@/components/layout/site-chrome';
import { MainContent } from '@/components/layout/main-content';
import { AuthBreadcrumbExtrasProvider } from '@/components/layout/auth-breadcrumb-extras';
import { FavoritesProvider } from '@/components/favorites/favorites-context';
import { AuthSessionProvider } from '@/components/auth/auth-session';
import { getSessionUser } from '@/lib/get-session-user';
import '../globals.css';

/**
 * Official Mazare3 typeface: Cairo (AR + EN).
 * Loaded as a true variable font (wght 200–1000) so major headings can use ~850.
 */
const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: 'variable',
  variable: '--font-cairo',
  display: 'swap',
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const initialUser = await getSessionUser();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${cairo.variable} ${cairo.className} min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <AuthSessionProvider initialUser={initialUser}>
            <FavoritesProvider>
              <AuthBreadcrumbExtrasProvider>
                <SiteChrome />
                <MainContent>{children}</MainContent>
              </AuthBreadcrumbExtrasProvider>
              <SiteFooter />
            </FavoritesProvider>
          </AuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
