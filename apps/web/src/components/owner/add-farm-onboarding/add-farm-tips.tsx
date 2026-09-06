'use client';

import { useTranslations } from 'next-intl';
import { Lightbulb } from 'lucide-react';
import type { AddFarmStepId } from '@mazare3/shared';

type Props = {
  step: AddFarmStepId;
};

export function AddFarmTips({ step }: Props) {
  const t = useTranslations('addFarm');

  return (
    <section
      data-testid="add-farm-tips"
      className="rounded-[16px] border border-[#E5EAF1] bg-[#F8FBFF] p-4"
    >
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-[#2F6EF6]" aria-hidden />
        <h2 className="text-[13px] font-bold text-[#0D2046]">{t('tipsTitle')}</h2>
      </div>
      <ul className="mt-2 list-disc space-y-1 ps-4 text-[12px] leading-relaxed text-[#53637A]">
        <li>{t(`tips.${step}.a`)}</li>
        <li>{t(`tips.${step}.b`)}</li>
      </ul>
    </section>
  );
}
