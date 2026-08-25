'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  APPROX_RADIUS_METERS,
  AREA_MAP_ZOOM,
  DEFAULT_MAP_ZOOM,
  EXACT_MAP_ZOOM,
  JORDAN_MAP_CENTER,
  getMapTileConfig,
} from '@/lib/map-config';

export type MapPoint = { lat: number; lng: number };

export type LeafletMapMode = 'picker' | 'approx-readonly' | 'exact-readonly';

export type LeafletInteractiveMapProps = {
  mode: LeafletMapMode;
  exact?: MapPoint | null;
  approx?: MapPoint | null;
  pickTarget?: 'exact' | 'approx';
  onExactChange?: (lat: number, lng: number) => void;
  onApproxChange?: (lat: number, lng: number) => void;
  overlayLabel: string;
  testId: string;
};

function pinIcon(kind: 'exact' | 'approx', active: boolean) {
  return L.divIcon({
    className: `mazare3-pin mazare3-pin-${kind}${active ? ' mazare3-pin-active' : ''}`,
    html: `<span class="mazare3-pin-dot" data-testid="map-pin-${kind}"></span>`,
    iconSize: [28, 36],
    iconAnchor: [14, 36],
  });
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const t = window.setTimeout(() => map.invalidateSize(), 80);
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
    };
  }, [map]);
  return null;
}

function Recenter({ point, zoom }: { point: MapPoint; zoom: number }) {
  const map = useMap();
  const prev = useRef('');
  useEffect(() => {
    const key = `${point.lat.toFixed(6)},${point.lng.toFixed(6)},${zoom}`;
    if (prev.current === key) return;
    prev.current = key;
    map.setView([point.lat, point.lng], zoom);
  }, [point.lat, point.lng, zoom, map]);
  return null;
}

function MapClick({
  enabled,
  onPick,
}: {
  enabled: boolean;
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (!enabled) return;
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LeafletInteractiveMap({
  mode,
  exact: exactProp,
  approx: approxProp,
  pickTarget = 'exact',
  onExactChange,
  onApproxChange,
  overlayLabel,
  testId,
}: LeafletInteractiveMapProps) {
  const tiles = getMapTileConfig();
  const exact = mode === 'approx-readonly' ? null : (exactProp ?? null);
  const approx = mode === 'exact-readonly' ? null : (approxProp ?? null);

  const viewPoint = useMemo(() => {
    if (mode === 'approx-readonly') return approx ?? JORDAN_MAP_CENTER;
    if (mode === 'exact-readonly') return exact ?? JORDAN_MAP_CENTER;
    if (pickTarget === 'approx' && approx) return approx;
    return exact ?? approx ?? JORDAN_MAP_CENTER;
  }, [mode, pickTarget, exact, approx]);

  const zoom = useMemo(() => {
    if (mode === 'exact-readonly' && exact) return EXACT_MAP_ZOOM;
    if (mode === 'approx-readonly' && approx) return AREA_MAP_ZOOM;
    if (exact || approx) return AREA_MAP_ZOOM;
    return DEFAULT_MAP_ZOOM;
  }, [mode, exact, approx]);

  const exactIcon = useMemo(() => pinIcon('exact', pickTarget === 'exact'), [pickTarget]);
  const approxIcon = useMemo(() => pinIcon('approx', pickTarget === 'approx'), [pickTarget]);

  if (mode === 'approx-readonly' && !approx) return null;
  if (mode === 'exact-readonly' && !exact) return null;

  const picker = mode === 'picker';
  const dataExact = exact && mode !== 'approx-readonly' ? exact : null;
  const dataApprox = approx && mode !== 'exact-readonly' ? approx : null;

  return (
    <div
      className="mazare3-map relative h-[280px] w-full overflow-hidden rounded-2xl border border-primary/15 md:h-[360px] lg:h-[380px]"
      dir="ltr"
      data-testid={testId}
      data-exact-lat={dataExact ? String(dataExact.lat) : undefined}
      data-exact-lng={dataExact ? String(dataExact.lng) : undefined}
      data-approx-lat={dataApprox ? String(dataApprox.lat) : undefined}
      data-approx-lng={dataApprox ? String(dataApprox.lng) : undefined}
    >
      <div className="pointer-events-none absolute start-3 top-3 z-[1000] rounded-lg bg-surface/95 px-3 py-1.5 text-xs font-semibold text-navy shadow-card">
        {overlayLabel}
      </div>
      <MapContainer
        center={[viewPoint.lat, viewPoint.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        style={{ height: '100%', width: '100%' }}
        attributionControl
        zoomControl
        maxZoom={19}
      >
        <TileLayer
          url={tiles.url}
          attribution={tiles.attribution}
          subdomains={tiles.subdomains}
        />
        <InvalidateSize />
        <Recenter point={viewPoint} zoom={zoom} />
        <MapClick
          enabled={picker}
          onPick={(lat, lng) => {
            if (pickTarget === 'approx') onApproxChange?.(lat, lng);
            else onExactChange?.(lat, lng);
          }}
        />
        {approx ? (
          <Circle
            center={[approx.lat, approx.lng]}
            radius={APPROX_RADIUS_METERS}
            pathOptions={{
              color: '#0e6ba8',
              fillColor: '#0e6ba8',
              fillOpacity: 0.14,
              weight: 2,
              dashArray: '6 6',
            }}
          />
        ) : null}
        {approx ? (
          <Marker
            position={[approx.lat, approx.lng]}
            draggable={picker}
            icon={approxIcon}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onApproxChange?.(lat, lng);
              },
            }}
          />
        ) : null}
        {exact ? (
          <Marker
            position={[exact.lat, exact.lng]}
            draggable={picker}
            icon={exactIcon}
            eventHandlers={{
              dragend: (e) => {
                const { lat, lng } = (e.target as L.Marker).getLatLng();
                onExactChange?.(lat, lng);
              },
            }}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
