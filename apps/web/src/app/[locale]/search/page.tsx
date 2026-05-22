import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionHeader } from '@/components/marketplace/section-header';
import { PropertySearchResults } from '@/components/marketplace/property-search-results';
import { PropertyGridSkeleton } from '@/components/marketplace/property-grid-skeleton';

type Props = { params: Promise<{ locale: string }> };

export default async function SearchPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} className="text-start" />
      <Suspense fallback={<PropertyGridSkeleton count={6} />}>
        <PropertySearchResults />
      </Suspense>
    </div>
  );
}
