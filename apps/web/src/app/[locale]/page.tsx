import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchProperties } from '@/lib/api-properties';
import { Link } from '@/i18n/navigation';
import { HeroSection } from '@/components/marketplace/hero-section';
import { SectionHeader } from '@/components/marketplace/section-header';
import { PropertyCard } from '@/components/marketplace/property-card';
import { Button } from '@/components/ui/button';
import { Search, Shield, TrendingUp } from 'lucide-react';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');
  let featured: Awaited<ReturnType<typeof fetchProperties>> = [];
  try {
    const all = await fetchProperties();
    featured = all.slice(0, 3);
  } catch {
    featured = [];
  }

  const steps = [
    { title: t('howStep1'), desc: t('howStep1Desc'), icon: Search },
    { title: t('howStep2'), desc: t('howStep2Desc'), icon: Shield },
    { title: t('howStep3'), desc: t('howStep3Desc'), icon: TrendingUp },
  ];

  return (
    <>
      <HeroSection />

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionHeader title={t('featuredTitle')} subtitle={t('featuredSubtitle')} />
        {featured.length > 0 ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <p className="mt-10 text-center text-sm text-muted">{t('featuredEmpty')}</p>
        )}
        <div className="mt-10 text-center">
          <Button variant="secondary" size="lg" asChild>
            <Link href="/search">{tCommon('explore')}</Link>
          </Button>
        </div>
      </section>

      <section className="border-y border-primary/8 bg-primary-soft/40 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeader title={t('howTitle')} />
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {steps.map(({ title, desc, icon: Icon }) => (
              <div
                key={title}
                className="glass-surface rounded-3xl p-8 text-center transition-shadow hover:shadow-soft"
              >
                <div className="gradient-primary mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl text-primary-foreground shadow-soft">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-navy">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="gradient-premium overflow-hidden rounded-3xl p-8 text-primary-foreground sm:p-12">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold sm:text-3xl">{t('ownerCtaTitle')}</h2>
            <p className="mt-4 text-primary-foreground/80">{t('ownerCtaDesc')}</p>
            <Button className="mt-6 shadow-premium" variant="royal" size="lg" asChild>
              <Link href="/become-owner">{tCommon('listProperty')}</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
