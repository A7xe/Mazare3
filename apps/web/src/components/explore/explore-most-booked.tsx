import type { PublicPropertySummary } from '@mazare3/shared';
import { ExplorePropertyCard } from './explore-property-card';

type Props = {
  title: string;
  properties: PublicPropertySummary[];
};

export function ExploreMostBooked({ title, properties }: Props) {
  if (!properties.length) return null;

  return (
    <section data-testid="explore-most-booked" className="min-w-0">
      <div className="mb-3">
        <h2 className="text-[18px] font-bold text-[#0D2046] sm:text-[20px]">{title}</h2>
      </div>

      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
        {properties.slice(0, 3).map((property) => (
          <ExplorePropertyCard key={property.id} property={property} compact />
        ))}
      </div>
    </section>
  );
}
