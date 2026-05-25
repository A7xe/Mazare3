import { Card } from '@/components/ui/card';

export function PropertyGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="overflow-hidden border-border p-0">
          <div className="aspect-[4/3] animate-pulse bg-primary-soft" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-3/4 animate-pulse rounded-lg bg-primary-soft" />
            <div className="h-4 w-1/2 animate-pulse rounded-lg bg-border" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-border" />
          </div>
        </Card>
      ))}
    </div>
  );
}
