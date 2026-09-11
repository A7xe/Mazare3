'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Circle,
  Clock,
  Home,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { ADD_FARM_WIZARD_HREF, OWNER_PROPERTIES_HREF } from '@/lib/add-farm-entry';
import type { PartnerOnboardingView, PartnerRequirementRow, PartnerVerificationStatus } from '@/lib/api-partner';
import { cn } from '@/lib/utils';
import {
  deriveOwnerPayoutReadiness,
  derivePartnerCorrectionActions,
  derivePartnerTrackingTimeline,
  OWNER_PAYOUT_SETUP_HREF,
  type PartnerCorrectionAction,
  type PartnerOnboardingStepId,
  type PartnerTimelineMilestone,
  type PartnerTimelineMilestoneState,
} from './partner-onboarding-model';

type Props = {
  onboarding: PartnerOnboardingView;
  requirements?: PartnerRequirementRow[];
  /** Open wizard at a correction step (changes_requested). */
  onContinueCorrection?: (step?: PartnerOnboardingStepId) => void;
  /** Resubmit after corrections when readiness allows. */
  onResubmit?: () => void;
  resubmitting?: boolean;
  /** Approved owner already has at least one property (optional). */
  hasExistingFarms?: boolean;
  /** Compact banner when correction wizard is already open. */
  compact?: boolean;
};

function StatusHeroIcon({ status }: { status: PartnerVerificationStatus }) {
  if (status === 'submitted') return <CheckCircle2 className="h-11 w-11 text-primary" aria-hidden />;
  if (status === 'under_review') return <Clock className="h-11 w-11 text-primary" aria-hidden />;
  if (status === 'changes_requested') {
    return <AlertTriangle className="h-11 w-11 text-amber-600" aria-hidden />;
  }
  if (status === 'approved' || status === 'legacy_approved') {
    return <CheckCircle2 className="h-11 w-11 text-green-600" aria-hidden />;
  }
  if (status === 'rejected') return <ShieldAlert className="h-11 w-11 text-danger" aria-hidden />;
  if (status === 'suspended') return <Ban className="h-11 w-11 text-danger" aria-hidden />;
  return <CheckCircle2 className="h-11 w-11 text-primary" aria-hidden />;
}

function milestoneIcon(state: PartnerTimelineMilestoneState) {
  if (state === 'complete' || state === 'approved') {
    return <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden />;
  }
  if (state === 'current') return <Clock className="h-5 w-5 text-primary" aria-hidden />;
  if (state === 'requires_action') {
    return <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden />;
  }
  if (state === 'rejected') return <ShieldAlert className="h-5 w-5 text-danger" aria-hidden />;
  return <Circle className="h-5 w-5 text-[#C5CDD8]" aria-hidden />;
}

