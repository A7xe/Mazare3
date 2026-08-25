'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  approximateCoordsFromExact,
  formatCoordinateInput,
  isValidLatitude,
  isValidLongitude,
} from '@mazare3/shared';
import { Button } from '@/components/ui/button';
import { InteractiveMap } from '@/components/maps/dynamic-map';

type LocationFields = {
  latitudeExact: string;
  longitudeExact: string;
  latitudeApprox: string;
  longitudeApprox: string;
};

type Props = {
  latitudeExact: string;
  longitudeExact: string;
  latitudeApprox: string;
  longitudeApprox: string;
  onChange: (patch: Partial<LocationFields>) => void;
};

function parseCoord(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function toPoint(latRaw: string, lngRaw: string, latOk: (n: number) => boolean, lngOk: (n: number) => boolean) {
  const lat = parseCoord(latRaw);
  const lng = parseCoord(lngRaw);
  if (lat == null || lng == null || !latOk(lat) || !lngOk(lng)) return null;
  return { lat, lng };
}

export function OwnerLocationPicker({
  latitudeExact,
  longitudeExact,
  latitudeApprox,
  longitudeApprox,
  onChange,
}: Props) {
  const t = useTranslations('ownerProperty');
  const [pickTarget, setPickTarget] = useState<'exact' | 'approx'>('exact');
  const [geoAvailable, setGeoAvailable] = useState(false);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);

  useEffect(() => {
    setGeoAvailable(typeof navigator !== 'undefined' && 'geolocation' in navigator);
  }, []);

  const exact = useMemo(
    () => toPoint(latitudeExact, longitudeExact, isValidLatitude, isValidLongitude),
    [latitudeExact, longitudeExact],
  );
  const approx = useMemo(
    () => toPoint(latitudeApprox, longitudeApprox, isValidLatitude, isValidLongitude),
    [latitudeApprox, longitudeApprox],
  );

  function setExact(lat: number, lng: number) {
    onChange({
      latitudeExact: formatCoordinateInput(lat),
      longitudeExact: formatCoordinateInput(lng),
    });
  }

  function setApprox(lat: number, lng: number) {
    onChange({
      latitudeApprox: formatCoordinateInput(lat),
      longitudeApprox: formatCoordinateInput(lng),
    });
  }

  function generateApprox() {
    if (!exact) return;
    const generated = approximateCoordsFromExact(exact.lat, exact.lng);
    if (!generated) return;
    setApprox(generated.latitudeApprox, generated.longitudeApprox);
    setPickTarget('approx');
  }

  function useCurrentLocation() {
    if (!geoAvailable) return;
    setGeoMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setExact(pos.coords.latitude, pos.coords.longitude);
        setPickTarget('exact');
      },
      () => setGeoMessage(t('geoDenied')),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <div>
        <p className="text-sm font-medium text-navy">{t('exactMapTitle')}</p>
        <p className="mt-1 text-xs text-muted">{t('exactMapHint')}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={pickTarget === 'exact' ? 'default' : 'outline'}
          data-testid="owner-map-pick-exact"
          onClick={() => setPickTarget('exact')}
        >
          {t('placeExactOnMap')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={pickTarget === 'approx' ? 'default' : 'outline'}
          data-testid="owner-map-pick-approx"
          onClick={() => setPickTarget('approx')}
        >
          {t('placeApproxOnMap')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!exact}
          data-testid="owner-generate-approx"
          onClick={generateApprox}
        >
          {t('generateApproxFromExact')}
        </Button>
        {geoAvailable ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            data-testid="owner-use-my-location"
            onClick={useCurrentLocation}
          >
            {t('useMyLocation')}
          </Button>
        ) : null}
      </div>
      {geoMessage ? <p className="text-xs text-muted">{geoMessage}</p> : null}
      <div
        data-testid="owner-location-map"
        data-exact-lat={exact ? String(exact.lat) : undefined}
        data-exact-lng={exact ? String(exact.lng) : undefined}
        data-approx-lat={approx ? String(approx.lat) : undefined}
        data-approx-lng={approx ? String(approx.lng) : undefined}
      >
        <InteractiveMap
          mode="picker"
          exact={exact}
          approx={approx}
          pickTarget={pickTarget}
          onExactChange={setExact}
          onApproxChange={setApprox}
          overlayLabel={pickTarget === 'approx' ? t('approxMapTitle') : t('exactMapTitle')}
          testId="owner-location-map-canvas"
        />
      </div>
      <p className="text-xs text-muted">{t('mapManualFallback')}</p>
    </div>
  );
}
