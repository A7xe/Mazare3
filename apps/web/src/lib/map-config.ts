/** Default view when a property has no coordinates yet (Jordan). */
export const JORDAN_MAP_CENTER = { lat: 31.95, lng: 35.91 } as const;

export const DEFAULT_MAP_ZOOM = 8;
export const AREA_MAP_ZOOM = 13;
export const EXACT_MAP_ZOOM = 16;

/** Visual uncertainty radius for the public/approximate pin (meters). */
export const APPROX_RADIUS_METERS = 1200;

const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapTileConfig = {
  url: string;
  attribution: string;
  subdomains: string;
};

/**
 * Tile URL/style is environment-configurable. Local default is OpenStreetMap.
 * Production may replace NEXT_PUBLIC_MAP_TILE_URL later — do not hardcode a commercial provider.
 */
export function getMapTileConfig(): MapTileConfig {
  const url = (process.env.NEXT_PUBLIC_MAP_TILE_URL ?? '').trim() || OSM_TILE_URL;
  const attribution =
    (process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? '').trim() || OSM_ATTRIBUTION;
  const subdomains = (process.env.NEXT_PUBLIC_MAP_TILE_SUBDOMAINS ?? '').trim() || 'abc';
  return { url, attribution, subdomains };
}
