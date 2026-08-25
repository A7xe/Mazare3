import { Suspense } from 'react';
import { setRequestLocale } from 'next-intl/server';
import { CheckoutReturnView } from '@/components/checkout/checkout-return-view';

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
};

export default async function CheckoutReturnPage({ params }: Props) {
  const { locale, bookingId } = await params;
  setRequestLocale(locale);
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-muted">…</div>}>
      <CheckoutReturnView bookingId={bookingId} />
    </Suspense>
  );
}
