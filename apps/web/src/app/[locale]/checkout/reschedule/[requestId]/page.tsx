import { setRequestLocale } from 'next-intl/server';
import { RescheduleCheckoutView } from '@/components/checkout/reschedule-checkout-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string; requestId: string }> };

export default async function RescheduleCheckoutPage({ params }: Props) {
  const { locale, requestId } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8">
      <RescheduleCheckoutView requestId={requestId} />
    </MarketplacePageShell>
  );
}
