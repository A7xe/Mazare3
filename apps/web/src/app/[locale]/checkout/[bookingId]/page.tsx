import { setRequestLocale } from 'next-intl/server';
import { CheckoutView } from '@/components/checkout/checkout-view';

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export default async function CheckoutPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <CheckoutView bookingId={bookingId} />
    </div>
  );
}
