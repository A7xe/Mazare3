'use client';

import {
  parseMarketplaceUserCoords,
  roundMarketplaceUserCoord,
} from '@mazare3/shared';

export type ExploreLocationResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; reason: 'unsupported' | 'denied' | 'unavailable' };

/**
 * Request browser geolocation only when the user explicitly activates Nearest / map CTA.
 * Returns coarse marketplace precision; does not persist or log coordinates.
 */
export function requestExploreUserLocation(): Promise<ExploreLocationResult> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({ ok: false, reason: 'unsupported' });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = parseMarketplaceUserCoords(
          roundMarketplaceUserCoord(pos.coords.latitude),
          roundMarketplaceUserCoord(pos.coords.longitude),
        );
        if (!coords) {
          resolve({ ok: false, reason: 'unavailable' });
          return;
        }
        resolve({ ok: true, lat: coords.lat, lng: coords.lng });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          resolve({ ok: false, reason: 'denied' });
          return;
        }
        resolve({ ok: false, reason: 'unavailable' });
      },
      {
        enableHighAccuracy: false,
        timeout: 12_000,
        maximumAge: 60_000,
      },
    );
  });
}
