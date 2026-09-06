import { PropertyGridSkeleton } from '@/components/marketplace/property-grid-skeleton';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

export default function PropertyLoading() {
  return (
    <MarketplacePageShell className="py-8">
      <div className="mb-6 h-5 w-24 animate-pulse rounded bg-border/50" />
      <div className="aspect-video animate-pulse rounded-2xl bg-border/50" />
      <div className="mt-8 space-y-4">
        <div className="h-8 w-2/3 animate-pulse rounded-xl bg-border/50" />
        <div className="h-4 w-1/2 animate-pulse rounded-lg bg-border/40" />
      </div>
      <div className="mt-12">
        <PropertyGridSkeleton count={2} />
      </div>
    </MarketplacePageShell>
  );
}
