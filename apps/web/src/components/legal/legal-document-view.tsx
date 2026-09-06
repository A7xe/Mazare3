import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import type { Locale } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { LEGAL_PAGE_SLUGS, type LegalDocument, type LegalPageSlug } from '@/lib/legal/types';
import { ContactIdentity } from '@/components/legal/contact-identity';
import type { SiteIdentity } from '@/lib/legal/site-identity';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

const PATHS: Record<LegalPageSlug, string> = {
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  'cancellation-refund': '/cancellation-refund',
  'booking-payment': '/booking-payment',
};

export async function LegalDocumentView({
  doc,
  locale,
  updatedOn,
  identity,
  showContactBlock = false,
  children,
}: {
  doc: LegalDocument;
  locale: Locale;
  updatedOn: string;
  identity?: SiteIdentity;
  showContactBlock?: boolean;
  children?: ReactNode;
}) {
  const t = await getTranslations('legal');
  const dateLabel = new Date(`${updatedOn}T12:00:00`).toLocaleDateString(
    locale === 'ar' ? 'ar-JO' : 'en-GB',
    { year: 'numeric', month: 'long', day: 'numeric' },
  );

  return (
    <MarketplacePageShell className="py-10 sm:py-14" data-testid={`legal-page-${doc.slug}`}>
      <div className="mx-auto w-full max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">{t('productPolicies')}</p>
      <h1 className="mt-2 text-3xl font-heading text-navy sm:text-4xl">{doc.title}</h1>
      <p className="mt-2 text-sm text-muted">
        {t('lastUpdated')}: {dateLabel}
      </p>
      <p className="mt-6 text-base leading-relaxed text-navy/90">{doc.intro}</p>

      {doc.sections.length > 3 ? (
        <nav
          className="mt-8 rounded-2xl border border-primary/15 bg-primary-soft/40 p-4"
          aria-label={t('onThisPage')}
          data-testid="legal-toc"
        >
          <p className="text-sm font-semibold text-navy">{t('onThisPage')}</p>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {doc.sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-sm text-primary hover:underline"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {showContactBlock && identity ? (
        <ContactIdentity locale={locale} identity={identity} />
      ) : null}

      {children}

      <div className="mt-10 space-y-10">
        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-xl font-semibold text-navy">{section.title}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={`${section.id}-p-${i}`} className="mt-3 text-sm leading-relaxed text-muted sm:text-[15px]">
                {p}
              </p>
            ))}
            {section.bullets && section.bullets.length > 0 ? (
              <ul className="mt-3 list-disc space-y-2 ps-5 text-sm leading-relaxed text-muted sm:text-[15px]">
                {section.bullets.map((item, i) => (
                  <li key={`${section.id}-b-${i}`}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>

      <nav
        className="mt-12 border-t border-border pt-6"
        aria-label={t('otherPolicies')}
        data-testid="legal-related-nav"
      >
        <p className="text-sm font-semibold text-navy">{t('otherPolicies')}</p>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {LEGAL_PAGE_SLUGS.filter((slug) => slug !== doc.slug).map((slug) => (
            <li key={slug}>
              <Link href={PATHS[slug]} className="font-medium text-primary hover:underline">
                {t(`nav.${slug}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      </div>
    </MarketplacePageShell>
  );
}
