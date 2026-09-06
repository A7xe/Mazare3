import { setRequestLocale } from 'next-intl/server';
import { MySupportView } from '@/components/account/my-support-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-10">
      <MySupportView />
    </MarketplacePageShell>
  );
}
