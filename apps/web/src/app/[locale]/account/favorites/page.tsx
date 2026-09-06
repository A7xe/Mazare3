import { setRequestLocale } from 'next-intl/server';
import { FavoritesView } from '@/components/account/favorites-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function FavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-10">
      <FavoritesView />
    </MarketplacePageShell>
  );
}
