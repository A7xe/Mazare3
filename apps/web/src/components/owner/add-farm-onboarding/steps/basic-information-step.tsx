'use client';

import { useTranslations } from 'next-intl';
import { PROPERTY_TYPES } from '@mazare3/shared';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { AddFarmFormState } from '../add-farm-wizard';

type Props = {
  form: AddFarmFormState;
  errors: Record<string, string>;
  onChange: (patch: Partial<AddFarmFormState>) => void;
};

export function BasicInformationStep({ form, errors, onChange }: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');

  return (
    <div className="space-y-5 text-start" data-testid="add-farm-step-basic-panel">
      <div>
        <h2 className="text-[17px] font-bold text-[#0D2046]">{t('steps.basic')}</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">{t('basicHint')}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="add-farm-title-ar" className="text-sm font-semibold text-[#0D2046]">
          {t('fields.titleAr')}
        </label>
        <Input
          id="add-farm-title-ar"
          required
          aria-invalid={Boolean(errors.titleAr)}
          aria-describedby={errors.titleAr ? 'err-title-ar' : undefined}
          placeholder={t('fields.titleArPlaceholder')}
          value={form.titleAr}
          onChange={(e) => onChange({ titleAr: e.target.value })}
          data-testid="add-farm-title-ar"
        />
        {errors.titleAr ? (
          <p id="err-title-ar" className="text-xs text-danger">
            {errors.titleAr}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="add-farm-title-en" className="text-sm font-semibold text-[#0D2046]">
          {tProp('titleEn')}
        </label>
        <Input
          id="add-farm-title-en"
          value={form.titleEn}
          onChange={(e) => onChange({ titleEn: e.target.value })}
        />
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-[#0D2046]">{t('fields.type')}</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROPERTY_TYPES.map((pt) => {
            const selected = form.type === pt;
            return (
              <button
                key={pt}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange({ type: pt })}
                className={cn(
                  'rounded-[12px] border px-3 py-2.5 text-start text-[12px] font-semibold transition',
                  selected
                    ? 'border-[#2F6EF6] bg-[#EEF4FF] text-[#0D2046]'
                    : 'border-[#E5EAF1] bg-white text-[#53637A] hover:border-[#2F6EF6]/40',
                )}
                data-testid={`add-farm-type-${pt}`}
              >
                {tProp(`propertyType.${pt}`)}
              </button>
            );
          })}
        </div>
        {errors.type ? <p className="mt-1 text-xs text-danger">{errors.type}</p> : null}
      </fieldset>

      <div className="space-y-2">
        <label htmlFor="add-farm-capacity" className="text-sm font-semibold text-[#0D2046]">
          {t('fields.capacity')}
        </label>
        <Input
          id="add-farm-capacity"
          type="number"
          min={1}
          max={500}
          required
          aria-invalid={Boolean(errors.capacity)}
          value={form.capacity}
          onChange={(e) => onChange({ capacity: e.target.value })}
          data-testid="add-farm-capacity"
        />
        {errors.capacity ? <p className="text-xs text-danger">{errors.capacity}</p> : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="add-farm-desc-ar" className="text-sm font-semibold text-[#0D2046]">
          {t('fields.descriptionAr')}
        </label>
        <textarea
          id="add-farm-desc-ar"
          required
          rows={4}
          aria-invalid={Boolean(errors.descriptionAr)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
          value={form.descriptionAr}
          onChange={(e) => onChange({ descriptionAr: e.target.value })}
          data-testid="add-farm-description-ar"
        />
        {errors.descriptionAr ? (
          <p className="text-xs text-danger">{errors.descriptionAr}</p>
        ) : (
          <p className="text-[11px] text-[#8A96A8]">{t('fields.descriptionHint')}</p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="add-farm-desc-en" className="text-sm font-semibold text-[#0D2046]">
          {tProp('descriptionEn')}
        </label>
        <textarea
          id="add-farm-desc-en"
          rows={3}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm"
          value={form.descriptionEn}
          onChange={(e) => onChange({ descriptionEn: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allowsOvernight}
            onChange={(e) => onChange({ allowsOvernight: e.target.checked })}
          />
          {tProp('allowsOvernight')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allowsFamilies}
            onChange={(e) => onChange({ allowsFamilies: e.target.checked })}
          />
          {tProp('allowsFamilies')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allowsYouth}
            onChange={(e) => onChange({ allowsYouth: e.target.checked })}
          />
          {tProp('allowsYouth')}
        </label>
      </div>
    </div>
  );
}
