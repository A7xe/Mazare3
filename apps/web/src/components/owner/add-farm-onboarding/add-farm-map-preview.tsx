'use client';

import { useTranslations } from 'next-intl';
import { isValidLatitude, isValidLongitude } from '@mazare3/shared';
import { MapPin } from 'lucide-react';
import { PublicApproxLocation } from '@/components/maps/public-approx-location';
import { jordanCityLabel } from './steps/location-step';
import type { AddFarmFormState } from './add-farm-wizard';

type Props = {
  form: AddFarmFormState;
  locale: 'ar' | 'en';
  /** When true, avoid a second Leaflet instance (picker is already on screen). */
  preferTextSummary: boolean;
};

function parseCoord(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) ? n : null;
}

export function AddFarmMapPreview({ form, locale, preferTextSummary }: Props) {
  const t = useTranslations('addFarm');
  const city = jordanCityLabel(form.city, locale);
  const area = form.area.trim();
  const approxText = form.approximateAddress.trim();
  const lat = parseCoord(form.latitudeApprox);
  const lng = parseCoord(form.longitudeApprox);
  const hasApproxPin =
    lat != null && lng != null && isValidLatitude(lat) && isValidLongitude(lng);
  const hasAnyLocation = Boolean(city || area || approxText || hasApproxPin);

  return (
    <section
      data-testid="add-farm-map-preview"
      className="rounded-[16px] border border-[#E5EAF1] bg-white p-4 shadow-[0_4px_14px_rgba(13,32,70,.04)]"
      aria-label={t('mapTitle')}
    >
      <p className="text-[12px] font-bold text-[#0D2046]">{t('mapTitle')}</p>

      {!hasAnyLocation ? (
        <p className="mt-2 flex items-start gap-2 text-[12px] text-[#64748B]">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2F6EF6]" aria-hidden />
          {t('mapSelectPrompt')}
        </p>
      ) : preferTextSummary || !hasApproxPin ? (
        <div className="mt-2 space-y-1 text-start text-[12px] text-[#53637A]">
          {city || area ? (
            <p className="font-semibold text-[#0D2046]">
              {[city, area].filter(Boolean).join(locale === 'ar' ? ' · ' : ' · ')}
            </p>
          ) : null}
          {approxText ? <p>{approxText}</p> : null}
          {hasApproxPin ? (
            <p className="text-[11px] text-[#8A96A8]">{t('mapApproxPinSet')}</p>
          ) : (
            <p className="text-[11px] text-[#8A96A8]">{t('mapApproxPinMissing')}</p>
          )}
        </div>
      ) : (
        <div className="mt-2">
          <PublicApproxLocation
            city={city}
            area={area}
            approximateLocation={approxText || t('mapApproxFallback')}
            latitudeApprox={lat}
            longitudeApprox={lng}
            mapLabel={t('mapApproxOverlay')}
            textOnlyHint={t('mapTextOnlyHint')}
          />
        </div>
      )}
    </section>
  );
}
