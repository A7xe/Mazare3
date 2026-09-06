'use client';

import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { ADD_FARM_STEPS, type AddFarmStepId } from '@mazare3/shared';
import { Button } from '@/components/ui/button';

type Props = {
  step: AddFarmStepId;
  saving: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  /** When false, hide Save Draft (e.g. Review has no editable fields). */
  showSaveDraft?: boolean;
  showSubmit?: boolean;
  onSubmit?: () => void;
};

export function AddFarmActions({
  step,
  saving,
  onPrevious,
  onNext,
  onSaveDraft,
  showSaveDraft = true,
  showSubmit,
  onSubmit,
}: Props) {
  const t = useTranslations('addFarm');
  const idx = ADD_FARM_STEPS.indexOf(step);
  const isFirst = idx <= 0;
  const isLast = idx >= ADD_FARM_STEPS.length - 1;

  return (
    <div
      data-testid="add-farm-actions"
      className="flex flex-wrap items-center gap-2.5 rounded-[16px] border border-[#E5EAF1] bg-white p-3 shadow-[0_4px_14px_rgba(13,32,70,.04)]"
    >
      {!isFirst ? (
        <Button type="button" variant="outline" disabled={saving} onClick={onPrevious}>
          {t('previous')}
        </Button>
      ) : null}

      {showSaveDraft ? (
        <Button type="button" variant="outline" disabled={saving} onClick={onSaveDraft} data-testid="add-farm-save-draft">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t('saveDraft')}
        </Button>
      ) : null}

      <div className="ms-auto flex gap-2">
        {showSubmit && onSubmit ? (
          <Button type="button" disabled={saving} onClick={onSubmit} data-testid="add-farm-submit-review-actions">
            {t('submitReview')}
          </Button>
        ) : null}
        {!isLast ? (
          <Button
            type="button"
            disabled={saving}
            onClick={onNext}
            className="bg-[#2F6EF6] hover:bg-[#2563EB]"
            data-testid="add-farm-next"
          >
            {t('next')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
