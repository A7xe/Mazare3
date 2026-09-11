'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  ArrowLeft,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  CircleHelp,
  CreditCard,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getHelpCenterFaqItems } from '@/lib/help-center-faq';
import { cn } from '@/lib/utils';
import { MySupportTicketsPanel } from '@/components/account/my-support-tickets-panel';

type HelpCenterViewProps = {
  supportEmail?: string | null;
  supportPhone?: string | null;
};

type TopicId = 'bookings' | 'payments' | 'refunds' | 'account';

const TOPICS: {
  id: TopicId;
  href: string;
  icon: typeof CalendarDays;
  iconClass: string;
  wrapClass: string;
}[] = [
  {
    id: 'bookings',
    href: '/account/bookings',
    icon: CalendarDays,
    iconClass: 'text-[#2F6EF6]',
    wrapClass: 'bg-[#EAF2FF]',
  },
  {
    id: 'payments',
    href: '/account/payment-methods',
    icon: CreditCard,
    iconClass: 'text-[#16A34A]',
    wrapClass: 'bg-[#E8F8EF]',
  },
  {
    id: 'refunds',
    href: '/cancellation-refund',
    icon: RotateCcw,
    iconClass: 'text-[#E11D48]',
    wrapClass: 'bg-[#FEE8EC]',
  },
  {
    id: 'account',
    href: '/account',
    icon: Users,
    iconClass: 'text-[#7C3AED]',
    wrapClass: 'bg-[#F1E9FF]',
  },
];

