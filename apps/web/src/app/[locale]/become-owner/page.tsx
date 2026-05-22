import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

type Props = { params: Promise<{ locale: string }> };

export default async function BecomeOwnerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');
  const tCommon = await getTranslations('common');

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-bold">{t('ownerCtaTitle')}</h1>
      <p className="mt-4 text-lg text-muted">{t('ownerCtaDesc')}</p>
      <p className="mt-6 text-sm text-muted">{tCommon('comingSoon')} — Phase 6</p>
      <Button className="mt-8" asChild>
        <Link href="/signup">{tCommon('signup')}</Link>
      </Button>
    </div>
  );
}
