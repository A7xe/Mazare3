import { PropertyGridSkeleton } from '@/components/marketplace/property-grid-skeleton';
import { MarketplacePageShell } from '@/components/layout/marketplace-page-shell';

export default function SearchLoading() {
  return (
    <MarketplacePageShell className="py-10">
      <div className="h-10 w-64 animate-pulse rounded-xl bg-border/50" />
      <div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded-lg bg-border/40" />
      <div className="mt-10">
        <PropertyGridSkeleton count={6} />
      </div>
    </MarketplacePageShell>
  );
}
