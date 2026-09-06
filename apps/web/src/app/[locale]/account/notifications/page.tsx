import { setRequestLocale } from 'next-intl/server';
import { NotificationsView } from '@/components/account/notifications-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-10">
      <div className="mx-auto w-full max-w-2xl">
        <NotificationsView />
      </div>
    </MarketplacePageShell>
  );
}
