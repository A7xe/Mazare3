import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

export default async function PropertyNotFound() {
  const t = await getTranslations('common');

  return (
    <MarketplacePageShell className="flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-semibold">{t('noResults')}</h1>
        <Button className="mt-6" asChild>
          <Link href="/search">{t('explore')}</Link>
        </Button>
      </div>
    </MarketplacePageShell>
  );
}
