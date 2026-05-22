import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

export default async function PropertyNotFound() {
  const t = await getTranslations('common');

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-semibold">{t('noResults')}</h1>
      <Button className="mt-6" asChild>
        <Link href="/search">{t('explore')}</Link>
      </Button>
    </div>
  );
}
