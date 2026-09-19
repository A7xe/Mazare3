import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { AccountLegalAcceptView } from '@/components/account/account-legal-accept-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountLegalAcceptPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8 sm:py-10">
      <div className="px-4 sm:px-5 lg:px-6">
        <Suspense fallback={null}>
          <AccountLegalAcceptView />
        </Suspense>
      </div>
    </MarketplacePageShell>
  );
}
