import { setRequestLocale } from 'next-intl/server';
import { MyBookingsView } from '@/components/account/my-bookings-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function MyBookingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8 sm:py-10">
      <div className="px-4 sm:px-5 lg:px-6">
        <MyBookingsView />
      </div>
    </MarketplacePageShell>
  );
}
