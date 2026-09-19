'use client';

import {
  CalendarCheck,
  CalendarRange,
  ClipboardList,
  FileCheck2,
  Shield,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FOUNDER_CONFIRMED_LEGAL_IDENTITY } from '@mazare3/shared/legal-identity';
import { sanitizeReturnUrl } from '@mazare3/shared/safe-return-url';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

const BENEFIT_KEYS = [
  { icon: Sparkles, key: 'reach' as const },
  { icon: CalendarRange, key: 'availability' as const },
  { icon: CalendarCheck, key: 'bookings' as const },
  { icon: FileCheck2, key: 'listing' as const },
  { icon: Wallet, key: 'settlements' as const },
  { icon: Shield, key: 'privacy' as const },
] as const;

const HOW_KEYS = ['apply', 'complete', 'review', 'list'] as const;

const NEED_KEYS = ['identity', 'partner', 'documents', 'agreement'] as const;

type Props = {
  returnUrl: string;
  mode: 'guest' | 'start';
  onStart?: () => void;
};

/** Unified Auth chooser handoff — never forces email mode. */
function partnerAuthHandoffHref(returnUrl: string): string {
  const safe = sanitizeReturnUrl(returnUrl) ?? '/become-owner';
  return `/auth?returnUrl=${encodeURIComponent(safe)}`;
}

export function PartnerEntryLanding({ returnUrl, mode, onStart }: Props) {
  const t = useTranslations('becomeOwner');
  const authHref = partnerAuthHandoffHref(returnUrl);
  const partnershipPhone = FOUNDER_CONFIRMED_LEGAL_IDENTITY.partnershipContactPhone;
  const opsEmail = FOUNDER_CONFIRMED_LEGAL_IDENTITY.projectOperationalEmail;

  return (
    <div className="space-y-10 sm:space-y-12" data-testid="partner-entry-landing">
      <section
        className="relative overflow-hidden rounded-[24px] border border-[#DCE6F5] bg-gradient-to-br from-[#F4F8FF] via-white to-[#EEF4FF] px-5 py-8 text-start sm:px-10 sm:py-12"
        data-testid="partner-acquisition-hero"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -end-16 -top-20 h-56 w-56 rounded-full bg-[#2F6EF6]/10 blur-2xl"
        />
        <p className="text-sm font-semibold text-primary" data-testid="partner-entry-eyebrow">
          {t('entry.eyebrow')}
        </p>
        <h1 className="mt-2 max-w-2xl font-heading text-[1.85rem] leading-tight text-[#0D2046] sm:text-[2.35rem]">
          {t('entry.headline')}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#53637A] sm:text-base">
          {t('entry.supporting')}
        </p>
        <p className="mt-2 max-w-xl text-[13px] font-medium text-[#0D2046]/85" data-testid="become-owner-entry-bridge">
          {t('entryBridge')}
        </p>

        {(partnershipPhone || opsEmail) && (
          <div
            className="mt-5 max-w-xl rounded-2xl border border-[#DCE6F5] bg-white/80 px-4 py-3 text-sm text-[#53637A]"
            data-testid="partner-partnership-contact"
          >
            <p className="font-semibold text-[#0D2046]">{t('partnershipContact.title')}</p>
            <p className="mt-1">{t('partnershipContact.lead')}</p>
            {partnershipPhone ? (
              <p className="mt-2 font-medium text-[#0D2046]" dir="ltr">
                <a
                  className="hover:underline"
                  href={`tel:${partnershipPhone.replace(/\s+/g, '')}`}
                  data-testid="partner-partnership-phone"
                >
                  {partnershipPhone}
                </a>
              </p>
            ) : null}
            {opsEmail ? (
              <p className="mt-1">
                <a
                  className="text-primary hover:underline"
                  href={`mailto:${opsEmail}`}
                  data-testid="partner-ops-email"
                >
                  {opsEmail}
                </a>
              </p>
            ) : null}
            <p className="mt-2 text-[12px] text-[#7A879B]">{t('partnershipContact.hoursNote')}</p>
          </div>
        )}

        {mode === 'guest' ? (
          <div
            className="mt-6 flex max-w-lg flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center"
            data-testid="partner-acquisition-ctas"
          >
            <Button asChild className="h-12 min-h-12 w-full shadow-soft sm:w-auto sm:min-w-[12rem]">
              <Link href={authHref} data-testid="partner-start-application">
                {t('entry.startCta')}
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 min-h-12 w-full border-[#D8E3F0] bg-white sm:w-auto sm:min-w-[12rem]"
            >
              <Link href={authHref} data-testid="partner-resume-application">
                {t('entry.resumeCta')}
              </Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <Button
              type="button"
              className="h-12 min-h-12 w-full shadow-soft sm:w-auto"
              data-testid="partner-start-application"
              onClick={onStart}
            >
              {t('entry.startCta')}
            </Button>
            <p className="mt-2 text-[12px] text-[#8A96A8]">{t('entry.startHint')}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="partner-benefits-heading" className="space-y-4">
        <div>
          <h2 id="partner-benefits-heading" className="text-xl font-bold text-[#0D2046]">
            {t('entry.benefitsTitle')}
          </h2>
          <p className="mt-1 text-sm text-[#53637A]">{t('entry.benefitsSubtitle')}</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {BENEFIT_KEYS.map(({ icon: Icon, key }) => (
            <li
              key={key}
              className="flex gap-3 rounded-2xl border border-[#E5EAF1] bg-white p-4"
              data-testid={`partner-benefit-${key}`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF4FF] text-primary">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#0D2046]">{t(`entry.benefits.${key}.title`)}</p>
                <p className="mt-0.5 text-[13px] text-[#53637A]">{t(`entry.benefits.${key}.body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="partner-how-heading" className="space-y-4" data-testid="partner-how-it-works">
        <div>
          <h2 id="partner-how-heading" className="text-xl font-bold text-[#0D2046]">
            {t('entry.howTitle')}
          </h2>
          <p className="mt-1 text-sm text-[#53637A]">{t('entry.howSubtitle')}</p>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_KEYS.map((key, index) => (
            <li
              key={key}
              className="rounded-2xl border border-[#E5EAF1] bg-white p-4"
              data-testid={`partner-how-${key}`}
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                {index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-[#0D2046]">{t(`entry.how.${key}`)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section
        aria-labelledby="partner-needs-heading"
        className="rounded-2xl border border-[#E5EAF1] bg-[#F8FBFF] p-5 sm:p-6"
        data-testid="partner-requirements-preview"
      >
        <div className="flex gap-3">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 id="partner-needs-heading" className="text-lg font-bold text-[#0D2046]">
              {t('entry.needsTitle')}
            </h2>
            <p className="mt-1 text-sm text-[#53637A]">{t('entry.needsSubtitle')}</p>
            <ul className="mt-3 space-y-2 text-sm text-[#0D2046]">
              {NEED_KEYS.map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                  <span>{t(`entry.needs.${key}`)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[13px] text-[#53637A]">{t('entry.reviewNote')}</p>
          </div>
        </div>
      </section>
    </div>
  );
}
