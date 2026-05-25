import { Suspense } from 'react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SectionHeader } from '@/components/marketplace/section-header';
import { PropertySearchResults } from '@/components/marketplace/property-search-results';
import { PropertyGridSkeleton } from '@/components/marketplace/property-grid-skeleton';
import { SearchFilters } from '@/components/marketplace/search-filters';
import { parseSearchParams } from '@/lib/search-params';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SearchPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('search');
  const raw = await searchParams;
  const filters = parseSearchParams(raw);
  const suspenseKey = JSON.stringify(filters);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <SectionHeader title={t('title')} subtitle={t('subtitle')} className="text-start" />
      <div className="mt-8 flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(280px,340px)_1fr]">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-primary-soft/30" />}>
          <SearchFilters />
        </Suspense>
        <div className="min-w-0">
          <Suspense key={suspenseKey} fallback={<PropertyGridSkeleton count={6} />}>
            <PropertySearchResults filters={filters} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
