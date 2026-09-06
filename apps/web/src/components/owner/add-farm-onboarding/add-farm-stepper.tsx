'use client';

import { useTranslations } from 'next-intl';
import {
  ADD_FARM_STEPS,
  type AddFarmStepId,
} from '@mazare3/shared';
import { Check, CircleDot, FileText, ImageIcon, MapPin, CircleDollarSign, ListChecks } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEP_ICONS = {
  basic: FileText,
  location: MapPin,
  photos: ImageIcon,
  pricing: CircleDollarSign,
  review: ListChecks,
} as const;

type Props = {
  current: AddFarmStepId;
  completed: Record<AddFarmStepId, boolean>;
  onSelect: (step: AddFarmStepId) => void;
};

export function AddFarmStepper({ current, completed, onSelect }: Props) {
  const t = useTranslations('addFarm');
  const currentIndex = ADD_FARM_STEPS.indexOf(current);

  return (
    <nav aria-label={t('stepsLabel')} data-testid="add-farm-stepper">
      {/* Mobile compact */}
      <div className="mb-3 sm:hidden">
        <p className="text-[12px] font-semibold text-[#2F6EF6]">
          {t('stepOf', { current: currentIndex + 1, total: ADD_FARM_STEPS.length })}
        </p>
        <p className="mt-0.5 text-[15px] font-bold text-[#0D2046]">{t(`steps.${current}`)}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E8EEF5]">
          <div
            className="h-full rounded-full bg-[#2F6EF6] transition-all"
            style={{ width: `${((currentIndex + 1) / ADD_FARM_STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Desktop / tablet — 5 columns from md; sm uses compact progress via mobile block */}
      <ol className="hidden gap-2 md:grid md:grid-cols-5">
        {ADD_FARM_STEPS.map((id, index) => {
          const Icon = STEP_ICONS[id];
          const isCurrent = id === current;
          const isDone = completed[id];
          const reachable =
            index <= currentIndex ||
            ADD_FARM_STEPS.slice(0, index).every((s) => completed[s]);

          return (
            <li key={id}>
              <button
                type="button"
                disabled={!reachable}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => reachable && onSelect(id)}
                className={cn(
                  'flex w-full flex-col items-start gap-2 rounded-[14px] border px-2.5 py-2.5 text-start transition sm:px-3',
                  isCurrent && 'border-[#2F6EF6] bg-[#EEF4FF] shadow-[0_4px_12px_rgba(47,110,246,.12)]',
                  !isCurrent && isDone && 'border-[#BBF7D0] bg-[#F0FDF4]',
                  !isCurrent && !isDone && 'border-[#E5EAF1] bg-white',
                  !reachable && 'cursor-not-allowed opacity-55',
                )}
                data-testid={`add-farm-step-${id}`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-bold',
                      isCurrent && 'bg-[#2F6EF6] text-white',
                      !isCurrent && isDone && 'bg-[#16A34A] text-white',
                      !isCurrent && !isDone && 'bg-[#F3F5F8] text-[#64748B]',
                    )}
                  >
                    {isDone && !isCurrent ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : isCurrent ? (
                      <CircleDot className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5',
                      isCurrent ? 'text-[#2F6EF6]' : 'text-[#8A96A8]',
                    )}
                    aria-hidden
                  />
                </span>
                <span
                  className={cn(
                    'text-[11px] font-semibold leading-snug sm:text-[12px]',
                    isCurrent ? 'text-[#0D2046]' : 'text-[#53637A]',
                  )}
                >
                  {t(`steps.${id}`)}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      {/* Tablet compact (sm–md): step pills without full 5-col squeeze */}
      <div className="mb-1 hidden gap-1.5 overflow-x-auto pb-1 sm:flex md:hidden" data-testid="add-farm-stepper-tablet">
        {ADD_FARM_STEPS.map((id, index) => {
          const isCurrent = id === current;
          const isDone = completed[id];
          const reachable =
            index <= currentIndex ||
            ADD_FARM_STEPS.slice(0, index).every((s) => completed[s]);
          return (
            <button
              key={id}
              type="button"
              disabled={!reachable}
              aria-current={isCurrent ? 'step' : undefined}
              onClick={() => reachable && onSelect(id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-semibold',
                isCurrent && 'border-[#2F6EF6] bg-[#EEF4FF] text-[#0D2046]',
                !isCurrent && isDone && 'border-[#BBF7D0] bg-[#F0FDF4] text-[#15803D]',
                !isCurrent && !isDone && 'border-[#E5EAF1] bg-white text-[#53637A]',
                !reachable && 'cursor-not-allowed opacity-55',
              )}
              data-testid={`add-farm-step-${id}`}
            >
              {index + 1}. {t(`steps.${id}`)}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
