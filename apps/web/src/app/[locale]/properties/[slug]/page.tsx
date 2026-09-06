import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchPropertyBySlug } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { PropertyDetailView } from '@/components/marketplace/property-detail-view';
import { ErrorState } from '@/components/marketplace/error-state';
import { getTranslations } from 'next-intl/server';
import { AVAILABILITY_PERIODS, type AvailabilityPeriod } from '@mazare3/shared';
import { Link } from '@/i18n/navigation';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(raw: Record<string, string | string[] | undefined>, key: string) {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function PropertyDetailPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('property');
  const raw = await searchParams;
  const date = first(raw, 'date') || undefined;
  const periodRaw = first(raw, 'period');
  const period =
    periodRaw && (AVAILABILITY_PERIODS as readonly string[]).includes(periodRaw)
      ? (periodRaw as AvailabilityPeriod)
      : undefined;
  const guestsRaw = first(raw, 'guests');
  const guests = guestsRaw ? Number(guestsRaw) : undefined;
  const rebookId = first(raw, 'rebook') || undefined;

  try {
    const { property, similar } = await fetchPropertyBySlug(slug);
    return (
      <PropertyDetailView
        property={property}
        similar={similar}
        locale={locale as 'ar' | 'en'}
        initialDate={rebookId ? undefined : date}
        initialPeriod={rebookId ? undefined : period}
        initialGuests={Number.isFinite(guests) ? guests : undefined}
        rebookId={rebookId}
      />
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      if (rebookId) {
        return (
          <MarketplacePageShell className="py-16 text-center">
            <div className="mx-auto max-w-lg">
              <h1 className="text-xl font-semibold text-navy">{t('rebookUnavailable')}</h1>
              <p className="mt-2 text-sm text-muted">{t('rebookUnavailableHint')}</p>
              <p className="mt-6">
                <Link href="/search" className="font-medium text-primary">
                  {t('rebookSearchCta')}
                </Link>
              </p>
            </div>
          </MarketplacePageShell>
        );
      }
      notFound();
    }

    return (
      <MarketplacePageShell className="py-16">
        <ErrorState
          title={t('errorTitle')}
          description={err instanceof ApiError ? err.message : t('errorGeneric')}
        />
      </MarketplacePageShell>
    );
  }
}
