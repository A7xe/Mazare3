import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@mazare3/shared';
import { makeLegalMetadata } from '@/components/legal/make-legal-page';
import { ContactPageView } from '@/components/legal/contact-page-view';
import { getLegalDocument } from '@/content/legal';
import { getSiteIdentity } from '@/lib/legal/site-identity';

export const generateMetadata = makeLegalMetadata('contact');

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const doc = getLegalDocument('contact', typedLocale);
  return (
    <ContactPageView locale={typedLocale} title={doc.title} identity={getSiteIdentity()} />
  );
}
