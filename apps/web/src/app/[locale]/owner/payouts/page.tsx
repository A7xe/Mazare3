import { Suspense } from 'react';
import { OwnerPayoutsView } from '@/components/owner/owner-payouts-view';

export default function OwnerPayoutsPage() {
  return (
    <Suspense fallback={null}>
      <OwnerPayoutsView />
    </Suspense>
  );
}