function PartnerTrackingTimeline({
  milestones,
  status,
}: {
  milestones: PartnerTimelineMilestone[];
  status: PartnerVerificationStatus;
}) {
  const t = useTranslations('becomeOwner');
  const partnerMilestones = milestones.filter((m) => m.group === 'partner');
  const marketMilestones = milestones.filter((m) => m.group === 'marketplace');

  return (
    <div className="space-y-5" data-testid="partner-tracking-timeline">
      <ol className="space-y-0" aria-label={t('tracking.partnerLifecycleLabel')}>
        {partnerMilestones.map((m, index) => {
          const current = m.state === 'current' || m.state === 'requires_action';
          const label =
            m.id === 'decision' && status === 'suspended'
              ? t('tracking.milestone.suspendedDecision')
              : t(`tracking.milestone.${m.id}`);
          return (
            <li
              key={m.id}
              className="relative flex gap-3 pb-5 last:pb-0"
              data-testid={`partner-timeline-${m.id}`}
              data-timeline-state={m.state}
              aria-current={current ? 'step' : undefined}
            >
              {index < partnerMilestones.length - 1 ? (
                <span
                  className="absolute start-[9px] top-6 h-[calc(100%-0.75rem)] w-px bg-[#DCE6F5]"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-[1] mt-0.5 shrink-0 bg-white">{milestoneIcon(m.state)}</span>
              <div className="min-w-0 flex-1 text-start">
                <p
                  className={cn(
                    'text-[14px] font-semibold',
                    current ? 'text-[#0D2046]' : 'text-[#53637A]',
                  )}
                >
                  {label}
                </p>
                <p className="mt-0.5 text-[12px] text-[#8A96A8]">
                  {t(`tracking.milestoneState.${m.state}`)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div
        className="rounded-2xl border border-dashed border-[#DCE6F5] bg-[#FBFCFE] px-4 py-3"
        data-testid="partner-marketplace-next"
      >
        <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8A96A8]">
          {t('tracking.marketplaceNextLabel')}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-[#53637A]">
          {t('tracking.marketplaceNextHint')}
        </p>
        <ol className="mt-3 space-y-2" aria-label={t('tracking.marketplaceLifecycleLabel')}>
          {marketMilestones.map((m) => (
            <li
              key={m.id}
              className="flex items-start gap-2 text-start"
              data-testid={`partner-timeline-${m.id}`}
              data-timeline-state={m.state}
            >
              {m.id === 'farm_setup' ? (
                <Sprout className="mt-0.5 h-4 w-4 shrink-0 text-[#8A96A8]" aria-hidden />
              ) : (
                <Home className="mt-0.5 h-4 w-4 shrink-0 text-[#8A96A8]" aria-hidden />
              )}
              <div>
                <p className="text-[13px] font-medium text-[#53637A]">
                  {t(`tracking.milestone.${m.id}`)}
                </p>
                <p className="text-[11px] text-[#8A96A8]">
                  {t(`tracking.milestoneState.${m.state}`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function CorrectionList({
  actions,
  onContinueCorrection,
}: {
  actions: PartnerCorrectionAction[];
  onContinueCorrection?: (step?: PartnerOnboardingStepId) => void;
}) {
  const t = useTranslations('becomeOwner');
  if (actions.length === 0) return null;
  return (
    <div
      className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-start"
      data-testid="partner-correction-list"
    >
      <p className="text-[13px] font-bold text-[#0D2046]" data-testid="partner-correction-count">
        {t('tracking.actionsCount', { count: actions.length })}
      </p>
      <ul className="mt-3 space-y-3">
        {actions.map((action) => (
          <li
            key={action.id}
            className="rounded-xl border border-amber-100 bg-white px-3 py-3"
            data-testid={`partner-correction-item-${action.step}`}
            data-field-key={action.fieldKey}
          >
            <p className="text-[14px] font-semibold text-[#0D2046]">{t(action.titleKey)}</p>
            {action.reason ? (
              <p className="mt-1 text-[13px] leading-relaxed text-[#53637A]">{action.reason}</p>
            ) : null}
            {onContinueCorrection ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 min-h-10"
                data-testid={`partner-correction-cta-${action.step}`}
                onClick={() => onContinueCorrection(action.step)}
              >
                {t('tracking.fixAction')}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PartnerStatusPanel({
  onboarding,
  requirements = [],
  onContinueCorrection,
  onResubmit,
  resubmitting,
  hasExistingFarms = false,
  compact = false,
}: Props) {
  const t = useTranslations('becomeOwner');
  const locale = useLocale();
  const status = onboarding.verificationStatus;
  if (!status) return null;

  const isApproved = status === 'approved' || status === 'legacy_approved';
  const milestones = derivePartnerTrackingTimeline(status);
  const corrections = derivePartnerCorrectionActions(onboarding, requirements);
  const canResubmit = status === 'changes_requested' && onboarding.readiness.canSubmit;
  const payoutReadiness = deriveOwnerPayoutReadiness(onboarding.payout);

  const titleKey =
    status === 'submitted'
      ? 'tracking.submittedTitle'
      : status === 'under_review'
        ? 'tracking.underReviewTitle'
        : status === 'changes_requested'
          ? 'tracking.changesTitle'
          : status === 'rejected'
            ? 'tracking.rejectedTitle'
            : status === 'suspended'
              ? 'tracking.suspendedTitle'
              : isApproved
                ? 'tracking.approvedTitle'
                : 'statusUx.genericTitle';

  const bodyKey =
    status === 'submitted'
      ? 'tracking.submittedBody'
      : status === 'under_review'
        ? 'tracking.underReviewBody'
        : status === 'changes_requested'
          ? 'tracking.changesBody'
          : status === 'rejected'
            ? 'tracking.rejectedBody'
            : status === 'suspended'
              ? 'tracking.suspendedBody'
              : isApproved
                ? 'tracking.approvedBody'
                : 'statusUx.genericBody';

  const submittedAtLabel =
    onboarding.submittedAt &&
    (status === 'submitted' || status === 'under_review' || status === 'changes_requested')
      ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar-JO' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(onboarding.submittedAt))
      : null;

  const chipLabel =
    status === 'submitted'
      ? t('statusUx.awaitingReview')
      : isApproved
        ? t('verification.approved')
        : t(`verification.${status}`);

  if (compact && status === 'changes_requested') {
    return (
      <section
        className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-start"
        data-testid="owner-application-status"
        data-partner-status={status}
        data-tracking-compact="true"
      >
        <p className="text-[15px] font-bold text-[#0D2046]">{t(titleKey)}</p>
        <p className="mt-1 text-[13px] text-[#53637A]">{t(bodyKey)}</p>
        {corrections.length > 0 ? (
          <p className="mt-2 text-[13px] font-medium text-amber-900" data-testid="partner-correction-count">
            {t('tracking.actionsCount', { count: corrections.length })}
          </p>
        ) : null}
        <span className="sr-only" data-testid="partner-status-chip">
          {chipLabel}
        </span>
      </section>
    );
  }

  return (
    <section
      className="mx-auto w-full max-w-xl rounded-[24px] border border-[#E5EAF1] bg-white px-5 py-8 shadow-[0_8px_28px_rgba(13,32,70,.05)] sm:px-8 sm:py-10"
      data-testid="owner-application-status"
      data-partner-status={status}
    >
      <div className="flex flex-col items-center text-center">
        <StatusHeroIcon status={status} />
        <h2 className="mt-4 text-2xl font-bold text-[#0D2046]">{t(titleKey)}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#53637A]">{t(bodyKey)}</p>
        <p
          className="mt-3 inline-flex items-center rounded-full bg-[#F0F5FF] px-3 py-1 text-[12px] font-semibold text-primary"
          data-testid="partner-status-chip"
        >
          {chipLabel}
        </p>
        {submittedAtLabel ? (
          <p className="mt-2 text-[12px] text-[#8A96A8]" data-testid="partner-submitted-at">
            {t('statusUx.submittedAt', { date: submittedAtLabel })}
          </p>
        ) : null}
      </div>

      {status === 'changes_requested' ? (
        <div className="mt-6 space-y-4">
          {corrections.length > 0 ? (
            <p
              className="text-center text-[14px] font-semibold text-amber-900"
              data-testid="partner-correction-count-banner"
            >
              {t('tracking.actionsCount', { count: corrections.length })}
            </p>
          ) : null}
          {onContinueCorrection ? (
            <Button
              type="button"
              className="w-full shadow-soft"
              data-testid="partner-continue-correction"
              onClick={() => onContinueCorrection(corrections[0]?.step)}
            >
              {t('tracking.completeRequired')}
            </Button>
          ) : null}
          <CorrectionList actions={corrections} onContinueCorrection={onContinueCorrection} />
          {canResubmit && onResubmit ? (
            <Button
              type="button"
              className="w-full shadow-soft sm:w-auto"
              data-testid="partner-resubmit"
              disabled={resubmitting}
              onClick={() => onResubmit()}
            >
              {resubmitting ? t('tracking.resubmitting') : t('tracking.resubmitCta')}
            </Button>
          ) : !canResubmit ? (
            <p className="text-[13px] text-[#53637A]" data-testid="partner-resubmit-blocked">
              {t('tracking.resubmitBlocked')}
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'rejected' && onboarding.rejectionReason ? (
        <p className="mx-auto mt-6 max-w-lg rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-start text-sm text-danger">
          {t('rejectedNotice')}: {onboarding.rejectionReason}
        </p>
      ) : null}

      {status === 'suspended' && onboarding.suspensionReason ? (
        <p className="mx-auto mt-6 max-w-lg rounded-xl border border-danger/20 bg-danger/10 px-4 py-3 text-start text-sm text-danger">
          {onboarding.suspensionReason}
        </p>
      ) : null}

      {isApproved ? (
        <div className="mt-6 space-y-3 text-center">
          <p
            className="mx-auto max-w-md text-[13px] leading-relaxed text-[#53637A]"
            data-testid="partner-approval-not-listing"
          >
            {t('tracking.approvalNotListing')}
          </p>
          <div
            className={cn(
              'rounded-2xl border px-4 py-3 text-start',
              payoutReadiness === 'ready'
                ? 'border-green-200 bg-green-50/80'
                : 'border-[#DCE6F5] bg-[#F8FBFF]',
            )}
            data-testid="partner-payout-setup-card"
          >
            <p className="text-[14px] font-semibold text-[#0D2046]">
              {t('tracking.payoutSetupTitle')}
            </p>
            {payoutReadiness === 'ready' ? (
              <p className="mt-1 text-[13px] text-green-800">{t('tracking.payoutSetupReady')}</p>
            ) : (
              <Button asChild variant="outline" size="sm" className="mt-3 min-h-10">
                <Link href={OWNER_PAYOUT_SETUP_HREF}>{t('tracking.payoutSetupCta')}</Link>
              </Button>
            )}
          </div>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
            {hasExistingFarms ? (
              <>
                <Button asChild className="shadow-soft" data-testid="partner-go-my-farms">
                  <Link href={OWNER_PROPERTIES_HREF}>{t('tracking.myFarmsCta')}</Link>
                </Button>
                <Button asChild variant="outline" data-testid="partner-go-add-farm">
                  <Link href={ADD_FARM_WIZARD_HREF}>{t('tracking.addFarmCta')}</Link>
                </Button>
              </>
            ) : (
              <Button asChild className="shadow-soft" data-testid="partner-go-add-farm">
                <Link href={ADD_FARM_WIZARD_HREF}>{t('tracking.addFarmCta')}</Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}

      {(status === 'submitted' || status === 'under_review') && (
        <p
          className="mx-auto mt-5 max-w-md text-center text-[13px] leading-relaxed text-[#53637A]"
          data-testid="partner-return-later-hint"
        >
          {t('statusUx.returnLaterHint')}
        </p>
      )}

      <div className="mt-8 border-t border-[#E5EAF1] pt-6">
        <h3 className="mb-4 text-start text-[14px] font-bold text-[#0D2046]">
          {t('tracking.timelineTitle')}
        </h3>
        <PartnerTrackingTimeline milestones={milestones} status={status} />
      </div>

      {!isApproved ? (
        <p className="mx-auto mt-6 max-w-md text-center text-[12px] text-[#8A96A8]">
          {t('statusUx.noSla')}
        </p>
      ) : null}
    </section>
  );
}
