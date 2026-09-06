'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { Grid2X2, Play, Star } from 'lucide-react';

type GalleryImage = { url: string; altAr: string; altEn: string };

type Props = {
  images: GalleryImage[];
  title: string;
  locale: 'ar' | 'en';
  showBestSeller?: boolean;
};

/** Thumbnail strip matches mockup: 7 equal landscape tiles; last shows +N when more exist. */
const THUMB_COUNT = 7;

export function PropertyDetailGallery({ images, title, locale, showBestSeller }: Props) {
  const t = useTranslations('property');
  const [active, setActive] = useState(0);

  const list = useMemo(() => {
    if (images.length > 0) return images;
    return [{ url: '', altAr: title, altEn: title }];
  }, [images, title]);

  const current = list[Math.min(active, list.length - 1)] ?? list[0];
  const thumbs = list.slice(0, Math.min(THUMB_COUNT, list.length));
  const overflow = Math.max(0, list.length - THUMB_COUNT);

  return (
    <div className="space-y-3" data-testid="property-gallery">
      <div className="relative aspect-[21/9] overflow-hidden rounded-[20px] bg-[#E8F1F8] shadow-[0_10px_28px_rgba(14,107,168,0.10)] sm:aspect-[3/1]">
        {current?.url ? (
          <Image
            src={current.url}
            alt={locale === 'ar' ? current.altAr : current.altEn}
            fill
            priority
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 70vw"
          />
        ) : (
          <div className="gradient-card-fallback flex h-full items-center justify-center p-8 text-primary-foreground">
            {title}
          </div>
        )}

        {showBestSeller ? (
          <span className="absolute start-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#2F6EF6] px-3 py-1.5 text-[12px] font-semibold text-white shadow-md">
            <Star className="h-3.5 w-3.5 fill-white" aria-hidden />
            {t('bestSeller')}
          </span>
        ) : null}

        <span className="absolute bottom-3.5 end-3.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white backdrop-blur-sm">
          {active + 1} / {list.length}
        </span>

        <div className="absolute bottom-3.5 start-3.5 flex flex-wrap justify-start gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[12px] font-medium text-[#0D2046] shadow-sm backdrop-blur-sm transition hover:bg-white disabled:opacity-70"
            disabled
            title={t('viewVideo')}
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {t('viewVideo')}
          </button>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/95 px-3.5 text-[12px] font-medium text-[#0D2046] shadow-sm backdrop-blur-sm transition hover:bg-white"
            onClick={() => setActive(0)}
            data-testid="gallery-view-photos"
          >
            <Grid2X2 className="h-3.5 w-3.5" aria-hidden />
            {t('viewPhotos')}
          </button>
        </div>
      </div>

      {list.length > 1 ? (
        <div className="grid grid-cols-7 gap-2.5 sm:gap-3">
          {thumbs.map((img, i) => {
            const isOverflowTile = i === THUMB_COUNT - 1 && overflow > 0;
            const selected =
              (!isOverflowTile && active === i) ||
              (isOverflowTile && active >= THUMB_COUNT - 1);
            return (
              <button
                key={`${img.url}-${i}`}
                type="button"
                onClick={() => setActive(isOverflowTile ? THUMB_COUNT - 1 : i)}
                className={`relative aspect-[16/10] overflow-hidden rounded-[12px] bg-[#E8F1F8] ring-2 transition ${
                  selected ? 'ring-[#2F6EF6]' : 'ring-transparent hover:ring-[#2F6EF6]/35'
                }`}
                aria-label={
                  isOverflowTile
                    ? t('thumbLabel', { n: list.length })
                    : t('thumbLabel', { n: i + 1 })
                }
                aria-pressed={selected}
              >
                {img.url ? (
                  <Image
                    src={img.url}
                    alt={locale === 'ar' ? img.altAr : img.altEn}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 14vw, 120px"
                  />
                ) : null}
                {isOverflowTile ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[15px] font-semibold tracking-tight text-white sm:text-base">
                    +{overflow}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
