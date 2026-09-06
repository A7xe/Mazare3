'use client';

import type { ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import {
  AMENITY_KEYS,
  MIN_MEDIA_FOR_PUBLISH,
  MIN_MEDIA_FOR_SUBMIT_REVIEW,
  assessPropertyMedia,
  type PropertyMediaItem,
} from '@mazare3/shared';
import {
  Car,
  Flame,
  Flower2,
  PartyPopper,
  Snowflake,
  UtensilsCrossed,
  Users,
  Waves,
  Wifi,
} from 'lucide-react';
import { OwnerPropertyMediaEditor } from '@/components/owner/owner-property-media-editor';
import { Input } from '@/components/ui/input';
import type { AddFarmFormState } from '../add-farm-wizard';

const POOL_AMENITY_KEYS = new Set(['pool', 'heated_pool', 'indoor_pool', 'kids_pool']);

const AMENITY_ICON: Record<(typeof AMENITY_KEYS)[number], ComponentType<{ className?: string }>> = {
  pool: Waves,
  heated_pool: Flame,
  indoor_pool: Waves,
  kids_pool: Waves,
  bbq: UtensilsCrossed,
  football: Users,
  wifi: Wifi,
  parking: Car,
  ac: Snowflake,
  garden: Flower2,
  events: PartyPopper,
};

/** Presentation colors aligned with marketplace amenity chips. */
const AMENITY_COLOR: Record<(typeof AMENITY_KEYS)[number], string> = {
  pool: 'text-[#18B7C9]',
  heated_pool: 'text-[#E85D4C]',
  indoor_pool: 'text-[#18B7C9]',
  kids_pool: 'text-[#18B7C9]',
  bbq: 'text-[#E85D4C]',
  football: 'text-[#22A06B]',
  wifi: 'text-[#2F6EF6]',
  parking: 'text-[#F59E0B]',
  ac: 'text-[#38BDF8]',
  garden: 'text-[#22A06B]',
  events: 'text-[#7C3AED]',
};

type Props = {
  form: AddFarmFormState;
  propertyId: string | null;
  media: PropertyMediaItem[];
  onChange: (patch: Partial<AddFarmFormState>) => void;
  onMediaChange: (media: PropertyMediaItem[]) => void;
  disabled?: boolean;
};

function syncPoolsWithAmenities(
  amenityKeys: string[],
  poolsCountRaw: string,
): { amenityKeys: string[]; poolsCount: string } {
  const hasPoolAmenity = amenityKeys.some((k) => POOL_AMENITY_KEYS.has(k));
  const pools = Number(poolsCountRaw);
  const poolsCount =
    hasPoolAmenity && (!Number.isFinite(pools) || pools < 1) ? '1' : poolsCountRaw;
  return { amenityKeys, poolsCount };
}

export function PhotosAmenitiesStep({
  form,
  propertyId,
  media,
  onChange,
  onMediaChange,
  disabled,
}: Props) {
  const t = useTranslations('addFarm');
  const tProp = useTranslations('ownerProperty');

  const assessment = assessPropertyMedia(media.map((m) => ({ sortOrder: m.sortOrder })));
  const selectedCount = form.amenityKeys.length;

  function toggleAmenity(key: string, checked: boolean) {
    const nextKeys = checked
      ? [...form.amenityKeys, key]
      : form.amenityKeys.filter((k) => k !== key);
    onChange(syncPoolsWithAmenities(nextKeys, form.poolsCount));
  }

  function onPoolsCountChange(value: string) {
    const n = Number(value);
    let nextKeys = form.amenityKeys;
    if (Number.isFinite(n) && n < 1) {
      nextKeys = form.amenityKeys.filter((k) => !POOL_AMENITY_KEYS.has(k));
    }
    onChange({ poolsCount: value, amenityKeys: nextKeys });
  }

  return (
    <div className="space-y-6 text-start" data-testid="add-farm-step-photos-panel">
      <div>
        <h2 className="text-[17px] font-bold text-[#0D2046]">{t('photosHeading')}</h2>
        <p className="mt-1 text-[12px] text-[#64748B]">{t('photosHint')}</p>
      </div>

      <ul className="space-y-1.5 rounded-[14px] border border-[#E5EAF1] bg-[#F8FBFF] px-3.5 py-3 text-[12px] text-[#53637A]">
        <li>{t('photoTipClear')}</li>
        <li>{t('photoTipFacilities')}</li>
        <li>{t('photoTipCover')}</li>
      </ul>

      <div
        className="rounded-[14px] border border-primary/20 bg-primary-soft/30 px-3.5 py-3 text-[12px] text-[#0D2046]"
        data-testid="add-farm-photos-status"
      >
        <p className="font-semibold">
          {t('photosCountLabel', { count: assessment.count })}
        </p>
        <p className="mt-1 text-[#53637A]">
          {t('photosRecommend', { min: MIN_MEDIA_FOR_PUBLISH })}
        </p>
        <p className="mt-1 text-[#53637A]">
          {assessment.canSubmitReview
            ? t('photosReady')
            : t('photosNeedMin', { min: MIN_MEDIA_FOR_SUBMIT_REVIEW })}
        </p>
      </div>

      {propertyId ? (
        <OwnerPropertyMediaEditor
          propertyId={propertyId}
          media={media}
          onMediaChange={(next) => {
            onMediaChange(next);
            onChange({ imageUrls: next.map((m) => m.url) });
          }}
          disabled={disabled}
          confirmDelete
          hideUrlAdd
        />
      ) : (
        <p
          role="status"
          className="rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center text-sm text-navy"
          data-testid="add-farm-photos-need-draft"
        >
          {t('photosNeedDraft')}
        </p>
      )}

      <div className="space-y-3" data-testid="add-farm-amenities">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-[15px] font-bold text-[#0D2046]">{t('amenitiesHeading')}</h3>
            <p className="mt-0.5 text-[12px] text-[#64748B]">{t('amenitiesHint')}</p>
          </div>
          <p className="text-[12px] font-medium text-[#53637A]" data-testid="add-farm-amenities-count">
            {t('amenitiesSelected', { count: selectedCount })}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AMENITY_KEYS.map((key) => {
            const selected = form.amenityKeys.includes(key);
            const Icon = AMENITY_ICON[key];
            const color = AMENITY_COLOR[key];
            return (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2.5 rounded-[14px] border px-3 py-2.5 text-sm transition-colors ${
                  selected
                    ? 'border-primary bg-primary-soft/60 text-navy shadow-[0_0_0_1px_rgba(47,110,246,.25)]'
                    : 'border-[#E5EAF1] bg-white text-[#0D2046] hover:border-primary/35'
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={selected}
                  aria-checked={selected}
                  onChange={(e) => toggleAmenity(key, e.target.checked)}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/80 ${color}`}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 font-medium leading-snug">
                  {tProp(`amenity.${key}`)}
                </span>
                <span
                  className={`h-4 w-4 shrink-0 rounded border ${
                    selected ? 'border-primary bg-primary' : 'border-[#CBD5E1] bg-white'
                  }`}
                  aria-hidden
                />
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2" data-testid="add-farm-pools-count">
        <label htmlFor="add-farm-pools" className="text-sm font-semibold text-[#0D2046]">
          {tProp('poolsCount')}
        </label>
        <Input
          id="add-farm-pools"
          type="number"
          min={0}
          value={form.poolsCount}
          onChange={(e) => onPoolsCountChange(e.target.value)}
          disabled={disabled}
        />
        <p className="text-[11px] text-[#8A96A8]">{t('poolsCountHint')}</p>
      </div>
    </div>
  );
}
