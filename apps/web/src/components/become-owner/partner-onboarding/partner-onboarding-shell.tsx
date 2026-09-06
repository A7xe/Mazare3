'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import type { PartnerRequirementRow } from '@/lib/api-partner';
import { PartnerOnboardingStepper } from './partner-onboarding-stepper';
import { PartnerOnboardingRail } from './partner-onboarding-rail';
import {
  type PartnerOnboardingStepId,
  type PartnerSectionCompletion,
} from './partner-onboarding-model';

type Props = {
  title: string;
  subtitle?: string;
  current: PartnerOnboardingStepId;
  completion: PartnerSectionCompletion;
  requirements?: PartnerRequirementRow[];
  onSelectStep: (step: PartnerOnboardingStepId | string) => void;
  allowJump?: boolean;
  banner?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  savedVisible?: boolean;
};

export function PartnerOnboardingShell({
  title,
  subtitle,
  current,
  completion,
  requirements = [],
  onSelectStep,
  allowJump = true,
  banner,
  actions,
  children,
  savedVisible,
}: Props) {
  const t = useTranslations('becomeOwner');

  return (
    <div className="space-y-5" data-testid="partner-onboarding-shell">
      <header className="space-y-1 text-start">
        <p className="text-sm font-semibold text-primary">{t('shell.eyebrow')}</p>
        <h1 className="font-heading text-[1.65rem] leading-tight text-[#0D2046] sm:text-[1.85rem]">
          {title}
        </h1>
        {subtitle ? <p className="max-w-2xl text-[13px] text-[#53637A] sm:text-[14px]">{subtitle}</p> : null}
        {savedVisible ? (
          <p className="text-sm font-medium text-[#15803D]" data-testid="partner-saved">
            {t('shell.saved')}
          </p>
        ) : null}
      </header>

      {banner}

      <PartnerOnboardingStepper
        current={current}
        completion={completion}
        onSelect={onSelectStep}
        allowJump={allowJump}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,32%)] xl:items-start xl:gap-7">
        <div className="min-w-0 space-y-4">
          <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_6px_20px_rgba(13,32,70,.04)] sm:p-6">
            {children}
          </div>
          {actions}
        </div>
        <div className="min-w-0">
          <PartnerOnboardingRail
            current={current}
            completion={completion}
            requirements={requirements}
          />
        </div>
      </div>
    </div>
  );
}
