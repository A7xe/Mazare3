'use client';

import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  PARTNER_ONBOARDING_STEPS,
  type PartnerOnboardingStepId,
  type PartnerSectionCompletion,
} from './partner-onboarding-model';

type Props = {
  current: PartnerOnboardingStepId;
  completion: PartnerSectionCompletion;
  onSelect: (step: PartnerOnboardingStepId) => void;
  allowJump?: boolean;
};

export function PartnerOnboardingStepper({
  current,
  completion,
  onSelect,
  allowJump = true,
}: Props) {
  const t = useTranslations('becomeOwner');
  const currentIndex = PARTNER_ONBOARDING_STEPS.indexOf(current);
  const percent = Math.round(((currentIndex + 1) / PARTNER_ONBOARDING_STEPS.length) * 100);

  return (
    <nav aria-label={t('shell.stepsLabel')} data-testid="partner-onboarding-stepper">
      <div className="mb-3 md:hidden" data-testid="partner-stepper-mobile">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[12px] font-semibold text-primary">
            {t('stepOf', { current: currentIndex + 1, total: PARTNER_ONBOARDING_STEPS.length })}
          </p>
          <p className="text-[13px] font-bold text-[#0D2046]">{t(`steps.${current}`)}</p>
        </div>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EEF7]"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('shell.progressLabel')}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
        </div>
      </div>

      <ol className="hidden gap-1.5 md:grid md:grid-cols-6" data-testid="partner-stepper-desktop">
        {PARTNER_ONBOARDING_STEPS.map((id, index) => {
          const done = completion[id];
          const active = id === current;
          return (
            <li key={id} className="min-w-0">
              <button
                type="button"
                disabled={!allowJump}
                aria-current={active ? 'step' : undefined}
                data-testid={`partner-step-${id}`}
                onClick={() => allowJump && onSelect(id)}
                className={cn(
                  'flex w-full flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition',
                  active && 'bg-[#EEF4FF]',
                  !active && allowJump && 'hover:bg-[#F7FAFF]',
                  !allowJump && 'cursor-default',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold',
                    active && 'bg-primary text-white',
                    !active && done && 'bg-[#DCFCE7] text-[#15803D]',
                    !active && !done && 'bg-[#E8EEF7] text-[#8A96A8]',
                  )}
                >
                  {done && !active ? <Check className="h-3.5 w-3.5" aria-hidden /> : index + 1}
                </span>
                <span
                  className={cn(
                    'line-clamp-2 text-[10px] font-semibold leading-tight',
                    active ? 'text-primary' : done ? 'text-[#15803D]' : 'text-[#8A96A8]',
                  )}
                >
                  {t(`steps.${id}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
