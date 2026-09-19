import type { ComponentType } from 'react';
import { getTranslations } from 'next-intl/server';
import type { AvailabilityPeriod, PublicPropertyDetail, PublicPropertySummary } from '@mazare3/shared';
import {
  BadgeCheck,
  Bath,
  BedDouble,
  ChevronLeft,
  Flower2,
  Home,
  MapPin,
  Shield,
  Star,
  Users,
  Waves,
  LandPlot,
  Trees,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { getPropertyTitle, shouldShowVerificationBadge } from '@/lib/property-helpers';
import { AmenityPills } from './amenity-pills';
import { PropertyBookingAside } from './property-booking-aside';
import { MobileBookCta } from './mobile-book-cta';
import { PropertyCard } from './property-card';
import { PropertyDetailGallery } from './property-detail-gallery';
import { PropertyAboutText } from './property-about-text';
import { PropertyPoolSafetyDisclosure } from './property-pool-safety-disclosure';
import { PropertyRatingBreakdown } from './property-rating-breakdown';
import { PropertyDetailMapCard } from './property-detail-map-card';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { PublicPropertyBreadcrumbTitle } from '@/components/layout/public-property-breadcrumb-title';

interface PropertyDetailViewProps {
  property: PublicPropertyDetail;
  similar: PublicPropertySummary[];
  locale: 'ar' | 'en';
  initialDate?: string;
  initialPeriod?: AvailabilityPeriod;
  initialGuests?: number;
  rebookId?: string;
}

function FeatureTag({
  icon: Icon,
  label,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-[9px] border border-[#D5DEE9] bg-white px-2.5 text-[11px] font-extrabold text-[#0D2046]">
      <Icon className="h-3 w-3 text-[#2F6EF6]" aria-hidden />
      {label}
    </span>
  );
}

function SpecItem({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Icon className="h-[22px] w-[22px] shrink-0 text-[#2F6EF6]" aria-hidden />
      <div className="min-w-0 text-start">
        <p className="truncate text-[11px] font-medium leading-none text-[#8A94A6]">{label}</p>
        <p className="mt-1 truncate text-[12px] font-extrabold leading-snug text-[#0D2046]">
          {value}
        </p>
      </div>
    </div>
  );
}

export async function PropertyDetailView({
  property,
  similar,
  locale,
  initialDate,
  initialPeriod,
  initialGuests,
  rebookId,
}: PropertyDetailViewProps) {
  const t = await getTranslations('property');
  const tCommon = await getTranslations('common');
  const tSearch = await getTranslations('search');
  const title = getPropertyTitle(property, locale);
  const description = locale === 'ar' ? property.descriptionAr : property.descriptionEn;
  const rules = locale === 'ar' ? property.rulesAr : property.rulesEn;
  const reviews = property.reviews ?? [];
  const verified = shouldShowVerificationBadge(property.verificationStatus);
  const typeLabel = tSearch(`propertyType.${property.type}`);
  const entireTypeLabel = t('entireType', { type: typeLabel });
  const locationLine = `${property.city}، ${property.area}`;

  const featureTags: { key: string; icon: ComponentType<{ className?: string }>; label: string }[] =
    [];
  if (property.hasPool) {
    featureTags.push({ key: 'pool', icon: Waves, label: t('tagPrivatePool') });
  }
  if (property.hasFootballField || property.amenityKeys.includes('football')) {
    featureTags.push({ key: 'field', icon: LandPlot, label: t('tagField') });
  }
  if (property.amenityKeys.includes('bbq') || property.amenityKeys.includes('garden')) {
    featureTags.push({ key: 'outdoor', icon: Trees, label: t('tagOutdoor') });
  }
  featureTags.push({ key: 'type', icon: Home, label: entireTypeLabel });
  featureTags.push({ key: 'privacy', icon: Shield, label: t('tagFullPrivacy') });

  const specs: { key: string; icon: ComponentType<{ className?: string }>; label: string; value: string }[] =
    [
      { key: 'privacy', icon: Flower2, label: t('specPrivacy'), value: t('tagFullPrivacy') },
      { key: 'type', icon: Home, label: t('specType'), value: entireTypeLabel },
      {
        key: 'guests',
        icon: Users,
        label: t('specGuests'),
        value: t('upToGuests', { count: property.capacity }),
      },
    ];
  if (property.bathrooms > 0) {
    specs.push({
      key: 'bathrooms',
      icon: Bath,
      label: t('specBathrooms'),
      value: t('bathroomsCount', { count: property.bathrooms }),
    });
  }
  if (property.bedrooms > 0) {
    specs.push({
      key: 'bedrooms',
      icon: BedDouble,
      label: t('specBedrooms'),
      value: t('bedroomsCount', { count: property.bedrooms }),
    });
  }
  if (property.poolsCount > 0 || property.hasPool) {
    specs.push({
      key: 'pool',
      icon: Waves,
      label: t('specPool'),
      value:
        property.poolsCount > 0
          ? t('poolsCount', { count: property.poolsCount })
          : t('tagPrivatePool'),
    });
  }

  return (
    <MarketplacePageShell className="py-5 pb-28 sm:py-6 sm:pb-10 lg:pb-12">
      <PublicPropertyBreadcrumbTitle title={title} />
      <div className="mb-4 flex lg:hidden">
        <Link
          href="/search"
          className="ms-auto inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#D8E0EA] bg-white px-4 text-[13px] font-medium text-[#0D2046] shadow-[0_2px_8px_rgba(13,32,70,0.04)] transition hover:border-[#2F6EF6]/40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {tCommon('back')}
        </Link>
      </div>

      <div className="grid items-start gap-x-5 gap-y-3 lg:grid-cols-[minmax(0,1fr)_minmax(300px,340px)] lg:gap-x-7 lg:gap-y-3 xl:grid-cols-[minmax(0,1fr)_minmax(320px,360px)] xl:gap-x-8">
        {/* Title — same row as back button on desktop */}
        <div className="flex min-w-0 flex-wrap items-center gap-2 lg:col-start-1 lg:row-start-1">
          <h1 className="text-[1.75rem] font-heading leading-tight tracking-tight text-[#0D2046] sm:text-[2rem]">
            {title}
          </h1>
          {verified ? (
            <BadgeCheck
              className="h-[22px] w-[22px] shrink-0 fill-[#2F6EF6] text-white"
              aria-label={t('verified')}
            />
          ) : null}
        </div>

        <div className="hidden lg:col-start-2 lg:row-start-1 lg:flex lg:items-center lg:justify-end">
          <Link
            href="/search"
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-[#D8E0EA] bg-white px-4 text-[13px] font-medium text-[#0D2046] shadow-[0_2px_8px_rgba(13,32,70,0.04)] transition hover:border-[#2F6EF6]/40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {tCommon('back')}
          </Link>
        </div>

        {/* Location / rating / tags — booking starts beside this row */}
        <div className="text-start lg:col-start-1 lg:row-start-2">
          <p className="inline-flex items-center gap-1.5 text-[14px] font-normal text-[#6B7280]">
            <MapPin className="h-4 w-4 shrink-0 text-[#6B7280]" strokeWidth={1.75} aria-hidden />
            {locationLine}
          </p>

          {property.reviewCount > 0 ? (
            <p
              className="mt-1 flex flex-wrap items-center gap-1.5 text-[14px]"
              data-testid="property-header-rating"
            >
              <span className="inline-flex items-center gap-0.5" aria-hidden>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-3.5 w-3.5 ${
                      i < Math.round(property.rating)
                        ? 'fill-[#F5B301] text-[#F5B301]'
                        : 'fill-transparent text-[#D0D7E2]'
                    }`}
                  />
                ))}
              </span>
              <span className="font-bold text-[#0D2046]">{property.rating.toFixed(1)}</span>
              <span className="font-normal text-[#6B7280]">({property.reviewCount})</span>
            </p>
          ) : null}

          {featureTags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2 ps-4 sm:ps-24">
              {featureTags.map((tag) => (
                <FeatureTag key={tag.key} icon={tag.icon} label={tag.label} />
              ))}
            </div>
          ) : null}
        </div>

        {/* Main column content */}
        <div className="min-w-0 space-y-5 lg:col-start-1 lg:row-start-3 lg:space-y-6">
          <PropertyDetailGallery
            images={property.images}
            title={title}
            locale={locale}
            showBestSeller={Boolean(property.isFeatured || property.isSponsored)}
          />

          <div
            className="-mt-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 rounded-[22px] border border-[#E5EAF1] bg-white px-5 py-4 sm:-mt-3 sm:px-6 sm:py-5"
            data-testid="property-specs"
          >
            {specs.map((s) => (
              <SpecItem key={s.key} icon={s.icon} label={s.label} value={s.value} />
            ))}
          </div>

          <div className="grid gap-4 pt-1 md:grid-cols-2 md:gap-5">
            <section
              data-testid="property-reviews-list"
              className="rounded-[18px] border border-[#E5EAF1] bg-white p-5 sm:p-6"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-[17px] font-bold text-[#0D2046]">{t('guestReviews')}</h2>
                {reviews.length > 0 ? (
                  <a
                    href="#guest-reviews-full"
                    className="shrink-0 text-[13px] font-semibold text-[#2F6EF6] hover:underline"
                  >
                    {t('viewAll')}
                  </a>
                ) : null}
              </div>
              <PropertyRatingBreakdown
                rating={property.rating}
                reviewCount={property.reviewCount}
                reviews={reviews}
              />
            </section>

            <section className="rounded-[18px] border border-[#E5EAF1] bg-white p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0D2046]">{t('about')}</h2>
              <div className="mt-3">
                <PropertyAboutText text={description} />
              </div>
            </section>
          </div>

          <section>
            <h2 className="text-lg font-bold text-[#0D2046]">{tCommon('amenities')}</h2>
            <div className="mt-3">
              <AmenityPills keys={property.amenityKeys} max={12} />
            </div>
          </section>

          <PropertyPoolSafetyDisclosure property={property} />

          {rules.length > 0 ? (
            <section>
              <h2 className="text-lg font-bold text-[#0D2046]">{tCommon('rules')}</h2>
              <ul className="mt-3 space-y-2 rounded-2xl border border-[#E8EEF5] bg-white p-4 text-[#5B6B7C]">
                {rules.map((rule) => (
                  <li key={rule} className="flex gap-2 text-sm leading-relaxed">
                    <span className="text-[#2F6EF6]">•</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {reviews.length > 0 ? (
            <section id="guest-reviews-full" className="scroll-mt-24">
              <h2 className="text-lg font-bold text-[#0D2046]">{t('guestReviews')}</h2>
              <ul className="mt-4 space-y-3">
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="rounded-2xl border border-[#E8EEF5] bg-white p-4 shadow-[0_4px_16px_rgba(13,32,70,0.04)]"
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-[#0D2046]">
                      <Star className="h-4 w-4 fill-[#F5B301] text-[#F5B301]" />
                      {review.rating}/5 · {review.customerDisplayName}
                    </div>
                    {review.comment ? (
                      <p className="mt-2 text-sm leading-relaxed text-[#5B6B7C]">{review.comment}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        {/* Sidebar — starts under the back button (same row as location/tags) */}
        <aside className="relative space-y-4 lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:self-start">
          <div id="booking-entry" className="scroll-mt-24 space-y-4">
            <PropertyBookingAside
              property={property}
              locale={locale}
              initialDate={initialDate}
              initialPeriod={initialPeriod}
              initialGuests={initialGuests}
              rebookId={rebookId}
            />

            <PropertyDetailMapCard
              city={property.city}
              area={property.area}
              approximateLocation={property.approximateLocation}
              latitudeApprox={property.latitudeApprox}
              longitudeApprox={property.longitudeApprox}
              locationLine={locationLine}
            />
          </div>
        </aside>
      </div>

      <MobileBookCta
        propertySlug={property.slug}
        basePrice={property.basePrice}
        currency={property.currency}
        exact={Boolean(initialDate && initialPeriod)}
      />

      {similar.length > 0 ? (
        <section className="mt-14 border-t border-[#E8EEF5] pt-10 pb-36">
          <h2 className="text-xl font-bold text-[#0D2046]">{t('similarTitle')}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      ) : null}
    </MarketplacePageShell>
  );
}
