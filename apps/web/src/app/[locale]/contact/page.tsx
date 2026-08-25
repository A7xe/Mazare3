import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@mazare3/shared';
import { makeLegalMetadata } from '@/components/legal/make-legal-page';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { ContactSupportForm } from '@/components/legal/contact-support-form';
import { getLegalDocument } from '@/content/legal';
import { getSiteIdentity, LEGAL_PAGES_UPDATED_ON } from '@/lib/legal/site-identity';

export const generateMetadata = makeLegalMetadata('contact');

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const typedLocale = locale as Locale;
  const doc = getLegalDocument('contact', typedLocale);
  return (
    <LegalDocumentView
      doc={doc}
      locale={typedLocale}
      updatedOn={LEGAL_PAGES_UPDATED_ON}
      identity={getSiteIdentity()}
      showContactBlock
    >
      <ContactSupportForm />
    </LegalDocumentView>
  );
}
