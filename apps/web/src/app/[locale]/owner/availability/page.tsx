import { Suspense } from 'react';
import { OwnerAvailabilityView } from '@/components/owner/owner-availability-view';
import { Loader2 } from 'lucide-react';

export default function OwnerAvailabilityPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <OwnerAvailabilityView />
    </Suspense>
  );
}
