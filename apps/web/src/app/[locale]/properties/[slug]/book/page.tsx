import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { getTranslations } from 'next-intl/server';
import { AVAILABILITY_PERIODS, type AvailabilityPeriod } from '@mazare3/shared';
import { fetchPropertyBySlug } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { ErrorState } from '@/components/marketplace/error-state';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { BookingConfigurationClient } from '@/components/marketplace/booking-configuration-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(raw: Record<string, string | string[] | undefined>, key: string) {
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

export default async function PropertyBookPage({ params, searchParams }: Props) {
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
    const { property } = await fetchPropertyBySlug(slug);
    return (
      <MarketplacePageShell className="py-4 sm:py-6">
        <BookingConfigurationClient
          property={property}
          locale={locale as 'ar' | 'en'}
          initialDate={rebookId ? undefined : date}
          initialPeriod={rebookId ? undefined : period}
          initialGuests={Number.isFinite(guests) ? guests : undefined}
          rebookId={rebookId}
        />
      </MarketplacePageShell>
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
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
