import type {
  PublicAvailabilitySlot,
  PublicPropertyDetail,
  PublicPropertySummary,
  PropertySearchQuery,
} from '@mazare3/shared';
import { apiFetch, getApiBaseUrl } from './api';

export type PropertySearchParams = Partial<{
  q: string;
  area: string;
  minPrice: number;
  maxPrice: number;
  guests: number;
  propertyType: PropertySearchQuery['propertyType'];
  amenities: string[];
  hasPool: boolean;
  verifiedOnly: boolean;
  sort: PropertySearchQuery['sort'];
}>;

function buildQueryString(params: PropertySearchParams): string {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.area) sp.set('area', params.area);
  if (params.minPrice != null) sp.set('minPrice', String(params.minPrice));
  if (params.maxPrice != null) sp.set('maxPrice', String(params.maxPrice));
  if (params.guests != null) sp.set('guests', String(params.guests));
  if (params.propertyType) sp.set('propertyType', params.propertyType);
  if (params.amenities?.length) sp.set('amenities', params.amenities.join(','));
  if (params.hasPool === true) sp.set('hasPool', 'true');
  if (params.hasPool === false) sp.set('hasPool', 'false');
  if (params.verifiedOnly) sp.set('verifiedOnly', 'true');
  if (params.sort) sp.set('sort', params.sort);
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

export async function fetchProperties(
  params: PropertySearchParams = {},
): Promise<PublicPropertySummary[]> {
  const res = await apiFetch<{ data: PublicPropertySummary[] }>(
    `/properties${buildQueryString(params)}`,
    { next: { revalidate: 30 } },
  );
  return res.data;
}

export async function fetchPropertyBySlug(slug: string): Promise<{
  property: PublicPropertyDetail;
  similar: PublicPropertySummary[];
}> {
  const res = await apiFetch<{
    data: PublicPropertyDetail;
    similar: PublicPropertySummary[];
  }>(`/properties/${slug}`, { next: { revalidate: 30 } });
  return { property: res.data, similar: res.similar ?? [] };
}

/** Client-safe availability fetch (browser → API origin). */
export async function fetchPropertyAvailability(
  slug: string,
  from: string,
  to: string,
): Promise<PublicAvailabilitySlot[]> {
  const sp = new URLSearchParams({ from, to });
  const res = await fetch(`${getApiBaseUrl()}/properties/${slug}/availability?${sp}`, {
    cache: 'no-store',
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? 'Failed to load availability');
  }
  return (body as { data: PublicAvailabilitySlot[] }).data;
}
