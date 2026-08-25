import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Tajawal, Inter } from 'next/font/google';
import { LOCALES, type Locale } from '@mazare3/shared';
import { routing } from '@/i18n/routing';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteChrome } from '@/components/layout/site-chrome';
import { FavoritesProvider } from '@/components/favorites/favorites-context';
import { AuthSessionProvider } from '@/components/auth/auth-session';
import { getSessionUser } from '@/lib/get-session-user';
import '../globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '700'],
  variable: '--font-tajawal',
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
      <body className={`${inter.variable} ${tajawal.variable} min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={messages}>
          <AuthSessionProvider initialUser={initialUser}>
            <FavoritesProvider>
              <SiteChrome />
              <main className="flex-1 pb-[4.75rem] sm:pb-20 md:pb-8">{children}</main>
              <SiteFooter />
            </FavoritesProvider>
          </AuthSessionProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
