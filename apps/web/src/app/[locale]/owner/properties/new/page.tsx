'use client';

import { Suspense } from 'react';
import { AddFarmWizard } from '@/components/owner/add-farm-onboarding/add-farm-wizard';

export default function OwnerNewPropertyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-[#53637A]">
          …
        </div>
      }
    >
      <AddFarmWizard />
    </Suspense>
  );
}
