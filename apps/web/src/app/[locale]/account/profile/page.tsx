import { setRequestLocale } from 'next-intl/server';
import { AccountProfileView } from '@/components/account/account-profile-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8 sm:py-10">
      <div className="px-4 sm:px-5 lg:px-6">
        <AccountProfileView />
      </div>
    </MarketplacePageShell>
  );
}
