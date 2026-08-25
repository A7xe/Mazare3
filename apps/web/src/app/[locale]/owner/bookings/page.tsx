import { Suspense } from 'react';
import { OwnerBookingsView } from '@/components/owner/owner-bookings-view';

export default function OwnerBookingsPage() {
  return (
    <Suspense fallback={null}>
      <OwnerBookingsView />
    </Suspense>
  );
}
