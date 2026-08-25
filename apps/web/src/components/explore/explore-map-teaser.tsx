'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { Map, MapPinned } from 'lucide-react';
import { searchHref } from '@mazare3/shared';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import type { PropertySearchParams } from '@/lib/api-properties';
import { requestExploreUserLocation } from '@/lib/explore-location';

type Props = {
  title: string;
  subtitle: string;
  ctaLabel: string;
  filters?: PropertySearchParams;
};

export function ExploreMapTeaser({ title, subtitle, ctaLabel, filters = {} }: Props) {
  const t = useTranslations('explore');
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  async function onShowNearby() {
    setGeoHint(null);
    setLocating(true);
    const result = await requestExploreUserLocation();
    setLocating(false);

    if (!result.ok) {
      setGeoHint(t('geoDenied'));
      return;
    }

    startTransition(() => {
      router.push(
        searchHref(pathname, {
          ...filters,
          sort: 'distance_asc',
          lat: result.lat,
          lng: result.lng,
        }),
      );
    });
  }

  return (
    <section
      data-testid="explore-map-teaser"
      className="relative isolate min-h-[220px] overflow-hidden rounded-[22px] border border-[#DCE7F7] bg-[#F4F8FF] shadow-[0_8px_24px_rgba(31,70,120,.06)] sm:min-h-[240px]"
    >
      <Image
        src="/explore/location.png"
        alt=""
        fill
        className="z-0 object-cover object-center"
        sizes="(max-width: 1024px) 100vw, 480px"
        priority={false}
        aria-hidden
      />

      <div className="relative z-10 flex h-full min-h-[220px] flex-col justify-center p-5 sm:min-h-[240px] sm:p-6">
        <div className="max-w-md text-start">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[#2F6EF6] shadow-sm">
            <MapPinned className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="text-[18px] font-bold text-[#0D2046] sm:text-[20px]">{title}</h2>
          <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-[#6B7A90]">{subtitle}</p>
          <button
            type="button"
            disabled={locating}
            onClick={() => void onShowNearby()}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#2F6EF6] px-4 text-[13px] font-semibold text-white shadow-[0_8px_18px_rgba(47,110,246,.28)] transition hover:bg-[#1D5FE8] disabled:opacity-70"
          >
            <Map className="h-4 w-4" aria-hidden />
            {ctaLabel}
          </button>
          {geoHint ? (
            <p
              role="status"
              aria-live="polite"
              className="mt-2 text-[12px] font-medium text-[#6B7A90]"
              data-testid="explore-map-geo-hint"
            >
              {geoHint}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
