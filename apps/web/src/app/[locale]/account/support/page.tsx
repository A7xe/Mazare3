import { setRequestLocale } from 'next-intl/server';
import { HelpCenterView } from '@/components/account/help-center-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';
import { getSiteIdentity } from '@/lib/legal/site-identity';

type Props = { params: Promise<{ locale: string }> };

export default async function AccountSupportPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const identity = getSiteIdentity();
  return (
    <MarketplacePageShell className="py-8 sm:py-10">
      <div className="px-4 sm:px-5 lg:px-6">
        <HelpCenterView
          supportEmail={identity.supportEmail}
          supportPhone={identity.supportPhone}
        />
      </div>
    </MarketplacePageShell>
  );
}
