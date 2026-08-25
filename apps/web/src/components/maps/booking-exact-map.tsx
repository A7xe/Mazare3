'use client';

import { isValidLatitude, isValidLongitude } from '@mazare3/shared';
import { InteractiveMap } from '@/components/maps/dynamic-map';

type Props = {
  latitudeExact: number | null;
  longitudeExact: number | null;
  label: string;
  testId: string;
};

export function BookingExactMap({ latitudeExact, longitudeExact, label, testId }: Props) {
  if (latitudeExact == null || longitudeExact == null) return null;
  const lat = typeof latitudeExact === 'number' ? latitudeExact : Number(latitudeExact);
  const lng = typeof longitudeExact === 'number' ? longitudeExact : Number(longitudeExact);
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) {
    return null;
  }

  return (
    <div
      className="mt-3"
      data-testid={testId}
      data-exact-lat={String(lat)}
      data-exact-lng={String(lng)}
    >
      <InteractiveMap
        mode="exact-readonly"
        exact={{ lat, lng }}
        overlayLabel={label}
        testId={`${testId}-canvas`}
      />
    </div>
  );
}
