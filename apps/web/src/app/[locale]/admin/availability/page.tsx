import { Suspense } from 'react';
import { AdminAvailabilityView } from '@/components/admin/admin-availability-view';

export default function AdminAvailabilityPage() {
  return (
    <Suspense fallback={null}>
      <AdminAvailabilityView />
    </Suspense>
  );
}
