import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import type { Locale } from '@mazare3/shared';
import { getLegalDocument } from '@/content/legal';
import { LegalDocumentView } from '@/components/legal/legal-document-view';
import { getSiteIdentity, LEGAL_PAGES_UPDATED_ON } from '@/lib/legal/site-identity';
import type { LegalPageSlug } from '@/lib/legal/types';

export function makeLegalMetadata(slug: LegalPageSlug) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const doc = getLegalDocument(slug, locale as Locale);
    return { title: doc.title };
  };
}

export function makeLegalPage(slug: LegalPageSlug) {
  return async function LegalPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    setRequestLocale(locale);
    const typedLocale = locale as Locale;
    const doc = getLegalDocument(slug, typedLocale);
    return (
      <LegalDocumentView
        doc={doc}
        locale={typedLocale}
        updatedOn={LEGAL_PAGES_UPDATED_ON}
        identity={slug === 'contact' || slug === 'about' ? getSiteIdentity() : undefined}
        showContactBlock={slug === 'contact'}
      />
    );
  };
}
