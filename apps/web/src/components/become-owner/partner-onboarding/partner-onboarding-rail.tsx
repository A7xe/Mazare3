'use client';

import { useTranslations } from 'next-intl';
import { Lock, ListChecks, Lightbulb } from 'lucide-react';
import type { PartnerRequirementRow } from '@/lib/api-partner';
import {
  PARTNER_ONBOARDING_STEPS,
  countRequiredPartnerDocuments,
  partnerCompletedSectionCount,
  partnerProgressPercent,
  type PartnerOnboardingStepId,
  type PartnerSectionCompletion,
} from './partner-onboarding-model';

type Props = {
  current: PartnerOnboardingStepId;
  completion: PartnerSectionCompletion;
  requirements?: PartnerRequirementRow[];
};

export function PartnerOnboardingRail({ current, completion, requirements = [] }: Props) {
  const t = useTranslations('becomeOwner');
  const percent = partnerProgressPercent(completion);
  const done = partnerCompletedSectionCount(completion);
  const docCounts = countRequiredPartnerDocuments(requirements);
  const totalSections = PARTNER_ONBOARDING_STEPS.length;

  return (
    <aside
      className="space-y-4 xl:sticky xl:top-24"
      data-testid="partner-onboarding-rail"
      aria-label={t('shell.railLabel')}
    >
      <section
        className="rounded-[18px] border border-[#E5EAF1] bg-white p-4 shadow-[0_6px_20px_rgba(13,32,70,.04)]"
        data-testid="partner-progress-card"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[14px] font-bold text-[#0D2046]">{t('shell.progressTitle')}</h2>
          <span className="text-[13px] font-bold tabular-nums text-primary">{percent}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8EEF7]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('shell.progressLabel')}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-[12px] text-[#53637A]">
          {t('shell.progressHint', { done, total: totalSections })}
        </p>
      </section>

      <section
        className="rounded-[18px] border border-[#E5EAF1] bg-[#F8FBFF] p-4"
        data-testid="partner-need-this-step"
      >
        <div className="flex gap-2">
          <ListChecks className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="text-[14px] font-bold text-[#0D2046]">{t('shell.needTitle')}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#53637A]">
              {current === 'documents' && docCounts.requiredTotal > 0
                ? t('shell.docsProgress', {
                    uploaded: docCounts.uploadedRequired,
                    total: docCounts.requiredTotal,
                  })
                : t(`shell.need.${current}`)}
            </p>
          </div>
        </div>
      </section>

      {(current === 'contact' || current === 'documents' || current === 'payout') && (
        <section
          className="rounded-[18px] border border-[#E5EAF1] bg-white p-4"
          data-testid={
            current === 'contact'
              ? 'partner-contact-privacy-rail'
              : current === 'documents'
                ? 'partner-documents-privacy'
                : 'partner-payout-privacy'
          }
        >
          <div className="flex gap-2">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="text-[14px] font-bold text-[#0D2046]">
                {current === 'contact'
                  ? t('shell.contactPrivacyTitle')
                  : current === 'documents'
                    ? t('shell.docsPrivacyTitle')
                    : t('shell.payoutPrivacyTitle')}
              </h2>
              <p className="mt-1 text-[12px] leading-relaxed text-[#53637A]">
                {current === 'contact'
                  ? t('contact.privacyNote')
                  : current === 'documents'
                    ? t('shell.docsPrivacyBody')
                    : t('shell.payoutPrivacyBody')}
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-[18px] border border-[#E5EAF1] bg-white p-4" data-testid="partner-tip-card">
        <div className="flex gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="text-[14px] font-bold text-[#0D2046]">{t('shell.tipTitle')}</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-[#53637A]">{t(`shell.tips.${current}`)}</p>
          </div>
        </div>
      </section>
    </aside>
  );
}