export function HelpCenterView({
  supportEmail = null,
  supportPhone = null,
}: HelpCenterViewProps) {
  const t = useTranslations('helpCenter');
  const locale = useLocale();
  const faqItems = useMemo(() => getHelpCenterFaqItems(locale), [locale]);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(faqItems[0]?.id ?? null);
  const [showAllFaq, setShowAllFaq] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredFaq = useMemo(() => {
    if (!normalizedQuery) return faqItems;
    return faqItems.filter((item) => {
      const haystack = `${item.question} ${item.answer} ${item.keywords.join(' ')}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [faqItems, normalizedQuery]);

  const visibleFaq = filteredFaq;

  const filteredTopics = useMemo(() => {
    if (!normalizedQuery) return TOPICS;
    return TOPICS.filter((topic) => {
      const label = `${t(`topics.${topic.id}.title`)} ${t(`topics.${topic.id}.desc`)}`.toLowerCase();
      return label.includes(normalizedQuery);
    });
  }, [normalizedQuery, t]);

  return (
    <div data-testid="help-center" className="pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start lg:gap-6">
        <div className="min-w-0 space-y-4">
          <header>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF]">
                  <Headphones className="h-5 w-5 text-[#2F6EF6]" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight text-[#0D2046] sm:text-[28px]">
                    {t('title')}
                  </h1>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#7A879B] sm:text-[15px]">
                    {t('subtitle')}
                  </p>
                </div>
              </div>
              <Link
                href="/account"
                className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
                aria-label={t('backToAccount')}
                data-testid="help-center-back"
              >
                <ArrowLeft className={cn('h-5 w-5', locale === 'en' && 'rotate-180')} aria-hidden />
              </Link>
            </div>
          </header>

          <section
            aria-label={t('searchLabel')}
            className="rounded-2xl border border-[#DDE3F0] bg-white p-4 shadow-[0_2px_14px_rgba(35,72,120,.04)] sm:p-5"
            data-testid="help-center-search-panel"
          >
            <label className="relative block">
              <span className="pointer-events-none absolute inset-y-0 inset-s-4 flex items-center text-[#9AA3C7]">
                <Search className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchLabel')}
                data-testid="help-center-search"
                className="h-12 w-full rounded-full border border-[#C5C8E0] bg-white pe-5 ps-11 text-sm text-[#0D2046] outline-none transition placeholder:text-[#9AA6B8] focus:border-[#9AA3C7] focus:ring-2 focus:ring-[#C5C8E0]/45"
              />
            </label>
            <p className="mt-3 text-[12px] leading-relaxed text-[#9AA3C7]">{t('searchHint')}</p>
          </section>

          {filteredTopics.length > 0 ? (
            <section data-testid="help-center-topics">
              <h3 className="mb-3 text-base font-bold text-[#0D2046] sm:text-lg">{t('topicsTitle')}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
                {filteredTopics.map((topic) => {
                  const Icon = topic.icon;
                  return (
                    <Link
                      key={topic.id}
                      href={topic.href}
                      data-testid={`help-center-topic-${topic.id}`}
                      className="group relative flex min-h-[168px] flex-col items-center rounded-2xl border border-[#E4EAF3] bg-white px-4 pb-10 pt-5 text-center shadow-[0_2px_12px_rgba(35,72,120,.04)] transition hover:border-[#2F6EF6]/22 hover:shadow-[0_8px_22px_rgba(35,72,120,.08)]"
                    >
                      <span
                        className={cn(
                          'mb-3 flex h-12 w-12 items-center justify-center rounded-full',
                          topic.wrapClass,
                        )}
                      >
                        <Icon className={cn('h-5 w-5', topic.iconClass)} aria-hidden />
                      </span>
                      <span className="text-[14px] font-bold text-[#0D2046]">
                        {t(`topics.${topic.id}.title`)}
                      </span>
                      <span className="mt-1.5 text-[12px] leading-relaxed text-[#7A879B]">
                        {t(`topics.${topic.id}.desc`)}
                      </span>
                      <span
                        className="absolute bottom-3 end-3 flex h-7 w-7 items-center justify-center text-[#2F6EF6] transition group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px]"
                        aria-hidden
                      >
                        <ChevronLeft
                          className={cn('h-4 w-4', locale === 'en' && 'rotate-180')}
                          strokeWidth={2.25}
                        />
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section
            data-testid="help-center-faq"
            className="rounded-xl border border-[#E2E8F2] bg-[#F5F8FC] p-4 sm:p-5"
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white">
                    <CircleHelp className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                  </span>
                  <h3 className="text-base font-bold text-[#0D2046] sm:text-lg">{t('faqTitle')}</h3>
                </div>
                <p className="mt-1.5 text-[13px] text-[#7A879B]">{t('faqSubtitle')}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAllFaq((v) => {
                    const next = !v;
                    if (next) setOpenId(null);
                    return next;
                  });
                }}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#EAF2FF] px-3.5 text-[12.5px] font-semibold text-[#2F6EF6] transition hover:bg-[#DCE9FF]"
                data-testid="help-center-faq-toggle"
              >
                {showAllFaq ? t('faqShowLess') : t('faqExpandAll')}
                <ChevronLeft
                  className={cn('h-3.5 w-3.5', locale === 'en' && 'rotate-180', showAllFaq && 'rotate-90')}
                  aria-hidden
                />
              </button>
            </div>

            {visibleFaq.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[#D5DCE8] bg-white px-4 py-8 text-center text-sm text-[#7A879B]">
                {t('searchEmpty')}
              </p>
            ) : (
              <div className="space-y-2">
                {visibleFaq.map((item) => {
                  const open = showAllFaq || openId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="overflow-hidden rounded-lg border border-[#E4EAF3] bg-white"
                      data-testid={`help-center-faq-${item.id}`}
                    >
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => {
                          if (showAllFaq) {
                            setShowAllFaq(false);
                            setOpenId(item.id);
                            return;
                          }
                          setOpenId(open ? null : item.id);
                        }}
                        className="flex w-full items-start gap-3 px-3.5 py-3 text-start sm:px-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold leading-snug text-[#0D2046] sm:text-[14px]">
                            {item.question}
                          </span>
                          {open ? (
                            <span className="mt-1.5 block text-[12.5px] font-medium leading-7 text-[#7A879B] sm:text-[13px]">
                              {item.answer}
                            </span>
                          ) : null}
                        </span>
                        <ChevronDown
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-[#8A96A8] transition-transform duration-200',
                            open && 'rotate-180',
                          )}
                          aria-hidden
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <MySupportTicketsPanel />
        </div>

        <aside className="lg:sticky lg:top-24" data-testid="help-center-sidebar">
          <div className="rounded-3xl border border-[#EEF1F6] bg-white p-5 shadow-[0_10px_32px_rgba(35,72,120,.08)] sm:p-6">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF2FF]">
              <Headphones className="h-7 w-7 text-[#2F6EF6]" strokeWidth={1.75} aria-hidden />
            </span>
            <h3 className="mt-4 text-center text-[15px] font-bold text-[#0D2046] sm:text-base">
              {t('sidebarTitle')}
            </h3>
            <p className="mt-2 text-center text-[12.5px] leading-relaxed text-[#7A879B] sm:text-[13px]">
              {t('sidebarBody')}
            </p>
            <Link
              href="/contact"
              data-testid="help-center-contact"
              className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#2F6EF6] text-sm font-semibold text-white shadow-[0_10px_22px_rgba(47,110,246,.32)] transition hover:bg-[#255FE0]"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {t('contactCta')}
            </Link>

            <div className="mt-5 rounded-2xl border border-[#E8EEF6] p-3.5 sm:p-4">
              <ul className="space-y-4">
                <li>
                  <Link href="/contact" className="flex gap-3 rounded-xl transition hover:bg-[#F7F9FC]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#2F6EF6]">
                      <MessageCircle className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 py-0.5">
                      <p className="text-sm font-bold text-[#0D2046]">{t('liveChatTitle')}</p>
                      <p className="text-[12px] leading-relaxed text-[#7A879B]">{t('liveChatHint')}</p>
                    </div>
                  </Link>
                </li>

                {supportPhone ? (
                  <li className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#2F6EF6]">
                      <Phone className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 py-0.5">
                      <a
                        href={`tel:${supportPhone.replace(/\s+/g, '')}`}
                        className="text-sm font-bold text-[#0D2046] hover:underline"
                        dir="ltr"
                      >
                        {supportPhone}
                      </a>
                      <p className="text-[12px] leading-relaxed text-[#7A879B]">{t('phoneHint')}</p>
                    </div>
                  </li>
                ) : null}

                {supportEmail ? (
                  <li className="flex gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#2F6EF6]">
                      <Mail className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="min-w-0 py-0.5">
                      <a
                        href={`mailto:${supportEmail}`}
                        className="break-all text-sm font-bold text-[#0D2046] hover:underline"
                        dir="ltr"
                      >
                        {supportEmail}
                      </a>
                      <p className="text-[12px] leading-relaxed text-[#7A879B]">{t('emailHint')}</p>
                    </div>
                  </li>
                ) : (
                  <li>
                    <Link href="/contact" className="flex gap-3 rounded-xl transition hover:bg-[#F7F9FC]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#2F6EF6]">
                        <Mail className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 py-0.5">
                        <p className="text-sm font-bold text-[#0D2046]">{t('liveChatAction')}</p>
                        <p className="text-[12px] leading-relaxed text-[#7A879B]">{t('emailHint')}</p>
                      </div>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
