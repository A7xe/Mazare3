import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import type { PublicPropertyDetail, PublicPropertySummary } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { MapPin, Star, Users, ChevronLeft } from 'lucide-react';
import { getPropertyTitle } from '@/lib/property-helpers';
import { VerifiedBadge } from './verified-badge';
import { AmenityPills } from './amenity-pills';
import { BookingPanel } from './booking-panel';
import { MobileBookCta } from './mobile-book-cta';
import { PropertyCard } from './property-card';
import { TrustBadges } from './trust-badges';
import { Badge } from '@/components/ui/badge';

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
    <div className="mx-auto max-w-7xl px-4 py-8 pb-28 sm:px-6 sm:pb-8 lg:px-8 lg:pb-8">
      <Link
        href="/search"
        className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted transition-colors hover:text-primary"
      >
        <ChevronLeft className={`h-4 w-4 ${locale === 'ar' ? 'rotate-180' : ''}`} />
        {tCommon('back')}
      </Link>

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-premium">
            <div className="grid gap-2 p-2 sm:grid-cols-2">
              {(property.images.length > 0
                ? property.images
                : [{ url: '', altAr: title, altEn: title }]
              ).map((img, i) => (
                <div
                  key={i}
                  className={`relative overflow-hidden rounded-2xl bg-primary-soft ${
                    i === 0 ? 'sm:col-span-2 aspect-[16/9]' : 'aspect-[4/3]'
                  }`}
                >
                  {img.url ? (
                    <>
                      <Image
                        src={img.url}
                        alt={locale === 'ar' ? img.altAr : img.altEn}
                        fill
                        className="object-cover"
                        sizes="(max-width: 1024px) 100vw, 66vw"
                        priority={i === 0}
                      />
                      {i === 0 && (
                        <div className="gradient-card-overlay absolute inset-0 opacity-60" />
                      )}
                    </>
                  ) : (
                    <div className="gradient-card-fallback flex h-full min-h-[200px] items-center justify-center p-8 text-primary-foreground">
                      {title}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-primary/10 bg-primary-soft/60 p-4 sm:p-5">
            <TrustBadges showSupport />
          </div>

          <div className="mt-8">
            <div className="flex flex-wrap items-start gap-3">
              <h1 className="text-2xl font-bold text-navy sm:text-3xl">{title}</h1>
              <VerifiedBadge status={property.verificationStatus} />
              {property.hasPlatformDeal && (
                <Badge variant="highlight">{tCommon('platformDeal')}</Badge>
              )}
            </div>

            <p className="mt-3 flex items-center gap-2 text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              {property.approximateLocation}
            </p>
            <p className="mt-1 text-xs text-muted">{t('approxLocationNote')}</p>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface px-3 py-1.5 font-semibold shadow-card">
                <Star className="h-4 w-4 fill-royal text-royal" />
                {property.rating} ({property.reviewCount})
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-muted">
                <Users className="h-4 w-4 text-primary" />
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
              <h2 className="text-xl font-semibold text-navy">{t('about')}</h2>
              <p className="mt-3 leading-relaxed text-muted">{description}</p>
            </section>

            <section className="mt-8">
              <h2 className="text-xl font-semibold text-navy">{tCommon('amenities')}</h2>
              <div className="mt-3">
                <AmenityPills keys={property.amenityKeys} max={8} />
              </div>
            </section>

            {rules.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-semibold text-navy">{tCommon('rules')}</h2>
                <ul className="mt-3 space-y-2 rounded-2xl border border-border bg-surface p-4 text-muted">
                  {rules.map((rule) => (
                    <li key={rule} className="flex gap-2 text-sm leading-relaxed">
                      <span className="text-primary">•</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <aside
          id="booking-panel"
          className="scroll-mt-24 lg:col-span-1 lg:sticky lg:top-24 lg:self-start"
        >
          <BookingPanel property={property} locale={locale} />
        </aside>
      </div>

      <MobileBookCta basePrice={property.basePrice} currency={property.currency} />

      {similar.length > 0 && (
        <section className="mt-16 border-t border-border pt-12 pb-24 lg:pb-8">
          <h2 className="text-xl font-semibold text-navy">{t('similarTitle')}</h2>
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
