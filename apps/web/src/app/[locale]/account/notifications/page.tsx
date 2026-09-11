import { setRequestLocale } from 'next-intl/server';
import { NotificationsView } from '@/components/account/notifications-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8 sm:py-10">
      <div className="px-4 sm:px-5 lg:px-6">
        <NotificationsView />
      </div>
    </MarketplacePageShell>
  );
}
