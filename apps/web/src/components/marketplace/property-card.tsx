'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Heart, MapPin, Star, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import type { PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VerifiedBadge } from './verified-badge';
import { PriceDisplay } from './price-display';
import { AmenityPills } from './amenity-pills';
import { getPropertyTitle, getApproxLocation } from '@/lib/property-helpers';

interface PropertyCardProps {
  property: PublicPropertySummary;
}

export function PropertyCard({ property }: PropertyCardProps) {
  const locale = useLocale() as 'ar' | 'en';
  const t = useTranslations('common');

  const title = getPropertyTitle(property, locale);
  const location = getApproxLocation(property);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="h-full"
    >
      <Card className="group h-full overflow-hidden border-border/80 p-0 transition-shadow hover:shadow-soft">
        <Link href={`/properties/${property.slug}`} className="block">
          <div className="relative aspect-[4/3] overflow-hidden">
            {property.imageUrl ? (
              <Image
                src={property.imageUrl}
                alt={title}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
            ) : (
              <div className="gradient-card-fallback flex h-full flex-col items-center justify-center p-6 text-center text-primary-foreground">
                <p className="text-lg font-semibold">{title}</p>
                <p className="mt-1 text-sm opacity-90">{property.type}</p>
              </div>
            )}
            <div className="absolute start-3 top-3 flex flex-wrap gap-2">
              <VerifiedBadge status={property.verificationStatus} />
              {property.hasPlatformDeal && (
                <Badge variant="accent">{t('platformDeal')}</Badge>
              )}
            </div>
            <button
              type="button"
              className="absolute end-3 top-3 rounded-full bg-surface/90 p-2 shadow-card backdrop-blur-sm transition-colors hover:bg-surface"
              aria-label="Favorite"
              onClick={(e) => e.preventDefault()}
            >
              <Heart className="h-4 w-4 text-muted" />
            </button>
          </div>

          <div className="space-y-3 p-5">
            <div>
              <h3 className="line-clamp-1 font-semibold text-foreground">{title}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-muted">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="line-clamp-1">{location}</span>
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 font-medium">
                <Star className="h-4 w-4 fill-accent text-accent" />
                {property.rating}
                <span className="font-normal text-muted">
                  ({property.reviewCount} {t('reviews')})
                </span>
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Users className="h-4 w-4" />
                {property.capacity}
              </span>
            </div>

            <AmenityPills keys={property.amenityKeys} />

            <div className="flex items-end justify-between gap-2 pt-1">
              <PriceDisplay
                amount={property.basePrice}
                currency={property.currency}
                locale={locale}
                fromLabel={t('from')}
                perDayLabel={t('perDay')}
              />
              <span className="shrink-0 rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium">
                {t('viewDetails')}
              </span>
            </div>
          </div>
        </Link>
      </Card>
    </motion.div>
  );
}
