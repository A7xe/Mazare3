import type { MarketplaceDiscoveryResponse } from '@mazare3/shared';
import { JORDAN_CITIES, searchHref } from '@mazare3/shared';
import type { HomeCityDestination } from '@/components/home/home-city-destinations';

export type HomeCityDestinationItem = Omit<HomeCityDestination, 'countLabel'>;

const FEATURED_CITY_KEYS = ['amman', 'dead_sea', 'jerash', 'ajloun', 'madaba', 'salt'] as const;

/** Modern city-skyline photography (Dubai-style urban aesthetic for the carousel). */
const CITY_DESTINATION_IMAGES: Record<(typeof FEATURED_CITY_KEYS)[number], string> = {
  amman:
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=900&q=85',
  dead_sea:
    'https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=900&q=85',
  jerash:
    'https://images.unsplash.com/photo-1496568816309-51d7c20e3b21?auto=format&fit=crop&w=900&q=85',
  ajloun:
    'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=900&q=85',
  madaba:
    'https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=900&q=85',
  salt:
    'https://images.unsplash.com/photo-1546412414-e1885259563a?auto=format&fit=crop&w=900&q=85',
};

function propertyCountsByCity(discovery: MarketplaceDiscoveryResponse | null): Map<string, number> {
  const counts = new Map<string, number>();
  for (const [city, count] of Object.entries(discovery?.cityPropertyCounts ?? {})) {
    if (count > 0) counts.set(city, count);
  }
  return counts;
}

export function buildHomeCityDestinations(
  discovery: MarketplaceDiscoveryResponse | null,
  locale: 'ar' | 'en',
  taglines: Record<string, string>,
): HomeCityDestinationItem[] {
  const counts = propertyCountsByCity(discovery);

  return FEATURED_CITY_KEYS.flatMap((key) => {
    const meta = JORDAN_CITIES.find((city) => city.key === key);
    if (!meta) return [];

    const imageUrl = CITY_DESTINATION_IMAGES[key];

    return [
      {
        key,
        label: locale === 'ar' ? meta.labelAr : meta.labelEn,
        tagline: taglines[key] ?? '',
        count: counts.get(key) ?? 0,
        imageUrl,
        fallbackImageUrl: imageUrl,
        href: searchHref('/search', { city: key }),
      },
    ];
  });
}
