'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { BadgeCheck, Moon, Percent, Sparkles } from 'lucide-react';
import type { ExploreCampaignId, ExploreCampaignTileModel } from '@mazare3/shared';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const CAMPAIGN_VISUAL: Record<
  ExploreCampaignId,
  {
    shell: string;
    iconWrap: string;
    icon: typeof Percent;
  }
> = {
  offers: {
    shell: 'border-[#F0D9A8]/90 bg-[linear-gradient(145deg,#FFF7E6_0%,#FFE8C2_55%,#FFFBF5_100%)]',
    iconWrap: 'bg-[#F59E0B] text-[#1A1205]',
    icon: Percent,
  },
  newlyAdded: {
    shell: 'border-[#E4D4FF]/95 bg-[linear-gradient(145deg,#F6F0FF_0%,#E9DCFF_55%,#FBFAFF_100%)]',
    iconWrap: 'bg-[#7C3AED] text-white',
    icon: Sparkles,
  },
  overnight: {
    shell: 'border-[#C7D2FE]/90 bg-[linear-gradient(145deg,#EEF2FF_0%,#C7D2FE_50%,#F8FAFF_100%)]',
    iconWrap: 'bg-[#312E81] text-white',
    icon: Moon,
  },
  featured: {
    shell: 'border-[#BFDBFE]/95 bg-[linear-gradient(145deg,#EEF5FF_0%,#DBEAFE_55%,#F8FBFF_100%)]',
    iconWrap: 'bg-[#2F6EF6] text-white',
    icon: BadgeCheck,
  },
};

type ExploreCampaignTilesProps = {
  tiles: ExploreCampaignTileModel[];
};

export function ExploreCampaignTiles({ tiles }: ExploreCampaignTilesProps) {
  const t = useTranslations('explore');
  const locale = useLocale();

  if (!tiles.length) return null;

  return (
    <section
      aria-label={t('campaignsLabel')}
      data-testid="explore-campaign-tiles"
      className="relative"
    >
      <div
        className={cn(
          '-mx-1 flex gap-3 overflow-x-auto px-1 pb-1',
          'snap-x snap-mandatory scroll-smooth',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {tiles.map((tile) => {
          const visual = CAMPAIGN_VISUAL[tile.id];
          const Icon = visual.icon;
          const title = t(`campaign.${tile.id}.title`);
          const subtitle = t(`campaign.${tile.id}.subtitle`);
          const href = searchHref('/search', tile.params);

          return (
            <Link
              key={tile.id}
              href={href}
              data-testid={`explore-campaign-tile-${tile.id}`}
              aria-label={`${title}. ${subtitle}`}
              className={cn(
                'relative flex w-[148px] shrink-0 snap-start flex-col overflow-hidden rounded-[18px] border p-3',
                'sm:w-[168px]',
                'shadow-[0_6px_18px_rgba(13,32,70,.06)]',
                'transition-[transform,box-shadow] duration-200',
                'motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-[0_10px_24px_rgba(13,32,70,.1)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6EF6]/45 focus-visible:ring-offset-2',
                visual.shell,
              )}
            >
              <div className="relative z-[1] flex items-start justify-between gap-2">
                <span
                  className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-[10px] shadow-sm',
                    visual.iconWrap,
                  )}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>

                {tile.imageUrl ? (
                  <div className="relative h-10 w-10 overflow-hidden rounded-[10px] ring-1 ring-black/5">
                    <Image
                      src={tile.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : null}
              </div>

              <div className="relative z-[1] mt-3 min-w-0">
                <h3 className="line-clamp-2 text-[13px] font-extrabold leading-snug text-[#0D2046]">
                  {title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[10.5px] font-medium leading-relaxed text-[#53637A]">
                  {subtitle}
                </p>
              </div>

              <span
                aria-hidden
                className={cn(
                  'pointer-events-none absolute -bottom-6 text-[64px] font-black leading-none opacity-[0.07]',
                  locale === 'ar' ? '-start-2' : '-end-2',
                  tile.id === 'offers' && 'text-[#F59E0B]',
                  tile.id === 'newlyAdded' && 'text-[#7C3AED]',
                  tile.id === 'overnight' && 'text-[#312E81]',
                  tile.id === 'featured' && 'text-[#2F6EF6]',
                )}
              >
                {tile.id === 'offers' ? '%' : tile.id === 'newlyAdded' ? 'N' : tile.id === 'overnight' ? '☾' : 'F'}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
