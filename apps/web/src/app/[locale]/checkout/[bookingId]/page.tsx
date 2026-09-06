import { setRequestLocale } from 'next-intl/server';
import { CheckoutView } from '@/components/checkout/checkout-view';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export default async function CheckoutPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  return (
    <MarketplacePageShell className="py-8">
      <CheckoutView bookingId={bookingId} />
    </MarketplacePageShell>
  );
}
