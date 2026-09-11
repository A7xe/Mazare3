'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CalendarDays,
  CreditCard,
  FileText,
  Lightbulb,
  MessageCircle,
  Shield,
  Users,
  XCircle,
} from 'lucide-react';
import type { Locale } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { LEGAL_PAGE_SLUGS, type LegalDocument, type LegalPageSlug } from '@/lib/legal/types';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { cn } from '@/lib/utils';

const PATHS: Record<LegalPageSlug, string> = {
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  'cancellation-refund': '/cancellation-refund',
  'booking-payment': '/booking-payment',
};

const POLICY_TABS: {
  slug: LegalPageSlug;
  icon: typeof FileText;
  wrap: string;
  iconClass: string;
  descKey: 'tabTermsDesc' | 'tabPrivacyDesc' | 'tabCancelDesc' | 'tabBookingDesc';
}[] = [
  {
    slug: 'terms',
    icon: FileText,
    wrap: 'bg-[#EAF2FF]',
    iconClass: 'text-[#2F6EF6]',
    descKey: 'tabTermsDesc',
  },
  {
    slug: 'privacy',
    icon: Shield,
    wrap: 'bg-[#E8F8EF]',
    iconClass: 'text-[#16A34A]',
    descKey: 'tabPrivacyDesc',
  },
  {
    slug: 'cancellation-refund',
    icon: XCircle,
    wrap: 'bg-[#FEE8EC]',
    iconClass: 'text-[#E11D48]',
    descKey: 'tabCancelDesc',
  },
  {
    slug: 'booking-payment',
    icon: Users,
    wrap: 'bg-[#EAF2FF]',
    iconClass: 'text-[#2F6EF6]',
    descKey: 'tabBookingDesc',
  },
];

function sectionIcon(index: number) {
  const icons = [FileText, Users, CreditCard, Shield, CalendarDays] as const;
  return icons[index % icons.length] ?? FileText;
}

