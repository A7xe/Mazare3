import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { PublicPropertyDetail, PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { MapPin, Star, Users, ChevronLeft } from 'lucide-react';
import { getPropertyTitle } from '@/lib/property-helpers';
import { VerifiedBadge } from './verified-badge';
import { AmenityPills } from './amenity-pills';
import { BookingPanel } from './booking-panel';
import { PropertyCard } from './property-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface PropertyDetailViewProps {
  property: PublicPropertyDetail;
  similar: PublicPropertySummary[];
  locale: 'ar' | 'en';
}

export async function PropertyDetailView({ property, similar, locale }: PropertyDetailViewProps) {
  const t = await getTranslations('property');
  const tCommon = await getTranslations('common');
  const title = getPropertyTitle(property, locale);
  const description = locale === 'ar' ? property.descriptionAr : property.descriptionEn;
  const rules = locale === 'ar' ? property.rulesAr : property.rulesEn;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/search"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {tCommon('back')}
      </Link>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {(property.images.length > 0
              ? property.images
              : [{ url: '', altAr: title, altEn: title }]
            ).map((img, i) => (
              <div
                key={i}
                className={`relative overflow-hidden rounded-2xl bg-background ${i === 0 ? 'sm:col-span-2 aspect-[16/9]' : 'aspect-[4/3]'}`}
              >
                {img.url ? (
                  <Image
                    src={img.url}
                    alt={locale === 'ar' ? img.altAr : img.altEn}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 66vw"
                    priority={i === 0}
                  />
                ) : (
                  <div className="gradient-card-fallback flex h-full min-h-[200px] items-center justify-center p-8 text-primary-foreground">
                    {title}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
              <VerifiedBadge status={property.verificationStatus} />
              {property.hasPlatformDeal && (
                <Badge variant="accent">{tCommon('platformDeal')}</Badge>
              )}
            </div>

            <p className="mt-2 flex items-center gap-2 text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {property.approximateLocation}
            </p>
            <p className="mt-1 text-xs text-muted">{t('approxLocationNote')}</p>

            <div className="mt-4 flex flex-wrap gap-4 text-sm">
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-accent text-accent" />
                {property.rating} ({property.reviewCount})
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Users className="h-4 w-4" />
                {property.capacity} {tCommon('guests')}
              </span>
              {property.allowsFamilies && (
                <Badge variant="muted">{tCommon('families')}</Badge>
              )}
              {property.allowsYouth && <Badge variant="muted">{tCommon('youth')}</Badge>}
              {property.allowsOvernight ? (
                <Badge variant="muted">{tCommon('overnight')}</Badge>
              ) : (
                <Badge variant="muted">{tCommon('dayUse')}</Badge>
              )}
            </div>

            <section className="mt-10">
              <h2 className="text-xl font-semibold">{t('about')}</h2>
              <p className="mt-3 leading-relaxed text-muted">{description}</p>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold">{tCommon('amenities')}</h2>
              <div className="mt-3">
                <AmenityPills keys={property.amenityKeys} max={8} />
              </div>
            </section>

            {rules.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold">{tCommon('rules')}</h2>
                <ul className="mt-3 list-inside list-disc space-y-2 text-muted">
                  {rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          <BookingPanel property={property} locale={locale} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 p-4 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted">{tCommon('from')}</p>
            <p className="text-lg font-semibold">
              {property.basePrice} {property.currency}
            </p>
          </div>
          <Button disabled className="flex-1">
            {tCommon('bookNow')} — {tCommon('comingSoon')}
          </Button>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-16 pb-24 lg:pb-8">
          <h2 className="text-xl font-semibold">{t('similarTitle')}</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {similar.map((p) => (
              <PropertyCard key={p.id} property={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
