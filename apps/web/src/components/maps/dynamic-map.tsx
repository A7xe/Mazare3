'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { LeafletInteractiveMapProps } from './leaflet-map';

function MapSkeleton({ testId }: { testId?: string }) {
  return (
    <div
      className="flex h-[280px] w-full items-center justify-center rounded-2xl border border-primary/15 bg-primary-soft/40 text-sm text-muted md:h-[360px] lg:h-[380px]"
      data-testid={testId ? `${testId}-loading` : 'map-loading'}
    />
  );
}

const LeafletMap = dynamic<LeafletInteractiveMapProps>(
  () => import('./leaflet-map').then((mod) => mod.LeafletInteractiveMap),
  {
    ssr: false,
    loading: () => <MapSkeleton />,
  },
);

/** Mount Leaflet only when the map is near the viewport (bookings lists can have many pins). */
export function InteractiveMap(props: LeafletInteractiveMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => setVisible(true);
    if (typeof IntersectionObserver === 'undefined') {
      show();
      return;
    }
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > 0 && rect.top < (typeof window !== 'undefined' ? window.innerHeight : 0) + 120) {
      show();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          show();
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {visible ? <LeafletMap {...props} /> : <MapSkeleton testId={props.testId} />}
    </div>
  );
}
