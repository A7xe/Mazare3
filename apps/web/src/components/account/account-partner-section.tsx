'use client';

import { Building2, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import {
  ADD_FARM_PARTNER_HREF,
  ADD_FARM_WIZARD_HREF,
  OWNER_PROPERTIES_HREF,
  type AccountPartnerSurfaceKind,
} from '@/lib/add-farm-entry';

type Props = {
  surface: AccountPartnerSurfaceKind | null;
  loading?: boolean;
};

function statusBadgeClass(surface: AccountPartnerSurfaceKind): string {
  switch (surface) {
    case 'draft':
      return 'bg-[#EEF1F6] text-[#53637A] ring-1 ring-[#D5DCE8]';
    case 'submitted':
    case 'under_review':
      return 'bg-primary-soft text-primary ring-1 ring-primary/20';
    case 'changes_requested':
      return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200';
    case 'rejected':
    case 'suspended':
      return 'bg-danger/10 text-danger ring-1 ring-danger/20';
    case 'approved':
      return 'bg-[#DCFCE7] text-[#15803D] ring-1 ring-[#BBF7D0]';
    default:
      return 'bg-[#EEF1F6] text-[#53637A] ring-1 ring-[#D5DCE8]';
  }
}

export function AccountPartnerSection({ surface, loading }: Props) {
  const t = useTranslations('accountHome.partnership');
  const locale = useLocale();
  const Chevron = locale === 'ar' ? ChevronLeft : ChevronRight;

  if (surface === null && !loading) return null;

  if (loading || !surface) {
    return (
      <section
        className="mt-6 rounded-2xl border border-border bg-surface p-4 shadow-card sm:p-5"
        data-testid="account-partner-section"
        aria-busy="true"
      >
        <div className="flex items-center gap-3 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          {t('loading')}
        </div>
      </section>
    );
  }

  if (surface === 'approved') {
    return (
      <section
        className="mt-6 space-y-3"
        data-testid="account-partner-section"
        data-partner-surface="approved"
        aria-labelledby="account-partner-heading"
      >
        <h2 id="account-partner-heading" className="text-base font-semibold text-navy">
          {t('sectionTitleApproved')}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <Link
              href={OWNER_PROPERTIES_HREF}
              data-testid="account-partner-my-properties"
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-navy shadow-card transition-colors hover:border-primary/30"
            >
              <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 text-start">
                <span className="block text-sm font-semibold">{t('approved.title')}</span>
                <span className="mt-0.5 block text-[13px] font-normal text-muted">
                  {t('approved.supporting')}
                </span>
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
          <li>
            <Link
              href={ADD_FARM_WIZARD_HREF}
              data-testid="account-partner-add-property"
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-navy shadow-card transition-colors hover:border-primary/30"
            >
              <Plus className="h-5 w-5 shrink-0 text-primary" aria-hidden />
              <span className="min-w-0 flex-1 text-start text-sm font-semibold">
                {t('approved.addCta')}
              </span>
              <Chevron className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </Link>
          </li>
        </ul>
      </section>
    );
  }

  const showStatus = surface !== 'join';
  const title =
    surface === 'join' ? t('join.title') : t('applicationTitle');
  const supporting = t(`${surface}.supporting`);
  const cta = t(`${surface}.cta`);
  const statusLabel = showStatus ? t(`${surface}.status`) : null;

  return (
    <section
      className="mt-6 space-y-3"
      data-testid="account-partner-section"
      data-partner-surface={surface}
      aria-labelledby="account-partner-heading"
    >
      <h2 id="account-partner-heading" className="text-base font-semibold text-navy">
        {t('sectionTitle')}
      </h2>
      <Link
        href={ADD_FARM_PARTNER_HREF}
        data-testid="account-partner-card"
        data-partner-cta={surface}
        className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-4 text-navy shadow-card transition-colors hover:border-primary/30"
      >
        <Building2 className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 text-start">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{title}</span>
            {statusLabel ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
                  statusBadgeClass(surface),
                )}
                data-testid="account-partner-status"
              >
                {statusLabel}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block text-[13px] font-normal leading-relaxed text-muted">
            {supporting}
          </span>
          <span className="mt-2 block text-[13px] font-semibold text-primary">{cta}</span>
        </span>
        <Chevron className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      </Link>
    </section>
  );
}
