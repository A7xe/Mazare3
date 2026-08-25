import { MapPin } from 'lucide-react';
import type { PublicPropertySummary } from '@mazare3/shared';
import { ExplorePropertyCard } from './explore-property-card';

type Props = {
  title: string;
  properties: PublicPropertySummary[];
};

export function ExploreNearRail({ title, properties }: Props) {
  if (!properties.length) return null;

  return (
    <section data-testid="explore-near-rail">
      <div className="mb-3">
        <h2 className="flex items-center gap-2 text-[18px] font-bold text-[#0D2046] sm:text-[20px]">
          <MapPin className="h-5 w-5 text-[#2F6EF6]" aria-hidden />
          {title}
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {properties.slice(0, 3).map((property) => (
          <ExplorePropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
  );
}
