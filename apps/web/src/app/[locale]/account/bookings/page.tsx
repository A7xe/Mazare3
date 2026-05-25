import { setRequestLocale } from 'next-intl/server';
import { MyBookingsView } from '@/components/account/my-bookings-view';

type Props = { params: Promise<{ locale: string }> };

export default async function MyBookingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <MyBookingsView />
    </div>
  );
}