export function LegalDocumentView({
  doc,
  locale,
  updatedOn,
  children,
}: {
  doc: LegalDocument;
  locale: Locale;
  updatedOn: string;
  identity?: unknown;
  showContactBlock?: boolean;
  children?: React.ReactNode;
}) {
  const t = useTranslations('legal');
  const currentLocale = useLocale();
  const [activeSection, setActiveSection] = useState(doc.sections[0]?.id ?? '');

  const dateLabel = useMemo(
    () =>
      new Date(`${updatedOn}T12:00:00`).toLocaleDateString(locale === 'ar' ? 'ar-JO' : 'en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
    [locale, updatedOn],
  );

  const showPolicyTabs = POLICY_TABS.some((tab) => tab.slug === doc.slug) || doc.slug === 'about';
  const showToc = doc.sections.length > 3;

  return (
    <MarketplacePageShell className="py-8 sm:py-10" data-testid={`legal-page-${doc.slug}`}>
      <div className="px-4 sm:px-5 lg:px-6 pb-10" dir={currentLocale === 'en' ? 'ltr' : 'rtl'}>
        <header className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#F1E9FF]">
                <FileText className="h-5 w-5 text-[#7C3AED]" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]">
                  {t('policiesHubTitle')}
                </p>
                <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#7A879B]">
                  {t('policiesHubSubtitle')}
                </p>
              </div>
            </div>
            <Link
              href="/"
              className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
              aria-label={t('backHome')}
              data-testid="legal-back"
            >
              <ArrowLeft className={cn('h-5 w-5', currentLocale === 'en' && 'rotate-180')} aria-hidden />
            </Link>
          </div>
        </header>

        {showPolicyTabs ? (
          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {POLICY_TABS.map((tab) => {
              const Icon = tab.icon;
              const active = doc.slug === tab.slug;
              return (
                <Link
                  key={tab.slug}
                  href={PATHS[tab.slug]}
                  data-testid={`legal-tab-${tab.slug}`}
                  className={cn(
                    'rounded-2xl border bg-white p-4 transition',
                    active
                      ? 'border-[#2F6EF6] bg-[#F3F8FF] shadow-[0_4px_16px_rgba(47,110,246,.12)]'
                      : 'border-[#E4EAF3] hover:border-[#2F6EF6]/30',
                  )}
                >
                  <span
                    className={cn(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-full',
                      tab.wrap,
                      tab.iconClass,
                    )}
                  >
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <p className="text-[14px] font-bold text-[#0D2046]">{t(`nav.${tab.slug}`)}</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7A879B]">{t(tab.descKey)}</p>
                </Link>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
          <div className="min-w-0 space-y-4">
            <article className="rounded-2xl border border-[#E4EAF3] bg-white p-5 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-xl font-bold text-[#0D2046] sm:text-2xl">{doc.title}</h1>
                  <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[#7A879B]">{doc.intro}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-xl bg-[#F5F8FC] px-3 py-2 text-[12px] font-medium text-[#7A879B]">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                  {t('lastUpdated')} {dateLabel}
                </span>
              </div>

              {children}

              <div className="space-y-0 divide-y divide-[#EEF2F7]">
                {doc.sections.map((section, index) => {
                  const Icon = sectionIcon(index);
                  return (
                    <section
                      key={section.id}
                      id={section.id}
                      className="scroll-mt-24 py-5 first:pt-0 last:pb-0"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[13px] font-bold text-[#2F6EF6]">
                          {index + 1}
                        </span>
                        <Icon className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                        <h2 className="text-[15px] font-bold text-[#0D2046] sm:text-base">
                          {section.title}
                        </h2>
                      </div>
                      {section.paragraphs.map((p, i) => (
                        <p
                          key={`${section.id}-p-${i}`}
                          className="mt-2 text-[13px] leading-7 text-[#53637A] sm:text-[14px]"
                        >
                          {p}
                        </p>
                      ))}
                      {section.bullets && section.bullets.length > 0 ? (
                        <ul className="mt-3 space-y-2">
                          {section.bullets.map((item, i) => (
                            <li
                              key={`${section.id}-b-${i}`}
                              className="flex gap-2 text-[13px] leading-7 text-[#53637A] sm:text-[14px]"
                            >
                              <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2F6EF6]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </article>

            <nav
              className="rounded-xl border border-[#E4EAF3] bg-white p-4"
              aria-label={t('otherPolicies')}
              data-testid="legal-related-nav"
            >
              <p className="text-sm font-semibold text-[#0D2046]">{t('otherPolicies')}</p>
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                {LEGAL_PAGE_SLUGS.filter((slug) => slug !== doc.slug).map((slug) => (
                  <li key={slug}>
                    <Link href={PATHS[slug]} className="text-sm text-[#2F6EF6] hover:underline">
                      {t(`nav.${slug}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-2xl border border-[#E4EAF3] bg-white shadow-[0_8px_24px_-16px_rgba(13,32,70,.35)]">
              <div className="relative aspect-[4/3]">
                <img
                  src="/account/discover-destinations.jpg"
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0A2458]/90 to-transparent px-4 pb-4 pt-10">
                  <div className="flex items-center gap-2 text-white">
                    <Shield className="h-4 w-4 shrink-0" aria-hidden />
                    <div>
                      <p className="text-[13px] font-bold">{t('trustTitle')}</p>
                      <p className="text-[11px] text-white/80">{t('trustSubtitle')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {showToc ? (
              <nav
                className="rounded-2xl border border-[#E4EAF3] bg-white p-4 shadow-[0_2px_12px_rgba(35,72,120,.04)]"
                aria-label={t('onThisPage')}
                data-testid="legal-toc"
              >
                <p className="text-sm font-bold text-[#0D2046]">{t('onThisPage')}</p>
                <ul className="mt-3 space-y-1">
                  {doc.sections.map((section) => {
                    const active = activeSection === section.id;
                    return (
                      <li key={section.id}>
                        <a
                          href={`#${section.id}`}
                          onClick={() => setActiveSection(section.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] transition',
                            active
                              ? 'bg-[#EAF2FF] font-semibold text-[#2F6EF6]'
                              : 'text-[#53637A] hover:bg-[#F5F8FC]',
                          )}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 shrink-0 rounded-full',
                              active ? 'bg-[#2F6EF6]' : 'bg-[#D5DCE8]',
                            )}
                          />
                          {section.title}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            ) : null}

            <div className="rounded-2xl border border-[#E4EAF3] bg-[#F3F8FF] p-5">
              <div className="flex items-start gap-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#2F6EF6]">
                  <Lightbulb className="h-4 w-4" aria-hidden />
                </span>
                <p className="text-[13px] leading-relaxed text-[#0D2046]">{t('supportNudge')}</p>
              </div>
              <Link
                href="/contact"
                className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgba(47,110,246,.9)] transition hover:bg-[#255FE0]"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                {t('supportCta')}
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </MarketplacePageShell>
  );
}
