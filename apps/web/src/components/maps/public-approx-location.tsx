'use client';

import { isValidLatitude, isValidLongitude } from '@mazare3/shared';
import { InteractiveMap } from '@/components/maps/dynamic-map';

type Props = {
  city: string;
  area: string;
  approximateLocation: string;
  latitudeApprox?: number | null;
  longitudeApprox?: number | null;
  mapLabel: string;
  textOnlyHint: string;
};

export function PublicApproxLocation({
  city,
  area,
  approximateLocation,
  latitudeApprox,
  longitudeApprox,
  mapLabel,
  textOnlyHint,
}: Props) {
  const hasApprox =
    typeof latitudeApprox === 'number' &&
    typeof longitudeApprox === 'number' &&
    isValidLatitude(latitudeApprox) &&
    isValidLongitude(longitudeApprox);

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">{approximateLocation}</p>
      {hasApprox ? (
        <div
          data-testid="public-approx-map"
          data-approx-lat={String(latitudeApprox)}
          data-approx-lng={String(longitudeApprox)}
        >
          <InteractiveMap
            mode="approx-readonly"
            approx={{ lat: latitudeApprox, lng: longitudeApprox }}
            overlayLabel={mapLabel}
            testId="public-approx-map-canvas"
          />
        </div>
      ) : (
        <p className="text-sm text-muted" data-testid="public-location-text-only">
          {city} · {area}
          {textOnlyHint ? ` — ${textOnlyHint}` : ''}
        </p>
      )}
    </div>
  );
}
