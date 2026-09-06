'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Clock, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import type { PartnerOnboardingView, PartnerVerificationStatus } from '@/lib/api-partner';

type Props = {
  onboarding: PartnerOnboardingView;
  onContinueCorrection?: () => void;
};

function StatusIcon({ status }: { status: PartnerVerificationStatus }) {
  if (status === 'submitted') return <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden />;
  if (status === 'under_review') return <Clock className="h-12 w-12 text-primary" aria-hidden />;
  if (status === 'changes_requested') {
    return <AlertTriangle className="h-12 w-12 text-amber-600" aria-hidden />;
  }
  if (status === 'rejected') return <ShieldAlert className="h-12 w-12 text-danger" aria-hidden />;
  if (status === 'suspended') return <Ban className="h-12 w-12 text-danger" aria-hidden />;
  return <CheckCircle2 className="h-12 w-12 text-primary" aria-hidden />;
}

function trackingStatusLabel(
  status: PartnerVerificationStatus,
  t: (key: string) => string,
) {
  // Submitted uses applicant-facing "Awaiting review"; other statuses use canonical labels.
  if (status === 'submitted') return t('statusUx.awaitingReview');
  return t(`verification.${status}`);
}

export function PartnerStatusPanel({ onboarding, onContinueCorrection }: Props) {
  const t = useTranslations('becomeOwner');
  const locale = useLocale();
  const status = onboarding.verificationStatus;
  const showTrackingCard =
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'changes_requested' ||
    status === 'rejected' ||
    status === 'suspended';

  const titleKey =
    status === 'submitted'
      ? 'statusUx.submittedTitle'
      : status === 'under_review'
        ? 'statusUx.underReviewTitle'
        : status === 'changes_requested'
          ? 'statusUx.changesTitle'
          : status === 'rejected'
            ? 'statusUx.rejectedTitle'
            : status === 'suspended'
              ? 'statusUx.suspendedTitle'
              : status === 'approved' || status === 'legacy_approved'
                ? 'approvedTitle'
                : 'statusUx.genericTitle';

  const bodyKey =
    status === 'submitted'
      ? 'statusUx.submittedBody'
      : status === 'under_review'
        ? 'statusUx.underReviewBody'
        : status === 'changes_requested'
          ? 'statusUx.changesBody'
          : status === 'rejected'
            ? 'statusUx.rejectedBody'
            : status === 'suspended'
              ? 'statusUx.suspendedBody'
              : status === 'approved' || status === 'legacy_approved'
                ? 'approvedDesc'
                : 'statusUx.genericBody';

  const submittedAtLabel =
    status === 'submitted' && onboarding.submittedAt
      ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(onboarding.submittedAt))
      : null;

  return (
    <section
      className="rounded-[24px] border border-[#E5EAF1] bg-white px-5 py-10 text-center shadow-[0_8px_28px_rgba(13,32,70,.05)] sm:px-10"
      data-testid="owner-application-status"
      data-partner-status={status}
    >
      <div className="mx-auto flex justify-center">
        <StatusIcon status={status} />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-[#0D2046]">{t(titleKey)}</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-[#53637A]">{t(bodyKey)}</p>

      {showTrackingCard ? (
        <div
          className="mx-auto mt-6 max-w-md rounded-2xl border border-[#DCE6F5] bg-[#F8FBFF] px-4 py-4 text-start"
          data-testid="partner-application-status-card"
        >
          <p className="text-[13px] font-bold text-[#0D2046]">{t('statusUx.applicationCardTitle')}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-[12px] text-[#53637A]">{t('statusLabel')}</span>
            <span
              className="text-[13px] font-semibold text-[#0D2046]"
              data-testid="partner-status-chip"
            >
              {trackingStatusLabel(status, t)}
            </span>
          </div>
          {submittedAtLabel ? (
            <p className="mt-2 text-[12px] text-[#8A96A8]" data-testid="partner-submitted-at">
              {t('statusUx.submittedAt', { date: submittedAtLabel })}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[#53637A]" data-testid="partner-status-chip">
          {t('statusLabel')}:{' '}
          <span className="font-semibold text-[#0D2046]">{t(`verification.${status}`)}</span>
        </p>
      )}

      {status === 'submitted' || status === 'under_review' ? (
        <p
          className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-[#53637A]"
          data-testid="partner-return-later-hint"
        >
          {t('statusUx.returnLaterHint')}
        </p>
      ) : null}

      {status === 'changes_requested' && onboarding.changeRequestReason ? (
        <p
          data-testid="partner-change-reason"
          className="mx-auto mt-5 max-w-lg rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-start text-sm text-[#0D2046]"
        >
          <span className="font-semibold">{t('changesRequestedTitle')}: </span>
          {onboarding.changeRequestReason}
        </p>
      ) : null}

      {status === 'rejected' && onboarding.rejectionReason ? (
        <p className="mx-auto mt-5 max-w-lg rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-start text-sm text-danger">
          {t('rejectedNotice')}: {onboarding.rejectionReason}
        </p>
      ) : null}

      {status === 'suspended' && onboarding.suspensionReason ? (
        <p className="mx-auto mt-5 max-w-lg rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-start text-sm text-danger">
          {onboarding.suspensionReason}
        </p>
      ) : null}

      <p className="mx-auto mt-4 max-w-md text-[12px] text-[#8A96A8]">{t('statusUx.noSla')}</p>

      {status === 'changes_requested' && onContinueCorrection ? (
        <Button
          type="button"
          className="mt-6 shadow-soft"
          data-testid="partner-continue-correction"
          onClick={onContinueCorrection}
        >
          {t('statusUx.continueCorrection')}
        </Button>
      ) : null}

      {(status === 'approved' || status === 'legacy_approved') && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button asChild className="shadow-soft" data-testid="partner-go-add-farm">
            <Link href="/owner/properties/new">{t('goToAddFarm')}</Link>
          </Button>
          <Button asChild variant="outline" data-testid="partner-go-owner-dashboard">
            <Link href="/owner">{t('goToDashboard')}</Link>
          </Button>
        </div>
      )}
    </section>
  );
}
