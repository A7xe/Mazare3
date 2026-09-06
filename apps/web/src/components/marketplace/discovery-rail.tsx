import { Link } from '@/i18n/navigation';
import type { PublicPropertySummary } from '@mazare3/shared';
import { HomePropertyCard } from '@/components/home/home-property-card';
import { HomePropertyCarousel } from '@/components/home/home-property-carousel';
import { OffersSectionIcon, OffersSectionMotifs } from '@/components/home/offers-section-chrome';
import { offerSectionShellClass } from '@/components/home/offer-presentation';
import { cn } from '@/lib/utils';

interface DiscoveryRailProps {
  title: string;
  subtitle?: string;
  seeAllHref: string;
  seeAllLabel: string;
  properties: PublicPropertySummary[];
  sectionId?: string;
  layout?: 'scroll' | 'grid' | 'stack' | 'list' | 'carousel';
  contentDir?: 'rtl' | 'ltr';
  /** Promotional Offers zone (Homepage stack + Explore carousel). */
  tone?: 'default' | 'promotional';
}

export function DiscoveryRail({
  title,
  subtitle,
  seeAllHref,
  seeAllLabel,
  properties,
  sectionId,
  layout = 'scroll',
  contentDir = 'rtl',
  tone = 'default',
}: DiscoveryRailProps) {
  if (!properties.length) return null;

  if (layout === 'carousel') {
    return (
      <HomePropertyCarousel
        title={title}
        subtitle={subtitle}
        seeAllHref={seeAllHref}
        seeAllLabel={seeAllLabel}
        properties={properties}
        sectionId={sectionId}
        contentDir={contentDir}
        tone={tone}
      />
    );
  }

  const cardVariant = layout === 'stack' ? 'offer' : layout === 'list' ? 'rated' : 'feature';
  const sidebarLayout = layout === 'stack' || layout === 'list';
  const promotional = tone === 'promotional' && sidebarLayout;

  return (
    <section
      className={
        promotional
          ? cn(offerSectionShellClass, 'rounded-[18px] p-3.5')
          : sidebarLayout
            ? 'rounded-[18px] border border-[#E4EBF5] bg-white p-3.5 shadow-[0_6px_24px_rgba(35,72,120,.055)]'
            : 'py-1'
      }
      data-testid={sectionId ? `discovery-rail-${sectionId}` : 'discovery-rail'}
    >
      {promotional ? <OffersSectionMotifs /> : null}

      <div
        className={
          sidebarLayout
            ? 'relative mb-2.5 flex items-start justify-between gap-3'
            : 'mb-3.5 flex items-end justify-between gap-3'
        }
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            {promotional ? <OffersSectionIcon /> : null}
            <h2
              className={
                promotional
                  ? 'text-[17px] font-extrabold leading-tight tracking-tight text-[#0D2046]'
                  : sidebarLayout
                    ? 'text-[16px] font-bold leading-tight text-[#0D2046]'
                    : 'text-[20px] font-bold leading-tight text-[#0D2046]'
              }
            >
              {title}
            </h2>
          </div>

          {subtitle ? (
            <p
              className={
                promotional
                  ? 'mt-1 line-clamp-2 text-[10.5px] font-medium leading-relaxed text-[#53637A]'
                  : sidebarLayout
                    ? 'mt-1 line-clamp-1 text-[10px] font-medium leading-relaxed text-[#8794A7]'
                    : 'mt-1 text-[12px] font-medium leading-relaxed text-[#53637A]'
              }
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {seeAllHref ? (
          <Link
            href={seeAllHref}
            className={
              sidebarLayout
                ? 'relative shrink-0 text-[10px] font-semibold text-[#2F6EF6] hover:text-[#1D5FE8]'
                : 'shrink-0 text-[12px] font-semibold text-[#2F6EF6] hover:text-[#1D5FE8]'
            }
          >
            {seeAllLabel}
          </Link>
        ) : null}
      </div>

      {layout === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {properties.slice(0, 3).map((property) => (
            <HomePropertyCard key={property.id} property={property} variant="feature" />
          ))}
        </div>
      ) : layout === 'stack' || layout === 'list' ? (
        <div className="relative flex flex-col gap-2.5">
          {properties.slice(0, 1).map((property) => (
            <HomePropertyCard key={property.id} property={property} variant={cardVariant} />
          ))}
        </div>
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2">
          {properties.map((property) => (
            <div key={property.id} className="w-[76%] max-w-[260px] shrink-0 snap-start sm:w-[248px]">
              <HomePropertyCard property={property} variant="feature" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
