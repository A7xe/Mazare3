import { getTranslations } from 'next-intl/server';
import type { Locale } from '@mazare3/shared';
import {
  ArrowLeft,
  Clock,
  Headphones,
  Mail,
  MessageCircle,
  Phone,
  Timer,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { ContactSupportForm } from '@/components/legal/contact-support-form';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import type { SiteIdentity } from '@/lib/legal/site-identity';
import { LEGAL_PAGE_SLUGS, type LegalPageSlug } from '@/lib/legal/types';
import { cn } from '@/lib/utils';

const PATHS: Record<LegalPageSlug, string> = {
  about: '/about',
  contact: '/contact',
  terms: '/terms',
  privacy: '/privacy',
  'cancellation-refund': '/cancellation-refund',
  'booking-payment': '/booking-payment',
  verification: '/verification',
  'cookie-policy': '/cookie-policy',
  'community-reviews': '/community-reviews',
};

type ContactPageViewProps = {
  locale: Locale;
  title: string;
  identity: SiteIdentity;
};

export async function ContactPageView({ locale, title, identity }: ContactPageViewProps) {
  const t = await getTranslations('contactPage');
  const tLegal = await getTranslations('legal');
  const hasPublishedContact = Boolean(
    identity.legalContactEmail ||
      identity.projectOperationalEmail ||
      identity.supportEmail ||
      identity.supportPhone,
  );

  function toWhatsAppDigits(phone: string): string | null {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('962')) return digits;
    if (digits.startsWith('0') && digits.length >= 9) return `962${digits.slice(1)}`;
    if (digits.length === 9 && digits.startsWith('7')) return `962${digits}`;
    return digits;
  }

  const whatsappDigits = identity.supportPhone ? toWhatsAppDigits(identity.supportPhone) : null;
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  const channels: {
    id: string;
    title: string;
    hint: string;
    href: string;
    external?: boolean;
    icon: typeof MessageCircle;
    iconWrap: string;
    iconClass: string;
    show: boolean;
  }[] = [
    {
      id: 'chat',
      title: t('channels.chatTitle'),
      hint: t('channels.chatHint'),
      href: '#contact-form',
      icon: MessageCircle,
      iconWrap: 'bg-[#EAF2FF]',
      iconClass: 'text-[#2F6EF6]',
      show: true,
    },
    {
      id: 'whatsapp',
      title: t('channels.whatsappTitle'),
      hint: t('channels.whatsappHint'),
      href: whatsappHref ?? '#contact-form',
      external: Boolean(whatsappHref),
      icon: MessageCircle,
      iconWrap: 'bg-[#E8F8EF]',
      iconClass: 'text-[#16A34A]',
      show: Boolean(whatsappHref),
    },
    {
      id: 'email',
      title: t('channels.emailTitle'),
      hint:
        identity.legalContactEmail ??
        identity.projectOperationalEmail ??
        identity.supportEmail ??
        t('channels.emailHintFallback'),
      href:
        identity.legalContactEmail || identity.projectOperationalEmail || identity.supportEmail
          ? `mailto:${identity.legalContactEmail ?? identity.projectOperationalEmail ?? identity.supportEmail}`
          : '#contact-form',
      external: Boolean(
        identity.legalContactEmail || identity.projectOperationalEmail || identity.supportEmail,
      ),
      icon: Mail,
      iconWrap: 'bg-[#F1E9FF]',
      iconClass: 'text-[#7C3AED]',
      show: true,
    },
    {
      id: 'phone',
      title: t('channels.phoneTitle'),
      hint: identity.supportPhone ?? t('channels.phoneHintFallback'),
      href: identity.supportPhone
        ? `tel:${identity.supportPhone.replace(/\s+/g, '')}`
        : '#contact-form',
      external: false,
      icon: Phone,
      iconWrap: 'bg-[#FFF1EC]',
      iconClass: 'text-[#F06A4D]',
      // Partnership phone must never appear as customer support phone.
      show: Boolean(identity.supportPhone),
    },
  ];

  return (
    <MarketplacePageShell className="py-8 sm:py-10" data-testid="legal-page-contact">
      <div className="px-4 sm:px-5 lg:px-6 pb-10" dir={locale === 'en' ? 'ltr' : 'rtl'}>
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
                      {title}
                    </h1>
                    <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#7A879B]">
                      {t('subtitle')}
                    </p>
                  </div>
                </div>
                <Link
                  href="/account/support"
                  className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#F06A4D] transition hover:bg-[#FFF1EC]"
                  aria-label={t('back')}
                  data-testid="contact-page-back"
                >
                  <ArrowLeft className={cn('h-5 w-5', locale === 'en' && 'rotate-180')} aria-hidden />
                </Link>
              </div>
            </header>

            <div id="contact-form" className="scroll-mt-24">
              <ContactSupportForm />
            </div>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <section className="rounded-2xl border border-[#E4EAF3] bg-white p-4 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-5">
              <h2 className="text-[15px] font-bold text-[#0D2046]">{t('channelsTitle')}</h2>
              <p className="mt-1 text-[12.5px] text-[#7A879B]">{t('channelsSubtitle')}</p>
              <ul className="mt-4 space-y-2.5">
                {channels
                  .filter((c) => c.show)
                  .map((channel) => {
                    const Icon = channel.icon;
                    const className =
                      'flex items-center gap-3 rounded-xl border border-[#E4EAF3] bg-white px-3 py-3 transition hover:border-[#2F6EF6]/25';
                    const body = (
                      <>
                        <span
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
                            channel.iconWrap,
                            channel.iconClass,
                          )}
                        >
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 text-start">
                          <span className="block text-sm font-bold text-[#0D2046]">{channel.title}</span>
                          <span className="block text-[12px] text-[#7A879B]" dir={channel.id === 'phone' && identity.supportPhone ? 'ltr' : undefined}>
                            {channel.hint}
                          </span>
                        </span>
                        <ArrowLeft
                          className={cn('h-4 w-4 shrink-0 text-[#9AA6B8]', locale === 'en' && 'rotate-180')}
                          aria-hidden
                        />
                      </>
                    );

                    if (channel.href.startsWith('#')) {
                      return (
                        <li key={channel.id}>
                          <a href={channel.href} className={className} data-testid={`contact-channel-${channel.id}`}>
                            {body}
                          </a>
                        </li>
                      );
                    }

                    if (channel.external || channel.href.startsWith('mailto:') || channel.href.startsWith('tel:')) {
                      return (
                        <li key={channel.id}>
                          <a
                            href={channel.href}
                            className={className}
                            data-testid={`contact-channel-${channel.id}`}
                            {...(channel.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          >
                            {body}
                          </a>
                        </li>
                      );
                    }

                    return (
                      <li key={channel.id}>
                        <Link href={channel.href} className={className} data-testid={`contact-channel-${channel.id}`}>
                          {body}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="rounded-2xl border border-[#E4EAF3] bg-white p-4 shadow-[0_2px_12px_rgba(35,72,120,.04)] sm:p-5">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
                <h2 className="text-[15px] font-bold text-[#0D2046]">{t('hoursTitle')}</h2>
              </div>
              <ul className="mt-4 space-y-3">
                <li className="flex gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF2FF] text-[#2F6EF6]">
                    <Timer className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-[#0D2046]">{t('responseTitle')}</p>
                    <p className="text-[12.5px] text-[#7A879B]">{t('responseBody')}</p>
                  </div>
                </li>
              </ul>
            </section>

            {!hasPublishedContact ? (
              <p
                className="rounded-xl border border-dashed border-[#D5DCE8] bg-white px-3 py-3 text-[12.5px] leading-relaxed text-[#7A879B]"
                data-testid="contact-identity-unpublished"
              >
                {tLegal('identityUnpublished')}
              </p>
            ) : (
              <div className="sr-only" data-testid="contact-identity">
                {identity.supportEmail}
                {identity.supportPhone}
              </div>
            )}
          </aside>
        </div>

        <nav
          className="mt-8 rounded-xl border border-[#E4EAF3] bg-[#F5F8FC] p-4"
          aria-label={tLegal('otherPolicies')}
          data-testid="legal-related-nav"
        >
          <p className="text-sm font-semibold text-[#0D2046]">{tLegal('otherPolicies')}</p>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {LEGAL_PAGE_SLUGS.filter((slug) => slug !== 'contact').map((slug) => (
              <li key={slug}>
                <Link href={PATHS[slug]} className="text-sm text-[#2F6EF6] hover:underline">
                  {tLegal(`nav.${slug}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </MarketplacePageShell>
  );
}
