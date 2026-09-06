'use client';

import { useTranslations } from 'next-intl';
import { Home, Users } from 'lucide-react';
import { PROPERTY_TYPES } from '@mazare3/shared';
import { formatPrice } from '@/lib/property-helpers';
import type { AddFarmFormState } from './add-farm-wizard';
import { jordanCityLabel } from './steps/location-step';

type Props = {
  form: AddFarmFormState;
  mediaUrl?: string;
  locale: 'ar' | 'en';
};

export function AddFarmPreview({ form, mediaUrl, locale }: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');
  const tCommon = useTranslations('common');
  const title =
    locale === 'ar'
      ? form.titleAr.trim() || t('previewTitlePlaceholder')
      : form.titleEn.trim() || form.titleAr.trim() || t('previewTitlePlaceholder');
  const typeLabel = (PROPERTY_TYPES as readonly string[]).includes(form.type)
    ? tProp(`propertyType.${form.type}`)
    : form.type;
  const capacity = Number(form.capacity);
  const hasCapacity = Number.isFinite(capacity) && capacity >= 1;
  const cityLabel = jordanCityLabel(form.city, locale);
  const areaLabel = form.area.trim();
  const locationLine = [cityLabel, areaLabel].filter(Boolean).join(' · ');
  const basePrice = Number(form.basePrice);
  const hasPrice = Number.isFinite(basePrice) && basePrice > 0;

  return (
    <section
      data-testid="add-farm-preview"
      className="overflow-hidden rounded-[18px] border border-[#E5EAF1] bg-white shadow-[0_6px_18px_rgba(13,32,70,.05)]"
      aria-label={t('previewLabel')}
    >
      <div className="border-b border-[#EEF2F7] px-3.5 py-2.5">
        <p className="text-[12px] font-bold text-[#0D2046]">{t('previewLabel')}</p>
        <p className="text-[11px] text-[#8A96A8]">{t('previewHint')}</p>
      </div>
      <div className="relative aspect-[16/10] bg-[#EEF5FF]">
        {mediaUrl ? (
          <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-[#8A96A8]">
            <Home className="h-8 w-8 opacity-50" aria-hidden />
            <span className="text-[11px] font-medium">{t('previewImagePlaceholder')}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 p-3.5 text-start">
        <h3 className="line-clamp-2 text-[15px] font-bold text-[#0D2046]">{title}</h3>
        <p className="text-[12px] font-medium text-[#64748B]">{typeLabel}</p>
        {locationLine ? (
          <p className="text-[12px] text-[#8A96A8]">{locationLine}</p>
        ) : (
          <p className="text-[12px] text-[#94A3B8]">{t('previewLocationPlaceholder')}</p>
        )}
        {hasCapacity ? (
          <p className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0D2046]">
            <Users className="h-3.5 w-3.5 text-[#2F6EF6]" aria-hidden />
            {t('previewGuests', { count: capacity })}
          </p>
        ) : null}
        {hasPrice ? (
          <p className="text-[14px] font-bold text-[#0D2046]" data-testid="add-farm-preview-price">
            <span className="me-1 text-[12px] font-semibold text-[#64748B]">
              {tCommon('from')}
            </span>
            {formatPrice(basePrice, 'JOD', locale)}
          </p>
        ) : (
          <p className="text-[12px] text-[#94A3B8]">{t('previewPricePlaceholder')}</p>
        )}
      </div>
    </section>
  );
}
