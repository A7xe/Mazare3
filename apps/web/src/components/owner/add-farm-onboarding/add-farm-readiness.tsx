'use client';

import { useTranslations } from 'next-intl';
import type { AddFarmReadinessBreakdown } from '@mazare3/shared';

type Props = {
  readiness: AddFarmReadinessBreakdown;
};

export function AddFarmReadiness({ readiness }: Props) {
  const t = useTranslations('addFarm');

  return (
    <section
      data-testid="add-farm-readiness"
      className="rounded-[16px] border border-[#E5EAF1] bg-white p-4 shadow-[0_4px_14px_rgba(13,32,70,.04)]"
      aria-label={t('readinessLabel')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-bold text-[#0D2046]">{t('readinessLabel')}</h2>
        <span className="text-[13px] font-bold tabular-nums text-[#2F6EF6]" data-testid="add-farm-readiness-percent">
          {readiness.percent}%
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E8EEF5]">
        <div
          className="h-full rounded-full bg-[#2F6EF6] transition-all"
          style={{ width: `${readiness.percent}%` }}
        />
      </div>
      <p className="mt-2 text-[11px] text-[#64748B]">
        {t('readinessProgress', {
          done: readiness.completedSteps,
          total: readiness.totalSteps,
        })}
      </p>
    </section>
  );
}
