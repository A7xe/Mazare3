import { Suspense } from 'react';
import { OwnerPayoutSetupView } from '@/components/owner/owner-payout-setup-view';

export default function OwnerPayoutSetupPage() {
  return (
    <Suspense fallback={null}>
      <OwnerPayoutSetupView />
    </Suspense>
  );
}
