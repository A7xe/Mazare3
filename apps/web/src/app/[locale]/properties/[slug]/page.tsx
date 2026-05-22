import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { fetchPropertyBySlug } from '@/lib/api-properties';
import { ApiError } from '@/lib/api';
import { PropertyDetailView } from '@/components/marketplace/property-detail-view';
import { ErrorState } from '@/components/marketplace/error-state';
import { getTranslations } from 'next-intl/server';

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function PropertyDetailPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('property');

  try {
    const { property, similar } = await fetchPropertyBySlug(slug);
    return <PropertyDetailView property={property} similar={similar} locale={locale as 'ar' | 'en'} />;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      notFound();
    }

    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <ErrorState
          title={t('errorTitle')}
          description={err instanceof ApiError ? err.message : t('errorGeneric')}
        />
      </div>
    );
  }
}
