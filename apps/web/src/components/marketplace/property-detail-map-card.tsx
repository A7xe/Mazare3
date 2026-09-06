'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { isValidLatitude, isValidLongitude } from '@mazare3/shared';
import { MapPin } from 'lucide-react';
import { InteractiveMap } from '@/components/maps/dynamic-map';

type Props = {
  city: string;
  area: string;
  approximateLocation: string;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
  locationLine: string;
};

export function PropertyDetailMapCard({
  city,
  area,
  approximateLocation,
  latitudeApprox,
  longitudeApprox,
  locationLine,
}: Props) {
  const t = useTranslations('property');
  const [expanded, setExpanded] = useState(false);

  const hasApprox =
    typeof latitudeApprox === 'number' &&
    typeof longitudeApprox === 'number' &&
    isValidLatitude(latitudeApprox) &&
    isValidLongitude(longitudeApprox);

  return (
    <section
      className="overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_8px_30px_rgba(14,107,168,0.06)]"
      data-testid="property-location-section"
    >
      <div className={`relative bg-[#E8F1F8] ${expanded ? 'h-64' : 'h-40'}`}>
        {hasApprox ? (
          <div
            className="absolute inset-0"
            data-testid="public-approx-map"
            data-approx-lat={String(latitudeApprox)}
            data-approx-lng={String(longitudeApprox)}
          >
            <InteractiveMap
              mode="approx-readonly"
              approx={{ lat: latitudeApprox, lng: longitudeApprox }}
              overlayLabel={t('approxMapLabel')}
              testId="public-approx-map-canvas"
            />
          </div>
        ) : (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
            data-testid="public-location-text-only"
          >
            <MapPin className="h-10 w-10 text-[#2F6EF6]" aria-hidden />
            <p className="text-sm text-[#5B6B7C]">
              {city} · {area}
              {approximateLocation ? ` — ${approximateLocation}` : ''}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="text-sm text-[#5B6B7C]">{locationLine}</p>
        <p className="text-xs text-[#5B6B7C]">{t('approxLocationNote')}</p>
        <button
          type="button"
          className="inline-flex w-full items-center justify-center rounded-xl bg-[#2F6EF6] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#2563EB]"
          onClick={() => setExpanded((v) => !v)}
        >
          {t('showOnMap')}
        </button>
      </div>
    </section>
  );
}
