'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { MapPin, Users, Clock, Star } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { searchHref } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './verified-badge';
import { PriceDisplay } from './price-display';
import { AmenityPills } from './amenity-pills';
import { FavoriteButton } from '@/components/favorites/favorite-button';
import {
  PropertyOfferBadge,
  usePropertyOfferPresentation,
} from '@/components/marketplace/property-offer-indicators';
import { getPropertyTitle, getApproxLocation } from '@/lib/property-helpers';
import type { PropertySearchParams } from '@/lib/api-properties';

interface PropertyCardProps {
  property: PublicPropertySummary;
  searchIntent?: PropertySearchParams;
}

export function PropertyCard({ property, searchIntent }: PropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('common');
  const tSearch = useTranslations('search');
  const tProperty = useTranslations('property');
  const { badgeLabel, pricing } = usePropertyOfferPresentation(property);

  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);
  const match = property.searchMatch;
  const exact = property.pricingMode === 'exact_slot' && match?.slotPrice != null;
  const href = searchHref(`/properties/${property.slug}`, {
    date: searchIntent?.date ?? match?.matchedDate ?? undefined,
    period: searchIntent?.period ?? match?.matchedPeriod ?? undefined,
    guests: searchIntent?.guests,
  });

  let cta = tSearch('ctaViewAvailability');
  if (exact && searchIntent?.period && match?.matchedPeriod) cta = tSearch('ctaViewAndBook');
  else if (exact && (match?.matchingPeriodsCount ?? 0) > 1) cta = tSearch('ctaChoosePeriod');
  else if (exact) cta = tSearch('ctaViewAndBook');

  return (
    <Card
      data-testid="property-card"
      className="group relative h-full overflow-hidden border-border p-0 transition-all duration-200 hover:border-primary/25 hover:shadow-premium"
    >
      <div className="absolute end-3 top-3 z-20">
        <FavoriteButton propertyId={property.id} variant="overlay" />
      </div>
      <Link href={href} className="block h-full" data-testid={`property-card-${property.slug}`}>
        <div className="relative aspect-[4/3] overflow-hidden bg-primary-soft">
          {property.imageUrl ? (
            <Image
              src={property.imageUrl}
              alt={title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
              sizes="(max-width: 768px) 80vw, 33vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-navy">
              <p className="text-lg font-semibold">{title}</p>
            </div>
          )}
          <div className="absolute start-3 top-3 z-10 flex max-w-[60%] flex-wrap gap-2">
            <VerifiedBadge
              status={property.verificationStatus}
              hidden={Boolean(property.isSponsored || property.isFeatured || property.hasActivePromotion)}
            />
            {property.isSponsored ? (
              <Badge variant="muted" data-testid="placement-badge-sponsored">
                {t('sponsored')}
              </Badge>
            ) : property.isFeatured ? (
              <Badge variant="highlight" data-testid="placement-badge-featured">
                {t('featured')}
              </Badge>
            ) : null}
            {badgeLabel ? <PropertyOfferBadge label={badgeLabel} className="text-[10px]" /> : null}
          </div>
        </div>

        <div className="space-y-2.5 p-4">
          <div>
            <h3 className="line-clamp-1 text-base font-semibold text-navy group-hover:text-primary">
              {title}
            </h3>
            {property.reviewCount > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-sm text-navy" data-testid="property-card-rating">
                <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                <span className="font-medium">{property.rating.toFixed(1)}</span>
                <span className="text-muted">({property.reviewCount})</span>
              </p>
            ) : null}
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="line-clamp-1">
                {property.city} · {location}
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary-soft px-2 py-0.5 font-medium text-navy">
              <Users className="h-3.5 w-3.5 text-primary" />
              {property.capacity} {t('guests')}
            </span>
            <Badge variant="muted">{tSearch(`propertyType.${property.type}`)}</Badge>
            {property.hasPool && <Badge variant="muted">{tSearch('amenity.pool')}</Badge>}
            {property.allowsOvernight && <Badge variant="muted">{t('overnight')}</Badge>}
          </div>

          <AmenityPills keys={property.amenityKeys} max={3} />

          {exact && match ? (
            <div className="rounded-xl bg-primary-soft/70 px-3 py-2 text-sm">
              {match.matchedPeriod && (
                <p className="font-medium text-navy">{tProperty(`period.${match.matchedPeriod}`)}</p>
              )}
              {match.startAtLocal && match.endAtLocal && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  <Clock className="h-3 w-3" />
                  {match.startAtLocal} – {match.endAtLocal}
                </p>
              )}
              {(match.matchingPeriodsCount ?? 0) > 1 && !searchIntent?.period && (
                <p className="mt-0.5 text-xs text-muted">
                  {tSearch('matchingPeriods', { count: match.matchingPeriodsCount })}
                </p>
              )}
              <div className="mt-2">
                <PriceDisplay
                  amount={pricing.displayPrice}
                  currency={property.currency}
                  locale={locale}
                  exact
                  originalAmount={pricing.originalPrice ?? undefined}
                />
              </div>
              {match.depositAmount != null && (
                <p className="mt-1 text-xs text-muted">
                  {tSearch('depositNow', { amount: match.depositAmount })}
                  {match.remainingAmount != null
                    ? ` · ${tSearch('remainingLater', { amount: match.remainingAmount })}`
                    : ''}
                </p>
              )}
            </div>
          ) : (
            <PriceDisplay
              amount={pricing.displayPrice}
              currency={property.currency}
              locale={locale}
              fromLabel={t('from')}
              browseHint={tSearch('browsePriceHint')}
              originalAmount={pricing.originalPrice ?? undefined}
            />
          )}

          <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
            {cta}
          </span>
        </div>
      </Link>
    </Card>
  );
}
