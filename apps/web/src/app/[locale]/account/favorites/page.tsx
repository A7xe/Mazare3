import { setRequestLocale } from 'next-intl/server';
import { FavoritesView } from '@/components/account/favorites-view';

type Props = { params: Promise<{ locale: string }> };

export default async function FavoritesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <FavoritesView />
    </div>
  );
}
