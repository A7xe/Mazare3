import { setRequestLocale } from 'next-intl/server';
import { NotificationsView } from '@/components/account/notifications-view';

type Props = { params: Promise<{ locale: string }> };

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <NotificationsView />
    </div>
  );
}
